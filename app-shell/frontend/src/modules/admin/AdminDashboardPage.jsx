import React, { useEffect, useState } from "react";
import { Settings, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../api/client";
import { ENDPOINTS } from "../../api/endpoints";
import { PageHead, Stat, Card, Badge, Button, Field, Modal, FileUploadBox, PageSkeleton } from "../../components/ui";

export default function AdminDashboardPage({ onNavigate }) {
  const [analytics, setAnalytics] = useState(null);
  const [logs, setLogs] = useState([]);
  const [siteCfg, setSiteCfg] = useState({});
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadAll = async () => {
    try {
      const [a, audit, cfg] = await Promise.all([
        api.get(ENDPOINTS.analytics).catch(() => null),
        api.get(ENDPOINTS.auditLogs).catch(() => []),
        api.get(ENDPOINTS.config).catch(() => null),
      ]);
      setAnalytics(a);
      setLogs(Array.isArray(audit) ? audit : audit?.results || []);
      setSiteCfg(cfg?.settings_json || {});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const saveSettings = async (updates) => {
    const next = { ...siteCfg, ...updates };
    setSiteCfg(next);
    try {
      await api.patch(ENDPOINTS.config, { settings_json: next });
      toast.success("Site settings saved");
    } catch (e) {
      toast.error(e.message || "Failed to save settings");
    }
  };

  const uploadHero = async (file) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("category", "hero");
      const res = await api.upload(ENDPOINTS.files, fd);
      const url = res.file_url || res.file;
      if (url) await saveSettings({ hero_image: url });
    } catch (e) {
      toast.error(e.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  if (loading) return <PageSkeleton />;

  return (
    <div className="stack" style={{ gap: 20 }}>
      <PageHead
        title="Admin Dashboard"
        action={
          <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
            <Settings size={14} /> Site Settings
          </Button>
        }
      />

      <div className="grid g4">
        <Stat label="Users" value={analytics?.users?.total || 0} />
        <Stat label="AI Chats" value={analytics?.ai_assistant?.total_conversations || 0} />
        <Stat label="Quiz Attempts" value={analytics?.quizzes?.total_attempts || 0} />
        <Stat label="Approved Docs" value={analytics?.ai_assistant?.approved_documents || 0} />
      </div>

      <div className="grid g2">
        <Card style={{ padding: 20 }} className="stack">
          <div className="between">
            <h3 style={{ margin: 0, fontSize: 16 }}>Quick Management</h3>
            <Badge tone="success"><ShieldCheck size={12} style={{ marginRight: 4 }} /> Protected</Badge>
          </div>
          <div className="grid g2">
            <Button variant="outline" size="sm" onClick={() => onNavigate?.("users")}>Manage Users</Button>
            <Button variant="outline" size="sm" onClick={() => onNavigate?.("content")}>Learning Content</Button>
            <Button variant="outline" size="sm" onClick={() => onNavigate?.("knowledge")}>AI Knowledge</Button>
            <Button variant="outline" size="sm" onClick={() => onNavigate?.("centers")}>Screening Centers</Button>
          </div>
        </Card>

        <Card style={{ padding: 20 }} className="stack">
          <h3 style={{ margin: 0, fontSize: 16 }}>Recent Audit Activity</h3>
          {logs.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: "var(--color-slate)" }}>No audit activity yet.</p>
          ) : (
            <div className="stack" style={{ gap: 8 }}>
              {logs.slice(0, 6).map((l) => (
                <div key={l.id} className="between" style={{ padding: "8px 10px", background: "var(--surface-muted)", borderRadius: 10, fontSize: 12 }}>
                  <strong>{l.action}</strong>
                  <span style={{ color: "var(--color-slate)" }}>{new Date(l.created_at).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {settingsOpen && (
        <Modal title="Site Settings & Visibility" onClose={() => setSettingsOpen(false)}>
          <div className="stack">
            <div className="grid g2">
              <Field label="Hero Title">
                <input value={siteCfg.hero_title || ""} onChange={(e) => setSiteCfg({ ...siteCfg, hero_title: e.target.value })} />
              </Field>
              <Field label="Hero Accent">
                <input value={siteCfg.hero_accent || ""} onChange={(e) => setSiteCfg({ ...siteCfg, hero_accent: e.target.value })} />
              </Field>
            </div>
            <Field label="Hero Subtitle">
              <input value={siteCfg.hero_subtitle || ""} onChange={(e) => setSiteCfg({ ...siteCfg, hero_subtitle: e.target.value })} />
            </Field>
            <FileUploadBox busy={uploading} label="Upload Hero Image" onFile={uploadHero} />
            <div className="chip-row">
              {[
                ["show_awareness", "Awareness"],
                ["show_ai_chat", "AI Chat"],
                ["show_guided_chat", "Guided"],
                ["show_quizzes", "Quizzes"],
                ["show_screening", "Screening"],
              ].map(([key, label]) => {
                const on = siteCfg[key] !== false;
                return (
                  <Button key={key} size="sm" variant={on ? "teal" : "outline"} onClick={() => saveSettings({ [key]: !on })}>
                    {on ? <Eye size={13} /> : <EyeOff size={13} />} {label}
                  </Button>
                );
              })}
            </div>
            <Button variant="primary" block onClick={() => { saveSettings(siteCfg); setSettingsOpen(false); }}>
              Save Settings
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

