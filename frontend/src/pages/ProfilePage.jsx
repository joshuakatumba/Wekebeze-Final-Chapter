import React, { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";
import { PageHead, Card, Field, Button } from "../components/ui";

export default function ProfilePage() {
  const { user, updateProfile, logout } = useAuth();
  const [name, setName] = useState(user.name || "");
  const [phone, setPhone] = useState(user.phone || "");
  const [busy, setBusy] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await updateProfile({ name, phone });
      toast("Profile updated");
    } catch (err) {
      toast(err.message || "Update failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack" style={{ gap: 16, maxWidth: 520 }}>
      <PageHead title="Profile" />
      <Card>
        <form onSubmit={save} className="stack">
          <Field label="Full name"><input value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Email"><input value={user.email} disabled /></Field>
          <Field label="Phone"><input value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
          <div className="row" style={{ justifyContent: "space-between", marginTop: 6 }}>
            <Button type="button" variant="outline" onClick={logout}>Log out</Button>
            <Button type="submit" variant="primary" loading={busy}>Save changes</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

