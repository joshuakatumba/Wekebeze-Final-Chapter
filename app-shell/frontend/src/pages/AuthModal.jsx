import React, { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";
import { Button, Field, Modal } from "../components/ui";

export default function AuthModal({ initialMode = "login", onClose }) {
  const { login, register } = useAuth();
  const { t } = useI18n();
  const [mode, setMode] = useState(initialMode);
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", role: "user" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (mode === "login") {
        const u = await login(form.email.trim(), form.password);
        toast(`Welcome, ${u.name}`);
      } else {
        const u = await register({
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || undefined,
          password: form.password,
          role: form.role,
        });
        toast(`Account created, ${u.name}`);
      }
      onClose();
    } catch (err) {
      setError(err.message || "Authentication failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={mode === "login" ? t("auth.login") : t("auth.register")} onClose={onClose}>
      {error && (
        <div style={{ padding: "10px 12px", borderRadius: 8, background: "#fde8e8", color: "var(--color-alarm-red)", fontSize: 13 }}>
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="stack">
        {mode === "register" && (
          <Field label={t("auth.name")}>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
        )}
        <Field label={t("auth.email")}>
          <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        {mode === "register" && (
          <Field label={t("auth.phone")}>
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
        )}
        <Field label={t("auth.password")}>
          <input type="password" required minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </Field>
        <Button type="submit" variant="primary" block loading={busy}>
          {mode === "login" ? t("auth.login") : t("auth.register")}
        </Button>
      </form>
      <div className="between" style={{ fontSize: 13 }}>
        <span style={{ color: "var(--color-slate)" }}>
          {mode === "login" ? "No account?" : "Already have an account?"}
        </span>
        <Button variant="ghost" size="sm" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>
          {mode === "login" ? t("auth.register") : t("auth.login")}
        </Button>
      </div>
    </Modal>
  );
}

