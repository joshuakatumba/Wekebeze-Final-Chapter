import React, { useState, useEffect, Suspense } from "react";
import { Toaster } from "sonner";
import "./styles/tokens.css";
import "./styles/shell.css";
import { applyBrandTheme } from "./config/brand";
import { getNavigation } from "./config/navigation";
import { api } from "./api/client";
import { ENDPOINTS } from "./api/endpoints";
import { useAuth } from "./context/AuthContext";
import { useI18n } from "./context/I18nContext";
import { AppShell } from "./layout/AppShell";
import { PageSkeleton } from "./components/ui";
import LandingPage from "./pages/LandingPage";
import AuthModal from "./pages/AuthModal";
import DashboardPage from "./pages/DashboardPage";
import FilesPage from "./pages/FilesPage";
import NotificationsPage from "./pages/NotificationsPage";
import ProfilePage from "./pages/ProfilePage";
import AdminUsersPage from "./pages/AdminUsersPage";
import AwarenessPage from "./modules/awareness/AwarenessPage";
import GuidedChatPage from "./modules/awareness/GuidedChatPage";
import AiAssistantPage from "./modules/ai/AiAssistantPage";
import QuizzesPage from "./modules/quizzes/QuizzesPage";
import ScreeningPage from "./modules/screening/ScreeningPage";
import AdminContentPage from "./modules/admin/AdminContentPage";

export default function App() {
  const { user, loading } = useAuth();
  const { t } = useI18n();
  const [tab, setTab] = useState("dashboard");
  const [authMode, setAuthMode] = useState(null);
  const [siteFlags, setSiteFlags] = useState({});

  useEffect(() => {
    applyBrandTheme();
    api.get(ENDPOINTS.config).then((res) => setSiteFlags(res?.settings_json || {})).catch(() => {});
  }, []);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <div style={{ width: 28, height: 28, border: "3px solid var(--surface-muted)", borderTopColor: "var(--color-lime-voltage)", borderRadius: "50%" }} className="spin" />
      </div>
    );
  }

  const rawNav = getNavigation(user?.role || "user", t);
  const isAdmin = user?.role === "admin";
  const canManageContent = user?.role === "admin" || user?.role === "provider";

  // Filter navigation items dynamically by admin-controlled visibility flags (admins always see all)
  const isVisible = (id) => {
    if (isAdmin) return true;
    if (id === "awareness" && siteFlags.show_awareness === false) return false;
    if (id === "ai_chat" && siteFlags.show_ai_chat === false) return false;
    if (id === "guided_chat" && siteFlags.show_guided_chat === false) return false;
    if (id === "quizzes" && siteFlags.show_quizzes === false) return false;
    if (id === "screening" && siteFlags.show_screening === false) return false;
    return true;
  };
  const visibleTabs = rawNav.sidebar.filter((item) => isVisible(item.id));
  const nav = {
    sidebar: visibleTabs,
    bottom: visibleTabs.slice(0, 4),
    more: visibleTabs.slice(4),
  };

  return (
    <>
      <AppShell nav={nav} activeTab={tab} onTabChange={setTab} onOpenAuth={setAuthMode}>
        {!user ? (
          <LandingPage onOpenAuth={setAuthMode} />
        ) : (
          <Suspense fallback={<PageSkeleton />}>
            {tab === "dashboard" && <DashboardPage onNavigate={setTab} />}
            {tab === "awareness" && <AwarenessPage onNavigate={setTab} />}
            {tab === "ai_chat" && <AiAssistantPage />}
            {tab === "guided_chat" && <GuidedChatPage onNavigate={setTab} />}
            {tab === "quizzes" && <QuizzesPage />}
            {tab === "screening" && <ScreeningPage />}
            {tab === "admin_content" && canManageContent && <AdminContentPage />}
            {tab === "files" && <FilesPage />}
            {tab === "notifications" && <NotificationsPage />}
            {tab === "profile" && <ProfilePage />}
            {tab === "users" && isAdmin && <AdminUsersPage />}
          </Suspense>
        )}
      </AppShell>

      {authMode && <AuthModal initialMode={authMode} onClose={() => setAuthMode(null)} />}
      <Toaster position="top-center" duration={2500} />
    </>
  );
}
