import { toastAlert } from "./alerts";

export const logoutUser = async (setIsLoggingOut) => {
  // ⬇️ Get user_id BEFORE clearing
  try {
    // ⬇️ Send logout request with user_id
    const encrypted_data = localStorage.getItem('data') || '';
    const user_id_data = localStorage.getItem('user_id') || '';
    const response = await fetch('http://localhost:8000/api/logout/', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        encrypted_data: encrypted_data,  // ⬅️ Send user_id from BEFORE clearing
        user_id_data: user_id_data,  // ⬅️ Send user_id from BEFORE clearing
      }),
    });

    if (response.ok) {
      const data = await response.json();
      toastAlert("Successfully Logged Out!");
      console.log("✅ Logout response:", data);
    } else {
      console.error("❌ Logout failed:", response.status);
    }
  } catch (error) {
    console.error('❌ Logout error:', error);
  } finally {
    // ⬇️ Clear AFTER backend call
    console.log('🧹 Clearing localStorage...');
    localStorage.clear();
    sessionStorage.clear();
    if (setIsLoggingOut) setIsLoggingOut(false);
  }
  
  console.log('✅ Logout complete');
  return true;
};