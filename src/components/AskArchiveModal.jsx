import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { X, Sparkles, Send, Loader2, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { useScraps } from "../context/ScrapContext";
import { useAuth } from "../context/AuthContext";
import { askMyScraps } from "../services/gemini";
import { useTranslation } from "../i18n/useTranslation";

const AskArchiveModal = ({ onClose, onSelectScrap, initialQuestion = "" }) => {
  const { scraps } = useScraps();
  const { preferredLanguage } = useAuth();
  const { t } = useTranslation();
  const [input, setInput] = useState(initialQuestion);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrapMap = useMemo(() => {
    const map = new Map();
    for (const s of scraps) {
      map.set(s.id, s);
    }
    return map;
  }, [scraps]);

  const starterQuestions = useMemo(() => {
    const suggestions = [];
    const hasRecipe = scraps.some(
      (s) => s.contentType === "recipe" || s.tags?.some((tag) => /recipe|레시피|食谱|菜谱/i.test(tag))
    );
    if (hasRecipe) {
      suggestions.push(t("ask.starterRecipes"));
    }

    const tagCounts = new Map();
    for (const s of scraps) {
      for (const rawTag of s.tags || []) {
        const cleanTag = rawTag?.trim();
        if (!cleanTag) continue;
        tagCounts.set(cleanTag, (tagCounts.get(cleanTag) || 0) + 1);
      }
    }
    const topTag = [...tagCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    if (topTag) {
      suggestions.push(t("ask.starterTopTag", { tag: topTag }));
    }

    suggestions.push(t("ask.starterThisWeek"));
    return suggestions.slice(0, 3);
  }, [scraps, t]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && !loading) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [loading, onClose]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const submitQuestion = useCallback(
    async (questionText) => {
      const clean = questionText.trim();
      if (!clean || loading) return;

      const userMsg = { id: `u-${Date.now()}`, role: "user", text: clean };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setLoading(true);

      try {
        const res = await askMyScraps(clean, scraps, preferredLanguage);
        const matchedScraps = res.matchedIds
          .map((id) => scrapMap.get(id))
          .filter(Boolean);

        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: "assistant",
            text: res.answer,
            matchedScraps,
            followUps: res.followUpSuggestions || [],
          },
        ]);
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          {
            id: `e-${Date.now()}`,
            role: "assistant",
            error: err.message || t("ask.queryFailed"),
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [loading, scraps, preferredLanguage, scrapMap, t]
  );

  const handleFormSubmit = (e) => {
    e.preventDefault();
    submitQuestion(input);
  };

  return (
    <motion.div
      className="dialog-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
    >
      <motion.div
        className="dialog-box ask-modal-box"
        initial={{ opacity: 0, y: 36 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 36 }}
        transition={{ type: "spring", damping: 26, stiffness: 280 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dialog-header">
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span className="ask-header-badge">
              <Sparkles size={15} />
            </span>
            <div>
              <h2 style={{ fontSize: "18px", fontWeight: "700", letterSpacing: "-0.02em", margin: 0 }}>
                {t("ask.title")}
              </h2>
              <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: 0 }}>
                {t("ask.subtitle", { count: scraps.length })}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="icon-circle-btn"
            aria-label={t("common.close")}
          >
            <X size={16} />
          </button>
        </div>

        <div className="ask-messages">
          {messages.length === 0 ? (
            <div className="ask-empty-state">
              <p style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "12px" }}>
                {t("ask.emptyPrompt")}
              </p>
              <div className="ask-starter-chips">
                {starterQuestions.map((q) => (
                  <button
                    key={q}
                    type="button"
                    className="ask-suggestion-chip"
                    onClick={() => submitQuestion(q)}
                    disabled={loading}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className={`ask-bubble-row ${msg.role}`}>
                <div className={`ask-bubble ${msg.role} ${msg.error ? "error" : ""}`}>
                  {msg.error ? (
                    <span>{t("common.errorPrefix", { message: msg.error })}</span>
                  ) : (
                    <p style={{ margin: 0, whiteSpace: "pre-wrap", color: "inherit", fontSize: "14px", lineHeight: 1.6 }}>
                      {msg.text}
                    </p>
                  )}

                  {msg.matchedScraps?.length > 0 && (
                    <div className="ask-sources-block">
                      <div className="ask-sources-label">{t("ask.sources")}</div>
                      <div className="ask-sources-grid">
                        {msg.matchedScraps.map((s) => {
                          const d = s.createdAt?.toDate ? format(s.createdAt.toDate(), "yy.MM.dd") : "";
                          return (
                            <button
                              key={s.id}
                              type="button"
                              className="ask-source-card"
                              onClick={() => {
                                onSelectScrap(s);
                                onClose();
                              }}
                            >
                              <img
                                src={s.thumbnail || "/placeholder.svg"}
                                alt=""
                                onError={(e) => {
                                  e.target.src = "/placeholder.svg";
                                }}
                              />
                              <div className="ask-source-info">
                                <span className="ask-source-title">{s.title || t("common.unanalyzedScrap")}</span>
                                {d && <span className="ask-source-date">{d}</span>}
                              </div>
                              <ExternalLink size={12} style={{ flexShrink: 0, opacity: 0.5 }} />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {msg.followUps?.length > 0 && (
                    <div className="ask-followups">
                      {msg.followUps.map((f) => (
                        <button
                          key={f}
                          type="button"
                          className="ask-suggestion-chip small"
                          onClick={() => submitQuestion(f)}
                          disabled={loading}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}

          {loading && (
            <div className="ask-bubble-row assistant">
              <div className="ask-bubble assistant" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Loader2 className="animate-spin" size={16} color="var(--accent-color)" />
                <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                  {t("ask.searching")}
                </span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <form className="dialog-url-row" onSubmit={handleFormSubmit}>
          <input
            type="text"
            placeholder={t("ask.inputPlaceholder")}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            style={{ flex: 1, margin: 0 }}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="ask-send-btn"
            aria-label={t("ask.sendQuestion")}
            style={{
              background: input.trim() && !loading ? "var(--accent-color)" : "rgba(0,0,0,0.06)",
              color: input.trim() && !loading ? "#fff" : "#A1A1A6",
              cursor: input.trim() && !loading ? "pointer" : "default",
            }}
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
          </button>
        </form>
      </motion.div>
    </motion.div>
  );
};

export default AskArchiveModal;
