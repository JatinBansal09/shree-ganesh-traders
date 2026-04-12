// Layout.jsx - CORRECTED VERSION
import { ErrorBoundary } from 'react-error-boundary';
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import { Outlet, useLocation } from "react-router-dom";
import { useState } from "react";
import { useActivityTracker } from './activityTracker';
import MobileHeader from './mob_header';
import { useTranslation } from "./i18n";

const Layout = () => {
  const location = useLocation();
  const isCataloguePage = location.pathname === "/catalogue"; 
  const [searchQuery, setSearchQuery] = useState("");
  const [onSearchEnter, setOnSearchEnter] = useState(() => () => {}); // ✅ add this
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [onSearchClear, setOnSearchClear] = useState(() => () => {});
  const { t } = useTranslation();
  
  useActivityTracker();

  return (
    <div className="h-screen flex flex-col md:grid md:grid-cols-[auto_1fr] md:grid-rows-[auto_1fr]">
      {/*            ^^^^^^^^^^^^^ Removed overflow-hidden to allow main to scroll */}
      
      {/* ⬇️ MOBILE HEADER (visible on mobile only) */}
      <div className="md:hidden">
        <MobileHeader 
          showSearch={isCataloguePage}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          isMobileMenuOpen={isMobileMenuOpen}
          setIsMobileMenuOpen={setIsMobileMenuOpen}
        />
      </div>

      {/* ⬇️ MOBILE SIDEBAR OVERLAY */}
      {isMobileMenuOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/50 z-[60] md:hidden animate-fadeIn"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          
          {/* Sidebar (slides in from left) */}
          <aside className="fixed top-0 left-0 h-full w-[280px] bg-white z-[70] shadow-2xl animate-slideInLeft">
            {/*                                                                                  ^^^^^^^^^^^^^^^^^^^^^  */}
            {/*                                                                  Animation added, removed static translate */}
            <ErrorBoundary fallback={<div className="p-4 text-red-500">Sidebar Error</div>}>
              <Sidebar 
                onNavigate={() => setIsMobileMenuOpen(false)} 
                showCloseButton={true}
              />
            </ErrorBoundary>
          </aside>
        </>
      )}

      {/* ⬇️ DESKTOP SIDEBAR (always visible on desktop) */}
      <aside className="hidden md:block md:row-span-2 overflow-y-auto border-r border-gray-200">
        {/*                            ^^^^^^^^^^^^^                                                    */}
        {/*                            Spans both header and main rows                                 */}
        <ErrorBoundary fallback={<div className="p-4 text-red-500">Sidebar Error</div>}>
          <Sidebar showCloseButton={false} />
        </ErrorBoundary>
      </aside>

      {/* ⬇️ DESKTOP TOP BAR (hidden on mobile) */}
      <header className="hidden md:block bg-white border-b border-gray-200">
        <ErrorBoundary fallback={<div className="p-4 text-red-500">TopBar failed</div>}>
        <TopBar
            showSearch={isCataloguePage}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            onSearchEnter={onSearchEnter}
            onSearchClear={onSearchClear}  // ✅
        />
        </ErrorBoundary>
      </header>

      {/* ⬇️ MAIN CONTENT (scrollable) */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden bg-white">
        <Outlet context={[searchQuery, setSearchQuery, setOnSearchEnter, setOnSearchClear]} />
        {/* Footer (scrolls with content) */}
        <footer className="p-6 text-center text-xs text-gray-500 border-t border-gray-200">
          {t("footer_text")}
        </footer>
      </main>

    </div>
  );
};

export default Layout;