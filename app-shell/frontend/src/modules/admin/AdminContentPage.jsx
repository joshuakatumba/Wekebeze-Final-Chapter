import React, { useEffect, useState } from "react";
import { Plus, CheckCircle2, Trash2, Upload, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../api/client";
import { ENDPOINTS } from "../../api/endpoints";
import { PageHead, Card, Badge, Button, Field, Modal, Stat, FileUploadBox } from "../../components/ui";

export default function AdminContentPage() {
  const [section, setSection] = useState("site");
  const [analytics, setAnalytics] = useState(null);
  const [siteCfg, setSiteCfg] = useState({});
  const [articles, setArticles] = useState([]);
  const [categories, setCategories] = useState([]);
  const [docs, setDocs] = useState([]);
  const [centers, setCenters] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [articleForm, setArticleForm] = useState({ title: "", cancer_type: "breast", language: "en", category: "", summary: "", content: "", image_url: "" });
  const [docForm, setDocForm] = useState({ title: "", source: "Uganda Cancer Institute", language: "en", content: "" });
  const [centerForm, setCenterForm] = useState({ name: "", district: "Kampala", location: "", latitude: "0.3476", longitude: "32.5825", contact: "" });
  const [quizForm, setQuizForm] = useState({ title: "", description: "", cancer_type: "breast", language: "en" });

  const loadData = async () => {
    const [a, cfg, arts, cats, d, c, q] = await Promise.all([
      api.get(ENDPOINTS.analytics).catch(() => null),
      api.get(ENDPOINTS.config).catch(() => null),
      api.get(ENDPOINTS.awarenessArticles).catch(() => []),
      api.get(ENDPOINTS.awarenessCategories).catch(() => []),
      api.get(ENDPOINTS.aiKnowledge).catch(() => []),
      api.get(ENDPOINTS.screeningCenters).catch(() => []),
      api.get(ENDPOINTS.quizzes).catch(() => []),
    ]);
    setAnalytics(a);
    setSiteCfg(cfg?.settings_json || {});
    setArticles(Array.isArray(arts) ? arts : []);
    setCategories(Array.isArray(cats) ? cats : []);
    setDocs(Array.isArray(d) ? d : []);
    setCenters(Array.isArray(c) ? c : []);
    setQuizzes(Array.isArray(q) ? q : []);
  };

  useEffect(() => {
    loadData();
  }, []);

  const saveSiteConfig = async (updates) => {
    const next = { ...siteCfg, ...updates };
    setSiteCfg(next);
    try {
      await api.patch(ENDPOINTS.config, { settings_json: next });
      toast.success("Site visibility & settings updated");
    } catch (e) {
      toast.error(e.message || "Update failed");
    }
  };

  const uploadMediaImage = async (file, onUrl) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("category", "wekebeze-media");
      const res = await api.upload(ENDPOINTS.files, fd);
      const url = res.file_url || res.file;
      if (url) onUrl(url);
      toast.success("Image uploaded");
    } catch (e) {
      toast.error(e.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const uploadKnowledgeFile = async (file) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("approve", "true");
      await api.upload(ENDPOINTS.aiKnowledgeUpload, fd);
      toast.success("Knowledge file uploaded & indexed for AI");
      loadData();
    } catch (e) {
      toast.error(e.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const toggleStatus = async (url, current, pubVal, archVal) => {
    const next = current === pubVal ? archVal : pubVal;
    try {
      await api.patch(url, { status: next });
      toast.success(`Status changed to ${next}`);
      loadData();
    } catch {
      toast.error("Failed to update visibility");
    }
  };

  const approveDoc = async (id) => {
    try {
      await api.post(ENDPOINTS.aiKnowledgeApprove(id));
      toast.success("Approved & indexed for AI RAG");
      loadData();
    } catch {
      toast.error("Failed to approve");
    }
  };

  const deleteItem = async (url, label) => {
    if (!window.confirm(`Delete this ${label}?`)) return;
    try {
      await api.delete(url);
      toast.success(`${label} deleted`);
      loadData();
    } catch {
      toast.error(`Failed to delete ${label}`);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      if (section === "articles") {
        const catId = articleForm.category || categories[0]?.id;
        await api.post(ENDPOINTS.awarenessArticles, { ...articleForm, category: catId, status: "published" });
        setArticleForm({ title: "", cancer_type: "breast", language: "en", category: "", summary: "", content: "", image_url: "" });
      } else if (section === "knowledge") {
        await api.post(ENDPOINTS.aiKnowledge, docForm);
        setDocForm({ title: "", source: "Uganda Cancer Institute", language: "en", content: "" });
      } else if (section === "centers") {
        await api.post(ENDPOINTS.screeningCenters, {
          ...centerForm,
          latitude: parseFloat(centerForm.latitude),
          longitude: parseFloat(centerForm.longitude),
          services: [{ name: "Clinical Breast Exam", price: 0, currency: "UGX" }],
        });
        setCenterForm({ name: "", district: "Kampala", location: "", latitude: "0.3476", longitude: "32.5825", contact: "" });
      } else if (section === "quizzes") {
        await api.post(ENDPOINTS.quizzes, quizForm);
        setQuizForm({ title: "", description: "", cancer_type: "breast", language: "en" });
      }
      toast.success("Saved");
      setModalOpen(false);
      loadData();
    } catch (err) {
      toast.error(err.message || "Save failed");
    }
  };

  return (
    <div className="stack" style={{ gap: 22 }}>
      <PageHead
        title="Content & Visibility Admin"
        action={
          section !== "site" && (
            <Button variant="primary" size="sm" onClick={() => setModalOpen(true)}>
              <Plus size={14} /> Add New
            </Button>
          )
        }
      />

      {analytics && (
        <div className="grid g4">
          <Stat label="Users" value={analytics.users?.total || 0} />
          <Stat label="Articles" value={analytics.awareness?.articles || 0} />
          <Stat label="AI Docs" value={analytics.ai_assistant?.approved_documents || 0} />
          <Stat label="Centers" value={analytics.screening?.total_centers || 0} />
        </div>
      )}

      <div className="chip-row">
        {[
          ["site", "Site Visibility"],
          ["articles", `Articles (${articles.length})`],
          ["knowledge", `AI Knowledge (${docs.length})`],
          ["centers", `Centers (${centers.length})`],
          ["quizzes", `Quizzes (${quizzes.length})`],
        ].map(([k, label]) => (
          <Button key={k} size="sm" variant={section === k ? "dark" : "outline"} onClick={() => setSection(k)}>
            {label}
          </Button>
        ))}
      </div>

      {section === "site" && (
        <Card style={{ padding: 24 }} className="stack">
          <h3 style={{ margin: 0, fontSize: 17 }}>Landing &amp; Module Visibility</h3>
          <div className="grid g2">
            <Field label="Hero Title">
              <input value={siteCfg.hero_title || ""} onChange={(e) => setSiteCfg({ ...siteCfg, hero_title: e.target.value })} />
            </Field>
            <Field label="Hero Accent Word">
              <input value={siteCfg.hero_accent || ""} onChange={(e) => setSiteCfg({ ...siteCfg, hero_accent: e.target.value })} />
            </Field>
          </div>
          <Field label="Hero Subtitle">
            <input value={siteCfg.hero_subtitle || ""} onChange={(e) => setSiteCfg({ ...siteCfg, hero_subtitle: e.target.value })} />
          </Field>
          <FileUploadBox
            busy={uploading}
            label="Upload Hero Banner Image"
            onFile={(f) => uploadMediaImage(f, (url) => saveSiteConfig({ hero_image: url }))}
          />
          <div className="row" style={{ gap: 10 }}>
            {[
              ["show_awareness", "Awareness"],
              ["show_ai_chat", "AI Assistant"],
              ["show_guided_chat", "Guided Chat"],
              ["show_quizzes", "Quizzes"],
              ["show_screening", "Screening"],
            ].map(([key, label]) => {
              const on = siteCfg[key] !== false;
              return (
                <Button key={key} size="sm" variant={on ? "teal" : "outline"} onClick={() => saveSiteConfig({ [key]: !on })}>
                  {on ? <Eye size={14} /> : <EyeOff size={14} />} {label}
                </Button>
              );
            })}
          </div>
          <div>
            <Button variant="primary" size="sm" onClick={() => saveSiteConfig(siteCfg)}>Save Site Settings</Button>
          </div>
        </Card>
      )}

      {section === "articles" && (
        <Card>
          <table className="tbl">
            <thead>
              <tr><th>Title</th><th>Topic</th><th>Visible</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {articles.map((a) => (
                <tr key={a.id}>
                  <td><strong>{a.title}</strong></td>
                  <td><Badge tone={a.cancer_type === "breast" ? "rose" : "success"}>{a.cancer_type}</Badge></td>
                  <td><Badge tone={a.status === "published" ? "success" : "warning"}>{a.status}</Badge></td>
                  <td>
                    <div className="row" style={{ gap: 6 }}>
                      <Button variant="outline" size="sm" onClick={() => toggleStatus(ENDPOINTS.awarenessArticle(a.id), a.status, "published", "archived")}>
                        {a.status === "published" ? <EyeOff size={13} /> : <Eye size={13} />}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => deleteItem(ENDPOINTS.awarenessArticle(a.id), "article")}>
                        <Trash2 size={13} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {section === "knowledge" && (
        <div className="stack" style={{ gap: 14 }}>
          <FileUploadBox
            busy={uploading}
            label="Upload .txt or .md Medical Guideline (Auto-Indexes for AI)"
            onFile={uploadKnowledgeFile}
          />
          <Card>
            <table className="tbl">
              <thead>
                <tr><th>Document</th><th>Status</th><th>Chunks</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {docs.map((d) => (
                  <tr key={d.id}>
                    <td><strong>{d.title}</strong></td>
                    <td><Badge tone={d.review_status === "approved" ? "success" : "warning"}>{d.review_status}</Badge></td>
                    <td>{d.chunk_count}</td>
                    <td>
                      <div className="row" style={{ gap: 6 }}>
                        {d.review_status !== "approved" && (
                          <Button variant="teal" size="sm" onClick={() => approveDoc(d.id)}>
                            <CheckCircle2 size={13} /> Approve
                          </Button>
                        )}
                        <Button variant="outline" size="sm" onClick={() => deleteItem(ENDPOINTS.aiKnowledgeItem(d.id), "document")}>
                          <Trash2 size={13} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {section === "centers" && (
        <Card>
          <table className="tbl">
            <thead>
              <tr><th>Facility</th><th>District</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {centers.map((c) => (
                <tr key={c.id}>
                  <td><strong>{c.name}</strong></td>
                  <td>{c.district}</td>
                  <td><Badge tone={c.status === "active" ? "success" : "warning"}>{c.status}</Badge></td>
                  <td>
                    <div className="row" style={{ gap: 6 }}>
                      <Button variant="outline" size="sm" onClick={() => toggleStatus(ENDPOINTS.screeningCenter(c.id), c.status, "active", "archived")}>
                        {c.status === "active" ? <EyeOff size={13} /> : <Eye size={13} />}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => deleteItem(ENDPOINTS.screeningCenter(c.id), "center")}>
                        <Trash2 size={13} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {section === "quizzes" && (
        <Card>
          <table className="tbl">
            <thead>
              <tr><th>Title</th><th>Topic</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {quizzes.map((q) => (
                <tr key={q.id}>
                  <td><strong>{q.title}</strong></td>
                  <td><Badge tone="rose">{q.cancer_type}</Badge></td>
                  <td><Badge tone={q.status === "published" ? "success" : "warning"}>{q.status}</Badge></td>
                  <td>
                    <div className="row" style={{ gap: 6 }}>
                      <Button variant="outline" size="sm" onClick={() => toggleStatus(ENDPOINTS.quiz(q.id), q.status, "published", "archived")}>
                        {q.status === "published" ? <EyeOff size={13} /> : <Eye size={13} />}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => deleteItem(ENDPOINTS.quiz(q.id), "quiz")}>
                        <Trash2 size={13} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {modalOpen && (
        <Modal title={`Add ${section}`} onClose={() => setModalOpen(false)}>
          <form onSubmit={handleCreate} className="stack">
            {section === "articles" && (
              <>
                <Field label="Article Title"><input required value={articleForm.title} onChange={(e) => setArticleForm({ ...articleForm, title: e.target.value })} /></Field>
                <div className="grid g2">
                  <Field label="Cancer Type">
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
                <FileUploadBox busy={uploading} label="Upload Cover Image" onFile={(f) => uploadMediaImage(f, (url) => setArticleForm((prev) => ({ ...prev, image_url: url })))} />
                <Field label="Content"><textarea rows={5} required value={articleForm.content} onChange={(e) => setArticleForm({ ...articleForm, content: e.target.value })} /></Field>
              </>
            )}
            {section === "knowledge" && (
              <>
                <Field label="Title"><input required value={docForm.title} onChange={(e) => setDocForm({ ...docForm, title: e.target.value })} /></Field>
                <Field label="Source"><input required value={docForm.source} onChange={(e) => setDocForm({ ...docForm, source: e.target.value })} /></Field>
                <Field label="Content"><textarea rows={5} required value={docForm.content} onChange={(e) => setDocForm({ ...docForm, content: e.target.value })} /></Field>
              </>
            )}
            {section === "centers" && (
              <>
                <Field label="Facility Name"><input required value={centerForm.name} onChange={(e) => setCenterForm({ ...centerForm, name: e.target.value })} /></Field>
                <Field label="District"><input required value={centerForm.district} onChange={(e) => setCenterForm({ ...centerForm, district: e.target.value })} /></Field>
                <Field label="Location"><input required value={centerForm.location} onChange={(e) => setCenterForm({ ...centerForm, location: e.target.value })} /></Field>
                <div className="grid g2">
                  <Field label="Latitude"><input required value={centerForm.latitude} onChange={(e) => setCenterForm({ ...centerForm, latitude: e.target.value })} /></Field>
                  <Field label="Longitude"><input required value={centerForm.longitude} onChange={(e) => setCenterForm({ ...centerForm, longitude: e.target.value })} /></Field>
                </div>
                <Field label="Contact"><input value={centerForm.contact} onChange={(e) => setCenterForm({ ...centerForm, contact: e.target.value })} /></Field>
              </>
            )}
            {section === "quizzes" && (
              <>
                <Field label="Quiz Title"><input required value={quizForm.title} onChange={(e) => setQuizForm({ ...quizForm, title: e.target.value })} /></Field>
                <div className="grid g2">
                  <Field label="Cancer Type">
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
            <Button type="submit" variant="primary" block><Upload size={14} /> Save</Button>
          </form>
        </Modal>
      )}
    </div>
  );
}
