import React, { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { api } from "../api/client";
import { ENDPOINTS } from "../api/endpoints";
import { PageHead, Badge, Button, PageSkeleton } from "../components/ui";

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await api.get(q ? `${ENDPOINTS.users}?q=${encodeURIComponent(q)}` : ENDPOINTS.users);
      setUsers(Array.isArray(res) ? res : res.results || []);
    } finally {
      setLoading(false);
    }
  }, [q]);

  useEffect(() => { load(); }, [load]);

  const toggleActive = async (u) => {
    try {
      await api.post(ENDPOINTS.toggleUserActive(u.id));
      toast(u.is_active ? "Account suspended" : "Account activated");
      load();
    } catch (err) {
      toast(err.message);
    }
  };

  if (loading) return <PageSkeleton />;

  return (
    <div className="stack" style={{ gap: 14 }}>
      <PageHead title="Users" />
      <input
        placeholder="Search users..."
        value={q}
        onChange={(e) => setQ(e.target.value)}
        style={{ maxWidth: 320, padding: "10px 14px", borderRadius: 9999, border: "1px solid var(--border-subtle)", background: "var(--surface-card)", color: "var(--text-primary)" }}
      />
      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        <table className="tbl">
          <thead>
            <tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th /></tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td><strong>{u.name}</strong></td>
                <td>{u.email}</td>
                <td><Badge>{u.role}</Badge></td>
                <td><Badge tone={u.is_active ? "success" : "danger"}>{u.is_active ? "Active" : "Suspended"}</Badge></td>
                <td style={{ textAlign: "right" }}>
                  <Button variant="outline" size="sm" onClick={() => toggleActive(u)}>
                    {u.is_active ? "Suspend" : "Activate"}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

