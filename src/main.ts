// main.ts - ALTERNATYWA
import "bootstrap/dist/css/bootstrap.min.css";

import { createApp } from "vue";
import { createPinia } from "pinia";
import { useAuthStore } from "./stores/authStore";

import App from "./App.vue";
import router from "./router";

// Import Bootstrap JavaScript
import "bootstrap/dist/js/bootstrap.bundle.min.js";

// Deklaracja globalnego Bootstrap bez importu typu
declare global {
  interface Window {
    bootstrap: any;
  }
}

const app = createApp(App);

app.use(createPinia());
app.use(router);

// Montuj aplikację
app.mount("#app");

// Inicjalizacja auth po zamontowaniu aplikacji
const authStore = useAuthStore();
authStore.checkAuth();

// Funkcja inicjalizacji dropdowns
const initializeDropdowns = () => {
  if (typeof window !== "undefined" && window.bootstrap) {
    try {
      const dropdownElementList = document.querySelectorAll(".dropdown-toggle");
      const dropdownList = [...dropdownElementList].map((dropdownToggleEl) => {
        // Sprawdź czy dropdown już nie istnieje
        if (!window.bootstrap.Dropdown.getInstance(dropdownToggleEl)) {
          return new window.bootstrap.Dropdown(dropdownToggleEl);
        }
        return window.bootstrap.Dropdown.getInstance(dropdownToggleEl);
      });

      console.log("Bootstrap dropdowns initialized:", dropdownList.length);
      return dropdownList;
    } catch (error) {
      console.warn("Failed to initialize Bootstrap dropdowns:", error);
      return [];
    }
  }
  return [];
};

// Dodaj event listener dla Bootstrap dropdowns po załadowaniu
document.addEventListener("DOMContentLoaded", () => {
  // Opóźnij inicjalizację żeby upewnić się że Bootstrap jest dostępny
  setTimeout(() => {
    initializeDropdowns();
  }, 100);
});

// Dodatkowa inicjalizacja dla Vue router
router.afterEach(() => {
  setTimeout(() => {
    initializeDropdowns();
  }, 200);
});

// Dodatkowa inicjalizacja gdy okno się załaduje
window.addEventListener("load", () => {
  setTimeout(() => {
    initializeDropdowns();
  }, 300);
});
