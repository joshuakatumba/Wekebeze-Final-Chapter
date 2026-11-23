import React, { useEffect, useRef, useState } from "react";
import { Plus, Pencil, Trash2, Eye, EyeOff, MapPin, Navigation, Share2, Copy } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../api/client";
import { ENDPOINTS } from "../../api/endpoints";
import { PageHead, Card, Badge, Button, Field, Modal, EmptyState } from "../../components/ui";

const EMPTY_CENTER = {
  name: "", district: "Kampala", location: "", latitude: 0.3476, longitude: 32.5825,
  map_url: "https://www.google.com/maps?q=0.3476,32.5825",
  contact: "", operating_hours: "Mon–Fri, 8:00 AM – 5:00 PM",
  services_text: "Clinical Breast Exam:0\nCervical VIA Screening:0",
};

function PinPickerMap({ lat, lng, onPick }) {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);

  useEffect(() => {
    let active = true;
    import("leaflet").then((Lmod) => {
      if (!active || !elRef.current) return;
      const L = Lmod.default || Lmod;
      if (mapRef.current) mapRef.current.remove();

      const map = L.map(elRef.current).setView([lat || 0.3476, lng || 32.5825], 12);
      L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        attribution: "&copy; OpenStreetMap",
      }).addTo(map);

      const icon = L.divIcon({
        html: `<div style="width:24px;height:24px;background:#f43f5e;border:3px solid #fff;border-radius:50%;box-shadow:0 3px 10px rgba(0,0,0,0.28);"></div>`,
        className: "", iconSize: [24, 24], iconAnchor: [12, 12],
      });

      const marker = L.marker([lat || 0.3476, lng || 32.5825], { icon }).addTo(map);
      map.on("click", (ev) => {
        const nextLat = Number(ev.latlng.lat.toFixed(6));
        const nextLng = Number(ev.latlng.lng.toFixed(6));
        marker.setLatLng([nextLat, nextLng]);
        onPick(nextLat, nextLng);
      });

      mapRef.current = map;
      markerRef.current = marker;
      setTimeout(() => map.invalidateSize(), 120);
    });
    return () => {
      active = false;
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
  }, []);

  useEffect(() => {
    if (markerRef.current && mapRef.current && lat && lng) {
      markerRef.current.setLatLng([lat, lng]);
      mapRef.current.panTo([lat, lng]);
    }
  }, [lat, lng]);

  return <div ref={elRef} style={{ height: 190, width: "100%", borderRadius: 12, border: "1px solid var(--border-subtle)" }} />;
}

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
      latitude: c.latitude, longitude: c.longitude,
      map_url: c.share_url || c.map_url || `https://www.google.com/maps?q=${c.latitude},${c.longitude}`,
      contact: c.contact || "", operating_hours: c.operating_hours || "",
      services_text: (c.services || []).map((s) => `${s.name}:${Number(s.price)}`).join("\n"),
    });
    setModalOpen(true);
  };

  const updatePin = (lat, lng) => {
    setForm((prev) => ({
      ...prev,
      latitude: lat,
      longitude: lng,
      map_url: `https://www.google.com/maps?q=${lat},${lng}`,
    }));
  };

  const useCurrentPin = () => {
    if (!navigator.geolocation) { toast.error("Location not supported"); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        updatePin(Number(pos.coords.latitude.toFixed(6)), Number(pos.coords.longitude.toFixed(6)));
        toast.success("Pin updated to your location");
      },
      () => toast.error("Location permission denied")
    );
  };

  const shareLink = (url) => {
    if (!url) return;
    if (navigator.share) {
      navigator.share({ title: "Screening Center Location", url }).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
      toast.success("Location link copied");
    }
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
      latitude: Number(form.latitude), longitude: Number(form.longitude),
      map_url: form.map_url, contact: form.contact, operating_hours: form.operating_hours, services,
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
                <Button variant="outline" size="sm" onClick={() => shareLink(c.share_url)} aria-label="Share pin" title="Share location link">
                  <Share2 size={13} />
                </Button>
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
        <Modal title={editingId ? "Edit Center" : "New Screening Center"} onClose={() => setModalOpen(false)}>
          <form onSubmit={handleSave} className="stack">
            <Field label="Facility Name"><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <div className="grid g2">
              <Field label="District"><input required value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} /></Field>
              <Field label="Phone"><input value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} /></Field>
            </div>
            <Field label="Address"><input required value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></Field>

            <div className="stack" style={{ gap: 8 }}>
              <div className="between">
                <label style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary)" }}>Tap map to drop pin</label>
                <Button type="button" variant="outline" size="sm" onClick={useCurrentPin}>
                  <Navigation size={13} /> My Pin
                </Button>
              </div>
              <PinPickerMap lat={form.latitude} lng={form.longitude} onPick={updatePin} />
              <div className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
                <input
                  value={form.map_url}
                  onChange={(e) => setForm({ ...form, map_url: e.target.value })}
                  placeholder="Paste or share Google Maps link..."
                  style={{ flex: 1, minWidth: 0, padding: "8px 10px", borderRadius: 10, border: "1px solid var(--border-subtle)", fontSize: 12 }}
                />
                <Button type="button" variant="outline" size="sm" onClick={() => shareLink(form.map_url)} aria-label="Copy link" title="Copy link">
                  <Copy size={13} />
                </Button>
              </div>
            </div>

            <Field label="Services (Name:PriceUGX)">
              <textarea rows={3} value={form.services_text} onChange={(e) => setForm({ ...form, services_text: e.target.value })} />
            </Field>
            <Button type="submit" variant="primary" block>Save</Button>
          </form>
        </Modal>
      )}
    </div>
  );
}
