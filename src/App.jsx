import React, { useState } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import InputSection from "./components/InputSection";
import ScrapList from "./components/ScrapList";
import { LogOut, PlusCircle, List, Copy, Check } from "lucide-react";

const MainApp = () => {
  // 인증 컨텍스트에서 유저 정보와 로그인/로그아웃 함수 가져오기
  const { user, login, logout } = useAuth();
  // 현재 활성화된 탭 상태 ('input' 또는 'list')
  const [activeTab, setActiveTab] = useState("list");
  // UID 복사 알림 상태
  const [copied, setCopied] = useState(false);

  const handleCopyUid = () => {
    navigator.clipboard.writeText(user.uid);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // 로그인하지 않은 경우 로그인 화면 표시
  if (!user) {
    return (
      <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "lightgray" }}>
        <div style={{flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px", background: "url('https://source.unsplash.com/random/1080x1920/?abstract,white') center/cover", position: "relative"}}>
          <div style={{position: "absolute", top: 0, left: 0, right: 0, bottom: 0, background: "linear-gradient(to bottom, rgba(249,249,251,0.2), #f9f9fb)"}}></div>
          <div style={{position: "relative", zIndex: 1, textAlign: "center", width: "100%"}}>
            <h1 style={{ fontSize: "56px", fontWeight: "700", letterSpacing: "-0.04em", lineHeight: "1.1", marginBottom: "16px", color: "var(--text-primary)" }}>
              Oh My Scrap
            </h1>
            <p style={{ fontSize: "20px", color: "var(--text-secondary)", letterSpacing: "-0.01em", marginBottom: "60px", fontWeight: "500" }}>
              Design your knowledge.
            </p>
            <button 
              className="btn" 
              onClick={async () => {
                try {
                  await login();
                } catch (error) {
                  console.error("Login failed:", error);
                  alert("로그인 중 문제가 발생했습니다. 브라우저 팝업 차단을 해제하거나, 운영망(웹앱 배포 주소)으로 접속했는지 확인해주세요.");
                }
              }} 
              style={{ 
                width: "100%", maxWidth: "320px", padding: "18px", fontSize: "17px", 
                background: "rgba(255,255,255,0.9)", color: "var(--text-primary)", 
                border: "1px solid rgba(172, 179, 184, 0.3)", backdropFilter: "blur(20px)",
                boxShadow: "var(--shadow-ambient)"
              }}
            >
              Sign in with Google
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <header className="flex-between" style={{ padding: "10px 0", marginBottom: "20px" }}>
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

      {activeTab === "input" ? (
        <InputSection onSuccess={() => setActiveTab("list")} />
      ) : (
        <ScrapList />
      )}

      {/* 하단 내비게이션 바 (모바일 특화, Glassmorphism) */}
      <nav style={{
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
      
      {/* Spacer for bottom nav */}
      <div style={{ height: "80px" }}></div>
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
