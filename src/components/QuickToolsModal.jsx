import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { X, Smartphone, Bookmark, Copy, Check, KeyRound, Download, Globe } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTranslation } from "../i18n/useTranslation";
import { LANGUAGE_OPTIONS } from "../i18n/translations";

const QuickToolsModal = ({ onClose, deferredPrompt, onInstallPwa }) => {
  const { user } = useAuth();
  const { language, setLanguage, t } = useTranslation();
  const bookmarkletRef = useRef(null);
  const [copiedType, setCopiedType] = useState(null);
  const [isStandalone] = useState(() => {
    if (typeof window === "undefined") return false;
    return (
      window.matchMedia?.("(display-mode: standalone)")?.matches ||
      window.navigator?.standalone === true
    );
  });

  const bookmarkletCode = useMemo(() => {
    const origin = typeof window !== "undefined" ? window.location.origin : "https://oh-my-scrap.web.app";
    return `javascript:(function(){window.open('${origin}/?addUrl='+encodeURIComponent(location.href),'_blank');})();`;
  }, []);

  useEffect(() => {
    const el = bookmarkletRef.current;
    if (el) {
      el.setAttribute("href", bookmarkletCode);
    }
  }, [bookmarkletCode]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleCopy = async (text, type) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedType(type);
      setTimeout(() => setCopiedType(null), 1800);
    } catch {
      alert(t("tools.clipboardDenied"));
    }
  };

  const maskedUid = user?.uid
    ? `${user.uid.slice(0, 6)}...${user.uid.slice(-4)}`
    : "";

  return (
    <motion.div
      className="dialog-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        className="dialog-box"
        style={{ width: "min(520px, 94vw)", overflowY: "auto" }}
        initial={{ opacity: 0, y: 36 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 36 }}
        transition={{ type: "spring", damping: 26, stiffness: 280 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dialog-header">
          <h2 style={{ fontSize: "18px", fontWeight: "700", letterSpacing: "-0.02em", margin: 0 }}>
            {t("tools.modalTitle")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="icon-circle-btn"
            aria-label={t("common.close")}
          >
            <X size={16} />
          </button>
        </div>

        {/* 1. Language Setting (App UI & Default AI Language) */}
        <div className="tool-card">
          <div className="tool-card-header">
            <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
              <span className="tool-icon-badge">
                <Globe size={16} />
              </span>
              <div style={{ minWidth: 0 }}>
                <h3 className="tool-card-title">{t("tools.languageTitle")}</h3>
                <p className="tool-card-sub">{t("tools.languageSub")}</p>
              </div>
            </div>
            <div
              className="language-toggle"
              role="group"
              aria-label={t("tools.languageTitle")}
            >
              {LANGUAGE_OPTIONS.map((opt) => (
                <button
                  key={opt.code}
                  type="button"
                  className={`lang-btn ${language === opt.code ? "active" : ""}`}
                  aria-pressed={language === opt.code}
                  onClick={() => setLanguage(opt.code)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 2. Mobile Share Sheet (PWA) */}
        <div className="tool-card">
          <div className="tool-card-header">
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span className="tool-icon-badge">
                <Smartphone size={16} />
              </span>
              <div>
                <h3 className="tool-card-title">{t("tools.pwaTitle")}</h3>
                <p className="tool-card-sub">{t("tools.pwaSub")}</p>
              </div>
            </div>
            {isStandalone ? (
              <span className="tool-status-pill">{t("tools.pwaInstalled")}</span>
            ) : deferredPrompt ? (
              <button type="button" className="tool-action-btn primary" onClick={onInstallPwa}>
                <Download size={13} />
                <span>{t("tools.pwaInstallBtn")}</span>
              </button>
            ) : null}
          </div>
          <p className="tool-card-desc">
            {t("tools.pwaDescBefore")}
            <strong>{t("tools.pwaDescInstall")}</strong>
            {t("tools.pwaDescMiddle")}
            <strong>Oh My Scrap</strong>
            {t("tools.pwaDescAfter")}
          </p>
        </div>

        {/* 3. Desktop Bookmarklet */}
        <div className="tool-card">
          <div className="tool-card-header">
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span className="tool-icon-badge">
                <Bookmark size={16} />
              </span>
              <div>
                <h3 className="tool-card-title">{t("tools.bookmarkletTitle")}</h3>
                <p className="tool-card-sub">{t("tools.bookmarkletSub")}</p>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", marginTop: "10px" }}>
            <a
              ref={bookmarkletRef}
              onClick={(e) => {
                e.preventDefault();
                alert(t("tools.bookmarkletAlert"));
              }}
              className="bookmarklet-pill"
              title={t("tools.bookmarkletDragTitle")}
            >
              + Oh My Scrap
            </a>
            <button
              type="button"
              className="tool-action-btn"
              onClick={() => handleCopy(bookmarkletCode, "bookmarklet")}
            >
              {copiedType === "bookmarklet" ? <Check size={13} /> : <Copy size={13} />}
              <span>{copiedType === "bookmarklet" ? t("common.copied") : t("tools.copyCode")}</span>
            </button>
          </div>
        </div>

        {/* 4. Personal UID (External Integrations) */}
        <div className="tool-card">
          <div className="tool-card-header">
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span className="tool-icon-badge">
                <KeyRound size={16} />
              </span>
              <div>
                <h3 className="tool-card-title">{t("tools.uidTitle")}</h3>
                <p className="tool-card-sub">{t("tools.uidSub")}</p>
              </div>
            </div>
            <button
              type="button"
              className="tool-action-btn"
              onClick={() => handleCopy(user?.uid || "", "uid")}
              disabled={!user?.uid}
            >
              {copiedType === "uid" ? <Check size={13} /> : <Copy size={13} />}
              <span>{copiedType === "uid" ? t("common.copied") : t("tools.copyUid")}</span>
            </button>
          </div>
          {maskedUid && (
            <code className="tool-uid-code">{maskedUid}</code>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default QuickToolsModal;
