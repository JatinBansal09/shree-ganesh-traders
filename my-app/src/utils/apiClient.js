// utils/apiClient.js - FIXED VERSION

const API_BASE = 'http://localhost:8000';

const apiFetch = async (url, options = {}) => {
  try {
    const fullUrl = `${API_BASE}${url}`;
    
    const response = await fetch(fullUrl, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    console.log(`📡 API: ${options.method || 'GET'} ${url} → ${response.status}`);

    // ⬇️ Handle 401 Unauthorized (Session expired)
    if (response.status === 401) {
      console.error('🔐 401 Unauthorized - Session expired');
      
      const errorData = await response.json().catch(() => ({}));
      const message = errorData.detail || 'Session expired. Please login again.';
      
      // Import and show alert
      const { toastAlert } = await import('../alerts');
      toastAlert(message, 'error');
      
      // Import and call logout (this clears storage automatically)
      const { logoutUser } = await import('../Logout');
      await logoutUser();
      
      // Redirect after short delay
      setTimeout(() => {
        window.location.href = '/login?session_expired=true';
      }, 1000);
      
      // Throw error
      const error = new Error(message);
      error.code = 'session_expired';
      throw error;
    }

    // ⬇️ Handle 403 Forbidden (Check if auth issue or permission issue)
    if (response.status === 403) {
      console.error('❌ 403 Forbidden - Checking reason...');
      
      const errorData = await response.json().catch(() => ({}));
      const message = errorData.detail || '';
      
      // ⬇️ Check if it's an authentication issue
      const isAuthError = 
        message.includes('credentials were not provided') ||
        message.includes('Authentication') ||
        message.includes('Session expired');
      
      if (isAuthError) {
        console.log('🔐 403 caused by authentication - treating as session expired');
        
        const { toastAlert } = await import('../alerts');
        toastAlert('Session expired. Please login again.', 'error');
        
        const { logoutUser } = await import('../Logout');
        await logoutUser();
        
        setTimeout(() => {
          window.location.href = '/login?session_expired=true';
        }, 1000);
        
        const error = new Error('Session expired');
        error.code = 'session_expired';
        throw error;
      }
      
      // ⬇️ Otherwise it's a real permission issue
      console.error('❌ 403 caused by insufficient permissions');
      
      const { toastAlert } = await import('../alerts');
      toastAlert(message || "You don't have permission.", 'error');
      
      const error = new Error(message);
      error.code = 'forbidden';
      throw error;
    }

    // ⬇️ Handle other errors
// ⬇️ Handle other errors (like 400 Bad Request)
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      
      // Create a standard error
      const message = errorData.detail || `HTTP ${response.status}`;
      const error = new Error(message);
      
      // 🚨 CRITICAL: Attach the full data (including errorData.errors) 
      // so the frontend can read it.
      error.data = errorData; 
      error.status = response.status;
      
      throw error;
    }

    // ✅ Success - return JSON
    return response.json();
    
}  catch (error) {
    console.error('API Fetch error:', error);
    throw error;  // ← just rethrow, don't handle here
}
};

export default apiFetch;