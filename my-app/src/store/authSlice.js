// authSlice.js - UPDATED

import { createSlice } from '@reduxjs/toolkit';

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: null, // Stores { id: encryptedId, username, etc. }
    isAuthenticated: false,
  },
  reducers: {
    setCredentials: (state, action) => {
      state.user = action.payload;
      state.isAuthenticated = true;
      
      // ⬇️ Sync encrypted ID to localStorage
      if (action.payload?.id) {
        localStorage.setItem('user_id', String(action.payload.id));
        console.log('✅ Redux updated, synced to localStorage');
      }
    },
    clearCredentials: (state) => {
      state.user = null;
      state.isAuthenticated = false;
      localStorage.removeItem('user_id');
      localStorage.removeItem('data');
      console.log('✅ Redux cleared, localStorage cleared');
    },
  },
});

export const { setCredentials, clearCredentials } = authSlice.actions;
export default authSlice.reducer;