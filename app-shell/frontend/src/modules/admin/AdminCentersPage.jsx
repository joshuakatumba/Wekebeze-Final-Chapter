import React, { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Eye, EyeOff, MapPin } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../api/client";
import { ENDPOINTS } from "../../api/endpoints";
import { PageHead, Card, Badge, Button, Field, Modal, EmptyState } from "../../components/ui";

const EMPTY_CENTER = {
  name: "", district: "Kampala", location: "", latitude: "0.3476", longitude: "32.5825",
  contact: "", operating_hours: "Mon–Fri, 8:00 AM – 5:00 PM",
  services_text: "Clinical Breast Exam:0\nCervical VIA Screening:0",
};

export default function AdminCentersPage() {
  const [centers, setCenters] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_CENTER);

  const load = async () => {
    const res = await api.get(ENDPOINTS.screeningCenters).catch(() => []);
    setCenters(Array.isArray(res) ? res : []);
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_CENTER);
    setModalOpen(true);
  };

  const openEdit = (c) => {
    setEditingId(c.id);
    setForm({
      name: c.name, district: c.district, location: c.location,
      latitude: String(c.latitude), longitude: String(c.longitude),
      contact: c.contact || "", operating_hours: c.operating_hours || "",
      services_text: (c.services || []).map((s) => `${s.name}:${Number(s.price)}`).join("\n"),
    });
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const services = (form.services_text || "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [name, price] = line.split(":");
        return { name: (name || "").trim(), price: Number(price || 0), currency: "UGX" };
      });

    const payload = {
      name: form.name, district: form.district, location: form.location,
      latitude: parseFloat(form.latitude), longitude: parseFloat(form.longitude),
      contact: form.contact, operating_hours: form.operating_hours, services,
    };

    try {
      if (editingId) await api.patch(ENDPOINTS.screeningCenter(editingId), payload);
      else await api.post(ENDPOINTS.screeningCenters, payload);
      toast.success(editingId ? "Center updated" : "Center added");
      setModalOpen(false);
      load();
    } catch (err) {
      toast.error(err.message || "Save failed");
    }
  };

  const toggleStatus = async (c) => {
    const next = c.status === "active" ? "archived" : "active";
    try {
      await api.patch(ENDPOINTS.screeningCenter(c.id), { status: next });
      toast.success(`Marked ${next}`);
      load();
    } catch {
      toast.error("Update failed");
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this screening center?")) return;
    try {
      await api.delete(ENDPOINTS.screeningCenter(id));
      toast.success("Deleted");
      load();
    } catch {
      toast.error("Delete failed");
    }
  };

  return (
    <div className="stack" style={{ gap: 18 }}>
      <PageHead
        title="Screening Centers"
        action={
          <Button variant="primary" size="sm" onClick={openCreate}>
            <Plus size={14} /> Add Center
          </Button>
        }
      />

      {centers.length === 0 ? (
        <EmptyState title="No screening centers yet" />
      ) : (
        <div className="grid g2">
          {centers.map((c) => (
            <Card key={c.id} style={{ padding: 18, display: "flex", flexDirection: "column", gap: 10 }}>
              <div className="between">
                <Badge tone="success">{c.district}</Badge>
                <Badge tone={c.status === "active" ? "success" : "warning"}>{c.status}</Badge>
              </div>
              <h3 style={{ margin: 0, fontSize: 16 }}>{c.name}</h3>
              <div className="row" style={{ fontSize: 13, color: "var(--color-slate)", gap: 6 }}>
                <MapPin size={14} color="#f43f5e" /> {c.location}
              </div>
              <div className="row" style={{ marginTop: "auto", gap: 6 }}>
                <Button variant="outline" size="sm" onClick={() => openEdit(c)}><Pencil size={13} /> Edit</Button>
                <Button variant="outline" size="sm" onClick={() => toggleStatus(c)}>
                  {c.status === "active" ? <EyeOff size={13} /> : <Eye size={13} />}
                </Button>
                <Button variant="outline" size="sm" onClick={() => remove(c.id)}><Trash2 size={13} /></Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {modalOpen && (
        <Modal title={editingId ? "Edit Screening Center" : "New Screening Center"} onClose={() => setModalOpen(false)}>
          <form onSubmit={handleSave} className="stack">
            <Field label="Facility Name"><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <div className="grid g2">
              <Field label="District"><input required value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} /></Field>
              <Field label="Phone Contact"><input value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} /></Field>
            </div>
            <Field label="Location / Address"><input required value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></Field>
            <div className="grid g2">
              <Field label="Latitude"><input required value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} /></Field>
              <Field label="Longitude"><input required value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} /></Field>
            </div>
            <Field label="Services (one per line: Name:PriceUGX)">
              <textarea rows={3} value={form.services_text} onChange={(e) => setForm({ ...form, services_text: e.target.value })} />
            </Field>
            <Button type="submit" variant="primary" block>Save Center</Button>
          </form>
        </Modal>
      )}
    </div>
  );
}

