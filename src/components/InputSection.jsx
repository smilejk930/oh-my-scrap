import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { scrapeUrl } from "../services/scraper";
import { analyzeContent } from "../services/gemini";
import { Clipboard, Loader2, Send, CheckCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// Forced site tags: domains whose common name differs from the hostname-derived tag
const FORCED_SITE_TAGS = {
  "news.hada.io": "GeekNews",
};

const getForcedSiteTag = (url) => {
  try {
    return FORCED_SITE_TAGS[new URL(url).hostname.replace(/^www\./, "")] || null;
  } catch {
    return null;
  }
};

const generateBasicTags = (url, isYoutubeVideo) => {
  if (isYoutubeVideo) return ["YouTube", "Video"];
  const forced = getForcedSiteTag(url);
  if (forced) return [forced];
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    const knownDomains = {
      "github.com": "GitHub", "medium.com": "Medium",
      "twitter.com": "Twitter", "x.com": "X",
      "reddit.com": "Reddit", "instagram.com": "Instagram",
      "linkedin.com": "LinkedIn", "notion.so": "Notion",
      "velog.io": "Velog", "tistory.com": "Tistory",
      "naver.com": "Naver",
    };
    const known = knownDomains[hostname];
    if (known) return [known];
    const parts = hostname.split(".");
    const meaningless = new Set(["blog", "www", "app", "m", "news", "shop"]);
    const fallbackIdx = parts.length >= 2 ? parts.length - 2 : 0;
    const domainPart = meaningless.has(parts[0]) ? (parts[1] ?? parts[0]) : parts[fallbackIdx];
    return [domainPart.charAt(0).toUpperCase() + domainPart.slice(1)];
  } catch {
    return ["Web"];
  }
};

const InputSection = ({ onSuccess }) => {
  const { user, preferredLanguage, useAi } = useAuth();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [preview, setPreview] = useState(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setUrl(text);
    } catch {
      // Silently fail if clipboard access is denied
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!url) return;

    setLoading(true);
    setPreview(null);
    try {
      setStatus("Fetching URL information...");
      const { title, thumbnail, content, description, skipAi, skipReason, isYoutubeVideo } = await scrapeUrl(url, { checkDuration: useAi });

      let analysis;
      if (!useAi) {
        analysis = {
          title,
          tags: generateBasicTags(url, isYoutubeVideo),
          fullSummary: description || ""
        };
      } else if (skipAi) {
        setStatus("Long video detected. Skipping AI...");
        analysis = {
          title,
          tags: ["YouTube", "Video"],
          fullSummary: skipReason || "Skipped AI analysis."
        };
        await new Promise(resolve => setTimeout(resolve, 800));
      } else {
        setStatus(isYoutubeVideo ? "AI is watching the video..." : "AI is analyzing content...");
        analysis = await analyzeContent(content, preferredLanguage, isYoutubeVideo ? url : null);
      }

      // Apply forced site tag (e.g. GeekNews for news.hada.io)
      const forcedTag = getForcedSiteTag(url);
      if (forcedTag && !analysis.tags.some(t => t?.toLowerCase() === forcedTag.toLowerCase())) {
        analysis.tags = [forcedTag, ...analysis.tags].slice(0, 3);
      }

      const newScrap = {
        userId: user.uid,
        url,
        title: analysis.title,
        originalTitle: title,
        thumbnail,
        tags: analysis.tags,
        fullSummary: analysis.fullSummary,
        createdAt: serverTimestamp()
      };

      setPreview(newScrap);
      setStatus("Analysis complete!");

      await addDoc(collection(db, "scraps"), newScrap);

      setTimeout(() => {
        if (isMountedRef.current) onSuccess();
      }, 1500);
    } catch (error) {
      console.error(error);
      alert(error.message);
      if (isMountedRef.current) {
        setLoading(false);
        setStatus("");
      }
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="card"
    >
      <form onSubmit={handleSubmit} className="flex-column">
        <label style={{ fontSize: "14px", fontWeight: "600", color: "#86868B" }}>Enter URL to scrap</label>
        <div style={{ position: "relative", display: "flex", gap: "8px" }}>
          <input
            type="url"
            placeholder="https://example.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={loading}
            required
            style={{ flex: 1 }}
          />
          <button
            type="button"
            onClick={handlePaste}
            disabled={loading}
            title="Paste from clipboard"
            style={{
              flexShrink: 0,
              width: "46px",
              height: "46px",
              borderRadius: "12px",
              border: "none",
              background: "rgba(0,0,0,0.06)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: loading ? "default" : "pointer",
              color: "var(--text-secondary)"
            }}
          >
            <Clipboard size={18} />
          </button>
          <motion.button
            type="submit"
            disabled={loading || !url}
            whileHover={url && !loading ? { scale: 1.06 } : {}}
            whileTap={url && !loading ? { scale: 0.93 } : {}}
            style={{
              flexShrink: 0,
              width: "46px",
              height: "46px",
              borderRadius: "12px",
              border: "none",
              background: url && !loading ? "var(--accent-color)" : "rgba(0,0,0,0.06)",
              color: url && !loading ? "#fff" : "#A1A1A6",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: url && !loading ? "pointer" : "default",
              boxShadow: url && !loading ? "0 4px 12px rgba(0,113,227,0.25)" : "none",
              transition: "background 0.2s, box-shadow 0.2s"
            }}
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
          </motion.button>
        </div>
      </form>

      <AnimatePresence>
        {status && (
          <motion.p
            key="status-text"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            style={{ marginTop: "15px", textAlign: "center", fontSize: "14px", fontWeight: "500", color: "var(--accent-color)" }}
          >
            {status}
          </motion.p>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {preview && (
          <motion.div
            key="preview-card"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{
              marginTop: "20px", padding: "15px", background: "rgba(0,0,0,0.02)",
              borderRadius: "12px", border: "1px solid rgba(0,0,0,0.05)"
            }}
          >
            <div className="scrap-item-row">
              <img
                src={preview.thumbnail || "/placeholder.svg"}
                alt="preview"
                className="scrap-thumbnail"
                onError={(e) => e.target.src = "/placeholder.svg"}
              />
              <div className="scrap-content">
                <h3 className="scrap-title" style={{ fontSize: "18px", color: "#0071E3" }}>{preview.title}</h3>
                <div style={{ display: "flex", gap: "5px", marginTop: "5px" }}>
                  {preview.tags?.filter(tag => tag && tag.trim()).map((tag, index) => (
                    <span key={`${tag}-${index}`} style={{ fontSize: "11px", background: "#eee", padding: "2px 8px", borderRadius: "10px" }}>#{tag}</span>
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
