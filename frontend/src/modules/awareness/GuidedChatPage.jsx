import React, { useEffect, useRef, useState } from "react";
import { Undo2, RotateCcw, Download, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../api/client";
import { ENDPOINTS } from "../../api/endpoints";
import { useI18n } from "../../context/I18nContext";
import { Button } from "../../components/ui";

export default function GuidedChatPage({ onNavigate }) {
  const { lang, t } = useI18n();
  const [cancerType, setCancerType] = useState("breast");
  const [nodes, setNodes] = useState({});
  const [startNodeId, setStartNodeId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const listRef = useRef(null);

  const loadFlow = async (ct, language) => {
    setLoading(true);
    try {
      const data = await api.get(ENDPOINTS.guidedFlow(ct, language));
      const map = data.nodes || {};
      const startId = data.start_node_id;
      setNodes(map);
      setStartNodeId(startId);
      setMessages(startId && map[startId] ? [{ from: "doctor", node: map[startId] }] : []);
    } catch {
      toast.error("Failed to load session");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadFlow(cancerType, lang); }, [cancerType, lang]);
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  const chooseOption = (opt) => {
    const nextNode = nodes[opt.next];
    const updated = [...messages, { from: "user", text: opt.text }];
    if (nextNode) {
      updated.push({ from: "doctor", node: nextNode });
      const isComplete = !nextNode.options || nextNode.options.length === 0;
      api.post(ENDPOINTS.guidedProgress, { cancer_type: cancerType, language: lang, current_node_id: nextNode.node_id, completed: isComplete }).catch(() => {});
    } else {
      updated.push({
        from: "doctor",
        node: {
          node_id: "end",
          text: lang === "lg" ? "Webale kumaliriza okusoma!" : "Session complete! Ready for a quick quiz?",
          options: [],
        },
      });
      api.post(ENDPOINTS.guidedProgress, { cancer_type: cancerType, language: lang, current_node_id: opt.next || "completed", completed: true }).catch(() => {});
    }
    setMessages(updated);
  };

  const goBack = () => {
    if (messages.length > 1) setMessages((prev) => prev.slice(0, -2));
  };

  const restart = () => {
    if (startNodeId && nodes[startNodeId]) setMessages([{ from: "doctor", node: nodes[startNodeId] }]);
  };

  const exportChat = () => {
    const link = document.createElement("a");
    link.href = "data:application/json;charset=utf-8," + encodeURIComponent(JSON.stringify(messages, null, 2));
    link.download = `wekebeze-${cancerType}-${lang}.json`;
    link.click();
  };

  const lastDoctor = [...messages].reverse().find((m) => m.from === "doctor");
  const isFinished = !loading && messages.length > 0 && (!lastDoctor?.node?.options || lastDoctor.node.options.length === 0);

  return (
    <div className="chat-sticky-wrap">
      <div className="chat-sticky-head">
        <div className="chip-row">
          {[
            ["breast", t("awareness.breast")],
            ["cervical", t("awareness.cervical")],
            ["prostate", "Prostate"],
          ].map(([key, label]) => (
            <Button key={key} size="sm" variant={cancerType === key ? "primary" : "outline"} onClick={() => setCancerType(key)}>
              {label}
            </Button>
          ))}
        </div>
        <div className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
          <button type="button" className="btn btn-outline" onClick={goBack} disabled={messages.length <= 1} aria-label="Undo" title="Undo" style={{ width: 32, height: 32, minHeight: 32, padding: 0 }}>
            <Undo2 size={14} />
          </button>
          <button type="button" className="btn btn-outline" onClick={restart} aria-label="Restart" title="Restart" style={{ width: 32, height: 32, minHeight: 32, padding: 0 }}>
            <RotateCcw size={14} />
          </button>
          <button type="button" className="btn btn-outline" onClick={exportChat} aria-label="Export" title="Export" style={{ width: 32, height: 32, minHeight: 32, padding: 0 }}>
            <Download size={14} />
          </button>
        </div>
      </div>

      <div ref={listRef} className="chat-sticky-body">
        {loading ? (
          <div className="skeleton" style={{ height: 100 }} />
        ) : (
          messages.map((m, idx) => {
            if (m.from === "user") {
              return (
                <div key={idx} style={{ alignSelf: "flex-end", maxWidth: "80%", background: "var(--color-lime-voltage)", color: "#fff", padding: "10px 14px", borderRadius: "18px 18px 4px 18px", fontSize: 14 }}>
                  {m.text}
                </div>
              );
            }
            const isLatest = idx === messages.length - 1;
            return (
              <div key={idx} style={{ display: "flex", gap: 10, alignItems: "flex-start", maxWidth: "88%" }}>
                <img src="/images/doctor-avatar.svg" alt="Doctor" style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0 }} />
                <div style={{ background: "#ffffff", padding: 14, borderRadius: "4px 18px 18px 18px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{m.node?.text}</div>
                  {m.node?.image && (
                    <img src={`/images/${m.node.image}`} alt="" style={{ maxWidth: 260, borderRadius: 10 }} onError={(e) => { e.currentTarget.style.display = "none"; }} />
                  )}
                  {isLatest && (m.node?.options || []).length > 0 && (
                    <div className="row" style={{ gap: 8, marginTop: 2 }}>
                      {m.node.options.map((opt, oi) => (
                        <Button key={oi} variant="outline" size="sm" onClick={() => chooseOption(opt)}>{opt.text}</Button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}

        {isFinished && (
          <div className="between" style={{ padding: 14, borderRadius: 14, background: "var(--color-teal-soft)" }}>
            <div className="row" style={{ gap: 8 }}>
              <CheckCircle2 size={18} color="#0d9488" />
              <span style={{ fontSize: 14 }}>Done! Take a quick quiz?</span>
            </div>
            <Button variant="teal" size="sm" onClick={() => onNavigate?.("quizzes")}>Quiz</Button>
          </div>
        )}
      </div>
    </div>
  );
}
