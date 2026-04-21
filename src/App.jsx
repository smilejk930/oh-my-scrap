import React, { useState } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import InputSection from "./components/InputSection";
import ScrapList from "./components/ScrapList";
import { LogOut, PlusCircle, List, ArrowRight } from "lucide-react";

const MainApp = () => {
  // 인증 컨텍스트에서 유저 정보와 로그인/로그아웃 함수 가져오기
  const { user, login, logout } = useAuth();
  // 현재 활성화된 탭 상태 ('input' 또는 'list')
  const [activeTab, setActiveTab] = useState("list");

  // 로그인하지 않은 경우 로그인 화면 표시
  if (!user) {
    return (
      <div className="container" style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="card" style={{ textAlign: "center", width: "100%", maxWidth: "400px" }}>
          <h1 style={{ marginBottom: "10px" }}>Oh My Scrap</h1>
          <p style={{ marginBottom: "30px" }}>나만의 유용한 URL 저장소</p>
          <button className="btn" onClick={login} style={{ width: "100%" }}>Google로 로그인</button>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <header className="flex-between" style={{ padding: "10px 0", marginBottom: "20px" }}>
        <h1>{activeTab === "input" ? "스크랩 추가" : "내 보관함"}</h1>
        <button className="btn btn-secondary" onClick={logout} style={{ padding: "8px" }}>
          <LogOut size={20} />
        </button>
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
