import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { X, Smartphone, Bookmark, Copy, Check, KeyRound, Download } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const QuickToolsModal = ({ onClose, deferredPrompt, onInstallPwa }) => {
  const { user } = useAuth();
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
      alert("Clipboard permission denied.");
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
            Quick Capture &amp; Tools
          </h2>
          <button type="button" onClick={onClose} className="icon-circle-btn" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {/* 1. Mobile Share Sheet (PWA) */}
        <div className="tool-card">
          <div className="tool-card-header">
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span className="tool-icon-badge">
                <Smartphone size={16} />
              </span>
              <div>
                <h3 className="tool-card-title">Mobile Share Sheet (PWA)</h3>
                <p className="tool-card-sub">Save links directly from YouTube, Chrome, or social apps</p>
              </div>
            </div>
            {isStandalone ? (
              <span className="tool-status-pill">Installed</span>
            ) : deferredPrompt ? (
              <button type="button" className="tool-action-btn primary" onClick={onInstallPwa}>
                <Download size={13} />
                <span>Install App</span>
              </button>
            ) : null}
          </div>
          <p className="tool-card-desc">
            On Android Chrome, tap <strong>Install app</strong> (or menu → Add to Home screen) to register <strong>Oh My Scrap</strong> in your system Share menu. On desktop Chrome/Edge, click the install icon in the address bar.
          </p>
        </div>

        {/* 2. Desktop Bookmarklet */}
        <div className="tool-card">
          <div className="tool-card-header">
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span className="tool-icon-badge">
                <Bookmark size={16} />
              </span>
              <div>
                <h3 className="tool-card-title">Desktop 1-Click Bookmarklet</h3>
                <p className="tool-card-sub">Drag the button below to your browser bookmarks bar</p>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", marginTop: "10px" }}>
            <a
              ref={bookmarkletRef}
              onClick={(e) => {
                e.preventDefault();
                alert("Drag this pill to your browser bookmarks bar, or use Copy Code to create a bookmark manually.");
              }}
              className="bookmarklet-pill"
              title="Drag to bookmarks bar"
            >
              + Oh My Scrap
            </a>
            <button
              type="button"
              className="tool-action-btn"
              onClick={() => handleCopy(bookmarkletCode, "bookmarklet")}
            >
              {copiedType === "bookmarklet" ? <Check size={13} /> : <Copy size={13} />}
              <span>{copiedType === "bookmarklet" ? "Copied!" : "Copy Code"}</span>
            </button>
          </div>
        </div>

        {/* 3. Personal UID (External Integrations) */}
        <div className="tool-card">
          <div className="tool-card-header">
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span className="tool-icon-badge">
                <KeyRound size={16} />
              </span>
              <div>
                <h3 className="tool-card-title">Personal UID</h3>
                <p className="tool-card-sub">Used for external integrations (e.g., Telegram GAS bot)</p>
              </div>
            </div>
            <button
              type="button"
              className="tool-action-btn"
              onClick={() => handleCopy(user?.uid || "", "uid")}
              disabled={!user?.uid}
            >
              {copiedType === "uid" ? <Check size={13} /> : <Copy size={13} />}
              <span>{copiedType === "uid" ? "Copied!" : "Copy UID"}</span>
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
