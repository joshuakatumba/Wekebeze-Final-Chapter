const API_URL = import.meta.env.VITE_API_URL || (typeof window !== "undefined" ? "/api/v1" : "http://localhost:8000/api/v1");
const PUBLIC_PATHS = ["/accounts/login/", "/accounts/google/", "/accounts/register/", "/core/health/"];

let onUnauthorized = null;
let onTokenRefresh = null;
let isRefreshing = false;

export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };
export const setTokenRefreshHandler = (fn) => { onTokenRefresh = fn; };

async function request(path, options = {}, isForm = false) {
  const isPublic = PUBLIC_PATHS.some((p) => path.startsWith(p));
  const token = isPublic ? null : localStorage.getItem("shell_token");

  const headers = {
    ...(isForm ? {} : { "Content-Type": "application/json" }),
    ...(token ? { Authorization: `Token ${token}` } : {}),
    ...(options.headers || {}),
  };

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (res.status === 401) {
    const data = await res.json().catch(() => ({}));
    if (data.code === "token_expired" && onTokenRefresh && !isRefreshing) {
      isRefreshing = true;
      const ok = await onTokenRefresh();
      isRefreshing = false;
      if (ok) return request(path, options, isForm);
    }
    localStorage.removeItem("shell_token");
    localStorage.removeItem("shell_token_expires");
    onUnauthorized?.();
    throw new Error("Unauthorized");
  }

  if (res.status === 204) return {};
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || data.detail || "Request failed");
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  patch: (path, body) => request(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  delete: (path) => request(path, { method: "DELETE" }),
  upload: (path, formData) => request(path, { method: "POST", body: formData }, true),
};

