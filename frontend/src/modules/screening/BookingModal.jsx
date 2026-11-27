import React, { useState } from "react";
import { Calendar, MapPin, Phone } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../api/client";
import { ENDPOINTS } from "../../api/endpoints";
import { useAuth } from "../../context/AuthContext";
import { useI18n } from "../../context/I18nContext";
import { Button, Field, Modal } from "../../components/ui";

export default function BookingModal({ center, source = "locator", onClose, onBooked }) {
  const { user } = useAuth();
  const { lang } = useI18n();
  const services = center?.services || [];
  const [form, setForm] = useState({
    full_name: user?.name || "",
    phone: user?.phone || "",
    preferred_date: "",
    service_name: services[0]?.name || "General Cancer Screening",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.full_name.trim() || !form.phone.trim()) {
      toast.error(lang === "lg" ? "Wandiika erinnya n'ennamba y'essimu" : "Please enter your name and phone number");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        center: center.id,
        full_name: form.full_name.trim(),
        phone: form.phone.trim(),
        service_name: form.service_name,
        notes: form.notes.trim(),
        source,
        ...(form.preferred_date ? { preferred_date: form.preferred_date } : {}),
      };
      const res = await api.post(ENDPOINTS.screeningBookings, payload);
      toast.success(
        lang === "lg"
          ? "Okusaba kwo okw'okwekebeza kutuuse! Eddwaliro lijja kukukubira."
          : "Screening request sent! The facility will reach out to confirm."
      );
      onBooked?.(res);
      onClose();
    } catch (err) {
      toast.error(err.message || "Could not submit booking");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={lang === "lg" ? "Saba Okwekebeza" : "Book Screening"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="stack" style={{ gap: 12 }}>
        <div style={{ padding: "10px 12px", borderRadius: 10, background: "var(--surface-muted)", fontSize: 13 }}>
          <strong style={{ display: "block", marginBottom: 4 }}>{center.name}</strong>
          <div className="row" style={{ gap: 6, color: "var(--color-slate)", fontSize: 12 }}>
            <MapPin size={13} color="#f43f5e" /> {center.location}, {center.district}
          </div>
          {center.contact && (
            <div className="row" style={{ gap: 6, color: "var(--color-slate)", fontSize: 12, marginTop: 3 }}>
              <Phone size={13} color="#14b8a6" /> {center.contact}
            </div>
          )}
        </div>

        <Field label={lang === "lg" ? "Erinnya lyo" : "Full Name"}>
          <input
            required
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            placeholder="e.g. Amina Nakato"
          />
        </Field>

        <div className="grid g2">
          <Field label={lang === "lg" ? "Essimu (MTN/Airtel)" : "Phone Number"}>
            <input
              required
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="+256 772 000 000"
            />
          </Field>
          <Field label={lang === "lg" ? "Olunaku lw'oyagala" : "Preferred Date"}>
            <input
              type="date"
              value={form.preferred_date}
              onChange={(e) => setForm({ ...form, preferred_date: e.target.value })}
            />
          </Field>
        </div>

        <Field label={lang === "lg" ? "Ekika ky'okwekebeza" : "Screening Service"}>
          {services.length > 0 ? (
            <select value={form.service_name} onChange={(e) => setForm({ ...form, service_name: e.target.value })}>
              {services.map((s, idx) => (
                <option key={s.id || idx} value={s.name}>
                  {s.name} ({Number(s.price) === 0 ? "Free" : `UGX ${Number(s.price).toLocaleString()}`})
                </option>
              ))}
              <option value="General Cancer Screening">General Cancer Screening</option>
            </select>
          ) : (
            <input
              value={form.service_name}
              onChange={(e) => setForm({ ...form, service_name: e.target.value })}
            />
          )}
        </Field>

        <Field label={lang === "lg" ? "Obubaka obulala (si kyatteeka)" : "Notes (optional)"}>
          <textarea
            rows={2}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder={lang === "lg" ? "Ekiseera ekikwanguyira..." : "Preferred morning/afternoon time..."}
          />
        </Field>

        <Button type="submit" variant="primary" block loading={saving}>
          <Calendar size={14} /> {lang === "lg" ? "Sindika Okusaba" : "Confirm Request"}
        </Button>
      </form>
    </Modal>
  );
}
