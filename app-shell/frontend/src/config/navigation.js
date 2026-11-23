/**
 * Central navigation map — drives Desktop Sidebar Drawer, Mobile BottomNav, and MoreSheet.
 */
export function getNavigation(role, t) {
  // Strictly 5 focused sections for Administrators
  if (role === "admin") {
    const adminTabs = [
      { id: "dashboard", label: "Dashboard", icon: "bx-pie-chart-alt-2" },
      { id: "users", label: "Users", icon: "bx-group" },
      { id: "content", label: "Content", icon: "bx-book-content" },
      { id: "knowledge", label: "AI Docs", icon: "bx-brain" },
      { id: "centers", label: "Centers", icon: "bx-map-pin" },
    ];
    return { sidebar: adminTabs, bottom: adminTabs.slice(0, 4), more: adminTabs.slice(4) };
  }

  // Health Educators: content curation + awareness/AI tools
  if (role === "provider") {
    const eduTabs = [
      { id: "dashboard", label: t("nav.dashboard"), icon: "bx-home-alt-2" },
      { id: "content", label: "Content", icon: "bx-book-content" },
      { id: "knowledge", label: "AI Docs", icon: "bx-brain" },
      { id: "ai_chat", label: t("nav.ai_chat"), icon: "bx-bot" },
      { id: "awareness", label: t("nav.awareness"), icon: "bx-book-heart" },
      { id: "profile", label: t("nav.profile"), icon: "bx-user" },
    ];
    return { sidebar: eduTabs, bottom: eduTabs.slice(0, 4), more: eduTabs.slice(4) };
  }

  // Standard Platform Users
  const userTabs = [
    { id: "dashboard", label: t("nav.dashboard"), icon: "bx-home-alt-2" },
    { id: "awareness", label: t("nav.awareness"), icon: "bx-book-heart" },
    { id: "ai_chat", label: t("nav.ai_chat"), icon: "bx-bot" },
    { id: "screening", label: t("nav.screening"), icon: "bx-map-pin" },
    { id: "guided_chat", label: t("nav.guided_chat"), icon: "bx-conversation" },
    { id: "quizzes", label: t("nav.quizzes"), icon: "bx-check-shield" },
    { id: "profile", label: t("nav.profile"), icon: "bx-user" },
  ];
  return { sidebar: userTabs, bottom: userTabs.slice(0, 4), more: userTabs.slice(4) };
}
