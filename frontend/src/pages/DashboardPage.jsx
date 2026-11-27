import React, { useEffect, useState } from "react";
import { Bot, Bell, CheckCircle2, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";
import { api } from "../api/client";
import { ENDPOINTS } from "../api/endpoints";
import { PageHead, Stat, Card, Badge, Button } from "../components/ui";

export default function DashboardPage({ onNavigate }) {
  const { user } = useAuth();
  const { lang } = useI18n();
  const [stats, setStats] = useState({ attempts: 0, conversations: 0, centers: 0 });
  const [categories, setCategories] = useState([]);
  const [reminders, setReminders] = useState([]);

  const loadReminders = () => {
    api.get(ENDPOINTS.reminders).then((r) => setReminders(Array.isArray(r) ? r : [])).catch(() => {});
  };

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
    loadReminders();
  }, [lang]);

  const addQuickReminder = async (type) => {
    const due = new Date();
    due.setDate(due.getDate() + (type === "breast_self_exam" ? 30 : 180));
    const payload =
      type === "breast_self_exam"
        ? {
            reminder_type: "breast_self_exam",
            title: lang === "lg" ? "Okwekebeza Amabeere Buli Mwezi" : "Monthly Breast Self-Exam",
            frequency: "monthly",
            next_due_date: due.toISOString().slice(0, 10),
            channel: "in_app",
          }
        : {
            reminder_type: "cervical_screening",
            title: lang === "lg" ? "Okwekebeza Omumwa gwa Nnabaana" : "Cervical Cancer Screening",
            frequency: "annual",
            next_due_date: due.toISOString().slice(0, 10),
            channel: "in_app",
          };
    try {
      await api.post(ENDPOINTS.reminders, payload);
      toast.success(lang === "lg" ? "Ekijjukizo kiteekeddwako" : "Reminder added");
      loadReminders();
    } catch {
      toast.error("Could not add reminder");
    }
  };

  const completeReminder = async (id) => {
    try {
      await api.post(ENDPOINTS.reminderComplete(id));
      toast.success(lang === "lg" ? "Kyawedde! Ekijjukizo ekiddako kitereddwa" : "Completed! Next due date scheduled");
      loadReminders();
    } catch {
      toast.error("Update failed");
    }
  };

  const deleteReminder = async (id) => {
    try {
      await api.delete(ENDPOINTS.reminder(id));
      loadReminders();
    } catch {
      toast.error("Delete failed");
    }
  };

  return (
    <div className="stack" style={{ gap: 24 }}>
      <PageHead
        title={`Welcome, ${user.name}`}
        action={
          <Button variant="primary" size="sm" onClick={() => onNavigate?.("ai_chat")} aria-label="AI Assistant" title="AI Assistant">
            <Bot size={15} /> AI
          </Button>
        }
      />

      <div className="stats-grid">
        <Stat label="AI Chats" value={stats.conversations} />
        <Stat label="Quizzes" value={stats.attempts} />
        <Stat label="Centers" value={stats.centers} />
      </div>

      {/* Personal Self-Exam & Screening Reminders */}
      <Card style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="between" style={{ flexWrap: "wrap", gap: 8 }}>
          <div className="row" style={{ gap: 8 }}>
            <Bell size={16} color="#f43f5e" />
            <h3 style={{ margin: 0, fontSize: 16 }}>
              {lang === "lg" ? "Ebijjukizo by'Obulamu" : "Health Reminders"}
            </h3>
          </div>
          <div className="row" style={{ gap: 6 }}>
            <Button variant="outline" size="sm" onClick={() => addQuickReminder("breast_self_exam")}>
              <Plus size={13} /> {lang === "lg" ? "Amabeere" : "Monthly Self-Exam"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => addQuickReminder("cervical_screening")}>
              <Plus size={13} /> {lang === "lg" ? "Nnabaana" : "Cervical Check"}
            </Button>
          </div>
        </div>
        {reminders.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: "var(--color-slate)" }}>
            {lang === "lg"
              ? "Teekako ekijjukizo okukuyamba obuteerabira kwekebeza buli mwezi."
              : "Set a gentle monthly breast self-exam or annual cervical screening reminder."}
          </p>
        ) : (
          <div className="stack" style={{ gap: 8 }}>
            {reminders.map((r) => (
              <div key={r.id} className="between" style={{ padding: "10px 12px", background: "var(--surface-muted)", borderRadius: 10, gap: 8, flexWrap: "wrap" }}>
                <div>
                  <strong style={{ fontSize: 13.5, display: "block" }}>{r.title}</strong>
                  <span style={{ fontSize: 12, color: "var(--color-slate)" }}>
                    {r.frequency} · Next due: {r.next_due_date}
                  </span>
                </div>
                <div className="row" style={{ gap: 6 }}>
                  <Button variant="teal" size="sm" onClick={() => completeReminder(r.id)}>
                    <CheckCircle2 size={13} /> Done
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => deleteReminder(r.id)} aria-label="Delete">
                    <Trash2 size={13} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="grid g2">
        {categories.map((cat) => (
          <Card key={cat.id} style={{ padding: 22, display: "flex", flexDirection: "column", gap: 14 }}>
            <Badge tone={cat.cancer_type === "breast" ? "rose" : "success"}>{cat.cancer_type}</Badge>
            <h3 style={{ margin: 0, fontSize: 19 }}>{cat.name}</h3>
            <p style={{ margin: 0, fontSize: 14, color: "var(--color-slate)", lineHeight: 1.5 }}>{cat.description}</p>
            <div className="card-actions" style={{ marginTop: "auto", paddingTop: 4 }}>
              <Button variant="primary" size="sm" onClick={() => onNavigate?.("guided_chat")}>
                Start
              </Button>
              <Button variant="outline" size="sm" onClick={() => onNavigate?.("awareness")}>
                Guides
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
