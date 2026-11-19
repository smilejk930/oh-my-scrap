import { useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { translate } from "./translations";

export const useTranslation = () => {
  const { preferredLanguage, updateLanguage } = useAuth();

  const t = useCallback(
    (key, params) => translate(preferredLanguage, key, params),
    [preferredLanguage]
  );

  return {
    language: preferredLanguage,
    setLanguage: updateLanguage,
    t,
  };
};
