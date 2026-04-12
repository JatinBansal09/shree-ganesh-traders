import { useEffect, useRef, useCallback } from 'react';
import { toastAlert } from './alerts';
import { logoutUser } from './Logout';
import { getUserInfo } from './auth_utils';

export const useSessionChecker = (checkInterval = 60000) => {  // 60 seconds
  const intervalRef = useRef(null);
  const isCheckingRef = useRef(false);

  const checkSession = useCallback(async () => {
    if (isCheckingRef.current) return;
    isCheckingRef.current = true;

    try {
      const userInfo = await getUserInfo();
      
      if (userInfo?.isRateLimited) {
        console.warn('Rate limited - skipping session check');
        isCheckingRef.current = false;
        return;
      }
      
      // ⬇️ FIXED: Removed .response_data
      if (!userInfo || userInfo.authenticated === false) {
        console.log('🔐 Session expired detected by checker!');
        toastAlert('Your session has expired. Logging out...', 'warning');
        
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        
        await logoutUser();
        
        setTimeout(() => {
          window.location.href = '/login?session_expired=true';
        }, 3000);
        
        return;
      }
      
      // ⬇️ FIXED: Check tampering correctly
      if (userInfo.tampered && userInfo.restore_user_id) {
        console.warn('🚨 Session checker detected tampering - restoring user_id');
        localStorage.setItem('user_id', String(userInfo.restore_user_id));
      }
      
      console.log('✅ Session check passed');
      
    } catch (error) {
      console.error('Session check failed:', error);
    } finally {
      isCheckingRef.current = false;
    }
  }, []);

  useEffect(() => {
    intervalRef.current = setInterval(checkSession, checkInterval);
    checkSession();
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [checkSession, checkInterval]);

  return { checkSession };
};