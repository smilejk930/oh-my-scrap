import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { db } from "../firebase/firebase";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { useAuth } from "./AuthContext";
import { normalizeUrlForDedup } from "../services/scraper";

const ScrapContext = createContext(null);

// eslint-disable-next-line react-refresh/only-export-components
export const useScraps = () => useContext(ScrapContext);

export const ScrapProvider = ({ children }) => {
  const { user } = useAuth();
  const uid = user?.uid || null;
  const [snapshotState, setSnapshotState] = useState(null);

  useEffect(() => {
    if (!uid) {
      return undefined;
    }

    const q = query(
      collection(db, "scraps"),
      where("userId", "==", uid),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setSnapshotState({ uid, items: data });
      },
      (error) => {
        console.error("Failed to subscribe scraps:", error);
        setSnapshotState({ uid, items: [] });
      }
    );

    return unsubscribe;
  }, [uid]);

  const effectiveScraps = useMemo(
    () => (uid && snapshotState?.uid === uid ? snapshotState.items : []),
    [uid, snapshotState]
  );
  const effectiveLoading = Boolean(uid) && snapshotState?.uid !== uid;

  // 정규화된 URL -> 스크랩 매핑으로 O(1) 중복 감지 지원
  const normalizedUrlMap = useMemo(() => {
    const map = new Map();
    for (const scrap of effectiveScraps) {
      const norm = normalizeUrlForDedup(scrap.url);
      if (norm && !map.has(norm)) {
        map.set(norm, scrap);
      }
    }
    return map;
  }, [effectiveScraps]);

  const findDuplicateScrap = useCallback(
    (rawUrl) => {
      const norm = normalizeUrlForDedup(rawUrl);
      if (!norm) return null;
      return normalizedUrlMap.get(norm) || null;
    },
    [normalizedUrlMap]
  );

  const updateScrap = useCallback(async (id, fields) => {
    if (!id) return;
    await updateDoc(doc(db, "scraps", id), fields);
  }, []);

  const togglePin = useCallback(async (scrap) => {
    if (!scrap?.id) return;
    await updateDoc(doc(db, "scraps", scrap.id), {
      isPinned: !scrap.isPinned,
    });
  }, []);

  const toggleRead = useCallback(async (scrap) => {
    if (!scrap?.id) return;
    await updateDoc(doc(db, "scraps", scrap.id), {
      isRead: !scrap.isRead,
    });
  }, []);

  const markRead = useCallback(async (scrap) => {
    if (!scrap?.id || scrap.isRead === true) return;
    try {
      await updateDoc(doc(db, "scraps", scrap.id), {
        isRead: true,
      });
    } catch (err) {
      console.warn("Failed to mark scrap as read:", err);
    }
  }, []);

  const saveUserNote = useCallback(async (id, userNote) => {
    if (!id) return;
    const cleanNote = typeof userNote === "string" ? userNote.slice(0, 5000) : "";
    await updateDoc(doc(db, "scraps", id), {
      userNote: cleanNote,
    });
  }, []);

  const toggleCheckedItem = useCallback(async (scrap, itemKey) => {
    if (!scrap?.id || !itemKey) return;
    const current = Array.isArray(scrap.checkedItems) ? scrap.checkedItems : [];
    const exists = current.includes(itemKey);
    const next = exists
      ? current.filter((k) => k !== itemKey)
      : [...current, itemKey].slice(0, 100);
    await updateDoc(doc(db, "scraps", scrap.id), {
      checkedItems: next,
    });
  }, []);

  const resetCheckedItems = useCallback(async (id) => {
    if (!id) return;
    await updateDoc(doc(db, "scraps", id), {
      checkedItems: [],
    });
  }, []);

  const deleteScrap = useCallback(async (id) => {
    if (!id) return;
    await deleteDoc(doc(db, "scraps", id));
  }, []);

  const value = useMemo(
    () => ({
      scraps: effectiveScraps,
      loading: effectiveLoading,
      findDuplicateScrap,
      updateScrap,
      togglePin,
      toggleRead,
      markRead,
      saveUserNote,
      toggleCheckedItem,
      resetCheckedItems,
      deleteScrap,
    }),
    [
      effectiveScraps,
      effectiveLoading,
      findDuplicateScrap,
      updateScrap,
      togglePin,
      toggleRead,
      markRead,
      saveUserNote,
      toggleCheckedItem,
      resetCheckedItems,
      deleteScrap,
    ]
  );

  return <ScrapContext.Provider value={value}>{children}</ScrapContext.Provider>;
};
