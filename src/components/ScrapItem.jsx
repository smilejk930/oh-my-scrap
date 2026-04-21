import React, { useState } from "react";
import { ExternalLink, ChevronDown, ChevronUp, Clock, Tag, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { scrapeUrl } from "../services/scraper";
import { analyzeContent } from "../services/gemini";
import { db } from "../firebase/firebase";
import { doc, updateDoc, deleteDoc } from "firebase/firestore";

const ScrapItem = ({ scrap, mode, isDesktop, isSelected, onSelect, onDelete }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const createdAt = scrap.createdAt?.toDate();
  const dateStr = createdAt ? format(createdAt, "yy.MM.dd") : "Just now";

  const handleDelete = async (e) => {
    e.stopPropagation();
    if (window.confirm("Are you sure you want to delete this?")) {
      try {
        await deleteDoc(doc(db, "scraps", scrap.id));
        if (onDelete) onDelete(scrap.id);
      } catch (error) {
        console.error(error);
        alert("An error occurred while deleting.");
      }
    }
  };

  // 텔레그램 등을 통해 들어온 분석 안된 데이터 처리
  const handleDelayedAnalysis = async (e) => {
    e.stopPropagation();
    if (isAnalyzing) return;

    setIsAnalyzing(true);
    try {
      const { title, thumbnail, content } = await scrapeUrl(scrap.url);
      const analysis = await analyzeContent(content);
      
      const scrapRef = doc(db, "scraps", scrap.id);
      await updateDoc(scrapRef, {
        title: analysis.title,
        originalTitle: title,
        thumbnail,
        tags: analysis.tags,
        fullSummary: analysis.fullSummary
      });
    } catch (error) {
      console.error(error);
      alert("An error occurred during analysis.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleOpen = () => {
    window.open(scrap.url, "_blank");
  };

  if (mode === "card") {
    return (
      <motion.div 
        layout
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="card" 
        style={{ padding: "0", overflow: "hidden", display: "flex", flexDirection: "column" }}
      >
        <div style={{ height: "160px", background: "#f0f0f0", position: "relative" }}>
          {scrap.thumbnail ? (
            <img src={scrap.thumbnail} alt="thumb" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#86868B" }}>
              <Tag size={40} opacity={0.2} />
            </div>
          )}
          <div style={{ position: "absolute", top: "10px", right: "10px", display: "flex", gap: "6px" }}>
            <button className="btn" style={{ padding: "8px", borderRadius: "50%", background: "rgba(255,255,255,0.8)", backdropFilter: "blur(10px)", color: "#FF3B30", border: "none" }} onClick={handleDelete}>
              <Trash2 size={18} />
            </button>
            <button className="btn" style={{ padding: "8px", borderRadius: "50%", background: "rgba(255,255,255,0.8)", backdropFilter: "blur(10px)", color: "#0071E3", border: "none" }} onClick={handleOpen}>
              <ExternalLink size={18} />
            </button>
          </div>
        </div>
        <div style={{ padding: "15px" }}>
          <h3 className="scrap-title" style={{ fontSize: "17px", whiteSpace: "normal", marginBottom: "8px" }}>
            {scrap.title || "Unanalyzed Scrap"}
          </h3>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "10px" }}>
            <span style={{ fontSize: "12px", color: "#86868B" }}>{dateStr}</span>
            {!scrap.title && (
              <button className="btn btn-secondary" style={{ fontSize: "11px", padding: "4px 10px" }} onClick={handleDelayedAnalysis} disabled={isAnalyzing}>
                {isAnalyzing ? "Analyzing..." : "Analyze with AI"}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    );
  }

  // List Mode
  return (
    <motion.div 
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`card ${isSelected ? "selected" : ""}`} 
      style={{ 
        padding: "12px", 
        marginBottom: "0", 
        border: isSelected ? "2px solid #0071E3" : "1px solid rgba(0,0,0,0.05)",
        cursor: "pointer",
        transition: "all 0.2s ease"
      }}
      onClick={() => isDesktop ? onSelect() : setIsExpanded(!isExpanded)}
    >
      <div className="scrap-item-row">
        {scrap.thumbnail ? (
          <img src={scrap.thumbnail} alt="thumb" className="scrap-thumbnail" />
        ) : (
          <div className="scrap-thumbnail" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Tag size={20} opacity={0.3} />
          </div>
        )}
        <div className="scrap-content">
          <h3 className="scrap-title">{scrap.title || "Unanalyzed Scrap"}</h3>
          <div className="flex-between">
            <div style={{ display: "flex", gap: "5px", overflow: "hidden" }}>
              {scrap.tags?.map(tag => (
                <span key={tag} style={{ fontSize: "10px", background: "rgba(0,0,0,0.05)", padding: "1px 6px", borderRadius: "8px", color: "#86868B" }}>#{tag}</span>
              ))}
            </div>
            <span style={{ fontSize: "11px", color: "#86868B", marginLeft: "10px" }}>{dateStr}</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          {!scrap.title ? (
            <button className="btn btn-secondary" style={{ padding: "6px 12px", fontSize: "12px" }} onClick={handleDelayedAnalysis}>
              {isAnalyzing ? "..." : "Analyze"}
            </button>
          ) : (
            !isDesktop && (
              <button style={{ background: "none", border: "none", color: "#C7C7CC" }}>
                {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </button>
            )
          )}
          <button className="btn btn-secondary" style={{ padding: "6px", color: "#FF3B30", border: "none", background: "none" }} onClick={handleDelete}>
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      {!isDesktop && isExpanded && scrap.fullSummary && (
        <motion.div 
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          style={{ marginTop: "15px", paddingTop: "15px", borderTop: "1px solid rgba(0,0,0,0.05)" }}
        >
          <p style={{ fontSize: "14px", color: "#424245", marginBottom: "15px" }}>{scrap.fullSummary}</p>
          <button className="btn btn-secondary" style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }} onClick={handleOpen}>
            <ExternalLink size={16} />
            View Original
          </button>
        </motion.div>
      )}
    </motion.div>
  );
};

export default ScrapItem;
