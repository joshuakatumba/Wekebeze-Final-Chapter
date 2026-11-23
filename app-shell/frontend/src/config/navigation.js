/**
 * Central navigation map — drives Desktop Sidebar, Mobile BottomNav, and MoreSheet.
 */
export function getNavigation(role, t) {
  const userTabs = [
    { id: "dashboard", label: t("nav.dashboard"), icon: "bx-home-alt-2" },
    { id: "awareness", label: t("nav.awareness"), icon: "bx-book-heart" },
    { id: "ai_chat", label: t("nav.ai_chat"), icon: "bx-bot" },
    { id: "screening", label: t("nav.screening"), icon: "bx-map-pin" },
    { id: "guided_chat", label: t("nav.guided_chat"), icon: "bx-conversation" },
    { id: "quizzes", label: t("nav.quizzes"), icon: "bx-check-shield" },
    { id: "notifications", label: t("nav.notifications"), icon: "bx-bell" },
    { id: "profile", label: t("nav.profile"), icon: "bx-user" },
  ];

  if (role === "admin") {
    const all = [
      { id: "dashboard", label: t("nav.dashboard"), icon: "bx-pie-chart-alt-2" },
      { id: "admin_content", label: t("nav.admin_content"), icon: "bx-slider-alt" },
      { id: "users", label: t("nav.users"), icon: "bx-group" },
      { id: "ai_chat", label: t("nav.ai_chat"), icon: "bx-bot" },
      { id: "awareness", label: t("nav.awareness"), icon: "bx-book-heart" },
      { id: "guided_chat", label: t("nav.guided_chat"), icon: "bx-conversation" },
      { id: "quizzes", label: t("nav.quizzes"), icon: "bx-check-shield" },
      { id: "screening", label: t("nav.screening"), icon: "bx-map-pin" },
      { id: "files", label: t("nav.files"), icon: "bx-folder" },
      { id: "notifications", label: t("nav.notifications"), icon: "bx-bell" },
      { id: "profile", label: t("nav.profile"), icon: "bx-user" },
    ];
    return { sidebar: all, bottom: all.slice(0, 4), more: all.slice(4) };
  }

  if (role === "provider") {
    const all = [
      ...userTabs.slice(0, 4),
      { id: "admin_content", label: t("nav.admin_content"), icon: "bx-slider-alt" },
      ...userTabs.slice(4),
    ];
    return { sidebar: all, bottom: all.slice(0, 4), more: all.slice(4) };
  }

  return { sidebar: userTabs, bottom: userTabs.slice(0, 4), more: userTabs.slice(4) };
}
