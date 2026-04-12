import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
import ModernLoginPage from './Login'
import RegistrationPage from "./Registration";
import Catalogue from './Catalogue'
import Users from './Users'
import RequireAuth from './RequireAuth'
import Dashboard from './Dashboard';
import Consumers from "./Final_Consumers";
import DiscountGroupSettingsPage from "./DiscountGroupSettingsPage";
import Masters_data from "./Masters_page";
import Layout from "./Layout";
import Home from "./Home";
import CartSidebar from "./Cartsidebar";
import Messages from './Messages';
import Settings from "./Settings";
import { LanguageProvider } from "./i18n";

const useGoogleTranslate = () => {
  useEffect(() => {
    window.googleTranslateElementInit = () => {
      new window.google.translate.TranslateElement({
        pageLanguage: 'en',
        includedLanguages: 'en,hi,pa',
        layout: window.google.translate.TranslateElement.InlineLayout.SIMPLE,
        autoDisplay: false,
      }, 'google_translate_element');
    };

    const existingTranslateScript = document.querySelector(
      'script[src*="translate.google.com/translate_a/element.js?cb=googleTranslateElementInit"]'
    );

    if (!existingTranslateScript) {
      const script = document.createElement('script');
      script.id = 'google-translate-script';
      script.src = "//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
      document.body.appendChild(script);
    }
  }, []);
};

function App() {

  useGoogleTranslate();

  useEffect(() => {
  // Mark that the page is loaded (set on every load)
  sessionStorage.setItem("page_loaded", "true");

  const handleBeforeUnload = () => {
    // On refresh, sessionStorage persists — so "page_loaded" will still be there after reload.
    // On tab close, sessionStorage is cleared by the browser.
    // We can't distinguish perfectly in beforeunload, so we defer logout check to load time instead.
    localStorage.removeItem("logout_pending");
    localStorage.setItem("logout_pending", Date.now());
  };

  // On page load, check if a logout was pending from a previous unload
  // If sessionStorage is empty, it means the browser was fully closed (not just refreshed)
  const wasRefresh = sessionStorage.getItem("page_loaded");
  if (!wasRefresh) {
    // True browser close → send logout
    const encrypted_data = localStorage.getItem('data') || '';
    const user_id_data   = localStorage.getItem('user_id') || '';
    if (encrypted_data) {
      navigator.sendBeacon(
        "http://localhost:8000/api/logout/",
        new Blob([JSON.stringify({ encrypted_data, user_id_data })], {
          type: "application/json"
        })
      );
      localStorage.clear();
    }
  }

  window.addEventListener("beforeunload", handleBeforeUnload);
  return () => window.removeEventListener("beforeunload", handleBeforeUnload);
}, []);

  return (
    <LanguageProvider>
      <div className="w-screen h-screen bg-white dark:bg-slate-950">
        <BrowserRouter>
          <ThemeController />
          <CartSidebar />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<ModernLoginPage />} />
            <Route path="/register" element={<RegistrationPage />} />
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route element={<Layout />}>
              <Route path="/dashboard" element={<RequireAuth allowedRoles={["Customer", "Owner", "Employee"]}><Dashboard /></RequireAuth>} />
              <Route path="/catalogue" element={<RequireAuth allowedRoles={["Customer", "Employee"]} ><Catalogue /></RequireAuth>} />
              <Route path="/messages" element={<RequireAuth allowedRoles={["Customer", "Employee", "Owner"]}><Messages /></RequireAuth>} />
              <Route path="/users" element={<RequireAuth allowedRoles={["Owner"]} ><Users /></RequireAuth>} />
              <Route
                path="/owner/users/:employeeId/customers"
                element={<RequireAuth allowedRoles={["Owner","Employee"]}><Consumers /></RequireAuth>}
              />
              <Route path="/masters" 
                element={<RequireAuth allowedRoles={["Owner"]}><Masters_data /></RequireAuth>}
              />
              <Route path="/discount-group-settings" element={<RequireAuth allowedRoles={["Owner"]}><DiscountGroupSettingsPage /></RequireAuth>} />
              <Route path="/settings" element={<RequireAuth><Settings /></RequireAuth>} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </div>
    </LanguageProvider>
  )
}

const ThemeController = () => {
  const location = useLocation();

  useEffect(() => {
    const darkMode = localStorage.getItem("dark_mode") === "true";
    const lightPages = ["/login", "/register"];
    const shouldUseDark = !lightPages.includes(location.pathname) && darkMode;
    document.documentElement.classList.toggle("dark", shouldUseDark);
  }, [location.pathname]);

  return null;
};

export default App;