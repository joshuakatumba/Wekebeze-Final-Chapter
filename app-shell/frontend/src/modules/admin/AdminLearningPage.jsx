import React, { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Eye, EyeOff, ListChecks } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../api/client";
import { ENDPOINTS } from "../../api/endpoints";
import { PageHead, Card, Badge, Button, Field, Modal, FileUploadBox, EmptyState } from "../../components/ui";

export default function AdminLearningPage() {
  const [sub, setSub] = useState("articles");
  const [articles, setArticles] = useState([]);
  const [categories, setCategories] = useState([]);
  const [nodes, setNodes] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [uploading, setUploading] = useState(false);

  // Forms
  const [articleForm, setArticleForm] = useState({ title: "", cancer_type: "breast", language: "en", category: "", summary: "", content: "", image_url: "" });
  const [nodeForm, setNodeForm] = useState({ node_id: "", cancer_type: "breast", language: "en", is_start: false, text: "", options_json: "[]" });
  const [quizForm, setQuizForm] = useState({ title: "", description: "", cancer_type: "breast", language: "en" });

  // Quiz Questions Modal
  const [activeQuiz, setActiveQuiz] = useState(null);
  const [qForm, setQForm] = useState({ question: "", opt1: "", opt2: "", opt3: "", opt4: "", correct_answer: 0, explanation: "" });

  const loadAll = async () => {
    const [arts, cats, nds, qzs] = await Promise.all([
      api.get(ENDPOINTS.awarenessArticles).catch(() => []),
      api.get(ENDPOINTS.awarenessCategories).catch(() => []),
      api.get(ENDPOINTS.guidedNodes).catch(() => []),
      api.get(ENDPOINTS.quizzes).catch(() => []),
    ]);
    setArticles(Array.isArray(arts) ? arts : []);
    setCategories(Array.isArray(cats) ? cats : []);
    setNodes(Array.isArray(nds) ? nds : []);
    setQuizzes(Array.isArray(qzs) ? qzs : []);
  };

  useEffect(() => { loadAll(); }, []);

  const openCreate = () => {
    setEditingId(null);
    setArticleForm({ title: "", cancer_type: "breast", language: "en", category: categories[0]?.id || "", summary: "", content: "", image_url: "" });
    setNodeForm({ node_id: "", cancer_type: "breast", language: "en", is_start: false, text: "", options_json: '[{"text": "Next", "next": "signs"}]' });
    setQuizForm({ title: "", description: "", cancer_type: "breast", language: "en" });
    setModalOpen(true);
  };

  const openEditArticle = (a) => {
    setEditingId(a.id);
    setArticleForm({
      title: a.title, cancer_type: a.cancer_type, language: a.language,
      category: a.category, summary: a.summary || "", content: a.content, image_url: a.image_url || "",
    });
    setModalOpen(true);
  };

  const openEditNode = (n) => {
    setEditingId(n.id);
    setNodeForm({
      node_id: n.node_id, cancer_type: n.cancer_type, language: n.language,
      is_start: Boolean(n.is_start), text: n.text, options_json: JSON.stringify(n.options || [], null, 2),
    });
    setModalOpen(true);
  };

  const openEditQuiz = (q) => {
    setEditingId(q.id);
    setQuizForm({ title: q.title, description: q.description || "", cancer_type: q.cancer_type, language: q.language });
    setModalOpen(true);
  };

  const openQuizQuestions = async (q) => {
    try {
      const detail = await api.get(`${ENDPOINTS.quiz(q.id)}?admin=1`);
      setActiveQuiz(detail);
      setQForm({ question: "", opt1: "", opt2: "", opt3: "", opt4: "", correct_answer: 0, explanation: "" });
    } catch {
      toast.error("Failed to load quiz questions");
    }
  };

  const addQuestion = async (e) => {
    e.preventDefault();
    const options = [qForm.opt1, qForm.opt2, qForm.opt3, qForm.opt4].map((s) => s.trim()).filter(Boolean);
    if (options.length < 2) {
      toast.error("Provide at least 2 options");
      return;
    }
    try {
      await api.post(ENDPOINTS.quizQuestions, {
        quiz: activeQuiz.id,
        question: qForm.question,
        options,
        correct_answer: Number(qForm.correct_answer),
        explanation: qForm.explanation,
        order: (activeQuiz.questions || []).length,
      });
      toast.success("Question added");
      openQuizQuestions(activeQuiz);
      loadAll();
    } catch (err) {
      toast.error(err.message || "Failed to add question");
    }
  };

  const deleteQuestion = async (qId) => {
    try {
      await api.delete(ENDPOINTS.quizQuestion(qId));
      toast.success("Question removed");
      openQuizQuestions(activeQuiz);
      loadAll();
    } catch {
      toast.error("Failed to remove question");
    }
  };

  const uploadCover = async (file) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("category", "article-cover");
      const res = await api.upload(ENDPOINTS.files, fd);
      setArticleForm((p) => ({ ...p, image_url: res.file_url || res.file || "" }));
      toast.success("Image uploaded");
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (sub === "articles") {
        const payload = { ...articleForm, category: articleForm.category || categories[0]?.id, status: "published" };
        if (editingId) await api.patch(ENDPOINTS.awarenessArticle(editingId), payload);
        else await api.post(ENDPOINTS.awarenessArticles, payload);
      } else if (sub === "nodes") {
        let parsedOptions = [];
        try { parsedOptions = JSON.parse(nodeForm.options_json || "[]"); } catch { toast.error("Options must be valid JSON"); return; }
        const payload = {
          node_id: nodeForm.node_id, cancer_type: nodeForm.cancer_type, language: nodeForm.language,
          is_start: nodeForm.is_start, text: nodeForm.text, options: parsedOptions, status: "published",
        };
        if (editingId) await api.patch(ENDPOINTS.guidedNode(editingId), payload);
        else await api.post(ENDPOINTS.guidedNodes, payload);
      } else if (sub === "quizzes") {
        if (editingId) await api.patch(ENDPOINTS.quiz(editingId), quizForm);
        else await api.post(ENDPOINTS.quizzes, { ...quizForm, status: "published" });
      }
      toast.success(editingId ? "Updated" : "Created");
      setModalOpen(false);
      loadAll();
    } catch (err) {
      toast.error(err.message || "Save failed");
    }
  };

  const togglePublish = async (url, current) => {
    const next = current === "published" ? "archived" : "published";
    try {
      await api.patch(url, { status: next });
      toast.success(`Marked ${next}`);
      loadAll();
    } catch {
      toast.error("Update failed");
    }
  };

  const removeItem = async (url, label) => {
    if (!window.confirm(`Delete this ${label}?`)) return;
    try {
      await api.delete(url);
      toast.success("Deleted");
      loadAll();
    } catch {
      toast.error("Delete failed");
    }
  };

  return (
    <div className="stack" style={{ gap: 18 }}>
      <PageHead
        title="Learning Content"
        action={
          <Button variant="primary" size="sm" onClick={openCreate}>
            <Plus size={14} /> Add {sub === "articles" ? "Article" : sub === "nodes" ? "Chat Node" : "Quiz"}
          </Button>
        }
      />

      <div className="chip-row">
        <Button size="sm" variant={sub === "articles" ? "primary" : "outline"} onClick={() => setSub("articles")}>
          Articles ({articles.length})
        </Button>
        <Button size="sm" variant={sub === "nodes" ? "primary" : "outline"} onClick={() => setSub("nodes")}>
          Guided Chat ({nodes.length})
        </Button>
        <Button size="sm" variant={sub === "quizzes" ? "primary" : "outline"} onClick={() => setSub("quizzes")}>
          Quizzes ({quizzes.length})
        </Button>
      </div>

      {sub === "articles" && (
        articles.length === 0 ? <EmptyState title="No articles yet" /> : (
          <div className="grid g2">
            {articles.map((a) => (
              <Card key={a.id} style={{ padding: 18, display: "flex", flexDirection: "column", gap: 10 }}>
                <div className="between">
                  <Badge tone={a.cancer_type === "breast" ? "rose" : "success"}>{a.cancer_type} · {a.language.toUpperCase()}</Badge>
                  <Badge tone={a.status === "published" ? "success" : "warning"}>{a.status}</Badge>
                </div>
                <h3 style={{ margin: 0, fontSize: 16 }}>{a.title}</h3>
                <div className="row" style={{ marginTop: "auto", gap: 6 }}>
                  <Button variant="outline" size="sm" onClick={() => openEditArticle(a)}><Pencil size={13} /> Edit</Button>
                  <Button variant="outline" size="sm" onClick={() => togglePublish(ENDPOINTS.awarenessArticle(a.id), a.status)}>
                    {a.status === "published" ? <EyeOff size={13} /> : <Eye size={13} />}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => removeItem(ENDPOINTS.awarenessArticle(a.id), "article")}><Trash2 size={13} /></Button>
                </div>
              </Card>
            ))}
          </div>
        )
      )}

      {sub === "nodes" && (
        nodes.length === 0 ? <EmptyState title="No guided nodes yet" /> : (
          <div className="grid g2">
            {nodes.slice(0, 30).map((n) => (
              <Card key={n.id} style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
                <div className="between">
                  <Badge tone="rose">{n.cancer_type}/{n.language}: {n.node_id}</Badge>
                  <Badge tone={n.status === "published" ? "success" : "warning"}>{n.status}</Badge>
                </div>
                <p style={{ margin: 0, fontSize: 13, color: "var(--color-slate)" }}>{n.text.slice(0, 110)}…</p>
                <div className="row" style={{ marginTop: "auto", gap: 6 }}>
                  <Button variant="outline" size="sm" onClick={() => openEditNode(n)}><Pencil size={13} /> Edit</Button>
                  <Button variant="outline" size="sm" onClick={() => togglePublish(ENDPOINTS.guidedNode(n.id), n.status)}>
                    {n.status === "published" ? <EyeOff size={13} /> : <Eye size={13} />}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => removeItem(ENDPOINTS.guidedNode(n.id), "node")}><Trash2 size={13} /></Button>
                </div>
              </Card>
            ))}
          </div>
        )
      )}

      {sub === "quizzes" && (
        quizzes.length === 0 ? <EmptyState title="No quizzes yet" /> : (
          <div className="grid g2">
            {quizzes.map((q) => (
              <Card key={q.id} style={{ padding: 18, display: "flex", flexDirection: "column", gap: 10 }}>
                <div className="between">
                  <Badge tone="rose">{q.cancer_type} · {q.language.toUpperCase()}</Badge>
                  <Badge tone={q.status === "published" ? "success" : "warning"}>{q.question_count} Qs</Badge>
                </div>
                <h3 style={{ margin: 0, fontSize: 16 }}>{q.title}</h3>
                <div className="row" style={{ marginTop: "auto", gap: 6 }}>
                  <Button variant="teal" size="sm" onClick={() => openQuizQuestions(q)}><ListChecks size={13} /> Questions</Button>
                  <Button variant="outline" size="sm" onClick={() => openEditQuiz(q)}><Pencil size={13} /></Button>
                  <Button variant="outline" size="sm" onClick={() => togglePublish(ENDPOINTS.quiz(q.id), q.status)}>
                    {q.status === "published" ? <EyeOff size={13} /> : <Eye size={13} />}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => removeItem(ENDPOINTS.quiz(q.id), "quiz")}><Trash2 size={13} /></Button>
                </div>
              </Card>
            ))}
          </div>
        )
      )}

      {modalOpen && (
        <Modal title={`${editingId ? "Edit" : "New"} ${sub === "articles" ? "Article" : sub === "nodes" ? "Guided Node" : "Quiz"}`} onClose={() => setModalOpen(false)}>
          <form onSubmit={handleSave} className="stack">
            {sub === "articles" && (
              <>
                <Field label="Title"><input required value={articleForm.title} onChange={(e) => setArticleForm({ ...articleForm, title: e.target.value })} /></Field>
                <div className="grid g2">
                  <Field label="Topic">
                    <select value={articleForm.cancer_type} onChange={(e) => setArticleForm({ ...articleForm, cancer_type: e.target.value })}>
                      <option value="breast">Breast</option>
                      <option value="cervical">Cervical</option>
                    </select>
                  </Field>
                  <Field label="Language">
                    <select value={articleForm.language} onChange={(e) => setArticleForm({ ...articleForm, language: e.target.value })}>
                      <option value="en">English</option>
                      <option value="lg">Luganda</option>
                    </select>
                  </Field>
                </div>
                <FileUploadBox busy={uploading} label="Upload Cover Image" onFile={uploadCover} />
                <Field label="Content"><textarea rows={5} required value={articleForm.content} onChange={(e) => setArticleForm({ ...articleForm, content: e.target.value })} /></Field>
              </>
            )}
            {sub === "nodes" && (
              <>
                <Field label="Logical Node ID (e.g. signs, screening)"><input required value={nodeForm.node_id} onChange={(e) => setNodeForm({ ...nodeForm, node_id: e.target.value })} /></Field>
                <div className="grid g2">
                  <Field label="Topic">
                    <select value={nodeForm.cancer_type} onChange={(e) => setNodeForm({ ...nodeForm, cancer_type: e.target.value })}>
                      <option value="breast">Breast</option>
                      <option value="cervical">Cervical</option>
                      <option value="prostate">Prostate</option>
                    </select>
                  </Field>
                  <Field label="Language">
                    <select value={nodeForm.language} onChange={(e) => setNodeForm({ ...nodeForm, language: e.target.value })}>
                      <option value="en">English</option>
                      <option value="lg">Luganda</option>
                    </select>
                  </Field>
                </div>
                <Field label="Doctor Message"><textarea rows={4} required value={nodeForm.text} onChange={(e) => setNodeForm({ ...nodeForm, text: e.target.value })} /></Field>
                <Field label='Options JSON (e.g. [{"text":"Next","next":"signs"}])'>
                  <textarea rows={3} value={nodeForm.options_json} onChange={(e) => setNodeForm({ ...nodeForm, options_json: e.target.value })} />
                </Field>
              </>
            )}
            {sub === "quizzes" && (
              <>
                <Field label="Quiz Title"><input required value={quizForm.title} onChange={(e) => setQuizForm({ ...quizForm, title: e.target.value })} /></Field>
                <Field label="Description"><input value={quizForm.description} onChange={(e) => setQuizForm({ ...quizForm, description: e.target.value })} /></Field>
                <div className="grid g2">
                  <Field label="Topic">
                    <select value={quizForm.cancer_type} onChange={(e) => setQuizForm({ ...quizForm, cancer_type: e.target.value })}>
                      <option value="breast">Breast</option>
                      <option value="cervical">Cervical</option>
                    </select>
                  </Field>
                  <Field label="Language">
                    <select value={quizForm.language} onChange={(e) => setQuizForm({ ...quizForm, language: e.target.value })}>
                      <option value="en">English</option>
                      <option value="lg">Luganda</option>
                    </select>
                  </Field>
                </div>
              </>
            )}
            <Button type="submit" variant="primary" block>Save</Button>
          </form>
        </Modal>
      )}

      {activeQuiz && (
        <Modal title={`Questions — ${activeQuiz.title}`} onClose={() => setActiveQuiz(null)}>
          <div className="stack" style={{ gap: 12 }}>
            {(activeQuiz.questions || []).map((q, i) => (
              <div key={q.id} className="between" style={{ padding: 10, background: "var(--surface-muted)", borderRadius: 10 }}>
                <div style={{ fontSize: 13 }}><strong>Q{i + 1}.</strong> {q.question}</div>
                <Button variant="outline" size="sm" onClick={() => deleteQuestion(q.id)}><Trash2 size={13} /></Button>
              </div>
            ))}
            <form onSubmit={addQuestion} className="stack" style={{ paddingTop: 8, borderTop: "1px solid var(--border-subtle)" }}>
              <Field label="New Question"><input required value={qForm.question} onChange={(e) => setQForm({ ...qForm, question: e.target.value })} /></Field>
              <div className="grid g2">
                <Field label="Option 1"><input required value={qForm.opt1} onChange={(e) => setQForm({ ...qForm, opt1: e.target.value })} /></Field>
                <Field label="Option 2"><input required value={qForm.opt2} onChange={(e) => setQForm({ ...qForm, opt2: e.target.value })} /></Field>
                <Field label="Option 3"><input value={qForm.opt3} onChange={(e) => setQForm({ ...qForm, opt3: e.target.value })} /></Field>
                <Field label="Option 4"><input value={qForm.opt4} onChange={(e) => setQForm({ ...qForm, opt4: e.target.value })} /></Field>
              </div>
              <Field label="Correct Option Index (0 = Option 1)">
                <select value={qForm.correct_answer} onChange={(e) => setQForm({ ...qForm, correct_answer: Number(e.target.value) })}>
                  <option value={0}>Option 1</option>
                  <option value={1}>Option 2</option>
                  <option value={2}>Option 3</option>
                  <option value={3}>Option 4</option>
                </select>
              </Field>
              <Field label="Explanation"><input value={qForm.explanation} onChange={(e) => setQForm({ ...qForm, explanation: e.target.value })} /></Field>
              <Button type="submit" variant="primary" block>Add Question</Button>
            </form>
          </div>
        </Modal>
      )}
    </div>
  );
}
