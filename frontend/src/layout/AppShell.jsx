import React, { useState } from "react";
import { createPortal } from "react-dom";
import { Menu, X, LogOut } from "lucide-react";
import { BRAND } from "../config/brand";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";
import { Button } from "../components/ui";

export function MoreSheet({ tabs, activeId, onChange, onClose }) {
  const { t } = useI18n();
  return createPortal(
    <div className="veil" onClick={onClose} style={{ alignItems: "flex-end", padding: 0 }}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}>
        <div className="modal-h">
          <h2 style={{ margin: 0, fontSize: 17 }}>{t("nav.more")}</h2>
          <button type="button" onClick={onClose} style={{ background: "var(--surface-muted)", border: "none", width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <X size={16} />
          </button>
        </div>
        <div className="modal-b" style={{ paddingBottom: "calc(24px + env(safe-area-inset-bottom, 0px))" }}>
          <div className="sidebar-nav">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`sidebar-nav-item ${activeId === tab.id ? "active" : ""}`}
                onClick={() => { onChange(tab.id); onClose(); }}
              >
                <i className={`bx ${tab.icon}`} />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function AppShell({ nav, activeTab, onTabChange, onOpenAuth, children }) {
  const { user, logout } = useAuth();
  const { lang, setLang, t } = useI18n();
  // Desktop: hidden sidebar opened via three-line menu; Mobile: fixed BottomNav + MoreSheet
  const [desktopMenuOpen, setDesktopMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const isMoreActive = nav?.more?.some((m) => m.id === activeTab);

  const handleSelectTab = (id) => {
    onTabChange(id);
    setDesktopMenuOpen(false);
  };

  return (
    <div>
      <header className="topbar">
        <div className="topbar-in">
          <div className="row" style={{ gap: 12 }}>
            {user && (
              <button
                type="button"
                className="tb-ctl tb-icon desktop-only"
                onClick={() => setDesktopMenuOpen((v) => !v)}
                aria-label="Toggle navigation menu"
                title="Menu"
              >
                <Menu size={22} />
              </button>
            )}
            <button
              type="button"
              className="brand-btn"
              onClick={() => handleSelectTab("dashboard")}
              style={{ flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 0 }}
            >
              <img
                src="/wekebeze-logo.svg"
                alt="Wekebeze"
                style={{ height: 28, width: 28, borderRadius: 8, flexShrink: 0 }}
              />
              <div className="brand">
                {BRAND.name} <span>{BRAND.accentName}</span>
              </div>
            </button>
          </div>

          <div className="topbar-actions">
            <button
              type="button"
              className="tb-ctl"
              onClick={() => setLang(lang === "en" ? "lg" : "en")}
              aria-label="Switch Language"
            >
              {lang === "en" ? "EN" : "LG"}
            </button>

            {user ? (
              <>
                <div className="desktop-only row" style={{ gap: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{user.name}</span>
                  <Button variant="outline" size="sm" onClick={logout}>
                    {t("nav.logout")}
                  </Button>
                </div>
                <button
                  type="button"
                  className="tb-ctl tb-icon mobile-only"
                  onClick={logout}
                  aria-label="Log out"
                  title="Log out"
                >
                  <LogOut size={18} />
                </button>
              </>
            ) : (
              <div className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
                <Button variant="outline" size="sm" onClick={() => onOpenAuth("login")}>
                  {t("nav.login")}
                </Button>
                <Button variant="primary" size="sm" className="desktop-only" onClick={() => onOpenAuth("register")}>
                  {t("nav.join")}
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      {user ? (
        <>
          <main className="shell main-content" style={{ maxWidth: 1040, paddingTop: 28 }}>
            {children}
          </main>

          {/* Mobile Bottom Navigation */}
          <nav className="bottom-nav" aria-label="Bottom Navigation">
            {(nav.bottom || []).map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`bottom-nav-item ${activeTab === tab.id ? "active" : ""}`}
                onClick={() => handleSelectTab(tab.id)}
              >
                <i className={`bx ${activeTab === tab.id ? tab.icon.replace("bx-", "bxs-") : tab.icon}`} />
                <span>{tab.label}</span>
              </button>
            ))}
            {(nav.more || []).length > 0 && (
              <button
                type="button"
                className={`bottom-nav-item ${isMoreActive ? "active" : ""}`}
                onClick={() => setMoreOpen(true)}
              >
                <i className={`bx ${isMoreActive ? "bxs-grid-alt" : "bx-grid-alt"}`} />
                <span>{t("nav.more")}</span>
              </button>
            )}
          </nav>

          {moreOpen && (
            <MoreSheet
              tabs={nav.more}
              activeId={activeTab}
              onChange={handleSelectTab}
              onClose={() => setMoreOpen(false)}
            />
          )}
        </>
      ) : (
        children
      )}

      {/* Desktop Slide-Out Sidebar Drawer */}
      {desktopMenuOpen && user && createPortal(
        <div className="drawer-overlay" onClick={() => setDesktopMenuOpen(false)}>
          <div className="drawer" style={{ left: 0, right: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-h">
              <div className="row" style={{ gap: 10 }}>
                <img src="/wekebeze-logo.svg" alt="Wekebeze" style={{ height: 28, width: 28, borderRadius: 7 }} />
                <div>
                  <strong style={{ display: "block", fontSize: 15 }}>{user.name}</strong>
                  <span style={{ fontSize: 12, color: "var(--color-slate)" }}>{BRAND.roles[user.role] || user.role}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDesktopMenuOpen(false)}
                aria-label="Close menu"
                style={{ background: "var(--surface-muted)", border: "none", width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--text-primary)" }}
              >
                <X size={16} />
              </button>
            </div>
            <div className="drawer-content">
              <nav className="sidebar-nav">
                {nav.sidebar.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    className={`sidebar-nav-item ${activeTab === tab.id ? "active" : ""}`}
                    onClick={() => handleSelectTab(tab.id)}
                  >
                    <i className={`bx ${activeTab === tab.id ? tab.icon.replace("bx-", "bxs-") : tab.icon}`} />
                    <span>{tab.label}</span>
                  </button>
                ))}
              </nav>
              <Button
                variant="outline"
                block
                style={{ marginTop: "auto", color: "var(--color-alarm-red)" }}
                onClick={() => { logout(); setDesktopMenuOpen(false); }}
              >
                <LogOut size={15} /> {t("nav.logout")}
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
