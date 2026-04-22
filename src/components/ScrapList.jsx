import React, { useEffect, useState } from "react";
import { db } from "../firebase/firebase";
import { collection, query, where, orderBy, onSnapshot, doc, deleteDoc } from "firebase/firestore";
import { useAuth } from "../context/AuthContext";
import ScrapItem from "./ScrapItem";
import { Search, LayoutGrid, List as ListIcon, Calendar, X, Loader2 } from "lucide-react";
import { format, subDays, startOfDay } from "date-fns";

const ScrapList = ({ viewMode, setViewMode }) => {
  const { user } = useAuth();
  const [scraps, setScraps] = useState([]); // Firestore에서 불러온 스크랩 전체 목록
  const [searchTerm, setSearchTerm] = useState(""); // 검색어 상태
  const [filterDate, setFilterDate] = useState("all"); // 날짜 필터 상태 ('today', 'week', 'month', 'older', 'all')
  const [loading, setLoading] = useState(true); // 데이터 로딩 상태
  const [selectedScrap, setSelectedScrap] = useState(null); // PC 화면에서 선택된 스크랩 상세 보기
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 768); // 데스크톱 화면 여부

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!user) return;

    let q = query(
      collection(db, "scraps"),
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setScraps(data);
      setLoading(false);
    });

    return unsubscribe;
  }, [user]);

  // 필터링 및 검색 로직 적용
  const filteredScraps = scraps.filter(scrap => {
    // 1. 검색어 필터: 제목이나 요약 내용, 태그에 검색어가 포함되어 있는지 확인
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = 
      scrap.title?.toLowerCase().includes(searchLower) ||
      scrap.fullSummary?.toLowerCase().includes(searchLower) ||
      scrap.tags?.some(tag => tag.toLowerCase().includes(searchLower));
    
    // 2. 날짜 필터: 선택된 기간(오늘, 1주일, 1달, 한달 이후)에 포함되는지 확인
    const createdAt = scrap.createdAt?.toDate();
    if (!createdAt) return matchesSearch;

    const now = new Date();
    let matchesDate = true;
    if (filterDate === "today") {
      matchesDate = createdAt >= startOfDay(now);
    } else if (filterDate === "week") {
      matchesDate = createdAt >= startOfDay(subDays(now, 7));
    } else if (filterDate === "month") {
      matchesDate = createdAt >= startOfDay(subDays(now, 30));
    } else if (filterDate === "older") {
      matchesDate = createdAt < startOfDay(subDays(now, 30));
    }

    return matchesSearch && matchesDate;
  });

  if (loading) return (
    <div style={{ display: "flex", justifyContent: "center", padding: "60px", color: "var(--accent-color)" }}>
      <Loader2 className="animate-spin" size={32} />
    </div>
  );


  return (
    <div className="flex-column" style={{ gap: "20px" }}>
      {/* Search & Layout Toggles */}
      <div className="flex-column" style={{ position: "sticky", top: "10px", zIndex: 10, background: "var(--bg-color)", paddingBottom: "10px" }}>
        <div style={{ position: "relative" }}>
          <Search size={18} style={{ position: "absolute", left: "12px", top: "14px", color: "#86868B" }} />
          <input 
            style={{ paddingLeft: "40px" }}
            placeholder="Search scraps..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex-between">
          <div style={{ display: "flex", gap: "8px", overflowX: "auto" }}>
            {["all", "today", "week", "month", "older"].map(f => (
              <button 
                key={f}
                className={`btn btn-secondary ${filterDate === f ? "active" : ""}`}
                style={{ 
                  fontSize: "12px", padding: "6px 12px", borderRadius: "10px",
                  background: filterDate === f ? "#0071E3" : "rgba(0,0,0,0.05)",
                  color: filterDate === f ? "white" : "#0071E3",
                  whiteSpace: "nowrap"
                }}
                onClick={() => setFilterDate(f)}
              >
                {f === "all" ? "All" : f === "today" ? "Today" : f === "week" ? "Week" : f === "month" ? "Month" : "Older"}
              </button>
            ))}
          </div>
          <div className="desktop-only" style={{ display: "flex", gap: "5px", background: "rgba(0,0,0,0.05)", padding: "4px", borderRadius: "10px" }}>
            <button 
              onClick={() => setViewMode("list")}
              style={{ background: viewMode === "list" ? "white" : "none", border: "none", padding: "4px", borderRadius: "6px", cursor: "pointer", display: "flex" }}
            >
              <ListIcon size={18} color={viewMode === "list" ? "#0071E3" : "#86868B"} />
            </button>
            <button 
              onClick={() => setViewMode("card")}
              style={{ background: viewMode === "card" ? "white" : "none", border: "none", padding: "4px", borderRadius: "6px", cursor: "pointer", display: "flex" }}
            >
              <LayoutGrid size={18} color={viewMode === "card" ? "#0071E3" : "#86868B"} />
            </button>
          </div>
        </div>
      </div>

      {filteredScraps.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#86868B" }}>
          No scraps found.
        </div>
      ) : (
        <div className="scrap-container" style={{ display: isDesktop ? "flex" : "block", gap: "20px" }}>
          <div className="scrap-left-pane" style={{ flex: isDesktop && selectedScrap ? 1 : "auto", minWidth: 0, display: "flex", flexDirection: "column", gap: "12px" }}>
            <div className={viewMode === "list" ? "scrap-list" : "scrap-grid"}>
              {filteredScraps.map(scrap => (
                <ScrapItem 
                  key={scrap.id} 
                  scrap={scrap} 
                  mode={viewMode} 
                  isDesktop={isDesktop}
                  isSelected={selectedScrap?.id === scrap.id}
                  onSelect={() => setSelectedScrap(scrap)}
                  onDelete={(id) => {
                    if (selectedScrap?.id === id) {
                      setSelectedScrap(null);
                    }
                  }}
                />
              ))}
            </div>
          </div>

          {isDesktop && selectedScrap && (
            <div className="scrap-right-pane" style={{ flex: 1.2, position: "sticky", top: "20px", height: "calc(100vh - 120px)", display: "flex", flexDirection: "column" }}>
              <div className="card" style={{ display: "flex", flexDirection: "column", animation: "fadeIn 0.15s ease", position: "relative", height: "100%", overflow: "hidden" }}>
                <button
                  onClick={() => setSelectedScrap(null)}
                  style={{ position: "absolute", top: "12px", right: "12px", background: "rgba(255,255,255,0.9)", border: "none", borderRadius: "50%", padding: "6px", cursor: "pointer", zIndex: 10, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}
                  title="Close"
                >
                  <X size={18} color="#333" />
                </button>

                {/* 썸네일 */}
                {selectedScrap.thumbnail && (
                  <div style={{ flexShrink: 0 }}>
                    <img
                      src={selectedScrap.thumbnail}
                      alt="thumbnail"
                      style={{ width: "100%", height: "180px", objectFit: "cover", borderRadius: "12px", border: "1px solid rgba(0,0,0,0.05)", display: "block" }}
                    />
                  </div>
                )}

                {/* 제목 + 태그 */}
                <div style={{ flexShrink: 0, marginTop: "16px" }}>
                  <h2 style={{ fontSize: "18px", fontWeight: "700", lineHeight: "1.4", paddingRight: "32px" }}>
                    {selectedScrap.title || "Unanalyzed Scrap"}
                  </h2>
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "10px" }}>
                    {selectedScrap.tags?.filter(t => t && t.trim()).map((t, index) => (
                      <span key={`${t}-${index}`} style={{ fontSize: "12px", background: "rgba(0,113,227,0.1)", color: "#0071E3", padding: "4px 10px", borderRadius: "12px" }}>
                        #{t}
                      </span>
                    ))}
                  </div>
                </div>

                {/* 요약 — 스크롤 영역 */}
                <div style={{ flex: 1, overflowY: "auto", marginTop: "14px", padding: "16px", background: "rgba(0,0,0,0.02)", borderRadius: "12px" }}>
                  <p style={{ fontSize: "14px", lineHeight: "1.7", color: "#333", whiteSpace: "pre-wrap", margin: 0 }}>
                    {selectedScrap.fullSummary || "No summary available."}
                  </p>
                </div>

                {/* 액션 버튼 */}
                <div style={{ flexShrink: 0, display: "flex", gap: "10px", marginTop: "14px" }}>
                  <button
                    className="btn"
                    style={{ flex: 1, padding: "12px", fontSize: "14px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
                    onClick={() => window.open(selectedScrap.url, "_blank")}
                  >
                    View Original
                  </button>
                  <button
                    className="btn btn-secondary"
                    style={{ flex: 1, padding: "12px", fontSize: "14px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", background: "rgba(255, 59, 48, 0.1)", color: "#FF3B30", border: "none" }}
                    onClick={async () => {
                      if (window.confirm("Are you sure you want to delete this?")) {
                        try {
                          await deleteDoc(doc(db, "scraps", selectedScrap.id));
                          setSelectedScrap(null);
                        } catch (error) {
                          console.error(error);
                          alert("An error occurred while deleting.");
                        }
                      }
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ScrapList;
