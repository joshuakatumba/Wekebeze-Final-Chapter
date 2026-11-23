import React, { useEffect, useState } from "react";
import { api } from "../../api/client";
import { ENDPOINTS } from "../../api/endpoints";
import { PageHead, Stat, Card, Badge, Button, PageSkeleton } from "../../components/ui";

export default function EducatorDashboardPage({ onNavigate }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(ENDPOINTS.educatorStats)
      .then((res) => setStats(res))
      .catch(() => setStats({}))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageSkeleton />;

  return (
    <div className="stack" style={{ gap: 20 }}>
      <PageHead
        title="Educator Workspace"
        action={<Badge tone="success">Health Educator</Badge>}
      />

      <div className="stats-grid">
        <Stat label="Articles" value={stats?.published_articles || 0} />
        <Stat label="AI Docs" value={stats?.approved_docs || 0} />
        <Stat label="Quizzes" value={stats?.quizzes || 0} />
      </div>

      <div className="grid g2">
        <Card style={{ padding: 20 }} className="stack">
          <Badge tone="rose">Curriculum</Badge>
          <h3 style={{ margin: 0, fontSize: 17 }}>Learning Content</h3>
          <p style={{ margin: 0, fontSize: 13.5, color: "var(--color-slate)" }}>
            Author and review English &amp; Luganda articles, guided nodes, and quizzes.
          </p>
          <div className="card-actions" style={{ marginTop: "auto" }}>
            <Button variant="primary" size="sm" onClick={() => onNavigate?.("content")}>
              Manage Content
            </Button>
          </div>
        </Card>

        <Card style={{ padding: 20 }} className="stack">
          <Badge tone="success">RAG Knowledge</Badge>
          <h3 style={{ margin: 0, fontSize: 17 }}>AI Medical Guidelines</h3>
          <p style={{ margin: 0, fontSize: 13.5, color: "var(--color-slate)" }}>
            Upload PDF/DOCX guidelines and approve verified sources for the AI assistant.
          </p>
          <div className="card-actions" style={{ marginTop: "auto" }}>
            <Button variant="teal" size="sm" onClick={() => onNavigate?.("knowledge")}>
              Manage AI Docs
            </Button>
            <Button variant="outline" size="sm" onClick={() => onNavigate?.("ai_chat")}>
              Test AI
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
