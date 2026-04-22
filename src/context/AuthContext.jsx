import React, { createContext, useContext, useEffect, useState } from "react";
import { auth, googleProvider, db } from "../firebase/firebase";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

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
            setUser(prev => ({ ...prev, settings: docSnap.data() }));
          } else {
            // 초기 설정 생성 (기본 언어: 영어)
            const initialSettings = { language: "en", useAi: false };
            setDoc(userDocRef, initialSettings);
            setUser(prev => ({ ...prev, settings: initialSettings }));
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

  const login = () => signInWithPopup(auth, googleProvider);
  const logout = () => signOut(auth);

  const updateLanguage = async (lang) => {
    if (!user) return;
    const userDocRef = doc(db, "users", user.uid);
    await setDoc(userDocRef, { language: lang }, { merge: true });
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
    preferredLanguage: user?.settings?.language || "en",
    useAi: user?.settings?.useAi ?? false,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
