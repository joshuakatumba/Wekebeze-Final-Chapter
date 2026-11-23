import React, { useEffect, useState } from "react";
import { BookOpen, Bot, ArrowRight } from "lucide-react";
import { api } from "../../api/client";
import { ENDPOINTS } from "../../api/endpoints";
import { useI18n } from "../../context/I18nContext";
import { PageHead, Card, Badge, Button, Modal, EmptyState } from "../../components/ui";

export default function AwarenessPage({ onNavigate }) {
  const { lang, t } = useI18n();
  const [cancerFilter, setCancerFilter] = useState("all");
  const [articles, setArticles] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ language: lang });
    if (cancerFilter !== "all") params.set("cancer_type", cancerFilter);
    api
      .get(`${ENDPOINTS.awarenessArticles}?${params.toString()}`)
      .then((data) => setArticles(Array.isArray(data) ? data : []))
      .catch(() => setArticles([]))
      .finally(() => setLoading(false));
  }, [lang, cancerFilter]);

  return (
    <div className="stack" style={{ gap: 20 }}>
      <PageHead
        title={t("awareness.title")}
        action={
          <Button variant="primary" size="sm" onClick={() => onNavigate?.("ai_chat")}>
            <Bot size={14} /> {t("awareness.ask_ai")}
          </Button>
        }
      />

      <div className="chip-row">
        {[
          ["all", "All"],
          ["breast", t("awareness.breast")],
          ["cervical", t("awareness.cervical")],
        ].map(([key, label]) => (
          <Button
            key={key}
            size="sm"
            variant={cancerFilter === key ? "primary" : "outline"}
            onClick={() => setCancerFilter(key)}
          >
            {label}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="grid g2">
          {[1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 220 }} />)}
        </div>
      ) : articles.length === 0 ? (
        <EmptyState title={t("common.empty")} />
      ) : (
        <div className="grid g2">
          {articles.map((art) => (
            <Card key={art.id} style={{ padding: 22, display: "flex", flexDirection: "column", gap: 14 }}>
              {art.image_url && (
                <img
                  src={art.image_url}
                  alt={art.title}
                  style={{ width: "100%", height: 150, objectFit: "cover", borderRadius: 10 }}
                />
              )}
              <Badge tone={art.cancer_type === "breast" ? "rose" : "success"}>
                {art.cancer_type === "breast" ? t("awareness.breast") : t("awareness.cervical")}
              </Badge>
              <h3 style={{ margin: 0, fontSize: 18 }}>{art.title}</h3>
              <div className="card-actions" style={{ marginTop: "auto" }}>
                <Button variant="outline" size="sm" onClick={() => setSelected(art)}>
                  <BookOpen size={14} /> Read <ArrowRight size={14} />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {selected && (
        <Modal
          title={selected.title}
          onClose={() => setSelected(null)}
          footer={
            <Button variant="primary" size="sm" onClick={() => { setSelected(null); onNavigate?.("ai_chat"); }}>
              <Bot size={14} /> Ask Follow-Up
            </Button>
          }
        >
          <div style={{ whiteSpace: "pre-wrap", fontSize: 15, lineHeight: 1.7, color: "var(--text-primary)" }}>
            {selected.content}
          </div>
        </Modal>
      )}
    </div>
  );
}
