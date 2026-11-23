import React, { useEffect, useState, useCallback } from "react";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "../api/client";
import { ENDPOINTS } from "../api/endpoints";
import { PageHead, Badge, Button, Card, PageSkeleton, EmptyState, Select } from "../components/ui";

const ROLE_LABELS = { user: "Platform User", provider: "Health Educator", admin: "Administrator" };
const ROLE_OPTIONS = [
  { value: "user", label: "Platform User" },
  { value: "provider", label: "Health Educator" },
  { value: "admin", label: "Administrator" },
];

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (roleFilter !== "all") params.set("role", roleFilter);
      const url = params.toString() ? `${ENDPOINTS.users}?${params}` : ENDPOINTS.users;
      const res = await api.get(url);
      setUsers(Array.isArray(res) ? res : res.results || []);
    } finally {
      setLoading(false);
    }
  }, [q, roleFilter]);

  useEffect(() => { load(); }, [load]);

  const toggleActive = async (u) => {
    try {
      await api.post(ENDPOINTS.toggleUserActive(u.id));
      toast.success(u.is_active ? "Account suspended" : "Account activated");
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const verify = async (u) => {
    try {
      await api.post(ENDPOINTS.verifyUser(u.id));
      toast.success("User verified");
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const changeRole = async (u, nextRole) => {
    try {
      await api.patch(ENDPOINTS.updateUserRole(u.id), { role: nextRole });
      toast.success(`Role updated to ${ROLE_LABELS[nextRole]}`);
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (loading) return <PageSkeleton />;

  return (
    <div className="stack" style={{ gap: 16 }}>
      <PageHead title="Users & Roles" />

      <div className="stack" style={{ gap: 10 }}>
        <input
          placeholder="Search by name or email..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ maxWidth: 360, width: "100%", padding: "9px 14px", borderRadius: 9999, border: "1px solid var(--border-subtle)", background: "var(--surface-card)", color: "var(--text-primary)", fontSize: 13 }}
        />
        <div className="chip-row">
          {[
            ["all", "All"],
            ["user", "Platform Users"],
            ["provider", "Health Educators"],
            ["admin", "Admins"],
          ].map(([k, label]) => (
            <Button key={k} size="sm" variant={roleFilter === k ? "primary" : "outline"} onClick={() => setRoleFilter(k)}>
              {label}
            </Button>
          ))}
        </div>
      </div>

      {users.length === 0 ? (
        <EmptyState title="No users found" />
      ) : (
        <div className="grid g2">
          {users.map((u) => (
            <Card key={u.id} style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="between">
                <Badge tone={u.is_active ? "success" : "danger"}>{u.is_active ? "Active" : "Suspended"}</Badge>
                {u.is_verified && <Badge tone="rose"><CheckCircle2 size={11} style={{ marginRight: 4 }} /> Verified</Badge>}
              </div>
              <div>
                <h3 style={{ margin: "0 0 2px", fontSize: 16 }}>{u.name}</h3>
                <div style={{ fontSize: 13, color: "var(--color-slate)" }}>{u.email}</div>
              </div>
              <div className="row" style={{ gap: 8, marginTop: "auto" }}>
                <Select value={u.role} options={ROLE_OPTIONS} onChange={(val) => changeRole(u, val)} />
                {!u.is_verified && (
                  <Button variant="teal" size="sm" onClick={() => verify(u)}>Verify</Button>
                )}
                <Button variant="outline" size="sm" onClick={() => toggleActive(u)}>
                  {u.is_active ? "Suspend" : "Activate"}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
