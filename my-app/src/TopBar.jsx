import { Search, ShoppingCart, Phone } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { toggleCart, selectCartCount } from "./store/cartSlice";
import { useTranslation } from "./i18n";

const TopBar = ({ showSearch, searchQuery, setSearchQuery, onSearchEnter, onSearchClear }) => {
  const dispatch = useDispatch();
  const cartCount = useSelector(selectCartCount);
  const { t } = useTranslation();

  return (
    <header className="bg-white border-b border-r border-gray-200">
      {/* Orange info strip */}
      <div className="bg-[#F7941D] text-white text-sm px-6 py-2 flex justify-between items-center">
        <div className="flex gap-6 items-center">
          <span className="flex items-center gap-1">
            <Phone size={16} className="text-white" /> +91 98765 43210
          </span>
          <span className="flex items-center gap-1">✉ info@shreeganeshtradingco.com</span>
        </div>
        <div>{t("weekly_offer")}</div>
      </div>

      {/* Main bar */}
      <div className="h-23 px-6 flex items-center justify-between">
        {/* Logo & Branding */}
        <div className="flex items-center gap-1"> {/* 👈 Reduced from 3 to 1 */}
          {/* Logo Image */}
          <img 
            src="/images/Shree_Ganesh_Traders_logo.png" 
            alt="Logo" 
            className="h-12 w-auto object-contain m-0 p-0"  /* 👈 Added m-0 p-0 to be safe */
          />
          
          {/* Text Branding */}
          <div className="flex flex-col justify-center leading-tight ml-[-4px]"> {/* 👈 Negative margin if needed */}
            <span className="text-xl font-bold text-[#1a1a2e] tracking-tight uppercase">
              Shree Ganesh Trading Co.
            </span>
            <span className="text-[10px] font-semibold text-[#F7941D] uppercase tracking-[0.2em] mt-0.5">
              Premium Sanitary Ware
            </span>
          </div>
        </div>
                {/* Search — ONLY when needed */}
        {showSearch && (
          <div className="flex-1 flex justify-start ml-12"> {/* 👈 ml-12 controls the gap */}
            <div className="relative w-[70%] max-w-md">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                placeholder={t("search_placeholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && onSearchEnter?.()}
                className="w-full pl-9 pr-4 py-1.5 text-[13px] rounded-lg bg-gray-100 focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    onSearchClear?.();
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        )}

        {/* Cart Button with badge */}
        <button
          onClick={() => dispatch(toggleCart())}
          className="relative bg-[#F7941D] p-3 rounded-lg text-white"
        >
          <ShoppingCart size={15} />
          {cartCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-white text-[#F7941D] text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center border border-[#F7941D]">
              {cartCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );
};

export default TopBar;