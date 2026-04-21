import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { scrapeUrl } from "../services/scraper";
import { analyzeContent } from "../services/gemini";
import { Loader2, Send, CheckCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const InputSection = ({ onSuccess }) => {
  const { user } = useAuth(); // 현재 로그인한 사용자 정보
  const [url, setUrl] = useState(""); // 입력된 URL 상태
  const [loading, setLoading] = useState(false); // 로딩 상태 제어 (스크래핑 로직 진행 중 버튼 비활성화용)
  const [status, setStatus] = useState(""); // 현재 진행 상태 텍스트 (스크래핑 중, 분석 중 등)
  const [preview, setPreview] = useState(null); // 분석이 완료된 결과 미리보기 데이터 객체

  // 폼 제출 시 실행되는 메인 로직 (URL 스크래핑 -> Gemini 분석 -> Firestore 저장)
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!url) return;

    setLoading(true);
    setPreview(null);
    try {
      // 1. Scraping: 입력된 URL로부터 내용과 이미지(썸네일), 제목을 추출함
      setStatus("Fetching URL information...");
      const { title, thumbnail, content } = await scrapeUrl(url);
      
      // 2. Gemini Analysis: 추출된 내용을 바탕으로 대표 문구(title)와 태그, 전체 요약 생성
      setStatus("AI is analyzing content...");
      const analysis = await analyzeContent(content);
      
      const newScrap = {
        userId: user.uid,
        url,
        title: analysis.title, // 20자 이내 요약
        originalTitle: title,
        thumbnail,
        tags: analysis.tags,
        fullSummary: analysis.fullSummary,
        createdAt: serverTimestamp()
      };

      setPreview(newScrap);
      setStatus("Analysis complete!");
      
      // 3. Save to Firestore: 생성된 최종 데이터를 DB(scraps 컬렉션)에 문서로 추가
      await addDoc(collection(db, "scraps"), newScrap);
      
      // 성공 시 잠시 대기 후 리스트(보관함) 탭으로 이동
      setTimeout(() => {
        onSuccess(); // 보관함으로 이동
      }, 1500);
    } catch (error) {
      console.error(error);
      alert(error.message);
    } finally {
      setLoading(false);
      setStatus("");
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="card"
    >
      <form onSubmit={handleSubmit} className="flex-column">
        <label style={{ fontSize: "14px", fontWeight: "600", color: "#86868B" }}>Enter URL to scrap</label>
        <div style={{ position: "relative" }}>
          <input 
            type="url" 
            placeholder="https://example.com" 
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={loading}
            required
          />
          <motion.button 
            type="submit" 
            style={{ 
              position: "absolute", 
              right: "6px", 
              top: "50%", 
              y: "-50%", // motion's version of translateY(-50%)
              width: "38px",
              height: "38px",
              borderRadius: "50%",
              display: "flex", 
              alignItems: "center", 
              justifyContent: "center",
              border: "none",
              cursor: url && !loading ? "pointer" : "default",
              backgroundColor: url ? "var(--accent-color)" : "rgba(0, 0, 0, 0.04)",
              color: url ? "#ffffff" : "#A1A1A6",
              boxShadow: url && !loading ? "0 4px 12px rgba(0, 113, 227, 0.2)" : "none",
              transition: { duration: 0.2 }
            }}
            whileHover={url && !loading ? { scale: 1.08, backgroundColor: "#0077ED" } : {}}
            whileTap={url && !loading ? { scale: 0.92 } : {}}
            disabled={loading || !url}
          >
            {loading ? (
              <Loader2 className="animate-spin" size={18} />
            ) : (
              <Send size={18} />
            )}
          </motion.button>
        </div>
      </form>

      <AnimatePresence>
        {status && (
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ marginTop: "15px", textAlign: "center", fontSize: "14px", fontWeight: "500" }}
          >
            {status}
          </motion.p>
        )}

        {preview && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{ 
              marginTop: "20px", padding: "15px", background: "rgba(0,0,0,0.02)", 
              borderRadius: "12px", border: "1px solid rgba(0,0,0,0.05)"
            }}
          >
            <div className="scrap-item-row">
              {preview.thumbnail && <img src={preview.thumbnail} alt="preview" className="scrap-thumbnail" />}
              <div className="scrap-content">
                <h3 className="scrap-title" style={{ fontSize: "18px", color: "#0071E3" }}>{preview.title}</h3>
                <div style={{ display: "flex", gap: "5px", marginTop: "5px" }}>
                  {preview.tags?.map(tag => (
                    <span key={tag} style={{ fontSize: "11px", background: "#eee", padding: "2px 8px", borderRadius: "10px" }}>#{tag}</span>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ marginTop: "10px", display: "flex", alignItems: "center", gap: "5px", color: "#34C759" }}>
              <CheckCircle size={16} />
              <span style={{ fontSize: "13px", fontWeight: "600" }}>Saved successfully!</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default InputSection;
