import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

import en from "./locales/en.json";
import ky from "./locales/ky.json";
import ru from "./locales/ru.json";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      ky: { translation: ky },
      ru: { translation: ru },
      en: { translation: en },
    },
    fallbackLng: "ky",
    supportedLngs: ["ky", "ru", "en"],
    interpolation: { escapeValue: false },
    detection: {
      // New visitors always start in Kyrgyz regardless of browser locale;
      // only an explicit switch (remembered in localStorage) changes it.
      order: ["localStorage"],
      caches: ["localStorage"],
    },
  });

export default i18n;
