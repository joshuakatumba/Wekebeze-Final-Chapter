import React, { useEffect, useState } from "react";
import { Plus, Pencil, CheckCircle2, Trash2, Archive } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../api/client";
import { ENDPOINTS } from "../../api/endpoints";
import { PageHead, Card, Badge, Button, Field, Modal, FileUploadBox, EmptyState } from "../../components/ui";

export default function AdminKnowledgePage() {
  const [docs, setDocs] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ title: "", source: "Uganda Cancer Institute", language: "en", content: "" });

  const loadDocs = async () => {
    const res = await api.get(ENDPOINTS.aiKnowledge).catch(() => []);
    setDocs(Array.isArray(res) ? res : []);
  };

  useEffect(() => { loadDocs(); }, []);

  const uploadFile = async (file) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("approve", "true");
      await api.upload(ENDPOINTS.aiKnowledgeUpload, fd);
      toast.success("Uploaded & indexed for AI");
      loadDocs();
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
      loadDocs();
    } catch (err) {
      toast.error(err.message || "Save failed");
    }
  };

  const approve = async (id) => {
    try {
      await api.post(ENDPOINTS.aiKnowledgeApprove(id));
      toast.success("Approved & indexed for AI RAG");
      loadDocs();
    } catch {
      toast.error("Approval failed");
    }
  };

  const archive = async (id) => {
    try {
      await api.patch(ENDPOINTS.aiKnowledgeItem(id), { review_status: "archived" });
      toast.success("Archived (removed from AI retrieval)");
      loadDocs();
    } catch {
      toast.error("Archive failed");
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this knowledge document?")) return;
    try {
      await api.delete(ENDPOINTS.aiKnowledgeItem(id));
      toast.success("Deleted");
      loadDocs();
    } catch {
      toast.error("Delete failed");
    }
  };

  return (
    <div className="stack" style={{ gap: 18 }}>
      <PageHead
        title="AI Knowledge Base"
        action={
          <Button variant="primary" size="sm" onClick={openCreate}>
            <Plus size={14} /> Add Document
          </Button>
        }
      />

      <FileUploadBox
        busy={uploading}
        label="Upload .txt or .md Medical Guideline (Auto-Indexes for AI)"
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
                <Badge>{d.language.toUpperCase()} · {d.chunk_count} chunks</Badge>
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

      {modalOpen && (
        <Modal title={editingId ? "Edit Knowledge Document" : "New Knowledge Document"} onClose={() => setModalOpen(false)}>
          <form onSubmit={handleSave} className="stack">
            <Field label="Title"><input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
            <div className="grid g2">
              <Field label="Source / Authority"><input required value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} /></Field>
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
    </div>
  );
}
