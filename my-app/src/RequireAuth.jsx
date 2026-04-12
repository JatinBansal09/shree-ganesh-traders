// RequireAuth.jsx
import { Navigate, useLocation } from "react-router-dom";
import { useState, useEffect } from 'react';
import { useAuth } from "./useAuth";
import { useSessionChecker } from './userSessionChecker';
import React from 'react';
import PropTypes from 'prop-types';

const RequireAuth = ({ children, allowedRoles }) => {
  // ⬅️ MOVE ALL HOOKS TO THE TOP, BEFORE ANY LOGIC
  const { user, loading, isAuthenticated } = useAuth();
  const location = useLocation();
  useSessionChecker(300000);  // This is a hook, so it stays here
  
  // ⬅️ MOVE THESE HOOKS UP TOO
  const [derivedRole, setDerivedRole] = useState(null);
  useEffect(() => {
    if (!user) {
      setDerivedRole(null);
      return;
    }

    if (user.user_role) {
      setDerivedRole(user.user_role);
      return;
    }

    // Fallback: infer from Django flags if provided
    if (user.is_superuser === true && user.is_staff === false) {
      setDerivedRole('Owner');
    } else if (user.is_superuser === false && user.is_staff === true) {
      setDerivedRole('Employee');
    } else {
      setDerivedRole('Customer');
    }
  }, [user]);

  // ⬅️ NOW DO CONDITIONAL LOGIC AFTER HOOKS
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="ml-4 text-gray-600">Verifying authentication...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Redirect to login, preserving the attempted location
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const roleToCheck = derivedRole;

  if (allowedRoles && !allowedRoles.includes(roleToCheck)) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="p-8 bg-red-50 rounded-lg border border-red-200">
          <h2 className="text-xl font-bold text-red-800">Access Denied</h2>
          <p className="text-red-700 mt-2">
            You don't have permission to view this page.
          </p>
          <button
            onClick={() => window.location.href = '/'}
            className="mt-4 px-6 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return children;
};

export default RequireAuth;