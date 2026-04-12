import React, { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { menu } from "./menu";
import { useNavigate, useLocation } from "react-router-dom";
import { getUserInfo, getUserRole } from "./auth_utils";
import apiFetch from "./utils/apiClient";
import { logoutUser } from "./Logout";
import { useTranslation } from "./i18n";
import TT from "./utils/TT";

const Sidebar = ({ onNavigate, showCloseButton }) => {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(false);
  const [role, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [employeeId, setEmpId] = useState(null);
  const [totalUnread, setTotalUnread] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const fetchRole = async () => {
      const data = await getUserInfo();
      setUserRole(data.user_role);
      if (data.user_role==='Employee'){
        setEmpId(data.user_id);
      }
      setLoading(false);
    };
    fetchRole();
  }, []);

  const filteredMenu = menu.filter(
    (item) => !item.roles || (role && item.roles.includes(role))
  );

  const handleLogout = async () => {
    if (isLoggingOut) return;

    setIsLoggingOut(true);
    console.log("Sidebar: Starting logout...");

    try {
      await logoutUser();
    } finally {
      navigate("/login", { replace: true });
    }
  };

  // ✅ Poll for total unread count every 10 seconds
  useEffect(() => {
    const fetchUnread = async () => {
      try {
        const res = await apiFetch("/api/messages/unread-count/");
        setTotalUnread(res.unread_count || 0);
      } catch (err) {
        console.error("Failed to fetch unread count:", err);
      }
    };

    fetchUnread(); // run immediately
    const interval = setInterval(fetchUnread, 10000);
    return () => clearInterval(interval);
  }, []);


  if (loading) return <div className="w-64 h-screen border-r bg-white" />;

  return (
    <aside
      className={`notranslate h-screen bg-white border-r border-gray-200 transition-all duration-300
      ${collapsed ? "w-16" : "w-64"}`}
    >

      <div className="flex items-center justify-between p-4">
        
        {/* ⬇️ LEFT SIDE: Logo/Title (only when not collapsed) */}
        {!collapsed && !showCloseButton && (
          <div>
            <h2 className="text-lg font-bold text-gray-800"><TT>sidebar_title</TT></h2>
            <p className="text-xs text-gray-500"><TT>sidebar_subtitle</TT></p>
          </div>
        )}

        {/* ⬇️ RIGHT SIDE: Close Button (Mobile) OR Toggle Button (Desktop) */}
        {showCloseButton ? (
          // Mobile: Show X button
          <button
            onClick={onNavigate}
            className="ml-auto p-2 rounded-full hover:bg-gray-200 transition"
            aria-label={t("close_menu")}
          >
            <X size={20} className="text-gray-700" />
          </button>
        ) : (
          // Desktop: Show collapse toggle
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="ml-auto p-2 rounded-lg hover:bg-gray-100 transition"
            aria-label={collapsed ? t("expand_sidebar") : t("collapse_sidebar")}
          >
            {collapsed ? (
              <ChevronRight size={20} className="text-gray-600" />
            ) : (
              <ChevronLeft size={20} className="text-gray-600" />
            )}
          </button>
        )}
      </div>

      <div className="border-b border-gray-200 mx-2" />

      {/* Menu */}
      <nav className="mt-2 space-y-1">
        {filteredMenu.map((item) => {
    const Icon = item.icon;
    const isLogoutItem = item.key.toLowerCase() === "logout";
    const itemLabel = t(item.translationKey ?? item.key, item.label);

    const isActive =
      item.path && !isLogoutItem && location.pathname === item.path;

    const labelText = isLoggingOut && isLogoutItem ? t("logout") : itemLabel;

    return (
      <div
        key={item.key}
        onClick={() => {
        if (isLogoutItem) {
          handleLogout();
        } else if (item.path) {

          // 🔹 Special case: Employee clicking Customers
          if (
            item.key === "customers" &&
            role === "Employee" &&
            employeeId
          ) {
            navigate(`/owner/users/${employeeId}/customers`);
          } else {
            navigate(item.path);
          }

          if (onNavigate) onNavigate();
        }
      }}

        className={`
          flex items-center mx-2 px-3 py-2 rounded-xl cursor-pointer transition-all
          ${collapsed ? "justify-center" : "gap-3"}
          ${
            isActive
              ? "bg-[#F7941D] text-white"
              : "text-gray-700 hover:bg-[#FFF3E0]"
          }
          ${!item.path && !isLogoutItem ? "opacity-50 cursor-not-allowed" : ""}
          ${isLoggingOut && isLogoutItem ? "opacity-50 cursor-wait" : ""}
        `}
        title={collapsed ? itemLabel : undefined}
      >
        <div className="relative">
          <Icon size={16} />
          {item.key === "messages" && totalUnread > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
              {totalUnread > 99 ? "99+" : totalUnread}
            </span>
          )}
        </div>
        {!collapsed && (
          <span className="flex-1 text-sm font-medium notranslate">
            {labelText}
          </span>
        )}
      </div>
    );
  })}
      </nav>
    </aside>
  );
};

export default Sidebar;