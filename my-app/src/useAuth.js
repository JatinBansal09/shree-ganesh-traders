// useAuth.js - CORRECTED VERSION

import { useState, useEffect, useCallback, useRef } from 'react';
import { logoutUser } from './Logout';
import { toastAlert } from './alerts';

export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Refs for timers
  const logoutTimerRef = useRef(null);
  const warningTimerRef = useRef(null);
  const refreshIntervalRef = useRef(null);

  // Logout function
  const calllogout = useCallback(async () => {
    // Clear all timers
    if (logoutTimerRef.current) {
      clearTimeout(logoutTimerRef.current);
      logoutTimerRef.current = null;
    }
    if (warningTimerRef.current) {
      clearTimeout(warningTimerRef.current);
      warningTimerRef.current = null;
    }
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }
    
    try {
      await logoutUser();
      setUser(null);
      console.log("✅ Logged out successfully");
    } catch (error) {
      console.error("❌ Logout error:", error);
    }
  }, []);  // ⬅️ No dependencies (stable)

  // Set auto-logout timer
  const setAutoLogoutTimer = useCallback((expiryTime) => {
    // Clear existing logout timers
    if (logoutTimerRef.current) {
      clearTimeout(logoutTimerRef.current);
      logoutTimerRef.current = null;
    }
    if (warningTimerRef.current) {
      clearTimeout(warningTimerRef.current);
      warningTimerRef.current = null;
    }

    const now = Date.now();
    const timeUntilExpiry = expiryTime - now;
    const timeUntilWarning = timeUntilExpiry - 60000; // 1 minute before
    
    console.log(`⏰ Session expires in ${Math.round(timeUntilExpiry / 1000)} seconds`);
    
    // Warning timer (1 minute before expiry)
    if (timeUntilWarning > 0) {
      warningTimerRef.current = setTimeout(() => {
        console.log('⚠️ Session expiring in 1 minute');
        toastAlert('Session expires in 1 minute!', 'warning');
      }, timeUntilWarning);
    }
    
    // Actual logout timer
    if (timeUntilExpiry > 0) {
      logoutTimerRef.current = setTimeout(async () => {
        console.log('⏰ Session expired - auto-logout');
        toastAlert('Session expired. Logging out...', 'error');
        await calllogout();
        setTimeout(() => {
          window.location.href = '/login?session_expired=true';
        }, 1000);
      }, timeUntilExpiry);
    }
  }, [calllogout]);  // ⬅️ Depends on calllogout (stable)

  // Check auth
  const checkAuth = useCallback(async () => {
    try {
      const clientUserId = localStorage.getItem('user_id') || '';
      
      console.log('🔄 checkAuth running...');
      
      const response = await fetch('http://localhost:8000/api/user-info/', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_user_id: clientUserId }),
      });
      
      // Handle "not logged in"
      if (response.status === 401) {
        console.log('ℹ️ No active session - user not logged in');
        setUser(null);
        setLoading(false);  // ⬅️ Set loading here
        return { success: false, user: null };
      }
      
      const data = await response.json();

      // Handle tampering
      if (data?.restore_user_id) {
        localStorage.setItem('user_id', String(data.restore_user_id));
        console.log('✅ user_id corrected');
        
        if (data.tampered) {
          await logoutUser();
          setLoading(false);  // ⬅️ Set loading here
          setTimeout(() => {
            toastAlert('Tampering detected. Logged out.', 'error');
            window.location.href = '/login?session_expired=true';
          }, 1000);
          return { success: false, user: null };
        }
      }

      if (response.ok && data.authenticated) {
        console.log('✅ User authenticated:', data.user_role);
        setUser(data);
        setLoading(false);  // ⬅️ Set loading here
        
        // Update logout timer with fresh expiry time
        if (data.session_expiry) {
          setAutoLogoutTimer(new Date(data.session_expiry).getTime());
        }
        
        return { success: true, user: data };
      } else {
        setUser(null);
        setLoading(false);  // ⬅️ Set loading here
        return { success: false, user: null };
      }
    } catch (error) {
      console.error('❌ Auth check failed:', error);
      setUser(null);
      setLoading(false);  // ⬅️ Set loading here
      return { success: false, user: null, error };
    }
  }, [setAutoLogoutTimer]);  // ⬅️ Only depends on setAutoLogoutTimer

  // ⬇️ Setup: Initial check + Start 2-minute interval
  useEffect(() => {
    console.log('🔐 useAuth: Mounting');
    
    // 1. Run initial check
    checkAuth();
    
    // 2. Start interval (runs every 2 minutes)
    console.log('⏰ Starting 2-minute refresh interval');
    refreshIntervalRef.current = setInterval(() => {
      console.log('🔄 [2-min interval] Running checkAuth...');
      checkAuth();
    }, 2 * 60 * 1000);  // 2 minutes
    
    // 3. Cleanup function
    return () => {
      console.log('🧹 useAuth: Unmounting - cleaning up');
      if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
      if (refreshIntervalRef.current) {
        console.log('⏰ Stopping 2-minute refresh interval');
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [checkAuth]);  // ⬅️ Stable dependency chain

  return { 
    user, 
    loading, 
    checkAuth,
    calllogout,
    isAuthenticated: !!user 
  };
};