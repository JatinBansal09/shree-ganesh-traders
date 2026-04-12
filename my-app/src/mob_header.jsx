import { Search, ShoppingCart, Phone, Menu, X } from "lucide-react";
import { useTranslation } from "./i18n";

const MobileHeader = ({ showSearch, searchQuery, setSearchQuery, isMobileMenuOpen, setIsMobileMenuOpen }) => {
  const { t } = useTranslation();
     
  return (
    <header className="bg-white border-b border-r border-gray-200 md:hidden sticky top-0 z-50">
      {/* Orange info strip (already in your design) */}
      <div className="bg-[#F7941D] text-white text-sm px-6 py-2 flex justify-between items-center">
        <div className="flex gap-6 items-center">
          <span className="flex items-center gap-1">
            <Phone size={16} className="text-white" /> +91 98765 43210
          </span>
        </div>
      </div>

      {/* Main bar */}
      <div className="h-23 px-6 flex items-center justify-between">
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} 
          className="text-gray-600 p-1"
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
        {/* Logo */}
        <div className="font-semibold text-gray-700">
          {t("sidebar_title")}
        </div>


        {/* Cart */}
        <button className="bg-[#F7941D] p-3 rounded-lg text-white">
          <ShoppingCart size={15} />
        </button>
      </div>
      <div className="mb-4">
        {/* Search — ONLY when needed */}
        {showSearch && (
          <div className="flex-1 flex justify-center">
            <div className="relative w-[80%]">
              <Search
                size={16}
                className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                placeholder={t("search_placeholder_mobile")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 text-[13px] rounded-lg bg-gray-100 focus:outline-none"
              />
              {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default MobileHeader;