export const ENDPOINTS = {
  // Core & Accounts (AppShell built-ins)
  health: "/core/health/",
  config: "/core/config/",
  files: "/core/files/",
  file: (id) => `/core/files/${id}/`,
  notifications: "/core/notifications/",
  notificationRead: (id) => `/core/notifications/${id}/mark_read/`,
  notificationsReadAll: "/core/notifications/mark_all_read/",
  auditLogs: "/core/audit-logs/",

  register: "/accounts/register/",
  login: "/accounts/login/",
  google: "/accounts/google/",
  me: "/accounts/me/",
  refreshToken: "/accounts/token/refresh/",
  logout: "/accounts/logout/",
  users: "/accounts/users/",
  toggleUserActive: (id) => `/accounts/users/${id}/toggle-active/`,
  verifyUser: (id) => `/accounts/users/${id}/verify/`,

  // Wekebeze Awareness & Guided Chat
  awarenessCategories: "/awareness/categories/",
  awarenessArticles: "/awareness/articles/",
  awarenessArticle: (id) => `/awareness/articles/${id}/`,
  guidedNodes: "/awareness/guided-nodes/",
  guidedNode: (id) => `/awareness/guided-nodes/${id}/`,
  guidedFlow: (cancerType, lang) => `/awareness/guided-nodes/flow/?cancer_type=${cancerType}&language=${lang}`,
  guidedProgress: "/awareness/progress/",
  analytics: "/awareness/analytics/",

  // Wekebeze Quizzes
  quizzes: "/quizzes/",
  quiz: (id) => `/quizzes/${id}/`,
  quizSubmit: (id) => `/quizzes/${id}/submit/`,
  myQuizAttempts: "/quizzes/attempts/me/",
  quizQuestions: "/quizzes/questions/",
  quizQuestion: (id) => `/quizzes/questions/${id}/`,

  // Wekebeze Screening Centers
  screeningCenters: "/screening/centers/",
  screeningCenter: (id) => `/screening/centers/${id}/`,
  screeningDistricts: "/screening/centers/districts/",
  screeningNearby: (lat, lng, radiusKm = 50) =>
    `/screening/centers/nearby/?lat=${lat}&lng=${lng}&radius_km=${radiusKm}`,

  // Wekebeze AI Assistant & RAG Knowledge Base
  aiConversations: "/ai/conversations/",
  aiConversation: (id) => `/ai/conversations/${id}/`,
  aiMessages: (id) => `/ai/conversations/${id}/messages/`,
  aiKnowledge: "/ai/knowledge/",
  aiKnowledgeItem: (id) => `/ai/knowledge/${id}/`,
  aiKnowledgeApprove: (id) => `/ai/knowledge/${id}/approve/`,
  aiKnowledgeUpload: "/ai/knowledge/upload/",
};
