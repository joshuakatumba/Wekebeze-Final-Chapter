import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bot, Plus, Send, Trash2, BookOpen, AlertTriangle, History, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../api/client";
import { ENDPOINTS } from "../../api/endpoints";
import { useI18n } from "../../context/I18nContext";
import { PageHead, Card, Button, Badge } from "../../components/ui";

const API_URL = import.meta.env.VITE_API_URL || "/api/v1";

export default function AiAssistantPage() {
  const { lang, t } = useI18n();
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
      if (!activeId && arr.length > 0) {
        selectConversation(arr[0].id);
      }
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

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamDraft]);

  const createConversation = async () => {
    try {
      const conv = await api.post(ENDPOINTS.aiConversations, { language: lang });
      setConversations((prev) => [conv, ...prev]);
      setActiveId(conv.id);
      setMessages([]);
      setHistoryOpen(false);
      return conv.id;
    } catch (e) {
      toast.error(e.message || "Could not start conversation");
      return null;
    }
  };

  const deleteConversation = async (id, e) => {
    e.stopPropagation();
    try {
      await api.delete(ENDPOINTS.aiConversation(id));
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeId === id) {
        setActiveId(null);
        setMessages([]);
      }
    } catch {
      toast.error("Failed to delete conversation");
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

      if (!res.ok) throw new Error("AI assistant request failed");

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
      toast.error(err.message || "Error contacting AI assistant");
      setStreamDraft("");
    } finally {
      setStreaming(false);
    }
  };

  const starterPrompts = lang === "lg"
    ? [
        "Obubonero bwa kookolo w'amabeere bwe buli wa?",
        "Eddagala lya HPV liyamba litya?",
        "Nsobola wa okwekebeza kookolo mu Uganda?",
      ]
    : [
        "Early warning signs of breast cancer",
        "How HPV vaccination prevents cervical cancer",
        "Free screening centers in Uganda",
      ];

  return (
    <div className="stack" style={{ gap: 18 }}>
      <PageHead
        title={t("ai.title")}
        action={
          <div className="row" style={{ gap: 8 }}>
            <Button variant="outline" size="sm" onClick={() => setHistoryOpen(true)}>
              <History size={15} /> History ({conversations.length})
            </Button>
            <Button variant="primary" size="sm" onClick={createConversation}>
              <Plus size={15} /> {t("ai.new_chat")}
            </Button>
          </div>
        }
      />

      <Card style={{ padding: 0, display: "flex", flexDirection: "column", height: "calc(100vh - 210px)", minHeight: 520, overflow: "hidden" }}>
        <div style={{ flex: 1, overflowY: "auto", padding: 28, display: "flex", flexDirection: "column", gap: 18, background: "var(--color-paper)" }}>
          {messages.length === 0 && !streamDraft ? (
            <div style={{ margin: "auto", textAlign: "center", maxWidth: 460 }}>
              <div style={{ width: 52, height: 52, borderRadius: "50%", background: "var(--color-linen-mist)", color: "var(--color-rose-600)", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
                <Bot size={26} />
              </div>
              <h3 style={{ margin: "0 0 18px", fontSize: 20 }}>{t("ai.title")}</h3>
              <div className="stack" style={{ gap: 10 }}>
                {starterPrompts.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setInput(p)}
                    style={{
                      padding: "12px 16px", borderRadius: 12, border: "1px solid var(--border-subtle)",
                      background: "var(--surface-card)", color: "var(--text-primary)", fontSize: 14,
                      textAlign: "left", cursor: "pointer",
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
                      maxWidth: "80%",
                      background: isUser ? "var(--color-lime-voltage)" : isUrgent ? "#fff1f2" : "var(--surface-card)",
                      color: isUser ? "#fff" : isUrgent ? "#881337" : "var(--text-primary)",
                      border: isUser ? "none" : `1px solid ${isUrgent ? "#f43f5e" : "var(--border-subtle)"}`,
                      padding: "14px 18px",
                      borderRadius: isUser ? "18px 18px 4px 18px" : "4px 18px 18px 18px",
                      fontSize: 14,
                      lineHeight: 1.65,
                    }}
                  >
                    {isUrgent && (
                      <div className="row" style={{ gap: 6, marginBottom: 8, fontWeight: 700, color: "#e11d48", fontSize: 13 }}>
                        <AlertTriangle size={15} /> Urgent Medical Escalation
                      </div>
                    )}
                    <div style={{ whiteSpace: "pre-wrap" }}>{m.content}</div>
                    {!isUser && Array.isArray(m.sources) && m.sources.length > 0 && (
                      <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--border-subtle)" }} className="row">
                        <BookOpen size={13} color="var(--color-pebble)" />
                        {m.sources.map((s, si) => (
                          <Badge key={si} tone="success">{s.title}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              {streamDraft && (
                <div style={{ alignSelf: "flex-start", maxWidth: "80%", background: "var(--surface-card)", border: "1px solid var(--border-subtle)", padding: "14px 18px", borderRadius: "4px 18px 18px 18px", fontSize: 14, lineHeight: 1.65, whiteSpace: "pre-wrap" }}>
                  {streamDraft}
                </div>
              )}
              <div ref={endRef} />
            </>
          )}
        </div>

        <form onSubmit={sendMessage} style={{ padding: "10px 12px", borderTop: "1px solid var(--border-subtle)", background: "var(--surface-card)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t("ai.placeholder")}
              disabled={streaming}
              style={{
                flex: 1, minWidth: 0, width: "100%", padding: "9px 13px", borderRadius: 9999,
                border: "1px solid var(--border-subtle)", background: "var(--color-paper)",
                color: "var(--text-primary)", fontSize: 13, outline: "none",
              }}
            />
            <Button type="submit" variant="primary" size="sm" loading={streaming} disabled={!input.trim()}>
              <Send size={13} /> {t("ai.send")}
            </Button>
          </div>
        </form>
      </Card>

      {historyOpen && createPortal(
        <div className="drawer-overlay" onClick={() => setHistoryOpen(false)}>
          <div className="drawer" onClick={(e) => e.stopPropagation()}>
            <div className="modal-h">
              <strong style={{ fontSize: 16 }}>Saved Conversations</strong>
              <button
                type="button"
                onClick={() => setHistoryOpen(false)}
                aria-label="Close history"
                style={{ background: "var(--surface-muted)", border: "none", width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--text-primary)" }}
              >
                <X size={16} />
              </button>
            </div>
            <div className="drawer-content">
              {conversations.length === 0 ? (
                <p style={{ fontSize: 13, color: "var(--color-slate)", margin: 0 }}>No saved conversations yet.</p>
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
                      fontWeight: activeId === c.id ? 700 : 500, fontSize: 13,
                    }}
                  >
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.title}</span>
                    <button
                      type="button"
                      onClick={(e) => deleteConversation(c.id, e)}
                      aria-label="Delete"
                      style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--color-pebble)" }}
                    >
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
