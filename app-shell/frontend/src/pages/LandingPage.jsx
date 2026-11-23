import React, { useEffect, useState } from "react";
import { Shield, BookOpen, MapPin } from "lucide-react";
import { api } from "../api/client";
import { ENDPOINTS } from "../api/endpoints";
import { useI18n } from "../context/I18nContext";
import { Button, Card } from "../components/ui";

export default function LandingPage({ onOpenAuth }) {
  const { lang, t } = useI18n();
  const [cfg, setCfg] = useState(null);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    Promise.all([
      api.get(ENDPOINTS.config).catch(() => null),
      api.get(`${ENDPOINTS.awarenessCategories}?language=${lang}`).catch(() => []),
    ]).then(([c, cats]) => {
      setCfg(c?.settings_json || {});
      setCategories(Array.isArray(cats) ? cats : []);
    });
  }, [lang]);

  const heroTitle = cfg?.hero_title || "Wekebeze";
  const heroAccent = cfg?.hero_accent || "Care";
  const heroSubtitle = cfg?.hero_subtitle || "Breast and cervical cancer awareness, AI guidance, and verified screening centers.";
  const heroImage = cfg?.hero_image || "/images/together.jpg";

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
            style={{ width: "100%", height: 260, objectFit: "cover", borderRadius: 20 }}
          />
        </div>
      </section>

      <section className="shell" style={{ maxWidth: 1040, paddingTop: 44, paddingBottom: 60 }}>
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
    </div>
  );
}
