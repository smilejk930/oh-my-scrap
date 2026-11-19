import React, { useState, useEffect, useCallback } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ScrapProvider } from "./context/ScrapContext";
import ScrapList from "./components/ScrapList";
import AddScrapDialog from "./components/AddScrapDialog";
import QuickToolsModal from "./components/QuickToolsModal";
import { extractFirstUrl } from "./services/scraper";
import { LogOut, Plus, List, LayoutGrid, SlidersHorizontal, Share2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const SHARE_STORAGE_KEY = "oms_pending_share_url";

const getInitialPendingShare = () => {
  if (typeof window === "undefined") {
    return { url: "", cameFromUrlParams: false };
  }
  const params = new URLSearchParams(window.location.search);
  const rawCandidate =
    params.get("addUrl") || params.get("url") || params.get("text") || params.get("title") || "";
  const extracted = extractFirstUrl(rawCandidate);
  const hasShareRoute =
    window.location.pathname === "/share-target" ||
    params.has("addUrl") ||
    params.has("url") ||
    params.has("text");

  if (extracted) {
    try {
      sessionStorage.setItem(SHARE_STORAGE_KEY, extracted);
    } catch {
      // ignore storage failure
    }
    return { url: extracted, cameFromUrlParams: hasShareRoute };
  }

  try {
    const saved = sessionStorage.getItem(SHARE_STORAGE_KEY) || "";
    return { url: saved, cameFromUrlParams: hasShareRoute };
  } catch {
    return { url: "", cameFromUrlParams: hasShareRoute };
  }
};

const UserAvatar = ({ user, size = 36 }) => {
  const label = user.displayName || user.email || "?";
  const initial = label.charAt(0).toUpperCase();
  return (
    <span
      title={label}
      aria-label={label}
      style={{ display: "inline-flex", flexShrink: 0, userSelect: "none", lineHeight: 0 }}
    >
      <svg width={size} height={size} viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg">
        <g fill="none" strokeWidth="5">
          <path d="M 5 18 A 13 13 0 0 1 18 5" stroke="#EA4335" />
          <path d="M 18 5 A 13 13 0 0 1 31 18" stroke="#FBBC05" />
          <path d="M 31 18 A 13 13 0 0 1 18 31" stroke="#34A853" />
          <path d="M 18 31 A 13 13 0 0 1 5 18" stroke="#4285F4" />
        </g>
        <text
          x="18"
          y="18"
          fontFamily="Arial, Helvetica, sans-serif"
          fontSize="14"
          fontWeight="700"
          fill="#4285F4"
          textAnchor="middle"
          dominantBaseline="central"
        >
          {initial}
        </text>
      </svg>
    </span>
  );
};

const MainApp = () => {
  const { user, login, logout } = useAuth();
  const [viewMode, setViewMode] = useState("list");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [selectedScrapId, setSelectedScrapId] = useState(null);
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  const [shareInit] = useState(() => getInitialPendingShare());
  const [pendingShareUrl, setPendingShareUrl] = useState(shareInit.url);

  // Share Target 또는 북마클릿으로 유입된 URL 쿼리 파라미터 정리
  useEffect(() => {
    if (shareInit.cameFromUrlParams && typeof window !== "undefined") {
      window.history.replaceState({}, "", "/");
    }
  }, [shareInit.cameFromUrlParams]);

  // PWA 설치 프롬프트 이벤트 캡처
  useEffect(() => {
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    const handleAppInstalled = () => {
      setDeferredPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const clearPendingShare = useCallback(() => {
    setPendingShareUrl("");
    try {
      sessionStorage.removeItem(SHARE_STORAGE_KEY);
    } catch {
      // ignore storage failure
    }
  }, []);

  const handleInstallPwa = useCallback(async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    try {
      await deferredPrompt.userChoice;
    } catch {
      // ignore
    }
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  const effectiveDialogOpen = isDialogOpen || Boolean(user && pendingShareUrl);
  const effectiveInitialUrl = user && pendingShareUrl ? pendingShareUrl : "";

  const handleCloseAddDialog = useCallback(() => {
    setIsDialogOpen(false);
    clearPendingShare();
  }, [clearPendingShare]);

  // Login screen
  if (!user) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--bg-color)", color: "var(--text-primary)", position: "relative", overflow: "hidden" }}>

        {/* Background Decoration Image (Subtle Texture) */}
        <div style={{
          position: "fixed", bottom: 0, left: 0, right: 0, height: "70vh", maxHeight: "800px",
          zIndex: 0, opacity: 0.4, pointerEvents: "none",
          display: "flex", justifyContent: "center", alignItems: "flex-end",
          maskImage: "linear-gradient(to top, black 50%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(to top, black 50%, transparent 100%)"
        }}>
          <div style={{
            width: "100%", maxWidth: "1200px", height: "100%",
            maskImage: "linear-gradient(to right, transparent 0%, black 25%, black 75%, transparent 100%)",
            WebkitMaskImage: "linear-gradient(to right, transparent 0%, black 25%, black 75%, transparent 100%)"
          }}>
            <img
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuCb-dy6bSveEyQqw973aodKszeup0x41_VdKMu0sTcD4ukt4n6j5xdZpY_aNHQA3Pf-nDU3uZt30308PXBkJxbTYfDjMoDlfBWn4AkWNa6Gk3R-9V6vvtewgQfsAe3ST5eWUpNtsIukDrzFpOKCl5qvyYZoxkH28pkUKS-89pcPiklnRnQ-NnnYvTPLzNdvzKG1mwJRcZACt_5Amg0TaxIoiiWoq0D-R_QGKg4ubglsmpUCUfzpoOiLG8GDt3l11RHE8PUZ6klAzgfq"
              alt="background texture"
              style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center bottom", filter: "grayscale(100%)", mixBlendMode: "multiply" }}
            />
          </div>
        </div>

        {/* Hero Section / Branding */}
        <main style={{ flexGrow: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 32px 48px", position: "relative", zIndex: 1 }}>
          <div style={{ width: "100%", maxWidth: "896px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>

            {/* Atmospheric Depth Elements */}
            <div style={{ position: "absolute", inset: 0, zIndex: -1, overflow: "hidden", pointerEvents: "none" }}>
              <div style={{ position: "absolute", top: "-10%", left: "-10%", width: "50%", height: "50%", borderRadius: "50%", background: "rgba(228, 233, 238, 0.4)", filter: "blur(120px)" }}></div>
              <div style={{ position: "absolute", top: "20%", right: "-15%", width: "60%", height: "60%", borderRadius: "50%", background: "rgba(242, 244, 246, 0.3)", filter: "blur(100px)" }}></div>
            </div>

            {/* Main Content Container */}
            <div style={{ marginBottom: pendingShareUrl ? "48px" : "96px", display: "flex", flexDirection: "column", gap: "24px" }}>
              <h1 style={{ fontSize: "clamp(60px, 8vw, 96px)", fontWeight: "900", letterSpacing: "-0.05em", lineHeight: "1.1", margin: 0 }}>
                Oh My Scrap
              </h1>
              <p style={{ fontSize: "clamp(20px, 2.5vw, 24px)", fontWeight: "300", color: "var(--text-secondary)", letterSpacing: "0.025em", margin: 0 }}>
                Design your knowledge.
              </p>
            </div>

            {pendingShareUrl && (
              <div className="login-share-notice">
                <Share2 size={15} style={{ flexShrink: 0, color: "var(--accent-color)" }} />
                <span>Shared link ready — sign in to save</span>
              </div>
            )}

            {/* Call to Action Section */}
            <div style={{ width: "100%", maxWidth: "384px" }}>
              <button
                onClick={async () => {
                  try {
                    await login();
                  } catch (error) {
                    console.error("Login failed:", error);
                    alert("An error occurred during login. Please disable pop-up blockers or ensure you are using the production URL.");
                  }
                }}
                style={{
                  width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "16px",
                  padding: "20px 32px", borderRadius: "12px", border: "1px solid rgba(255, 255, 255, 0.2)",
                  background: "linear-gradient(145deg, rgba(255, 255, 255, 0.95), rgba(242, 244, 246, 0.8))",
                  backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
                  boxShadow: "0 10px 40px rgba(0,0,0,0.04)", cursor: "pointer", transition: "transform 0.3s"
                }}
                onMouseDown={(e) => { e.currentTarget.style.transform = "scale(0.98)"; }}
                onMouseUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
              >
                <div style={{ width: "24px", height: "24px", display: "flex", alignItems: "center", justifyContent: "center", background: "#fff", borderRadius: "50%", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
                  <svg height="18" viewBox="0 0 24 24" width="18" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"></path>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"></path>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"></path>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"></path>
                  </svg>
                </div>
                <span style={{ fontSize: "14px", fontWeight: "600", letterSpacing: "0.025em", color: "var(--text-primary)" }}>
                  Sign in with Google
                </span>
              </button>

              <div style={{ marginTop: "32px" }}>
                <p style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.15em", color: "var(--text-secondary)", opacity: 0.6, fontWeight: "500", margin: 0 }}>
                  Secure Access Archive
                </p>
                <p style={{ fontSize: "11px", letterSpacing: "0.05em", color: "var(--text-secondary)", opacity: 0.6, fontWeight: "500", margin: "8px 0 0 0" }}>
                  Created by smilejk930
                </p>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="app-layout">
      {/* --- Main Content Area --- */}
      <main className="main-content">
        <div className="container">
          {/* Mobile Header (Hidden on Desktop) */}
          <header className="flex-between mobile-only" style={{ padding: "10px 0", marginBottom: "20px", alignItems: "center" }}>
            <h1 style={{ fontSize: "24px", fontWeight: "700", letterSpacing: "-0.03em" }}>Oh My Scrap</h1>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={() => setIsToolsOpen(true)}
                style={{
                  width: "38px",
                  height: "38px",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "rgba(0, 0, 0, 0.04)",
                  border: "none",
                  color: "#3A3A3C",
                  cursor: "pointer"
                }}
                title="Quick Tools & PWA"
                aria-label="Quick Tools and PWA"
              >
                <SlidersHorizontal size={18} />
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={logout}
                style={{
                  width: "38px",
                  height: "38px",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "rgba(0, 0, 0, 0.04)",
                  border: "none",
                  color: "#3A3A3C",
                  cursor: "pointer"
                }}
                title="Sign Out"
              >
                <LogOut size={18} />
              </motion.button>
              <UserAvatar user={user} />
            </div>
          </header>

          {/* Desktop Header (Hidden on Mobile) */}
          <div className="desktop-header desktop-only">
            <h1>Oh My Scrap</h1>
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsToolsOpen(true)}
                style={{
                  padding: "10px 14px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "7px",
                  fontSize: "13px"
                }}
                title="Quick Capture, PWA & Personal UID"
              >
                <SlidersHorizontal size={15} />
                <span>Tools</span>
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={logout}
                style={{
                  padding: "10px 14px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  fontSize: "13px"
                }}
                title="Sign Out"
              >
                <LogOut size={16} />
                <span>Sign Out</span>
              </button>
              <UserAvatar user={user} />
            </div>
          </div>

          <ScrapList
            viewMode={viewMode}
            setViewMode={setViewMode}
            onAddClick={() => setIsDialogOpen(true)}
            selectedScrapId={selectedScrapId}
            setSelectedScrapId={setSelectedScrapId}
          />

          <div className="mobile-only mobile-bottom-spacer"></div>
        </div>
      </main>

      {/* --- Mobile Bottom Navigation --- */}
      <nav className="mobile-only" style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        background: "rgba(255, 255, 255, 0.75)",
        backdropFilter: "blur(30px) saturate(180%)",
        WebkitBackdropFilter: "blur(30px) saturate(180%)",
        borderTop: "1px solid rgba(172, 179, 184, 0.15)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "12px 24px calc(12px + env(safe-area-inset-bottom))",
        zIndex: 100
      }}>
        {/* Left: view-mode toggle pill */}
        <div className="language-toggle">
          <button
            className={`lang-btn ${viewMode === "list" ? "active" : ""}`}
            onClick={() => setViewMode("list")}
            title="List view"
          >
            <List size={14} />
          </button>
          <button
            className={`lang-btn ${viewMode === "card" ? "active" : ""}`}
            onClick={() => setViewMode("card")}
            title="Card view"
          >
            <LayoutGrid size={14} />
          </button>
        </div>

        {/* Right: Add button */}
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={() => setIsDialogOpen(true)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "10px 18px",
            borderRadius: "20px",
            border: "none",
            background: "var(--accent-color)",
            color: "#fff",
            fontWeight: "600",
            fontSize: "14px",
            cursor: "pointer",
            boxShadow: "0 4px 14px rgba(0,113,227,0.3)"
          }}
        >
          <Plus size={16} />
          <span>Add</span>
        </motion.button>
      </nav>

      {/* Add Scrap Dialog */}
      <AnimatePresence>
        {effectiveDialogOpen && (
          <AddScrapDialog
            key={`add-scrap-dialog-${effectiveInitialUrl || "manual"}`}
            initialUrl={effectiveInitialUrl}
            onClose={handleCloseAddDialog}
            onViewExisting={(existing) => {
              if (existing?.id) {
                setSelectedScrapId(existing.id);
              }
            }}
          />
        )}
      </AnimatePresence>

      {/* Quick Tools & PWA Modal */}
      <AnimatePresence>
        {isToolsOpen && (
          <QuickToolsModal
            onClose={() => setIsToolsOpen(false)}
            deferredPrompt={deferredPrompt}
            onInstallPwa={handleInstallPwa}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <ScrapProvider>
        <MainApp />
      </ScrapProvider>
    </AuthProvider>
  );
}

export default App;
