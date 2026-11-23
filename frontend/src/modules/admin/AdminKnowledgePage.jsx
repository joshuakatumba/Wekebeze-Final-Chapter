import React, { useEffect, useState } from "react";
import { Plus, Pencil, CheckCircle2, Trash2, Archive, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../api/client";
import { ENDPOINTS } from "../../api/endpoints";
import { PageHead, Card, Badge, Button, Field, Modal, FileUploadBox, EmptyState } from "../../components/ui";

export default function AdminKnowledgePage() {
  const [tab, setTab] = useState("docs");
  const [docs, setDocs] = useState([]);
  const [insights, setInsights] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ title: "", source: "Uganda Cancer Institute", language: "en", content: "" });
  const [promoting, setPromoting] = useState(null);
  const [promoteAnswer, setPromoteAnswer] = useState("");

  const loadAll = async () => {
    const [d, ins] = await Promise.all([
      api.get(ENDPOINTS.aiKnowledge).catch(() => []),
      api.get(`${ENDPOINTS.aiInsights}?status=pending`).catch(() => []),
    ]);
    setDocs(Array.isArray(d) ? d : []);
    setInsights(Array.isArray(ins) ? ins : []);
  };

  useEffect(() => { loadAll(); }, []);

  const uploadFile = async (file) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("approve", "true");
      await api.upload(ENDPOINTS.aiKnowledgeUpload, fd);
      toast.success("Uploaded & indexed into vector DB");
      loadAll();
    } catch (e) {
      toast.error(e.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setForm({ title: "", source: "Uganda Cancer Institute", language: "en", content: "" });
    setModalOpen(true);
  };

  const openEdit = (d) => {
    setEditingId(d.id);
    setForm({ title: d.title, source: d.source, language: d.language, content: d.content });
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (editingId) await api.patch(ENDPOINTS.aiKnowledgeItem(editingId), form);
      else await api.post(ENDPOINTS.aiKnowledge, form);
      toast.success(editingId ? "Updated" : "Draft created");
      setModalOpen(false);
      loadAll();
    } catch (err) {
      toast.error(err.message || "Save failed");
    }
  };

  const approve = async (id) => {
    try {
      await api.post(ENDPOINTS.aiKnowledgeApprove(id));
      toast.success("Approved & vector-indexed");
      loadAll();
    } catch {
      toast.error("Approval failed");
    }
  };

  const archive = async (id) => {
    try {
      await api.patch(ENDPOINTS.aiKnowledgeItem(id), { review_status: "archived" });
      toast.success("Archived");
      loadAll();
    } catch {
      toast.error("Archive failed");
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this knowledge document?")) return;
    try {
      await api.delete(ENDPOINTS.aiKnowledgeItem(id));
      toast.success("Deleted");
      loadAll();
    } catch {
      toast.error("Delete failed");
    }
  };

  const handlePromote = async (e) => {
    e.preventDefault();
    if (!promoting) return;
    try {
      await api.post(ENDPOINTS.aiInsightPromote(promoting.id), { answer: promoteAnswer });
      toast.success("Promoted to permanent vector knowledge base");
      setPromoting(null);
      loadAll();
    } catch (err) {
      toast.error(err.message || "Promotion failed");
    }
  };

  const dismissInsight = async (id) => {
    try {
      await api.post(ENDPOINTS.aiInsightDismiss(id));
      toast.success("Dismissed");
      loadAll();
    } catch {
      toast.error("Action failed");
    }
  };

  return (
    <div className="stack" style={{ gap: 18 }}>
      <PageHead
        title="AI Knowledge Base"
        action={
          <Button variant="primary" size="sm" onClick={openCreate}>
            <Plus size={14} /> Add
          </Button>
        }
      />

      <div className="chip-row">
        <Button size="sm" variant={tab === "docs" ? "primary" : "outline"} onClick={() => setTab("docs")}>
          Documents ({docs.length})
        </Button>
        <Button size="sm" variant={tab === "insights" ? "primary" : "outline"} onClick={() => setTab("insights")}>
          <Sparkles size={13} /> Learned ({insights.length})
        </Button>
      </div>

      {tab === "docs" ? (
        <>
          <FileUploadBox
            busy={uploading}
            accept=".pdf,.docx,.txt,.md"
            label="Upload PDF, DOCX, TXT, or MD Document"
            onFile={uploadFile}
          />

          {docs.length === 0 ? (
            <EmptyState title="No knowledge documents yet" />
          ) : (
            <div className="grid g2">
              {docs.map((d) => (
                <Card key={d.id} style={{ padding: 18, display: "flex", flexDirection: "column", gap: 10 }}>
                  <div className="between">
                    <Badge tone={d.review_status === "approved" ? "success" : "warning"}>{d.review_status}</Badge>
                    <Badge>{d.language.toUpperCase()} · {d.chunk_count} vectors</Badge>
                  </div>
                  <h3 style={{ margin: 0, fontSize: 16 }}>{d.title}</h3>
                  <div style={{ fontSize: 12, color: "var(--color-slate)" }}>{d.source}</div>
                  <div className="row" style={{ marginTop: "auto", gap: 6 }}>
                    {d.review_status !== "approved" ? (
                      <Button variant="teal" size="sm" onClick={() => approve(d.id)}>
                        <CheckCircle2 size={13} /> Approve
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" onClick={() => archive(d.id)}>
                        <Archive size={13} /> Archive
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => openEdit(d)}><Pencil size={13} /> Edit</Button>
                    <Button variant="outline" size="sm" onClick={() => remove(d.id)}><Trash2 size={13} /></Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      ) : insights.length === 0 ? (
        <EmptyState title="No pending learned insights yet" />
      ) : (
        <div className="grid g2">
          {insights.map((ins) => (
            <Card key={ins.id} style={{ padding: 18, display: "flex", flexDirection: "column", gap: 10 }}>
              <div className="between">
                <Badge tone={ins.insight_type === "high_rated" ? "success" : "warning"}>
                  {ins.insight_type === "high_rated" ? "High Rated" : "Knowledge Gap"}
                </Badge>
                <Badge>{ins.hit_count}x · {ins.helpful_votes} 👍 </Badge>
              </div>
              <h3 style={{ margin: 0, fontSize: 15 }}>{ins.question_pattern}</h3>
              {ins.suggested_answer && (
                <p style={{ margin: 0, fontSize: 13, color: "var(--color-slate)" }}>
                  {ins.suggested_answer.slice(0, 140)}…
                </p>
              )}
              <div className="row" style={{ marginTop: "auto", gap: 6 }}>
                <Button variant="teal" size="sm" onClick={() => { setPromoting(ins); setPromoteAnswer(ins.suggested_answer || ""); }}>
                  <Sparkles size={13} /> Promote
                </Button>
                <Button variant="outline" size="sm" onClick={() => dismissInsight(ins.id)}>
                  <X size={13} />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {modalOpen && (
        <Modal title={editingId ? "Edit Document" : "New Document"} onClose={() => setModalOpen(false)}>
          <form onSubmit={handleSave} className="stack">
            <Field label="Title"><input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
            <div className="grid g2">
              <Field label="Source"><input required value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} /></Field>
              <Field label="Language">
                <select value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })}>
                  <option value="en">English</option>
                  <option value="lg">Luganda</option>
                </select>
              </Field>
            </div>
            <Field label="Verified Medical Text">
              <textarea rows={7} required value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
            </Field>
            <Button type="submit" variant="primary" block>Save</Button>
          </form>
        </Modal>
      )}

      {promoting && (
        <Modal title="Promote to Vector Knowledge Base" onClose={() => setPromoting(null)}>
          <form onSubmit={handlePromote} className="stack">
            <div style={{ fontSize: 13, color: "var(--color-slate)" }}>{promoting.question_pattern}</div>
            <Field label="Verified Guidance">
              <textarea rows={6} required value={promoteAnswer} onChange={(e) => setPromoteAnswer(e.target.value)} />
            </Field>
            <Button type="submit" variant="primary" block>Approve &amp; Index</Button>
          </form>
        </Modal>
      )}
    </div>
  );
}
