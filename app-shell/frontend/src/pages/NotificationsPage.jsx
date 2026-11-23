import React, { useEffect, useState, useCallback } from "react";
import { api } from "../api/client";
import { ENDPOINTS } from "../api/endpoints";
import { PageHead, Button, Badge, EmptyState, PageSkeleton } from "../components/ui";

export default function NotificationsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await api.get(ENDPOINTS.notifications);
      setItems(Array.isArray(res) ? res : res.results || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const markAll = async () => {
    await api.post(ENDPOINTS.notificationsReadAll);
    setItems((prev) => prev.map((x) => ({ ...x, is_read: true })));
  };

  if (loading) return <PageSkeleton />;

  return (
    <div className="stack" style={{ gap: 14 }}>
      <PageHead
        title="Notifications"
        action={items.some((i) => !i.is_read) ? <Button variant="outline" size="sm" onClick={markAll}>Mark all read</Button> : null}
      />
      {items.length === 0 ? (
        <EmptyState title="No notifications" />
      ) : (
        items.map((n) => (
          <div className="card" key={n.id} style={{ padding: 14 }}>
            <div className="between">
              <strong style={{ fontSize: 14 }}>{n.title}</strong>
              {!n.is_read && <Badge tone="success">New</Badge>}
            </div>
            {n.message && <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--color-slate)" }}>{n.message}</p>}
          </div>
        ))
      )}
    </div>
  );
}

