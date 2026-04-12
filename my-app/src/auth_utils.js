// auth_utils.js - FIXED
import { useSelector, useDispatch } from 'react-redux';

export const getUserRole = async () => {
  try {
    const response = await fetch("http://localhost:8000/api/user-info/", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_user_id: localStorage.getItem("user_id") || "",
      }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    return data.user_role || null;
  } catch (err) {
    console.error("getUserRole failed:", err);
    return null;
  }
};

// auth_utils.js
export const getUserInfo = async () => {
  try {
  const response = await fetch('http://localhost:8000/api/user-info/', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_user_id: localStorage.getItem('user_id') || '',
    })
  });

  if (response.status === 429) {
    // Return a specific flag so the tracker knows to just WAIT
    return { isRateLimited: true }; 
  }

  if (!response.ok) return null;
  return response.json();
  } catch (error) {
    console.error('getUserInfo: Network or fetch error:', error);
    // Return null to indicate failure, allowing caller to handle (e.g., logout)
    return null;
  }
};

export const getActualUserRole = async () => {
  try {
    const response = await fetch('http://localhost:8000/api/actual-user-role/', {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) return null;

    const data = await response.json();
    return data.actual_user_role || null;
  } catch (err) {
    console.error('getActualUserRole failed:', err);
    return null;
  }
};