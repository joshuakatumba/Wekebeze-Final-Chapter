import React, { useEffect, useState } from "react";
import { Bot, BookOpen, ArrowRight } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";
import { api } from "../api/client";
import { ENDPOINTS } from "../api/endpoints";
import { PageHead, Stat, Card, Badge, Button } from "../components/ui";

export default function DashboardPage({ onNavigate }) {
  const { user } = useAuth();
  const { lang, t } = useI18n();
  const [stats, setStats] = useState({ attempts: 0, conversations: 0, centers: 0 });
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    Promise.all([
      api.get(ENDPOINTS.myQuizAttempts).catch(() => []),
      api.get(ENDPOINTS.aiConversations).catch(() => []),
      api.get(ENDPOINTS.screeningCenters).catch(() => []),
      api.get(`${ENDPOINTS.awarenessCategories}?language=${lang}`).catch(() => []),
    ]).then(([attempts, convs, centers, cats]) => {
      setStats({
        attempts: Array.isArray(attempts) ? attempts.length : 0,
        conversations: Array.isArray(convs) ? convs.length : 0,
        centers: Array.isArray(centers) ? centers.length : 0,
      });
      setCategories(Array.isArray(cats) ? cats : []);
    });
  }, [lang]);

  return (
    <div className="stack" style={{ gap: 26 }}>
      <PageHead
        title={`Welcome, ${user.name}`}
        action={
          <Button variant="primary" size="sm" onClick={() => onNavigate?.("ai_chat")}>
            <Bot size={15} /> {t("awareness.ask_ai")}
          </Button>
        }
      />

      <div className="stats-grid">
        <Stat label="AI Chats" value={stats.conversations} />
        <Stat label="Quizzes" value={stats.attempts} />
        <Stat label="Centers" value={stats.centers} />
      </div>

      <div className="grid g2">
        {categories.map((cat) => (
          <Card key={cat.id} style={{ padding: 22, display: "flex", flexDirection: "column", gap: 14 }}>
            <Badge tone={cat.cancer_type === "breast" ? "rose" : "success"}>{cat.cancer_type}</Badge>
            <h3 style={{ margin: 0, fontSize: 19 }}>{cat.name}</h3>
            <p style={{ margin: 0, fontSize: 14, color: "var(--color-slate)", lineHeight: 1.5 }}>{cat.description}</p>
            <div className="card-actions" style={{ marginTop: "auto", paddingTop: 4 }}>
              <Button variant="primary" size="sm" onClick={() => onNavigate?.("guided_chat")}>
                {t("awareness.start_guided")} <ArrowRight size={14} />
              </Button>
              <Button variant="outline" size="sm" onClick={() => onNavigate?.("awareness")}>
                <BookOpen size={14} /> Guides
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
