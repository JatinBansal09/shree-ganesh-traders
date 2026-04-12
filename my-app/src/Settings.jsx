// src/Settings.jsx
import { useState, useEffect } from "react";
import {
  Bell, Lock, Palette, Globe, Shield,
  Eye, EyeOff, ChevronRight, Check, AlertCircle,
  Volume2, Smartphone, Mail, RefreshCw, Save,
} from "lucide-react";
import apiFetch from "./utils/apiClient";
import { getUserInfo } from "./auth_utils";
import { useTranslation } from "./i18n";
import TT from "./utils/TT";


// ── Reusable Toggle ───────────────────────────────────────────────────────────
const Toggle = ({ checked, onChange, disabled }) => (
  <button
    onClick={() => !disabled && onChange(!checked)}
    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none ${
      checked ? "bg-[#F7941D]" : "bg-gray-200"
    } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
  >
    <span
      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
        checked ? "translate-x-6" : "translate-x-1"
      }`}
    />
  </button>
);

// ── Reusable Section ──────────────────────────────────────────────────────────
const Section = ({ icon: Icon, title, description, children }) => (
  <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-4">
    <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-50">
      <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center">
        <Icon size={15} className="text-[#F7941D]" />
      </div>
      <div>
        <p className="text-sm font-medium text-gray-800"><TT>{title}</TT></p>
        <p className="text-xs text-gray-400"><TT>{description}</TT></p>
      </div>
    </div>
    <div className="divide-y divide-gray-50">{children}</div>
  </div>
);

// ── Reusable Row ──────────────────────────────────────────────────────────────
const SettingRow = ({ label, description, children }) => (
  <div className="flex items-center justify-between px-6 py-4">
    <div>
      <p className="text-sm text-gray-700">{label}</p>
      {description && <p className="text-xs text-gray-400 mt-0.5">{description}</p>}
    </div>
    <div className="shrink-0 ml-4">{children}</div>
  </div>
);

// ── Change Password Modal ─────────────────────────────────────────────────────
const ChangePasswordModal = ({ onClose }) => {
  const [form, setForm]         = useState({ old: "", new_: "", confirm: "" });
  const [showOld, setShowOld]   = useState(false);
  const [showNew, setShowNew]   = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]       = useState("");
  const [success, setSuccess]   = useState(false);

  const handleSubmit = async () => {
    setError("");
    if (!form.old || !form.new_ || !form.confirm) {
      setError("All fields are required.");
      return;
    }
    if (form.new_.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (form.new_ !== form.confirm) {
      setError("Passwords do not match.");
      return;
    }
    try {
      setSubmitting(true);
      await apiFetch("/api/employee/change-password/", {
        method: "POST",
        body: JSON.stringify({ old_password: form.old, new_password: form.new_ }),
      });
      setSuccess(true);
      setTimeout(onClose, 1500);
    } catch (err) {
      const msg = err?.data?.error || "Failed to change password. Try again later.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl">
        <div className="flex justify-between items-center px-5 pt-5 pb-3 border-b border-gray-100">
          <p className="text-base font-medium text-gray-800">Change Password</p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
        </div>
        <div className="px-5 py-4 space-y-3">
          {success ? (
            <div className="flex flex-col items-center gap-2 py-4">
              <Check size={36} className="text-green-500" />
              <p className="text-sm text-gray-700">Password changed successfully!</p>
            </div>
          ) : (
            <>
              {/* Old password */}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Current Password</label>
                <div className="relative">
                  <input
                    type={showOld ? "text" : "password"}
                    value={form.old}
                    onChange={(e) => setForm(f => ({ ...f, old: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 pr-10 text-sm focus:outline-none focus:border-[#F7941D]"
                    placeholder="Enter current password"
                  />
                  <button onClick={() => setShowOld(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {showOld ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* New password */}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">New Password</label>
                <div className="relative">
                  <input
                    type={showNew ? "text" : "password"}
                    value={form.new_}
                    onChange={(e) => setForm(f => ({ ...f, new_: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 pr-10 text-sm focus:outline-none focus:border-[#F7941D]"
                    placeholder="Min. 8 characters"
                  />
                  <button onClick={() => setShowNew(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* Confirm */}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Confirm New Password</label>
                <input
                  type="password"
                  value={form.confirm}
                  onChange={(e) => setForm(f => ({ ...f, confirm: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#F7941D]"
                  placeholder="Repeat new password"
                />
              </div>

              {error && (
                <p className="text-xs text-red-400 flex items-center gap-1">
                  <AlertCircle size={11} /> {error}
                </p>
              )}
            </>
          )}
        </div>
        {!success && (
          <div className="flex justify-end gap-2 px-5 pb-5">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className={`px-4 py-2 text-sm text-white rounded-lg transition ${
                submitting ? "bg-gray-300 cursor-not-allowed" : "bg-[#F7941D] hover:bg-[#e8860f]"
              }`}
            >
              {submitting ? "Saving..." : "Update Password"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Main Settings Page ────────────────────────────────────────────────────────
const Settings = () => {
  const { language, setLanguage, t } = useTranslation();
  const [currentLanguage, setCurrentLanguage] = useState(language);
  const [userRole, setUserRole]   = useState(null);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  // ── Settings state ────────────────────────────────────────────────────────
  const [settings, setSettings] = useState(() => ({
    // Notifications
    email_notifications:   true,
    order_alerts:          true,
    marketing_emails:      false,
    customer_messages:     true,
    system_notifications:  true,
    low_stock_alerts:      true,

    // Alert config
    alert_sound:           true,
    vibration:             false,
    priority:              "high",   // high | medium | low

    // Security
    two_factor:            false,
    session_timeout:       true,

    // Appearance
    dark_mode:             false,
    compact_view:          false,

    // Language
    language,
    number_format:         "en-IN",
  }));

  // ── Load settings & user role ─────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      try {
        const userData = await getUserInfo();
        setUserRole(userData.user_role);

        const res = await apiFetch("/api/employee/settings/");
        if (res) setSettings(prev => ({ ...prev, ...res }));
      } catch (err) {
        console.error("Failed to load settings:", err);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  useEffect(() => {
    const savedDarkMode = localStorage.getItem("dark_mode");
    if (savedDarkMode !== null) {
      setSettings(prev => ({ ...prev, dark_mode: savedDarkMode === "true" }));
    }
  }, []);

  useEffect(() => {
    if (settings.language && settings.language !== language) {
      const savedLanguage = localStorage.getItem("language");
      if (!savedLanguage || savedLanguage === settings.language) {
        setLanguage(settings.language);
      }
    }
  }, [settings.language, language, setLanguage]);

  useEffect(() => {
    if (currentLanguage !== language) {
      setCurrentLanguage(language);
    }
  }, [language, currentLanguage]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", settings.dark_mode);
    if (settings.dark_mode) {
      localStorage.setItem("dark_mode", "true");
    } else {
      localStorage.removeItem("dark_mode");
    }
  }, [settings.dark_mode]);

  const set = (key, value) => setSettings(prev => ({ ...prev, [key]: value }));

  const applyLanguage = (lang) => {
  setCurrentLanguage(lang);
  set("language", lang);
  localStorage.setItem("language", lang);
  setLanguage(lang);

  const googleLangMap = { en: "en", hi: "hi", pa: "pa" };
  const googleLang = googleLangMap[lang] || "en";
  document.cookie = `googtrans=/en/${googleLang}; path=/;`;
  window.location.reload();
};
  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    try {
      setSaving(true);
      setSaveError("");
      await apiFetch("/api/employee/settings/update/", {
        method: "PATCH",
        body: JSON.stringify(settings),
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) {
      setSaveError("Failed to save settings. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // ── Reset to defaults ─────────────────────────────────────────────────────
  const handleReset = async () => {
    try {
      const res = await apiFetch("/api/employee/settings/update/", {
        method: "PUT",
        body: JSON.stringify({ reset: true }),
      });
      if (res) setSettings(prev => ({ ...prev, ...res }));
    } catch (err) {
      setSaveError("Unable to reset settings.");
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-full text-gray-400 text-sm">
      Loading settings...
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">

      {/* ── Page Header ── */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-800"><TT>settings_page</TT></h1>
        <p className="text-sm text-gray-400 mt-0.5">
          <TT>manage_preferences</TT>
        </p>
      </div>

      {/* ── 1. Notifications ── */}
      <Section icon={Bell} title={t("notifications_title")} description={t("notifications_description")}>
        <SettingRow label={t("email_notifications")} description={t("email_notifications_description", "Receive order updates via email")}>
          <Toggle checked={settings.email_notifications} onChange={(v) => set("email_notifications", v)} />
        </SettingRow>
        <SettingRow label={t("order_alerts")} description={t("order_alerts_description", "Get notified about new orders")}>
          <Toggle checked={settings.order_alerts} onChange={(v) => set("order_alerts", v)} />
        </SettingRow>
        <SettingRow label={t("customer_messages")} description={t("customer_messages_description", "Alerts for new messages from customers")}>
          <Toggle checked={settings.customer_messages} onChange={(v) => set("customer_messages", v)} />
        </SettingRow>
        <SettingRow label={t("low_stock_alerts")} description={t("low_stock_alerts_description", "Notify when product stock is running low")}>
          <Toggle checked={settings.low_stock_alerts} onChange={(v) => set("low_stock_alerts", v)} />
        </SettingRow>
        <SettingRow label={t("system_notifications")} description={t("system_notifications_description", "Important system and maintenance alerts")}>
          <Toggle checked={settings.system_notifications} onChange={(v) => set("system_notifications", v)} />
        </SettingRow>
        <SettingRow label={t("marketing_emails")} description={t("marketing_emails_description", "Promotions and product updates")}>
          <Toggle checked={settings.marketing_emails} onChange={(v) => set("marketing_emails", v)} />
        </SettingRow>
      </Section>

      {/* ── 2. Alert Configuration ── */}
      <Section icon={Volume2} title={t("order_alerts_config_title")} description={t("order_alerts_config_description")}>
        <SettingRow label={t("alert_sound")} description={t("alert_sound_description", "Play a sound for new order alerts")}>
          <Toggle checked={settings.alert_sound} onChange={(v) => set("alert_sound", v)} />
        </SettingRow>
        <SettingRow label={t("vibration")} description={t("vibration_description", "Vibrate on mobile for new alerts")}>
          <Toggle checked={settings.vibration} onChange={(v) => set("vibration", v)} />
        </SettingRow>
        <SettingRow label={t("priority_level")} description={t("priority_level_description", "How prominently alerts are shown")}>
          <select
            value={settings.priority}
            onChange={(e) => set("priority", e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700 focus:outline-none focus:border-[#F7941D]"
          >
            <option value="high">High — Always popup</option>
            <option value="medium">Medium — Notification panel</option>
            <option value="low">Low — Silent</option>
          </select>
        </SettingRow>
      </Section>

      {/* ── 3. Security ── */}
      <Section icon={Lock} title={t("security_title")} description={t("security_description")}>
        <SettingRow label={t("two_factor")} description={t("two_factor_description", "Add an extra layer of security")}>
          <button
            onClick={() => set("two_factor", !settings.two_factor)}
            className={`px-4 py-1.5 text-xs rounded-lg border transition ${
              settings.two_factor
                ? "bg-green-50 border-green-200 text-green-600"
                : "border-gray-200 text-gray-600 hover:border-gray-300"
            }`}
          >
            {settings.two_factor ? "Enabled" : "Enable"}
          </button>
        </SettingRow>
        <SettingRow label={t("change_password")} description={t("change_password") ?? "Update your account password"}>
          <button
            onClick={() => setShowPasswordModal(true)}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs border border-gray-200 text-gray-600 rounded-lg hover:border-gray-300 transition"
          >
            Change <ChevronRight size={12} />
          </button>
        </SettingRow>
        <SettingRow label={t("session_timeout")} description={t("session_timeout") ?? "Auto logout after 30 minutes of inactivity"}>
          <Toggle checked={settings.session_timeout} onChange={(v) => set("session_timeout", v)} />
        </SettingRow>
      </Section>

      {/* ── 4. Appearance ── */}
      <Section icon={Palette} title={t("appearance_title")} description={t("appearance_description")}>
        <SettingRow label={t("dark_mode")} description={t("dark_mode") ?? "Switch to dark theme"}>
          <Toggle checked={settings.dark_mode} onChange={(v) => set("dark_mode", v)} />
        </SettingRow>

      </Section>

      {/* ── 5. Language & Region ── */}
      <Section icon={Globe} title={t("language_title")} description={t("language_description")}>
        <SettingRow label={t("language_label")} description={
          currentLanguage === "en" ? t("select_language_en")
          : currentLanguage === "hi" ? t("select_language_hi")
          : t("select_language_pa")
        }>
          <select
            value={currentLanguage}
            onChange={(e) => applyLanguage(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700 focus:outline-none focus:border-[#F7941D]"
          >
            <option value="en">English (India)</option>
            <option value="hi">हिन्दी</option>
            <option value="pa">ਪੰਜਾਬੀ</option>
        </select>
        </SettingRow>
        <SettingRow label={t("number_format")} description={t("number_format") ?? "Format for displaying amounts"}>
          <select
            value={settings.number_format}
            onChange={(e) => set("number_format", e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700 focus:outline-none focus:border-[#F7941D]"
          >
            <option value="en-IN">Indian (₹1,00,000)</option>
            <option value="en-US">International (₹100,000)</option>
          </select>
        </SettingRow>
      </Section>

      {/* ── 6. Other Controls ── */}
      <Section icon={Shield} title={t("advanced_account_management")} description={t("clear_cache_description")}
      >
        <SettingRow label={t("clear_cache")} description={t("clear_cache_description")}>
          <button
            onClick={() => { localStorage.clear(); sessionStorage.clear(); }}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs border border-gray-200 text-gray-600 rounded-lg hover:border-red-200 hover:text-red-500 transition"
          >
            <RefreshCw size={11} /> Clear
          </button>
        </SettingRow>
        <SettingRow label={t("allow_email_alerts")} description={t("allow_email_alerts") ?? "Send alerts to your registered email"}>
          <Toggle checked={settings.email_notifications} onChange={(v) => set("email_notifications", v)} />
        </SettingRow>
      </Section>

      {/* ── Save / Reset bar ── */}
      <div className="flex items-center justify-between gap-3 mt-2 pb-8">
        <button
          onClick={handleReset}
          className="px-4 py-2 text-sm text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 transition"
        >
          Reset to Default
        </button>
        <div className="flex items-center gap-3">
          {saveSuccess && (
            <span className="flex items-center gap-1 text-xs text-green-600">
              <Check size={13} /> Saved
            </span>
          )}
          {saveError && (
            <span className="flex items-center gap-1 text-xs text-red-400">
              <AlertCircle size={13} /> {saveError}
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className={`flex items-center gap-2 px-5 py-2 text-sm text-white rounded-xl transition ${
              saving ? "bg-gray-300 cursor-not-allowed" : "bg-[#F7941D] hover:bg-[#e8860f]"
            }`}
          >
            <Save size={14} />
            {saving ? t("saving") : t("save_settings")}
          </button>
        </div>
      </div>

      {/* ── Change Password Modal ── */}
      {showPasswordModal && (
        <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />
      )}
    </div>
  );
};

export default Settings;