import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Plus, Send, Trash2, AlertTriangle, History, X, ThumbsUp, ThumbsDown } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../api/client";
import { ENDPOINTS } from "../../api/endpoints";
import { useI18n } from "../../context/I18nContext";
import { Badge } from "../../components/ui";

const API_URL = import.meta.env.VITE_API_URL || "/api/v1";

/** Clean, XSS-safe inline Markdown renderer (**bold**, *italic*, `code`) */
function renderInline(text) {
  const tokens = [];
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let last = 0;
  let m;
  let key = 0;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) tokens.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) {
      tokens.push(<strong key={key++} style={{ fontWeight: 600, color: "var(--text-primary)" }}>{tok.slice(2, -2)}</strong>);
    } else if (tok.startsWith("*")) {
      tokens.push(<em key={key++} style={{ color: "var(--text-secondary)" }}>{tok.slice(1, -1)}</em>);
    } else if (tok.startsWith("`")) {
      tokens.push(<code key={key++} style={{ background: "var(--surface-muted)", padding: "1px 5px", borderRadius: 5, fontSize: "0.9em" }}>{tok.slice(1, -1)}</code>);
    }
    last = regex.lastIndex;
  }
  if (last < text.length) tokens.push(text.slice(last));
  return tokens;
}

/** Structured Markdown message formatter (headings, bullet/numbered lists, paragraphs, dividers) */
function FormattedMessage({ content }) {
  const lines = String(content || "").split("\n");
  const blocks = [];
  let listItems = [];
  let listType = null;

  const flushList = () => {
    if (!listItems.length) return;
    const Tag = listType === "ol" ? "ol" : "ul";
    blocks.push(
      <Tag key={`l-${blocks.length}`} style={{ margin: "6px 0 10px", paddingLeft: 20, display: "flex", flexDirection: "column", gap: 5 }}>
        {listItems.map((item, i) => (
          <li key={i} style={{ lineHeight: 1.55 }}>{renderInline(item)}</li>
        ))}
      </Tag>
    );
    listItems = [];
    listType = null;
  };

  lines.forEach((rawLine, idx) => {
    const line = rawLine.trim();
    if (!line) {
      flushList();
      return;
    }
    if (/^-{3,}$/.test(line)) {
      flushList();
      blocks.push(<hr key={`hr-${idx}`} style={{ border: "none", borderTop: "1px solid var(--border-subtle)", margin: "12px 0" }} />);
      return;
    }
    const headingMatch = line.match(/^#{1,4}\s+(.+)$/);
    if (headingMatch) {
      flushList();
      blocks.push(
        <h4 key={`h-${idx}`} style={{ margin: "12px 0 6px", fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
          {renderInline(headingMatch[1])}
        </h4>
      );
      return;
    }
    // Standalone bold line treated as a clean section heading
    if (/^\*\*[^*]+\*\*$/.test(line)) {
      flushList();
      blocks.push(
        <h4 key={`bh-${idx}`} style={{ margin: blocks.length ? "14px 0 6px" : "0 0 6px", fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
          {line.slice(2, -2)}
        </h4>
      );
      return;
    }
    const ulMatch = line.match(/^[-*•]\s+(.+)$/);
    if (ulMatch) {
      if (listType && listType !== "ul") flushList();
      listType = "ul";
      listItems.push(ulMatch[1]);
      return;
    }
    const olMatch = line.match(/^\d+\.\s+(.+)$/);
    if (olMatch) {
      if (listType && listType !== "ol") flushList();
      listType = "ol";
      listItems.push(olMatch[1]);
      return;
    }
    flushList();
    blocks.push(
      <p key={`p-${idx}`} style={{ margin: "6px 0", lineHeight: 1.62 }}>
        {renderInline(line)}
      </p>
    );
  });
  flushList();

  return <div style={{ fontSize: 14 }}>{blocks}</div>;
}

export default function AiAssistantPage() {
  const { lang } = useI18n();
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamDraft, setStreamDraft] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [ratings, setRatings] = useState({});
  const endRef = useRef(null);

  const rateMessage = async (messageId, rating) => {
    if (!activeId) return;
    setRatings((prev) => ({ ...prev, [messageId]: rating }));
    try {
      await api.post(ENDPOINTS.aiFeedback(activeId), { message_id: messageId, rating });
    } catch {
      toast.error("Could not save feedback");
    }
  };

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
          Accept: "text/event-stream, application/json, */*",
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
                    maxWidth: isUser ? "80%" : "88%",
                    background: isUser ? "var(--color-lime-voltage)" : isUrgent ? "#fff1f2" : "#ffffff",
                    color: isUser ? "#fff" : isUrgent ? "#881337" : "var(--text-primary)",
                    padding: isUser ? "10px 15px" : "14px 18px",
                    borderRadius: isUser ? "18px 18px 4px 18px" : "4px 18px 18px 18px",
                    boxShadow: isUser ? "none" : "0 1px 4px rgba(0,0,0,0.04)",
                    fontSize: 14,
                  }}
                >
                  {isUrgent && (
                    <div className="row" style={{ gap: 6, marginBottom: 8, color: "#e11d48", fontSize: 12, fontWeight: 600 }}>
                      <AlertTriangle size={14} /> Urgent Medical Guidance
                    </div>
                  )}
                  {isUser ? (
                    <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{m.content}</div>
                  ) : (
                    <FormattedMessage content={m.content} />
                  )}
                  {!isUser && Array.isArray(m.sources) && m.sources.length > 0 && (
                    <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px solid var(--border-subtle)" }} className="row">
                      {m.sources.map((s, si) => <Badge key={si} tone="success">{s.title}</Badge>)}
                    </div>
                  )}
                  {!isUser && !String(m.id).startsWith("tmp-") && (
                    <div className="row" style={{ gap: 6, marginTop: 8 }}>
                      <button
                        type="button"
                        onClick={() => rateMessage(m.id, 1)}
                        aria-label="Helpful"
                        style={{
                          background: ratings[m.id] === 1 ? "var(--color-teal-soft)" : "transparent",
                          color: ratings[m.id] === 1 ? "var(--color-teal-dark)" : "var(--color-pebble)",
                          border: "none", borderRadius: 8, padding: 4, cursor: "pointer", display: "inline-flex",
                        }}
                      >
                        <ThumbsUp size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => rateMessage(m.id, -1)}
                        aria-label="Not helpful"
                        style={{
                          background: ratings[m.id] === -1 ? "var(--color-linen-mist)" : "transparent",
                          color: ratings[m.id] === -1 ? "var(--color-rose-600)" : "var(--color-pebble)",
                          border: "none", borderRadius: 8, padding: 4, cursor: "pointer", display: "inline-flex",
                        }}
                      >
                        <ThumbsDown size={13} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            {streamDraft && (
              <div style={{ alignSelf: "flex-start", maxWidth: "88%", background: "#ffffff", padding: "14px 18px", borderRadius: "4px 18px 18px 18px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                <FormattedMessage content={streamDraft} />
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
