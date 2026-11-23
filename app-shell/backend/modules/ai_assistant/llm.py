"""
Provider-agnostic LLM client for Wekebeze.
Supports: openai, gemini, anthropic (Claude), groq, openrouter, deepseek, ollama, and any OpenAI-compatible custom base URL.

Configure via server-only environment variables:
  LLM_PROVIDER=openai | gemini | anthropic | groq | openrouter | deepseek | ollama | custom
  LLM_API_KEY=<provider-api-key>   (optional for local ollama)
  LLM_MODEL=<model-name>
  LLM_BASE_URL=<optional-custom-endpoint>
"""
import os
import requests

PROVIDER_DEFAULTS = {
    "openai": {
        "base_url": "https://api.openai.com/v1",
        "model": "gpt-4o-mini",
    },
    "gemini": {
        "base_url": "https://generativelanguage.googleapis.com/v1beta/openai",
        "model": "gemini-2.5-flash",
    },
    "groq": {
        "base_url": "https://api.groq.com/openai/v1",
        "model": "llama-3.3-70b-versatile",
    },
    "openrouter": {
        "base_url": "https://openrouter.ai/api/v1",
        "model": "google/gemini-2.0-flash-001",
    },
    "deepseek": {
        "base_url": "https://api.deepseek.com/v1",
        "model": "deepseek-chat",
    },
    "ollama": {
        "base_url": "http://host.docker.internal:11434/v1",
        "model": "llama3.2",
    },
    "anthropic": {
        "base_url": "https://api.anthropic.com/v1/messages",
        "model": "claude-3-5-haiku-latest",
    },
    "custom": {
        "base_url": "",
        "model": "gpt-4o-mini",
    },
}


def resolve_llm_config() -> dict:
    provider = os.environ.get("LLM_PROVIDER", "").strip().lower()
    model = os.environ.get("LLM_MODEL", "").strip()
    api_key = os.environ.get("LLM_API_KEY", "").strip()
    base_url = os.environ.get("LLM_BASE_URL", "").strip()

    # Auto-detect provider if LLM_PROVIDER is not explicitly set
    if not provider:
        lower_model = model.lower()
        if lower_model.startswith("gemini"):
            provider = "gemini"
        elif lower_model.startswith("claude"):
            provider = "anthropic"
        elif lower_model.startswith("deepseek"):
            provider = "deepseek"
        elif base_url and "11434" in base_url:
            provider = "ollama"
        elif base_url:
            provider = "custom"
        else:
            provider = "openai"

    defaults = PROVIDER_DEFAULTS.get(provider, PROVIDER_DEFAULTS["custom"])
    return {
        "provider": provider,
        "model": model or defaults["model"],
        "api_key": api_key,
        "base_url": (base_url or defaults["base_url"]).rstrip("/"),
    }


def _call_anthropic(cfg: dict, system_prompt: str, messages: list[dict], timeout: int = 30) -> str | None:
    if not cfg["api_key"]:
        return None
    url = cfg["base_url"] or PROVIDER_DEFAULTS["anthropic"]["base_url"]
    if not url.endswith("/messages"):
        url = f"{url}/messages"
    payload = {
        "model": cfg["model"],
        "max_tokens": 1024,
        "temperature": 0.2,
        "system": system_prompt,
        "messages": [{"role": m["role"], "content": m["content"]} for m in messages if m["role"] in ("user", "assistant")],
    }
    resp = requests.post(
        url,
        headers={
            "x-api-key": cfg["api_key"],
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
        json=payload,
        timeout=timeout,
    )
    resp.raise_for_status()
    data = resp.json()
    blocks = data.get("content") or []
    return "\n".join(b.get("text", "") for b in blocks if b.get("type") == "text").strip() or None


def _call_openai_compatible(cfg: dict, system_prompt: str, messages: list[dict], timeout: int = 30) -> str | None:
    # Local Ollama does not require an API key; cloud providers do
    if cfg["provider"] != "ollama" and not cfg["api_key"]:
        return None
    if not cfg["base_url"]:
        return None

    # Use LangChain ChatOpenAI with custom base_url (works for OpenAI, Gemini, Groq, OpenRouter, DeepSeek, Ollama, vLLM)
    try:
        from langchain_openai import ChatOpenAI
        from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

        llm = ChatOpenAI(
            api_key=cfg["api_key"] or "ollama",
            model=cfg["model"],
            base_url=cfg["base_url"],
            temperature=0.2,
            timeout=timeout,
        )
        lc_msgs = [SystemMessage(content=system_prompt)]
        for m in messages:
            if m["role"] == "user":
                lc_msgs.append(HumanMessage(content=m["content"]))
            elif m["role"] == "assistant":
                lc_msgs.append(AIMessage(content=m["content"]))
        result = llm.invoke(lc_msgs)
        return getattr(result, "content", str(result))
    except Exception:
        # Direct HTTP fallback to /chat/completions
        url = f"{cfg['base_url']}/chat/completions"
        headers = {"Content-Type": "application/json"}
        if cfg["api_key"]:
            headers["Authorization"] = f"Bearer {cfg['api_key']}"
        payload = {
            "model": cfg["model"],
            "temperature": 0.2,
            "messages": [{"role": "system", "content": system_prompt}, *messages],
        }
        resp = requests.post(url, headers=headers, json=payload, timeout=timeout)
        resp.raise_for_status()
        choices = resp.json().get("choices") or []
        if not choices:
            return None
        return (choices[0].get("message") or {}).get("content")


def generate_llm_reply(system_prompt: str, history: list[dict], user_message: str) -> str | None:
    """Invoke whichever LLM provider is configured via environment variables."""
    cfg = resolve_llm_config()
    msgs = [
        {"role": h["role"], "content": h["content"]}
        for h in (history or [])[-6:]
        if h.get("role") in ("user", "assistant")
    ]
    msgs.append({"role": "user", "content": user_message})

    try:
        if cfg["provider"] == "anthropic":
            return _call_anthropic(cfg, system_prompt, msgs)
        return _call_openai_compatible(cfg, system_prompt, msgs)
    except Exception:
        return None
