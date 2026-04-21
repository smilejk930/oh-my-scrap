import React, { useState } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import InputSection from "./components/InputSection";
import ScrapList from "./components/ScrapList";
import { LogOut, PlusCircle, List, Copy, Check } from "lucide-react";

const MainApp = () => {
  // 인증 컨텍스트에서 유저 정보와 로그인/로그아웃 함수 가져오기
  const { user, login, logout } = useAuth();
  // 현재 활성화된 탭 상태 ('input' 또는 'list')
  const [activeTab, setActiveTab] = useState("input");
  // UID 복사 알림 상태
  const [copied, setCopied] = useState(false);

  const handleCopyUid = () => {
    navigator.clipboard.writeText(user.uid);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // 로그인하지 않은 경우 로그인 화면 표시 (Stitch 디자인 적용)
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
            <div style={{ marginBottom: "96px", display: "flex", flexDirection: "column", gap: "24px" }}>
              <h1 style={{ fontSize: "clamp(60px, 8vw, 96px)", fontWeight: "900", letterSpacing: "-0.05em", lineHeight: "1.1", margin: 0 }}>
                Oh My Scrap
              </h1>
              <p style={{ fontSize: "clamp(20px, 2.5vw, 24px)", fontWeight: "300", color: "var(--text-secondary)", letterSpacing: "0.025em", margin: 0 }}>
                Design your knowledge.
              </p>
            </div>

            {/* Call to Action Section */}
            <div style={{ width: "100%", maxWidth: "384px" }}>
              <button 
                onClick={async () => {
                  try {
                    await login();
                  } catch (error) {
                    console.error("Login failed:", error);
                    alert("로그인 중 문제가 발생했습니다. 브라우저 팝업 차단을 해제하거나, 운영망(웹앱 배포 주소)으로 접속했는지 확인해주세요.");
                  }
                }} 
                style={{ 
                  width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "16px",
                  padding: "20px 32px", borderRadius: "12px", border: "1px solid rgba(255, 255, 255, 0.2)",
                  background: "linear-gradient(145deg, rgba(255, 255, 255, 0.95), rgba(242, 244, 246, 0.8))",
                  backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
                  boxShadow: "0 10px 40px rgba(0,0,0,0.04)", cursor: "pointer", transition: "transform 0.3s"
                }}
                onMouseDown={(e) => e.currentTarget.style.transform = "scale(0.98)"}
                onMouseUp={(e) => e.currentTarget.style.transform = "scale(1)"}
                onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
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
      {/* --- Desktop Sidebar --- */}
      <aside className="sidebar desktop-only">
        <div className="sidebar-logo">Oh My Scrap</div>
        <nav className="sidebar-nav">
          <button 
            className={`sidebar-nav-item ${activeTab === "input" ? "active" : ""}`}
            onClick={() => setActiveTab("input")}
          >
            <PlusCircle size={20} />
            <span>스크랩 추가</span>
          </button>
          <button 
            className={`sidebar-nav-item ${activeTab === "list" ? "active" : ""}`}
            onClick={() => setActiveTab("list")}
          >
            <List size={20} />
            <span>내 보관함</span>
          </button>
        </nav>
        <div className="sidebar-footer">
          <button 
            className="btn btn-secondary" 
            onClick={handleCopyUid} 
            title="텔레그램 봇 연동을 위한 전체 UID 복사"
            style={{ padding: "10px 14px", fontSize: "13px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
          >
            {copied ? <Check size={16} color="var(--accent-color)" /> : <Copy size={16} />}
            {copied ? "개인 식별자 복사됨" : "개인 식별자 (UID) 복사"}
          </button>
          <button className="btn btn-secondary" onClick={logout} style={{ padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", fontSize: "13px" }} title="로그아웃">
            <LogOut size={16} />
            <span>로그아웃</span>
          </button>
        </div>
      </aside>

      {/* --- Main Content Area --- */}
      <main className="main-content">
        <div className="container">
          {/* Mobile Header (Hidden on Desktop) */}
          <header className="flex-between mobile-only" style={{ padding: "10px 0", marginBottom: "20px" }}>
            <h1>{activeTab === "input" ? "스크랩 추가" : "내 보관함"}</h1>
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <button 
                className="btn btn-secondary" 
                onClick={handleCopyUid} 
                title="텔레그램 봇 연동을 위한 전체 UID 복사"
                style={{ padding: "6px 12px", fontSize: "12px", display: "flex", alignItems: "center", gap: "6px" }}
              >
                {copied ? <Check size={14} color="var(--accent-color)" /> : <Copy size={14} />}
                {copied ? "복사됨!" : "UID 복사"}
              </button>
              <button className="btn btn-secondary" onClick={logout} style={{ padding: "8px" }} title="로그아웃">
                <LogOut size={20} />
              </button>
            </div>
          </header>

          {/* Desktop Title (Hidden on Mobile) */}
          <div className="desktop-header desktop-only">
            <h1>{activeTab === "input" ? "새로운 스크랩 추가하기" : "내 보관함"}</h1>
          </div>

          {/* Content Route */}
          {activeTab === "input" ? (
            <InputSection onSuccess={() => setActiveTab("list")} />
          ) : (
            <ScrapList />
          )}

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
        justifyContent: "space-around",
        padding: "16px 0 calc(16px + env(safe-area-inset-bottom))",
        zIndex: 100
      }}>
        <button 
          onClick={() => setActiveTab("input")}
          style={{ 
            background: "none", border: "none", color: activeTab === "input" ? "var(--accent-color)" : "var(--text-secondary)",
            display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", cursor: "pointer"
          }}
        >
          <PlusCircle size={24} />
          <span style={{ fontSize: "11px", fontWeight: "600" }}>입력</span>
        </button>
        <button 
          onClick={() => setActiveTab("list")}
          style={{ 
            background: "none", border: "none", color: activeTab === "list" ? "var(--accent-color)" : "var(--text-secondary)",
            display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", cursor: "pointer"
          }}
        >
          <List size={24} strokeWidth={activeTab === "list" ? 2.5 : 2} />
          <span style={{ fontSize: "11px", fontWeight: "600", letterSpacing: "0.02em" }}>보관함</span>
        </button>
      </nav>
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}

export default App;
