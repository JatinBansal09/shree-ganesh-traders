// activityTracker.jsx - COMPLETELY REWRITTEN

import { useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { getUserInfo } from './auth_utils';
import { toastAlert } from './alerts';
import { logoutUser } from './Logout';
import { useLocation } from 'react-router-dom';

export const useActivityTracker = () => {
  const lastActivityRef = useRef(Date.now());
  const lastCheckRef = useRef(Date.now());
  const location = useLocation();
  const reduxUserId = useSelector((state) => state.auth.user?.id);  // Encrypted

  useEffect(() => {
    // Don't run on login page
    if (location.pathname === '/login') return;
    
    // Don't run if no Redux user (not logged in yet)
    if (!reduxUserId) {
      console.log('⏸️ Activity tracker waiting for login...');
      return;
    }
    
    console.log('✅ Activity tracker started');
    
    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];

    const handleActivity = async () => {
      const now = Date.now();
      const timeSinceLastActivity = now - lastActivityRef.current;
      const timeSinceLastCheck = now - lastCheckRef.current;
      lastActivityRef.current = now;

      // ⬇️ CHECK 1: Tampering Detection (every 30 seconds max)
      if (timeSinceLastCheck > 5000) {  // 30 seconds
        lastCheckRef.current = now;
        
        const storageUserId = localStorage.getItem('user_id');
        
        console.log('🔍 Tampering check:');
        console.log('   Redux (encrypted):', reduxUserId?.substring(0, 20) + '...');
        console.log('   localStorage (encrypted):', storageUserId?.substring(0, 20) + '...');
        
        // ⬇️ Case 1: localStorage is missing
        if (!storageUserId) {
          try {
            const userInfo = await getUserInfo();
            
            if (userInfo?.isRateLimited) {
              console.warn('Rate limited - skipping check');
              return;
            }
            
            // ⬇️ Fixed: Check correct structure
            if (!userInfo || userInfo.authenticated === false) {
              console.log('🔐 Session invalid - logging out');
              toastAlert('Your session has expired. Logging out...', 'error');
              await logoutUser();
              setTimeout(() => {
                  window.location.href = '/login?session_expired=true';
              }, 3000)
              return; // Exit early
            }else {
              setTimeout(() => {
                toastAlert('✅ Session valid during activity check but user data tampered contact owner to get login access again at 7035413333', 'error');
                console.log('🚨 SECURITY ALERT: localStorage data tampered but session still valid - restoring user_id if provided by server. Login again...', 'warning');
              }, 6000);
              if (userInfo.restore_user_id) {
                localStorage.setItem('user_id', String(userInfo.restore_user_id));
              }  // Logout with null user_id to clear session on server
              await logoutUser();
              setTimeout(() => {
                  window.location.href = '/login?session_expired=true';
              }, 8000)
              return; // Exit early
            }
            

            
          } catch (err) {
            console.error('Tampering check failed:', err);
          }
        }
        
        // ⬇️ Case 2: localStorage doesn't match Redux
        else if ((reduxUserId)&&(String(storageUserId) !== String(reduxUserId)) ){
          console.warn('🚨 localStorage and Redux mismatch!');
          console.warn(`   Redux: ${reduxUserId?.substring(0, 20)}...`);
          console.warn(`   localStorage: ${storageUserId?.substring(0, 20)}...`);
          
          toastAlert('Session tampering detected. Verifying...', 'error');
          
          try {
            const userInfo = await getUserInfo();
            
            if (userInfo?.isRateLimited) {
              console.warn('Rate limited - skipping check');
              return;
            }
            
            // ⬇️ Fixed: Check correct structure
            if (!userInfo || userInfo.authenticated === false) {
              console.log('🔐 Session invalid after tampering - logging out');
              toastAlert('Session invalid. Logging out...contact owner to get login access again at 7035413333', 'error');
              await logoutUser();
              setTimeout(() => {
                window.location.href = '/login?session_expired=true';
              }, 3000);
              return;
            }
            else {
              setTimeout(() => {
                toastAlert('🚨 SECURITY ALERT: localStorage/ redux data tampered but session still valid - restoring user_id if provided by server. Login again...', 'warning');
                console.error('🚨 SECURITY ALERT: localStorage/ redux store tampered but session still valid - restoring user_id if provided by server');
              }, 3000);
              // ⬇️ Session is valid - restore correct value
              if (userInfo.restore_user_id) {
                console.log('✅ Correcting localStorage from server');
                localStorage.setItem('user_id', String(userInfo.restore_user_id));     
                // ⬇️ Also update Redux to match
                // You'll need to import dispatch for this
                // dispatch(setCredentials({ id: userInfo.restore_user_id }));
              }
              if (userInfo.tampered) {
                  // Now we are sure it's a real session issue, not just a rate limit.
                  await logoutUser();
                  setTimeout(() => {
                    window.location.href = '/login?session_expired=true';
                  }, 8000)
                  return; // Exit early
              }
            }
            
          } catch (err) {
            console.error('Mismatch check failed:', err);
          }
        }
        else {
          console.log('✅ No tampering detected');
        }
      }

      // ⬇️ CHECK 2: Session Extension (every 5 minutes)
      if (timeSinceLastActivity > 5 * 60 * 1000) {
        console.log('🔄 User active - extending session...');
        
        try {
          const response = await fetch('http://localhost:8000/api/extend-session/', {
            method: 'POST',
            credentials: 'include',
          });
          
          if (response.status === 401) {
            console.log('🔐 Session expired during extension');
            toastAlert('Your session has expired. Logging out...', 'warning');
            await logoutUser();
            window.location.href = '/login?session_expired=true';
            return;
          }
          
          if (response.ok) {
            console.log('✅ Session extended');
          }
        } catch (err) {
          console.error('Session extend failed:', err);
        }
      }
    };

    // Attach listeners
    activityEvents.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Initial check
    handleActivity();

    // Cleanup
    return () => {
      activityEvents.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [location.pathname, reduxUserId]);  // ⬅️ Include reduxUserId
};