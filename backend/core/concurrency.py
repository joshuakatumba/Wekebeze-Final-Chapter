"""
Production concurrency primitives for high-traffic multi-user database access:
- distributed_mutex: Redis SET NX PX lock (with safe Lua compare-and-delete) + in-process threading.Lock fallback.
- bounded_semaphore: Redis atomic counter semaphore + in-process threading.BoundedSemaphore fallback.
"""
import threading
import time
import uuid
from contextlib import contextmanager
from django.core.cache import cache

_LOCAL_MUTEX_GUARD = threading.Lock()
_LOCAL_MUTEXES: dict[str, threading.Lock] = {}
_LOCAL_SEMAPHORES: dict[str, threading.BoundedSemaphore] = {}
_LOCAL_RW_LOCKS: dict[str, "_LocalRWLock"] = {}


class _LocalRWLock:
    """In-process Readers-Writer lock (writer-preferring to prevent writer starvation)."""

    def __init__(self):
        self._cond = threading.Condition(threading.Lock())
        self._readers = 0
        self._writers_waiting = 0
        self._writer_active = False

    def acquire_read(self, timeout: float = 8.0) -> bool:
        deadline = time.monotonic() + timeout
        with self._cond:
            while self._writer_active or self._writers_waiting > 0:
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    return False
                self._cond.wait(remaining)
            self._readers += 1
            return True

    def release_read(self):
        with self._cond:
            self._readers = max(0, self._readers - 1)
            if self._readers == 0:
                self._cond.notify_all()

    def acquire_write(self, timeout: float = 8.0) -> bool:
        deadline = time.monotonic() + timeout
        with self._cond:
            self._writers_waiting += 1
            try:
                while self._writer_active or self._readers > 0:
                    remaining = deadline - time.monotonic()
                    if remaining <= 0:
                        return False
                    self._cond.wait(remaining)
                self._writer_active = True
                return True
            finally:
                self._writers_waiting -= 1

    def release_write(self):
        with self._cond:
            self._writer_active = False
            self._cond.notify_all()


def _get_local_rw_lock(name: str) -> _LocalRWLock:
    with _LOCAL_MUTEX_GUARD:
        rw = _LOCAL_RW_LOCKS.get(name)
        if rw is None:
            rw = _LocalRWLock()
            _LOCAL_RW_LOCKS[name] = rw
        return rw

_LUA_RELEASE = """
if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
else
    return 0
end
"""


class ConcurrencyBusyError(Exception):
    """Raised when a mutex or semaphore cannot be acquired within wait_timeout."""


def _get_redis_client():
    """Return raw redis-py client if django-redis is configured, else None."""
    try:
        if hasattr(cache, "client") and hasattr(cache.client, "get_client"):
            return cache.client.get_client()
    except Exception:
        return None
    return None


def _get_local_mutex(key: str) -> threading.Lock:
    with _LOCAL_MUTEX_GUARD:
        lock = _LOCAL_MUTEXES.get(key)
        if lock is None:
            lock = threading.Lock()
            _LOCAL_MUTEXES[key] = lock
        return lock


def _get_local_semaphore(name: str, max_concurrent: int) -> threading.BoundedSemaphore:
    with _LOCAL_MUTEX_GUARD:
        sem = _LOCAL_SEMAPHORES.get(name)
        if sem is None:
            sem = threading.BoundedSemaphore(max_concurrent)
            _LOCAL_SEMAPHORES[name] = sem
        return sem


@contextmanager
def distributed_mutex(key: str, ttl_seconds: int = 15, wait_timeout: float = 8.0, poll_interval: float = 0.05):
    """
    Mutual exclusion lock across workers/processes (via Redis) or threads (local fallback).
    Prevents race conditions on concurrent writes to the same entity.
    """
    redis_client = _get_redis_client()
    if redis_client is not None:
        lock_key = f"wekebeze:mutex:{key}"
        token = str(uuid.uuid4())
        deadline = time.monotonic() + wait_timeout
        acquired = False
        while time.monotonic() < deadline:
            if redis_client.set(lock_key, token, nx=True, px=int(ttl_seconds * 1000)):
                acquired = True
                break
            time.sleep(poll_interval)
        if not acquired:
            raise ConcurrencyBusyError(f"Resource '{key}' is busy. Please retry shortly.")
        try:
            yield
        finally:
            try:
                redis_client.eval(_LUA_RELEASE, 1, lock_key, token)
            except Exception:
                pass
        return

    # In-process thread mutex fallback (SQLite / local dev / unit tests)
    lock = _get_local_mutex(key)
    acquired = lock.acquire(timeout=wait_timeout)
    if not acquired:
        raise ConcurrencyBusyError(f"Resource '{key}' is busy. Please retry shortly.")
    try:
        yield
    finally:
        lock.release()


@contextmanager
def bounded_semaphore(name: str, max_concurrent: int = 8, ttl_seconds: int = 30, wait_timeout: float = 8.0, poll_interval: float = 0.05):
    """
    Counting semaphore bounding concurrent access to heavy operations
    (AI RAG inference, document chunking/ingestion, bulk updates).
    """
    redis_client = _get_redis_client()
    if redis_client is not None:
        sem_key = f"wekebeze:sem:{name}"
        deadline = time.monotonic() + wait_timeout
        acquired = False
        while time.monotonic() < deadline:
            current = redis_client.incr(sem_key)
            if current == 1:
                redis_client.expire(sem_key, ttl_seconds)
            if current <= max_concurrent:
                acquired = True
                break
            redis_client.decr(sem_key)
            time.sleep(poll_interval)
        if not acquired:
            raise ConcurrencyBusyError(f"Service '{name}' is at capacity. Please retry shortly.")
        try:
            yield
        finally:
            try:
                val = redis_client.decr(sem_key)
                if val < 0:
                    redis_client.set(sem_key, 0, ex=ttl_seconds)
            except Exception:
                pass
        return

    # In-process bounded semaphore fallback
    sem = _get_local_semaphore(name, max_concurrent)
    acquired = sem.acquire(timeout=wait_timeout)
    if not acquired:
        raise ConcurrencyBusyError(f"Service '{name}' is at capacity. Please retry shortly.")
    try:
        yield
    finally:
        sem.release()


@contextmanager
def rw_lock(name: str, mode: str = "read", ttl_seconds: int = 20, wait_timeout: float = 8.0, poll_interval: float = 0.03):
    """
    Readers-Writer lock:
    - mode="read": allows many concurrent readers while blocking only if an exclusive writer holds the lock.
    - mode="write": acquires exclusive write access (waits for active readers to drain) so readers never see partial/torn DB writes.
    Uses Redis across Gunicorn workers when configured, with an in-process writer-preferring RWLock fallback.
    """
    redis_client = _get_redis_client()
    if redis_client is not None:
        write_key = f"wekebeze:rw:{name}:writer"
        readers_key = f"wekebeze:rw:{name}:readers"
        deadline = time.monotonic() + wait_timeout

        if mode == "read":
            while time.monotonic() < deadline:
                if not redis_client.exists(write_key):
                    cnt = redis_client.incr(readers_key)
                    if cnt == 1:
                        redis_client.expire(readers_key, ttl_seconds)
                    if not redis_client.exists(write_key):
                        break
                    redis_client.decr(readers_key)
                time.sleep(poll_interval)
            else:
                raise ConcurrencyBusyError(f"Resource '{name}' is being updated. Please retry.")
            try:
                yield
            finally:
                try:
                    if redis_client.decr(readers_key) < 0:
                        redis_client.set(readers_key, 0, ex=ttl_seconds)
                except Exception:
                    pass
            return

        # Exclusive write mode
        token = str(uuid.uuid4())
        acquired = False
        while time.monotonic() < deadline:
            if redis_client.set(write_key, token, nx=True, px=int(ttl_seconds * 1000)):
                acquired = True
                break
            time.sleep(poll_interval)
        if not acquired:
            raise ConcurrencyBusyError(f"Resource '{name}' write lock busy. Please retry.")
        try:
            # Wait for in-flight readers to drain before mutating
            while time.monotonic() < deadline:
                active_readers = int(redis_client.get(readers_key) or 0)
                if active_readers <= 0:
                    break
                time.sleep(poll_interval)
            yield
        finally:
            try:
                redis_client.eval(_LUA_RELEASE, 1, write_key, token)
            except Exception:
                pass
        return

    # Local in-process RWLock fallback
    rw = _get_local_rw_lock(name)
    if mode == "read":
        if not rw.acquire_read(timeout=wait_timeout):
            raise ConcurrencyBusyError(f"Resource '{name}' is being updated. Please retry.")
        try:
            yield
        finally:
            rw.release_read()
    else:
        if not rw.acquire_write(timeout=wait_timeout):
            raise ConcurrencyBusyError(f"Resource '{name}' write lock busy. Please retry.")
        try:
            yield
        finally:
            rw.release_write()

