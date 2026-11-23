import React, { useEffect, useRef, useState } from "react";
import { Loader2, X, Upload, ChevronDown, Check } from "lucide-react";

export function Button({ variant = "primary", size = "md", block = false, loading = false, disabled, children, className = "", ...props }) {
  const cls = [
    "btn",
    `btn-${variant}`,
    size === "sm" ? "btn-sm" : "",
    block ? "btn-block" : "",
    className,
  ].filter(Boolean).join(" ");
  return (
    <button className={cls} disabled={disabled || loading} {...props}>
      {loading && <Loader2 size={15} className="spin" />}
      {children}
    </button>
  );
}

export function Card({ children, style, className = "" }) {
  return <div className={`card ${className}`} style={style}>{children}</div>;
}

export function Stat({ label, value, sub }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-val">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

export function Badge({ tone = "default", children }) {
  return <span className={`badge ${tone !== "default" ? `badge-${tone}` : ""}`}>{children}</span>;
}

export function PageHead({ title, action }) {
  return (
    <div className="page-head">
      <h1 className="page-head-title">{title}</h1>
      {action && <div className="page-head-action">{action}</div>}
    </div>
  );
}

export function Field({ label, children }) {
  return (
    <div className="field">
      {label && <label>{label}</label>}
      {children}
    </div>
  );
}

export function Modal({ title, onClose, footer, children }) {
  return (
    <div className="veil" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-h">
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ background: "var(--surface-muted)", border: "none", width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--text-primary)" }}
          >
            <X size={16} />
          </button>
        </div>
        <div className="modal-b">{children}</div>
        {footer && <div className="modal-f">{footer}</div>}
      </div>
    </div>
  );
}

export function EmptyState({ title, action }) {
  return (
    <div className="card" style={{ textAlign: "center", padding: "40px 20px" }}>
      <h3 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 700 }}>{title}</h3>
      {action}
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="skeleton" style={{ width: 180, height: 26 }} />
      <div className="grid g3">
        {[1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 96 }} />)}
      </div>
      <div className="skeleton" style={{ height: 180 }} />
    </div>
  );
}

export function FileUploadBox({ onFile, busy = false, label = "Upload file", accept }) {
  return (
    <label
      style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
        padding: "16px", border: "1.5px dashed var(--border-subtle)",
        borderRadius: "var(--radius-cards)", cursor: busy ? "not-allowed" : "pointer",
        background: "var(--surface-card)", fontSize: 13.5, fontWeight: 500, textAlign: "center",
      }}
    >
      {busy ? <Loader2 size={16} className="spin" /> : <Upload size={16} />}
      <span>{label}</span>
      <input
        type="file"
        accept={accept}
        disabled={busy}
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = "";
        }}
      />
    </label>
  );
}

export function Select({ value, onChange, options = [], placeholder = "Select..." }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onDocClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const current = options.find((o) => String(o.value) === String(value));

  return (
    <div ref={ref} className="wk-select">
      <button type="button" className={`wk-select-trigger ${open ? "open" : ""}`} onClick={() => setOpen((v) => !v)}>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {current ? current.label : placeholder}
        </span>
        <ChevronDown size={14} style={{ flexShrink: 0, transition: "transform 0.15s", transform: open ? "rotate(180deg)" : "none", color: "var(--color-pebble)" }} />
      </button>
      {open && (
        <div className="wk-select-menu">
          {options.map((opt) => {
            const active = String(opt.value) === String(value);
            return (
              <button
                key={opt.value}
                type="button"
                className={`wk-select-option ${active ? "active" : ""}`}
                onClick={() => { onChange(opt.value); setOpen(false); }}
              >
                <span>{opt.label}</span>
                {active && <Check size={14} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

