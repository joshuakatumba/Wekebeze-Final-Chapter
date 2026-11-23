import React, { useEffect, useRef, useState } from "react";
import { ArrowLeft, RotateCcw, Download, CheckCircle2, Info } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../api/client";
import { ENDPOINTS } from "../../api/endpoints";
import { useI18n } from "../../context/I18nContext";
import { PageHead, Card, Button, Badge } from "../../components/ui";

export default function GuidedChatPage({ onNavigate }) {
  const { lang, t } = useI18n();
  const [cancerType, setCancerType] = useState("breast");
  const [nodes, setNodes] = useState({});
  const [startNodeId, setStartNodeId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [historyIds, setHistoryIds] = useState([]);
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
      if (startId && map[startId]) {
        setMessages([{ from: "doctor", node: map[startId] }]);
        setHistoryIds([startId]);
      } else {
        setMessages([]);
        setHistoryIds([]);
      }
    } catch {
      toast.error("Failed to load guided session");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFlow(cancerType, lang);
  }, [cancerType, lang]);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  const chooseOption = (opt) => {
    const nextNode = nodes[opt.next];
    const updated = [...messages, { from: "user", text: opt.text }];
    if (nextNode) {
      updated.push({ from: "doctor", node: nextNode });
      setHistoryIds((prev) => [...prev, nextNode.node_id]);
      const isComplete = !nextNode.options || nextNode.options.length === 0;
      api.post(ENDPOINTS.guidedProgress, {
        cancer_type: cancerType,
        language: lang,
        current_node_id: nextNode.node_id,
        completed: isComplete,
      }).catch(() => {});
    } else {
      updated.push({
        from: "doctor",
        node: {
          node_id: "end",
          text: lang === "lg"
            ? "Webale kumaliriza okusoma kuno! Oyinza okukola ebibuuzo oba okunoonya ebifo by'okwekebeza."
            : "Thank you for completing this guided awareness session! You can now test your knowledge with a quiz or find a screening center.",
          options: [],
        },
      });
      api.post(ENDPOINTS.guidedProgress, {
        cancer_type: cancerType,
        language: lang,
        current_node_id: opt.next || "completed",
        completed: true,
      }).catch(() => {});
    }
    setMessages(updated);
  };

  const goBack = () => {
    if (messages.length <= 1) return;
    setMessages((prev) => prev.slice(0, -2));
    setHistoryIds((prev) => prev.slice(0, -1));
  };

  const restart = () => {
    if (startNodeId && nodes[startNodeId]) {
      setMessages([{ from: "doctor", node: nodes[startNodeId] }]);
      setHistoryIds([startNodeId]);
    }
  };

  const exportChat = () => {
    const dataUri = "data:application/json;charset=utf-8," + encodeURIComponent(JSON.stringify(messages, null, 2));
    const link = document.createElement("a");
    link.href = dataUri;
    link.download = `wekebeze-guided-${cancerType}-${lang}.json`;
    link.click();
  };

  const lastDoctor = [...messages].reverse().find((m) => m.from === "doctor");
  const isFinished = !loading && messages.length > 0 && (!lastDoctor?.node?.options || lastDoctor.node.options.length === 0);

  return (
    <div className="stack" style={{ gap: 16 }}>
      <PageHead
        title={t("guided.title")}
        action={
          <div className="chip-row">
            {[
              ["breast", t("awareness.breast")],
              ["cervical", t("awareness.cervical")],
              ["prostate", "Prostate"],
            ].map(([key, label]) => (
              <Button
                key={key}
                size="sm"
                variant={cancerType === key ? "primary" : "outline"}
                onClick={() => setCancerType(key)}
              >
                {label}
              </Button>
            ))}
          </div>
        }
      />

      <Card style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column", height: "calc(100vh - 230px)", minHeight: 460 }}>
        <div
          ref={listRef}
          style={{ flex: 1, overflowY: "auto", padding: 18, display: "flex", flexDirection: "column", gap: 14, background: "var(--color-paper)" }}
        >
          {loading ? (
            <div className="skeleton" style={{ height: 120 }} />
          ) : (
            messages.map((m, idx) => {
              if (m.from === "user") {
                return (
                  <div key={idx} style={{ alignSelf: "flex-end", maxWidth: "78%", background: "var(--color-lime-voltage)", color: "#fff", padding: "10px 14px", borderRadius: "16px 16px 4px 16px", fontSize: 14, fontWeight: 500 }}>
                    {m.text}
                  </div>
                );
              }
              const isLatest = idx === messages.length - 1;
              return (
                <div key={idx} style={{ display: "flex", gap: 10, alignItems: "flex-start", maxWidth: "86%" }}>
                  <img
                    src="/images/doctor-avatar.svg"
                    alt="Doctor"
                    style={{ width: 34, height: 34, borderRadius: "50%", border: "1px solid var(--border-subtle)", flexShrink: 0 }}
                  />
                  <div style={{ background: "var(--surface-card)", border: "1px solid var(--border-subtle)", padding: 14, borderRadius: "4px 16px 16px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{m.node?.text}</div>
                    {m.node?.image && (
                      <img
                        src={`/images/${m.node.image}`}
                        alt="Infographic"
                        style={{ maxWidth: 280, borderRadius: 10, border: "1px solid var(--border-subtle)" }}
                        onError={(e) => { e.currentTarget.style.display = "none"; }}
                      />
                    )}
                    {isLatest && (m.node?.options || []).length > 0 && (
                      <div className="row" style={{ gap: 8, marginTop: 4 }}>
                        {m.node.options.map((opt, oi) => (
                          <Button key={oi} variant="outline" size="sm" onClick={() => chooseOption(opt)}>
                            {opt.text}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}

          {isFinished && (
            <Card style={{ background: "var(--color-teal-soft)", borderColor: "var(--color-teal)" }}>
              <div className="between" style={{ flexWrap: "wrap", gap: 10 }}>
                <div className="row">
                  <CheckCircle2 size={18} color="#0d9488" />
                  <strong style={{ fontSize: 14 }}>Guided session complete! Ready to test your knowledge?</strong>
                </div>
                <Button variant="teal" size="sm" onClick={() => onNavigate?.("quizzes")}>
                  Take Knowledge Quiz
                </Button>
              </div>
            </Card>
          )}
        </div>

        <div className="between" style={{ padding: "12px 16px", borderTop: "1px solid var(--border-subtle)", background: "var(--surface-card)", flexWrap: "wrap", gap: 8 }}>
          <div className="row" style={{ gap: 8 }}>
            <Button variant="outline" size="sm" onClick={goBack} disabled={messages.length <= 1}>
              <ArrowLeft size={14} /> {t("common.back")}
            </Button>
            <Button variant="outline" size="sm" onClick={restart}>
              <RotateCcw size={14} /> {t("guided.restart")}
            </Button>
            <Button variant="outline" size="sm" onClick={exportChat}>
              <Download size={14} /> {t("guided.export")}
            </Button>
          </div>
          <div className="row" style={{ gap: 6, fontSize: 11, color: "var(--color-pebble)" }}>
            <Info size={13} />
            <span>{t("common.disclaimer")}</span>
            <Badge>{historyIds.length} steps</Badge>
          </div>
        </div>
      </Card>
    </div>
  );
}

