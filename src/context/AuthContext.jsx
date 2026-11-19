import React, { createContext, useContext, useEffect, useState } from "react";
import { auth, googleProvider, db } from "../firebase/firebase";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { doc, setDoc, onSnapshot } from "firebase/firestore";
import { normalizeLanguage } from "../i18n/translations";

const LANGUAGE_STORAGE_KEY = "oms_language";

const readCachedLanguage = () => {
  if (typeof window === "undefined") return "en";
  try {
    return normalizeLanguage(window.localStorage.getItem(LANGUAGE_STORAGE_KEY));
  } catch {
    return "en";
  }
};

const writeCachedLanguage = (lang) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, normalizeLanguage(lang));
  } catch {
    // ignore storage failures
  }
};

const AuthContext = createContext();

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cachedLanguage, setCachedLanguage] = useState(() => readCachedLanguage());

  useEffect(() => {
    let unsubscribeSettings;
    const unsubscribeAuth = onAuthStateChanged(auth, async (authUser) => {
      if (authUser) {
        // 기본 유저 정보 설정
        setUser(authUser);

        // Firestore에서 유저 설정 실시간 감시 (언어 등)
        const userDocRef = doc(db, "users", authUser.uid);
        unsubscribeSettings = onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data?.language === "en" || data?.language === "ko") {
              writeCachedLanguage(data.language);
              setCachedLanguage(data.language);
            }
            setUser((prev) => ({ ...prev, settings: data }));
          } else {
            // 초기 설정 생성 (캐시된 언어 우선, 기본값: 영어)
            const initialSettings = { language: readCachedLanguage(), useAi: false };
            setDoc(userDocRef, initialSettings);
            setUser((prev) => ({ ...prev, settings: initialSettings }));
          }
          setLoading(false);
        });
      } else {
        setUser(null);
        if (unsubscribeSettings) unsubscribeSettings();
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeSettings) unsubscribeSettings();
    };
  }, []);

  const preferredLanguage = normalizeLanguage(user?.settings?.language || cachedLanguage);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = preferredLanguage;
    }
  }, [preferredLanguage]);

  const login = () => signInWithPopup(auth, googleProvider);
  const logout = () => signOut(auth);

  const updateLanguage = async (lang) => {
    const normalized = normalizeLanguage(lang);
    writeCachedLanguage(normalized);
    setCachedLanguage(normalized);
    if (!user) return;
    setUser((prev) =>
      prev ? { ...prev, settings: { ...(prev.settings || {}), language: normalized } } : prev
    );
    try {
      const userDocRef = doc(db, "users", user.uid);
      await setDoc(userDocRef, { language: normalized }, { merge: true });
    } catch (error) {
      console.error("Failed to save language preference:", error);
    }
  };

  const updateUseAi = async (val) => {
    if (!user) return;
    const userDocRef = doc(db, "users", user.uid);
    await setDoc(userDocRef, { useAi: val }, { merge: true });
  };

  const value = {
    user,
    login,
    logout,
    updateLanguage,
    updateUseAi,
    preferredLanguage,
    useAi: user?.settings?.useAi ?? false,
    loading,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
