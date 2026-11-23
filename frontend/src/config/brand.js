import rawConfig from "./app.config.json";

export const BRAND = {
  name: import.meta.env.VITE_APP_NAME || rawConfig.name || "AppShell",
  accentName: rawConfig.accentName || "Core",
  tagline: rawConfig.tagline || "Build once. Ship any application.",
  description: rawConfig.description || "",
  roles: rawConfig.roles || { user: "User", provider: "Operator", admin: "Administrator" },
  features: rawConfig.features || {},
  theme: rawConfig.theme || {},
};

export function applyBrandTheme() {
  if (typeof document === "undefined") return;
  document.documentElement.removeAttribute("data-theme");
  localStorage.removeItem("shell-theme");
}

