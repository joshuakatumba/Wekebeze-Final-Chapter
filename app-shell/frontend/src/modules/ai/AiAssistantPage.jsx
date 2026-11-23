import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Plus, Send, Trash2, AlertTriangle, History, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../api/client";
import { ENDPOINTS } from "../../api/endpoints";
import { useI18n } from "../../context/I18nContext";
import { Badge } from "../../components/ui";

const API_URL = import.meta.env.VITE_API_URL || "/api/v1";

export default function AiAssistantPage() {
  const { lang } = useI18n();
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamDraft, setStreamDraft] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const endRef = useRef(null);

  const loadConversations = async () => {
    try {
      const list = await api.get(ENDPOINTS.aiConversations);
      const arr = Array.isArray(list) ? list : [];
      setConversations(arr);
      if (!activeId && arr.length > 0) selectConversation(arr[0].id);
    } catch {
      setConversations([]);
    }
  };

  const selectConversation = async (id) => {
    setActiveId(id);
    setHistoryOpen(false);
    try {
      const detail = await api.get(ENDPOINTS.aiConversation(id));
      setMessages(detail.messages || []);
    } catch {
      setMessages([]);
    }
  };

  useEffect(() => { loadConversations(); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, streamDraft]);

  const createConversation = async () => {
    try {
      const conv = await api.post(ENDPOINTS.aiConversations, { language: lang });
      setConversations((prev) => [conv, ...prev]);
      setActiveId(conv.id);
      setMessages([]);
      setHistoryOpen(false);
      return conv.id;
    } catch (e) {
      toast.error(e.message || "Could not start chat");
      return null;
    }
  };

  const deleteConversation = async (id, e) => {
    e.stopPropagation();
    try {
      await api.delete(ENDPOINTS.aiConversation(id));
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeId === id) { setActiveId(null); setMessages([]); }
    } catch {
      toast.error("Delete failed");
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || streaming) return;

    let convId = activeId;
    if (!convId) {
      convId = await createConversation();
      if (!convId) return;
    }

    setInput("");
    setMessages((prev) => [...prev, { id: `tmp-${Date.now()}`, role: "user", content: text }]);
    setStreaming(true);
    setStreamDraft("");

    try {
      const token = localStorage.getItem("shell_token");
      const res = await fetch(`${API_URL}${ENDPOINTS.aiMessages(convId)}?stream=1`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
          ...(token ? { Authorization: `Token ${token}` } : {}),
        },
        body: JSON.stringify({ content: text, language: lang }),
      });
      if (!res.ok) throw new Error("Request failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() || "";

        for (const evt of events) {
          const line = evt.split("\n").find((l) => l.startsWith("data: "));
          if (!line) continue;
          const payload = JSON.parse(line.slice(6));
          if (payload.type === "token") {
            accumulated += payload.content;
            setStreamDraft(accumulated);
          } else if (payload.type === "done") {
            setStreamDraft("");
            setMessages((prev) => [
              ...prev.filter((m) => !String(m.id).startsWith("tmp-")),
              payload.user_message,
              payload.assistant_message,
            ]);
            setConversations((prev) =>
              prev.map((c) => (c.id === convId ? { ...c, title: payload.conversation_title || c.title } : c))
            );
          }
        }
      }
    } catch (err) {
      toast.error(err.message || "Error contacting assistant");
      setStreamDraft("");
    } finally {
      setStreaming(false);
    }
  };

  const quickPrompts = lang === "lg"
    ? ["Obubonero bwa kookolo?", "Okwekebeza mu Uganda?"]
    : ["Early warning signs?", "Free screening in Uganda?"];

  return (
    <div className="chat-sticky-wrap">
      <div className="chat-sticky-head">
        <h1 className="page-head-title" style={{ fontSize: 18 }}>{lang === "lg" ? "Omuyambi" : "Assistant"}</h1>
        <div className="row" style={{ gap: 8, flexWrap: "nowrap" }}>
          <button type="button" className="btn btn-outline" onClick={() => setHistoryOpen(true)} aria-label="History" title="History" style={{ width: 34, height: 34, minHeight: 34, padding: 0 }}>
            <History size={15} />
          </button>
          <button type="button" className="btn btn-primary" onClick={createConversation} aria-label="New chat" title="New chat" style={{ width: 34, height: 34, minHeight: 34, padding: 0 }}>
            <Plus size={15} />
          </button>
        </div>
      </div>

      <div className="chat-sticky-body">
        {messages.length === 0 && !streamDraft ? (
          <div style={{ margin: "auto", textAlign: "center", maxWidth: 340 }}>
            <h3 style={{ margin: "0 0 14px", fontSize: 18, fontWeight: 500, color: "var(--text-secondary)" }}>
              {lang === "lg" ? "Nnyinza kukuyamba ntya?" : "How can I help?"}
            </h3>
            <div className="row" style={{ justifyContent: "center", gap: 8 }}>
              {quickPrompts.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setInput(p)}
                  style={{
                    padding: "8px 14px", borderRadius: 9999, border: "1px solid var(--border-subtle)",
                    background: "#ffffff", color: "var(--text-primary)", fontSize: 13, cursor: "pointer",
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((m) => {
              const isUser = m.role === "user";
              const isUrgent = m.metadata?.is_urgent;
              return (
                <div
                  key={m.id}
                  style={{
                    alignSelf: isUser ? "flex-end" : "flex-start",
                    maxWidth: "84%",
                    background: isUser ? "var(--color-lime-voltage)" : isUrgent ? "#fff1f2" : "#ffffff",
                    color: isUser ? "#fff" : isUrgent ? "#881337" : "var(--text-primary)",
                    padding: "11px 15px",
                    borderRadius: isUser ? "18px 18px 4px 18px" : "4px 18px 18px 18px",
                    boxShadow: isUser ? "none" : "0 1px 4px rgba(0,0,0,0.04)",
                    fontSize: 14,
                    lineHeight: 1.6,
                  }}
                >
                  {isUrgent && (
                    <div className="row" style={{ gap: 6, marginBottom: 6, color: "#e11d48", fontSize: 12 }}>
                      <AlertTriangle size={14} /> Urgent
                    </div>
                  )}
                  <div style={{ whiteSpace: "pre-wrap" }}>{m.content}</div>
                  {!isUser && Array.isArray(m.sources) && m.sources.length > 0 && (
                    <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--border-subtle)" }} className="row">
                      {m.sources.map((s, si) => <Badge key={si} tone="success">{s.title}</Badge>)}
                    </div>
                  )}
                </div>
              );
            })}
            {streamDraft && (
              <div style={{ alignSelf: "flex-start", maxWidth: "84%", background: "#ffffff", padding: "11px 15px", borderRadius: "4px 18px 18px 18px", fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                {streamDraft}
              </div>
            )}
            <div ref={endRef} />
          </>
        )}
      </div>

      <form onSubmit={sendMessage} className="chat-sticky-bar">
        <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", background: "#ffffff", borderRadius: 9999, padding: "4px 4px 4px 14px", boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={lang === "lg" ? "Buuza ekibuuzo..." : "Ask a question..."}
            disabled={streaming}
            style={{
              flex: 1, minWidth: 0, border: "none", background: "transparent",
              color: "var(--text-primary)", fontSize: 14, outline: "none", padding: "8px 0",
            }}
          />
          <button
            type="submit"
            className="btn btn-primary"
            disabled={streaming || !input.trim()}
            aria-label="Send"
            title="Send"
            style={{ width: 36, height: 36, minHeight: 36, padding: 0, flexShrink: 0 }}
          >
            <Send size={15} />
          </button>
        </div>
      </form>

      {historyOpen && createPortal(
        <div className="drawer-overlay" onClick={() => setHistoryOpen(false)}>
          <div className="drawer" onClick={(e) => e.stopPropagation()}>
            <div className="modal-h">
              <h2 style={{ margin: 0, fontSize: 16 }}>History</h2>
              <button type="button" onClick={() => setHistoryOpen(false)} aria-label="Close" style={{ background: "var(--surface-muted)", border: "none", width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--text-primary)" }}>
                <X size={16} />
              </button>
            </div>
            <div className="drawer-content">
              {conversations.length === 0 ? (
                <p style={{ fontSize: 13, color: "var(--color-slate)", margin: 0 }}>Empty</p>
              ) : (
                conversations.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => selectConversation(c.id)}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                      padding: "10px 12px", borderRadius: 10, cursor: "pointer",
                      background: activeId === c.id ? "var(--color-linen-mist)" : "var(--surface-muted)",
                      color: activeId === c.id ? "var(--color-rose-600)" : "var(--text-primary)",
                      fontSize: 13,
                    }}
                  >
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.title}</span>
                    <button type="button" onClick={(e) => deleteConversation(c.id, e)} aria-label="Delete" style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--color-pebble)" }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
