import React, { useEffect, useMemo, useRef, useState } from "react";
import { MapPin, Phone, List, Map as MapIcon, Navigation } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../api/client";
import { ENDPOINTS } from "../../api/endpoints";
import { useI18n } from "../../context/I18nContext";
import { PageHead, Card, Badge, Button, EmptyState, Modal } from "../../components/ui";

export default function ScreeningPage() {
  const { t } = useI18n();
  const [centers, setCenters] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [district, setDistrict] = useState("All");
  const [view, setView] = useState("list");
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [locating, setLocating] = useState(false);
  const mapElRef = useRef(null);
  const mapInstanceRef = useRef(null);

  useEffect(() => {
    Promise.all([
      api.get(ENDPOINTS.screeningCenters),
      api.get(ENDPOINTS.screeningDistricts),
    ])
      .then(([cList, dList]) => {
        setCenters(Array.isArray(cList) ? cList : []);
        setDistricts(Array.isArray(dList) ? dList : []);
      })
      .catch(() => toast.error("Failed to load screening centers"))
      .finally(() => setLoading(false));
  }, []);

  const findNearMe = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const nearby = await api.get(ENDPOINTS.screeningNearby(pos.coords.latitude, pos.coords.longitude, 150));
          setCenters(Array.isArray(nearby) ? nearby : []);
          setDistrict("All");
        } catch {
          toast.error("Could not fetch nearby centers");
        } finally {
          setLocating(false);
        }
      },
      () => {
        setLocating(false);
        toast.error("Location access denied.");
      }
    );
  };

  const filtered = useMemo(() => {
    if (district === "All") return centers;
    return centers.filter((c) => c.district === district);
  }, [centers, district]);

  useEffect(() => {
    if (view !== "map" || !mapElRef.current) return;
    let active = true;
    import("leaflet").then((Lmod) => {
      if (!active || !mapElRef.current) return;
      const L = Lmod.default || Lmod;
      if (mapInstanceRef.current) mapInstanceRef.current.remove();
      const map = L.map(mapElRef.current).setView([0.3476, 32.5825], 7);
      L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        attribution: "&copy; OpenStreetMap",
      }).addTo(map);
      const icon = L.divIcon({
        html: `<div style="width:26px;height:26px;background:#f43f5e;border:3px solid #fff;border-radius:50%;"></div>`,
        className: "",
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      });
      filtered.forEach((c) => {
        if (typeof c.latitude === "number" && typeof c.longitude === "number") {
          L.marker([c.latitude, c.longitude], { icon })
            .addTo(map)
            .bindPopup(`<strong>${c.name}</strong><br/>${c.district}`);
        }
      });
      mapInstanceRef.current = map;
    });
    return () => {
      active = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [view, filtered]);

  return (
    <div className="stack" style={{ gap: 18 }}>
      <PageHead
        title={t("screening.title")}
        action={
          <div className="row" style={{ gap: 8 }}>
            <Button variant="outline" size="sm" loading={locating} onClick={findNearMe}>
              <Navigation size={14} /> {t("screening.use_location")}
            </Button>
            <Button variant={view === "list" ? "dark" : "outline"} size="sm" onClick={() => setView("list")}>
              <List size={14} />
            </Button>
            <Button variant={view === "map" ? "dark" : "outline"} size="sm" onClick={() => setView("map")}>
              <MapIcon size={14} />
            </Button>
          </div>
        }
      />

      <div className="chip-row">
        <Button size="sm" variant={district === "All" ? "primary" : "outline"} onClick={() => setDistrict("All")}>
          {t("screening.all_districts")}
        </Button>
        {districts.map((d) => (
          <Button key={d} size="sm" variant={district === d ? "primary" : "outline"} onClick={() => setDistrict(d)}>
            {d}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="grid g2">{[1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 150 }} />)}</div>
      ) : view === "map" ? (
        <Card style={{ padding: 8 }}>
          <div ref={mapElRef} style={{ height: 500, width: "100%", borderRadius: 10 }} />
        </Card>
      ) : filtered.length === 0 ? (
        <EmptyState title={t("common.empty")} />
      ) : (
        <div className="grid g2">
          {filtered.map((c) => (
            <Card key={c.id} style={{ padding: 22, display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="between">
                <Badge tone="success">{c.district}</Badge>
                {c.distance_km != null && <Badge tone="rose">{c.distance_km} km</Badge>}
              </div>
              <h3 style={{ margin: 0, fontSize: 18 }}>{c.name}</h3>
              <div className="row" style={{ fontSize: 14, color: "var(--color-slate)", gap: 6 }}>
                <MapPin size={15} color="#f43f5e" /> {c.location}
              </div>
              <div className="card-actions" style={{ marginTop: "auto", paddingTop: 6 }}>
                <Button variant="outline" size="sm" onClick={() => setSelected(c)}>
                  View Services &amp; Contact
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {selected && (
        <Modal title={selected.name} onClose={() => setSelected(null)}>
          <div className="stack" style={{ gap: 12 }}>
            <div className="row" style={{ fontSize: 14, color: "var(--color-slate)" }}>
              <MapPin size={15} color="#f43f5e" /> {selected.location}, {selected.district}
            </div>
            <div className="row" style={{ fontSize: 14, fontWeight: 600 }}>
              <Phone size={15} color="#14b8a6" /> {selected.contact || "N/A"}
            </div>
            <div className="stack" style={{ gap: 8 }}>
              {(selected.services || []).map((s) => (
                <div key={s.id} className="between" style={{ padding: "10px 12px", background: "var(--surface-muted)", borderRadius: 10 }}>
                  <strong style={{ fontSize: 14 }}>{s.name}</strong>
                  <Badge tone={Number(s.price) === 0 ? "success" : "default"}>
                    {Number(s.price) === 0 ? t("screening.free") : `UGX ${Number(s.price).toLocaleString()}`}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
