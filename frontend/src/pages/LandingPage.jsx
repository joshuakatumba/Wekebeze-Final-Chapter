import React, { useEffect, useState } from "react";
import { Shield, BookOpen, MapPin, Send, Calendar, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { api } from "../api/client";
import { ENDPOINTS } from "../api/endpoints";
import { useI18n } from "../context/I18nContext";
import { Button, Card, Badge } from "../components/ui";
import BookingModal from "../modules/screening/BookingModal";

const MAX_GUEST_TURNS = 3;

export default function LandingPage({ onOpenAuth }) {
  const { lang, t } = useI18n();
  const [cfg, setCfg] = useState(null);
  const [categories, setCategories] = useState([]);
  const [guestMessages, setGuestMessages] = useState([]);
  const [guestInput, setGuestInput] = useState("");
  const [asking, setAsking] = useState(false);
  const [bookingCenter, setBookingCenter] = useState(null);

  useEffect(() => {
    Promise.all([
      api.get(ENDPOINTS.config).catch(() => null),
      api.get(`${ENDPOINTS.awarenessCategories}?language=${lang}`).catch(() => []),
    ]).then(([c, cats]) => {
      setCfg(c?.settings_json || {});
      setCategories(Array.isArray(cats) ? cats : []);
    });
  }, [lang]);

  const userTurns = guestMessages.filter((m) => m.role === "user").length;
  const limitReached = userTurns >= MAX_GUEST_TURNS;

  const askGuest = async (e, presetText) => {
    e?.preventDefault();
    const text = (presetText ?? guestInput).trim();
    if (!text || asking || limitReached) return;
    setGuestInput("");
    const nextHistory = [...guestMessages, { role: "user", content: text }];
    setGuestMessages(nextHistory);
    setAsking(true);
    try {
      const res = await api.post(ENDPOINTS.aiGuestAsk, {
        content: text,
        language: lang,
        history: guestMessages.map((m) => ({ role: m.role, content: m.content })),
      });
      setGuestMessages([
        ...nextHistory,
        {
          role: "assistant",
          content: res.content,
          sources: res.sources || [],
          metadata: res.metadata || {},
        },
      ]);
    } catch (err) {
      toast.error(err.message || "Could not reach assistant");
    } finally {
      setAsking(false);
    }
  };

  const heroTitle = cfg?.hero_title || "Wekebeze";
  const heroAccent = cfg?.hero_accent || "Care";
  const heroSubtitle = cfg?.hero_subtitle || "Breast and cervical cancer awareness, AI guidance, and verified screening centers.";
  const heroImage = cfg?.hero_image || "/images/together.jpg";

  const sampleQuestions =
    lang === "lg"
      ? ["Obubonero bwa kookolo w'amabeere?", "Nnyinza kwekebeza wa bweereere mu Kampala?"]
      : ["Early warning signs of breast cancer?", "Where can I get free screening in Kampala?"];

  return (
    <div>
      <section className="hero">
        <div className="hero-in">
          <div>
            <h1>
              {heroTitle} <em>{heroAccent}</em>
            </h1>
            <p>{heroSubtitle}</p>
            <div className="row" style={{ gap: 12 }}>
              <Button variant="primary" onClick={() => onOpenAuth("register")}>{t("nav.join")}</Button>
              <Button variant="outline" onClick={() => onOpenAuth("login")}>
                {t("nav.login")}
              </Button>
            </div>
          </div>

          <img
            src={heroImage}
            alt={heroTitle}
            style={{ width: "100%", height: "clamp(190px, 34vw, 270px)", objectFit: "cover", borderRadius: 18 }}
          />
        </div>
      </section>

      {/* Anonymous Guest AI Chat — Try Free Without Sign-Up */}
      <section className="shell" style={{ maxWidth: 820, paddingTop: 32, paddingBottom: 8 }}>
        <Card style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="between">
            <div className="row" style={{ gap: 8 }}>
              <Sparkles size={18} color="#f43f5e" />
              <h2 style={{ margin: 0, fontSize: 17 }}>
                {lang === "lg" ? "Buuza Wekebeze AI Bweereere" : "Try Wekebeze AI Free"}
              </h2>
            </div>
            <Badge tone="success">
              {Math.max(0, MAX_GUEST_TURNS - userTurns)}/{MAX_GUEST_TURNS} {lang === "lg" ? "ebibuuzo" : "free"}
            </Badge>
          </div>

          {guestMessages.length === 0 ? (
            <div className="row" style={{ gap: 8 }}>
              {sampleQuestions.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => askGuest(null, q)}
                  style={{
                    padding: "8px 14px", borderRadius: 9999, border: "1px solid var(--border-subtle)",
                    background: "var(--surface-muted)", color: "var(--text-primary)", fontSize: 13, cursor: "pointer",
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          ) : (
            <div className="stack" style={{ gap: 10, maxHeight: 340, overflowY: "auto" }}>
              {guestMessages.map((m, idx) => (
                <div
                  key={idx}
                  className={m.role === "user" ? "ai-user-bubble" : "ai-msg-bubble"}
                  style={{ border: m.role === "assistant" ? "1px solid var(--border-subtle)" : "none" }}
                >
                  <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.55 }}>{m.content}</div>
                  {m.role === "assistant" && Array.isArray(m.metadata?.recommended_centers) && m.metadata.recommended_centers.length > 0 && (
                    <div className="stack" style={{ gap: 8, marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border-subtle)" }}>
                      {m.metadata.recommended_centers.map((c) => (
                        <div key={c.id} className="between" style={{ padding: "8px 10px", background: "var(--surface-muted)", borderRadius: 10, gap: 8, flexWrap: "wrap" }}>
                          <div style={{ minWidth: 0 }}>
                            <strong style={{ fontSize: 13, display: "block" }}>{c.name}</strong>
                            <span style={{ fontSize: 12, color: "var(--color-slate)" }}>{c.district} · {c.location}</span>
                          </div>
                          <Button type="button" variant="teal" size="sm" onClick={() => setBookingCenter(c)}>
                            <Calendar size={13} /> {lang === "lg" ? "Saba" : "Book"}
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {asking && (
                <div className="ai-thinking" role="status">
                  <span className="ai-dot" />
                  <span className="ai-dot" />
                  <span className="ai-dot" />
                </div>
              )}
            </div>
          )}

          {limitReached ? (
            <div className="between" style={{ padding: "12px 14px", borderRadius: 12, background: "var(--color-linen-mist)", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, color: "var(--color-rose-600)", fontWeight: 500 }}>
                {lang === "lg"
                  ? "Ggulawo akawunti ey'obwereere okugenda mu maaso n'okutereka ebyo by'obuuza."
                  : "Create a free account to continue chatting, save history, and set screening reminders."}
              </span>
              <Button variant="primary" size="sm" onClick={() => onOpenAuth("register")}>
                {t("nav.join")}
              </Button>
            </div>
          ) : (
            <form onSubmit={askGuest} style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--surface-muted)", borderRadius: 9999, padding: "4px 4px 4px 14px" }}>
              <input
                value={guestInput}
                onChange={(e) => setGuestInput(e.target.value)}
                placeholder={lang === "lg" ? "Buuza ekibuuzo mu kyama..." : "Ask privately without signing up..."}
                disabled={asking}
                style={{ flex: 1, minWidth: 0, border: "none", background: "transparent", fontSize: 14, outline: "none", padding: "8px 0" }}
              />
              <button
                type="submit"
                className="btn btn-primary"
                disabled={asking || !guestInput.trim()}
                aria-label="Send"
                style={{ width: 36, height: 36, minHeight: 36, padding: 0, flexShrink: 0 }}
              >
                <Send size={15} />
              </button>
            </form>
          )}
        </Card>
      </section>

      <section className="shell" style={{ maxWidth: 1040, paddingTop: 28, paddingBottom: 60 }}>
        {categories.length > 0 ? (
          <div className="grid g2">
            {categories.map((cat) => (
              <Card key={cat.id} style={{ padding: 26, display: "flex", flexDirection: "column", gap: 12 }}>
                <h3 style={{ margin: 0, fontSize: 19 }}>{cat.name}</h3>
                <p style={{ margin: 0, fontSize: 14, color: "var(--color-slate)" }}>{cat.description}</p>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid g3">
            {[
              [Shield, "Early Detection", "Recognize warning signs early.", "#f43f5e"],
              [BookOpen, "AI & Guided Learning", "Ask questions in English or Luganda.", "#14b8a6"],
              [MapPin, "Screening Locator", "Find verified screening facilities.", "#f43f5e"],
            ].map(([IconComp, title, desc, color]) => (
              <Card key={title} style={{ padding: 24 }}>
                <IconComp size={24} color={color} style={{ marginBottom: 14 }} />
                <h3 style={{ margin: "0 0 8px", fontSize: 18 }}>{title}</h3>
                <p style={{ margin: 0, fontSize: 14, color: "var(--color-slate)" }}>{desc}</p>
              </Card>
            ))}
          </div>
        )}
      </section>

      {bookingCenter && (
        <BookingModal center={bookingCenter} source="guest_chat" onClose={() => setBookingCenter(null)} />
      )}
    </div>
  );
}
