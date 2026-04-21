import React, { useEffect, useState } from "react";
import { db } from "../firebase/firebase";
import { collection, query, where, orderBy, onSnapshot, doc, deleteDoc } from "firebase/firestore";
import { useAuth } from "../context/AuthContext";
import ScrapItem from "./ScrapItem";
import { Search, LayoutGrid, List as ListIcon, Calendar, X } from "lucide-react";
import { format, subDays, startOfDay } from "date-fns";

const ScrapList = () => {
  const { user } = useAuth();
  const [scraps, setScraps] = useState([]); // Firestore에서 불러온 스크랩 전체 목록
  const [viewMode, setViewMode] = useState("list"); // 리스트형('list') 또는 카드형('card') 보기 모드
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

  if (loading) return <p style={{ textAlign: "center", padding: "40px" }}>불러오는 중...</p>;

  return (
    <div className="flex-column" style={{ gap: "20px" }}>
      {/* Search & Layout Toggles */}
      <div className="flex-column" style={{ position: "sticky", top: "10px", zIndex: 10, background: "var(--bg-color)", paddingBottom: "10px" }}>
        <div style={{ position: "relative" }}>
          <Search size={18} style={{ position: "absolute", left: "12px", top: "14px", color: "#86868B" }} />
          <input 
            style={{ paddingLeft: "40px" }}
            placeholder="스크랩 검색..." 
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
                {f === "all" ? "전체" : f === "today" ? "오늘" : f === "week" ? "일주일" : f === "month" ? "한달" : "한달 이후"}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: "5px", background: "rgba(0,0,0,0.05)", padding: "4px", borderRadius: "10px" }}>
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
          데이터가 없습니다.
        </div>
      ) : (
        <div className="scrap-container" style={{ display: isDesktop ? "flex" : "block", gap: "20px" }}>
          <div className="scrap-left-pane" style={{ flex: isDesktop && selectedScrap ? 1 : "auto", display: "flex", flexDirection: "column", gap: "12px" }}>
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
            <div className="scrap-right-pane" style={{ flex: 1, position: "sticky", top: "20px", height: "fit-content", maxHeight: "calc(100vh - 120px)", overflowY: "auto" }}>
              <div className="card" style={{ display: "flex", flexDirection: "column", animation: "fadeIn 0.3s ease", position: "relative" }}>
                <button 
                  onClick={() => setSelectedScrap(null)}
                  style={{ position: "absolute", top: "12px", right: "12px", background: "rgba(255,255,255,0.9)", border: "none", borderRadius: "50%", padding: "6px", cursor: "pointer", zIndex: 10, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}
                  title="닫기"
                >
                  <X size={18} color="#333" />
                </button>
                {selectedScrap.thumbnail && (
                  <img 
                    src={selectedScrap.thumbnail} 
                    alt="thumbnail" 
                    style={{ width: "100%", height: "240px", objectFit: "cover", borderRadius: "12px", border: "1px solid rgba(0,0,0,0.05)" }} 
                  />
                )}
                <h2 style={{ fontSize: "22px", marginTop: "20px", fontWeight: "700" }}>
                  {selectedScrap.title || "분석되지 않은 스크랩"}
                </h2>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "12px" }}>
                  {selectedScrap.tags?.map(t => (
                    <span key={t} style={{ fontSize: "12px", background: "rgba(0,113,227,0.1)", color: "#0071E3", padding: "4px 10px", borderRadius: "12px" }}>
                      #{t}
                    </span>
                  ))}
                </div>
                <div style={{ marginTop: "20px", padding: "20px", background: "rgba(0,0,0,0.02)", borderRadius: "12px" }}>
                  <p style={{ fontSize: "15px", lineHeight: "1.6", color: "#333", whiteSpace: "pre-wrap" }}>
                    {selectedScrap.fullSummary || "요약 정보가 없습니다."}
                  </p>
                </div>
                <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
                  <button 
                    className="btn" 
                    style={{ flex: 1, padding: "14px", fontSize: "15px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }} 
                    onClick={() => window.open(selectedScrap.url, "_blank")}
                  >
                    원문 보기
                  </button>
                  <button 
                    className="btn btn-secondary" 
                    style={{ flex: 1, padding: "14px", fontSize: "15px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", background: "rgba(255, 59, 48, 0.1)", color: "#FF3B30", border: "none" }} 
                    onClick={async () => {
                      if (window.confirm("정말로 삭제하시겠습니까?")) {
                        try {
                          await deleteDoc(doc(db, "scraps", selectedScrap.id));
                          setSelectedScrap(null);
                        } catch (error) {
                          console.error(error);
                          alert("삭제 중 오류가 발생했습니다.");
                        }
                      }
                    }}
                  >
                    삭제하기
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
