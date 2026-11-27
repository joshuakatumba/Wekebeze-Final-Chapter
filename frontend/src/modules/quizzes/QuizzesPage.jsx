import React, { useEffect, useState } from "react";
import { CheckCircle2, XCircle, Award, X, Share2, Copy } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../api/client";
import { ENDPOINTS } from "../../api/endpoints";
import { useI18n } from "../../context/I18nContext";
import { PageHead, Card, Badge, Button, EmptyState } from "../../components/ui";

export default function QuizzesPage() {
  const { lang, t } = useI18n();
  const [quizzes, setQuizzes] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [activeQuiz, setActiveQuiz] = useState(null);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const loadAll = async () => {
    const [qList, aList] = await Promise.all([
      api.get(`${ENDPOINTS.quizzes}?language=${lang}`).catch(() => []),
      api.get(ENDPOINTS.myQuizAttempts).catch(() => []),
    ]);
    setQuizzes(Array.isArray(qList) ? qList : []);
    setAttempts(Array.isArray(aList) ? aList : []);
  };

  useEffect(() => {
    loadAll();
  }, [lang]);

  const startQuiz = async (id) => {
    try {
      const detail = await api.get(ENDPOINTS.quiz(id));
      setActiveQuiz(detail);
      setAnswers({});
      setResult(null);
    } catch {
      toast.error("Could not load quiz");
    }
  };

  const submitQuiz = async () => {
    if (!activeQuiz) return;
    setSubmitting(true);
    try {
      const res = await api.post(ENDPOINTS.quizSubmit(activeQuiz.id), { answers });
      setResult(res);
      loadAll();
    } catch (e) {
      toast.error(e.message || "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (activeQuiz) {
    const total = activeQuiz.questions?.length || 0;
    const answeredCount = Object.keys(answers).length;

    return (
      <div className="stack" style={{ gap: 16 }}>
        <PageHead
          title={activeQuiz.title}
          action={
            <Button variant="outline" size="sm" onClick={() => { setActiveQuiz(null); setResult(null); }} aria-label="Close">
              <X size={14} />
            </Button>
          }
        />

        {result ? (
          <div className="stack" style={{ gap: 14 }}>
            <Card style={{ textAlign: "center", padding: 28 }}>
              <Award size={40} color="#14b8a6" style={{ marginBottom: 8 }} />
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "var(--color-pebble)" }}>{t("quiz.score")}</div>
              <div style={{ fontSize: 42, fontWeight: 900, color: "var(--text-primary)", margin: "4px 0" }}>
                {result.attempt.percentage}%
              </div>
              <p style={{ margin: "0 0 16px", fontSize: 14, color: "var(--color-slate)" }}>
                You scored {result.attempt.score} out of {result.attempt.total_questions}
              </p>
              <div className="row" style={{ justifyContent: "center", gap: 8 }}>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(
                    lang === "lg"
                      ? `Nfunye ${result.attempt.score}/${result.attempt.total_questions} (${result.attempt.percentage}%) mu kugezesebwa kwa ${activeQuiz.title} ku Wekebeze! Gezesa okumanya kwo era ofune ebifo by'okwekebeza kookolo mu Uganda: ${window.location.origin}`
                      : `I scored ${result.attempt.score}/${result.attempt.total_questions} (${result.attempt.percentage}%) on "${activeQuiz.title}" on Wekebeze! Test your cancer awareness & find verified screening centers in Uganda: ${window.location.origin}`
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-teal btn-sm"
                >
                  <Share2 size={14} /> {lang === "lg" ? "Gabana ku WhatsApp" : "Share on WhatsApp"}
                </a>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const msg =
                      lang === "lg"
                        ? `Nfunye ${result.attempt.score}/${result.attempt.total_questions} (${result.attempt.percentage}%) ku Wekebeze! ${window.location.origin}`
                        : `I scored ${result.attempt.score}/${result.attempt.total_questions} (${result.attempt.percentage}%) on Wekebeze! ${window.location.origin}`;
                    if (navigator.clipboard) {
                      navigator.clipboard.writeText(msg);
                      toast.success(lang === "lg" ? "Obubaka bukopiddwa" : "Share text copied");
                    }
                  }}
                >
                  <Copy size={14} /> {lang === "lg" ? "Koppa" : "Copy"}
                </Button>
              </div>
            </Card>

            {(result.breakdown || []).map((item, idx) => (
              <Card key={item.question_id}>
                <div className="between" style={{ marginBottom: 6 }}>
                  <strong style={{ fontSize: 14 }}>Q{idx + 1}. {item.question}</strong>
                  {item.is_correct ? <CheckCircle2 size={18} color="#14b8a6" /> : <XCircle size={18} color="#f43f5e" />}
                </div>
                {item.explanation && (
                  <p style={{ margin: 0, fontSize: 13, color: "var(--color-slate)" }}>{item.explanation}</p>
                )}
              </Card>
            ))}
          </div>
        ) : (
          <div className="stack" style={{ gap: 14 }}>
            {(activeQuiz.questions || []).map((q, idx) => (
              <Card key={q.id}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-rose-600)", textTransform: "uppercase", marginBottom: 6 }}>
                  Question {idx + 1} of {total}
                </div>
                <h3 style={{ margin: "0 0 12px", fontSize: 16 }}>{q.question}</h3>
                <div className="stack" style={{ gap: 8 }}>
                  {(q.options || []).map((opt, oi) => {
                    const selected = answers[q.id] === oi;
                    return (
                      <button
                        key={oi}
                        type="button"
                        onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: oi }))}
                        style={{
                          padding: "11px 14px", borderRadius: 12, textAlign: "left", cursor: "pointer",
                          border: `1.5px solid ${selected ? "var(--color-lime-voltage)" : "var(--border-subtle)"}`,
                          background: selected ? "var(--color-linen-mist)" : "var(--surface-card)",
                          color: "var(--text-primary)", fontWeight: selected ? 700 : 500, fontSize: 14,
                        }}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </Card>
            ))}
            <div className="between">
              <span style={{ fontSize: 13, color: "var(--color-slate)" }}>{answeredCount} of {total} answered</span>
              <Button variant="primary" loading={submitting} disabled={answeredCount < total} onClick={submitQuiz}>
                {t("quiz.submit")}
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="stack" style={{ gap: 18 }}>
      <PageHead title={t("quiz.title")} />

      {quizzes.length === 0 ? (
        <EmptyState title={t("common.empty")} />
      ) : (
        <div className="grid g2">
          {quizzes.map((q) => (
            <Card key={q.id} style={{ padding: 22, display: "flex", flexDirection: "column", gap: 14 }}>
              <Badge tone={q.cancer_type === "breast" ? "rose" : "success"}>{q.cancer_type}</Badge>
              <h3 style={{ margin: 0, fontSize: 18 }}>{q.title}</h3>
              <div className="card-actions" style={{ marginTop: "auto" }}>
                <Button variant="primary" size="sm" onClick={() => startQuiz(q.id)}>
                  {t("quiz.start")}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {attempts.length > 0 && (
        <Card style={{ overflowX: "auto" }}>
          <h3 style={{ margin: "0 0 12px", fontSize: 16 }}>Recent Attempts</h3>
          <table className="tbl">
            <thead>
              <tr>
                <th>Quiz</th>
                <th>Score</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {attempts.slice(0, 8).map((a) => (
                <tr key={a.id}>
                  <td><strong>{a.quiz_title}</strong></td>
                  <td><Badge tone={a.percentage >= 70 ? "success" : "warning"}>{a.score}/{a.total_questions} ({a.percentage}%)</Badge></td>
                  <td style={{ color: "var(--color-slate)" }}>{new Date(a.completed_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

