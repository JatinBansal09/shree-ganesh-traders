import { useState, useEffect, useActionState, startTransition } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import { toastAlert } from './alerts';
import { useDispatch } from 'react-redux';
import { setCredentials } from './store/authSlice';
import { useTranslation } from './i18n';

const Logo = () => (
  <img src="public\images\Shree_Ganesh_Traders_logo.png" class="h-20" alt="" />
);

const ModernLoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();
  const dispatch = useDispatch(); // 👈 Added this
  const { t } = useTranslation();

  // NOTE: Use the custom login endpoint you defined in urls.py
  const API_LOGIN_URL = 'http://localhost:8000/api/';  // ⬅️ Ensure this is the correct endpoint (e.g., /api/login/)

  // ⬅️ State for CSRF token
  const [csrfToken, setCsrfToken] = useState('');

  useEffect(() => {
    // Fetch CSRF token on mount
    fetch('http://localhost:8000/api/csrf-token/', {
      credentials: 'include',
    })
      .then(response => response.json())
      .then(data => setCsrfToken(data.csrfToken))  // ⬅️ Assume the endpoint returns { csrfToken: '...' }
      .catch(err => console.error('CSRF token fetch failed:', err));
  }, []);

  const [state, submitAction, isPending] = useActionState(
    async (prevState, loginData) => {
      const { username, password } = loginData;

      try {
        const response = await fetch(API_LOGIN_URL, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrfToken,  // ⬅️ Include CSRF token
          },
          body: JSON.stringify({ username, password }),
        });

        if (response.ok) {
          const responseData = await response.json();  // ⬅️ Call json() only once here
          // ⬇️ Store encrypted user_id in localStorage
          localStorage.setItem('data', String(responseData.data));
          localStorage.setItem('user_id', String(responseData.user_id));  // Encrypted
          
          // ⬇️ Store SAME encrypted user_id in Redux
          dispatch(setCredentials({ 
            id: responseData.user_id,  // ⬅️ Store encrypted ID
            username: username,
          }));

          console.log('✅ Encrypted user_id stored in both localStorage and Redux');
          
          toastAlert("Successfully Logged In!");
          navigate('/dashboard');
          return { error: null };
        } else {
          // ⬅️ For non-ok responses, try to parse error (but handle if body is empty)
          let errorMessage = 'Invalid credentials';
          try {
            const errorData = await response.json();  // ⬅️ Only call if needed, and wrap in try
            errorMessage = errorData.detail || errorMessage;
          } catch (parseError) {
            console.warn('Could not parse error response:', parseError);
          }
          return { error: errorMessage };
        }
      } catch (err) {
        console.error('Login error:', err);
        toastAlert("Server Error. Please try again later.", "error");
        return { error: "Network error occurred." };
      }
    },
    { error: null }
  );

  // Placeholder for your actual logo. Replace with your imported logo component or img tag.

  return (
    <div className="relative min-h-screen flex items-center justify-center font-sans overflow-hidden">
      {/* ...existing code... */}
      <Link 
        to="/" 
        className="absolute top-6 left-6 z-50 flex items-center gap-2 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full shadow-md border border-gray-100 text-[#1a1a2e] hover:bg-[#048bb4] hover:text-white transition-all duration-300 group"
      >
        <span className="text-lg group-hover:-translate-x-1 transition-transform">←</span>
        <span className="text-xs font-bold uppercase tracking-wider">Home</span>
      </Link>
      {/* Top Left Blue-ish */}
      <div className="absolute top-0 left-0 w-60 h-45 bg-[#048bb4] transform skew-y-[-18deg] -translate-x-1/2 -translate-y-1/40 opacity-90"></div>
      {/* Top Right Orange-ish */}
      <div className="absolute top-[-7%] right-0 w-60 h-40 bg-[#f9ac19] transform skew-y-[18deg] translate-x-1/2 translate-y-1/4 opacity-90"></div>
      {/* Bottom Left Orange-ish */}
      <div className="absolute bottom-[-8%] left-0 w-60 h-55 bg-[#f9ac19] transform skew-y-[15deg] -translate-x-1/2 -translate-y-1/70 opacity-90"></div>
      {/* Bottom Right Red-ish */}
      <div className="absolute bottom-0 right-0 w-60 h-55 bg-[#f15a24] transform -skew-y-[15deg] translate-x-1/2 translate-y-1/4 opacity-80"></div>
      {/* left-top trapezium */}
      <div className="absolute w-22 h-25 bg-[#f9ac19] [clip-path:polygon(0%_20%,_0%_80%,_80%_100%,_80%_0%)] top-[18%] xl:top-[20%] 2xl:top-[22%] left-[25%] xl:left-[27%] 2xl:left-[30%]" style={{ zIndex: 1}}>
      </div>
      {/* left-bottom triangle */}
      <div className="absolute w-22 h-25 bg-[#f15a24] [clip-path:polygon(50%_0%,_0%_100%,_100%_100%)] rotate-[270deg] opacity-70 top-[41%] xl:top-[44%] 2xl:top-[47%] left-[27%] xl:left-[29%] 2xl:left-[31%]" style={{ zIndex: 1}}>
      </div>
      {/* right-bottom trapezium */}
      <div className="absolute w-22 h-25 bg-[#f9ac19] [clip-path:polygon(0%_20%,_0%_80%,_80%_100%,_80%_0%)] rotate-[180deg] top-[58%] xl:top-[61%] 2xl:top-[64%] left-[68%] xl:left-[66%] 2xl:left-[64%]" style={{ zIndex: 1}}>
      </div>
      {/* right-top triangle */}
      <div className="absolute w-22 h-25 bg-[#048bb4] [clip-path:polygon(50%_0%,_0%_100%,_100%_100%)] rotate-[90deg] top-[28%] xl:top-[30%] 2xl:top-[32%] left-[66%] xl:left-[64%] 2xl:left-[62%]" style={{ zIndex: 1}}>
      </div>
      
      <div className="relative bg-white p-4 pl-15 pr-15 rounded-xl shadow-2xl max-w-lg w-full z-10 overflow-hidden">
        {/* Logo */}
        <div className="flex justify-center mb-2">
          <Logo />
        </div>
        <p className="text-center text-gray-600 text-base mb-2 px-4">
          {t("welcome_portal")}
        </p>
        <div
          className="absolute w-16 h-12 bg-[#f9ac19] transform skew-y-[15deg] translate-x-1/4 -translate-y-1/4 opacity-70"
          style={{ top: 0, right: 0 }}
        ></div>

        <h2 className="text-3xl font-bold text-center text-gray-800 mb-6">{t("sign_in")}</h2>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(() => submitAction({ username, password }));
          }}
        >
          {/* Username Input */}
          <div className="mb-2">
            <label htmlFor="usernamer" className="block text-gray-600 text-sm mb-2">{t("username")}</label>
            <input
              type="username"
              id="username"
              placeholder={t("enter_username")}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-300 bg-gray-50 text-sm"
              required
            />
          </div>

          {/* Password Input */}
          <div className="mb-4">
            <div className="flex justify-between items-center">
              <label htmlFor="password" className="block text-gray-600 text-sm mb-2">{t("password")}</label>
              <a href="#" className="text-sm text-blue-500 hover:text-blue-700">{t("forgot_password")}</a>
            </div>
            <input
              type="password"
              id="password"
              placeholder={t("enter_password")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-300 bg-gray-50 text-sm"
              required
            />
          </div>

          {/* Sign In Button */}
          <div className="flex justify-center mt-6 mb-2">
            <button
              type="submit"
              disabled={isPending}
              className="w-[40%] bg-[#048bb4] hover:bg-[#f15a24] text-white font-semibold py-2.5 px-4 rounded-3xl focus:outline-none focus:ring-2 focus:ring-blue-400 transition duration-300 ease-in-out text-sm disabled:opacity-50"
            >
              {isPending ? t("signing_in") : t("sign_in_button")}
            </button>
          </div>
          {/* Error Message */}
          {state.error && (
            <p className="text-red-500 text-sm text-center mb-4">{state.error}</p>
          )}
        </form>

        {/* Sign Up Link */}
        <div className="text-center text-gray-500 mb-4">
          {t("dont_have_account")} {" "}
          <Link to="/register" className="text-blue-500 hover:text-blue-700 font-semibold">
            {t("sign_up")}
          </Link>
        </div>
      </div>
      {/* ...existing code... */}
    </div>
  );
};

export default ModernLoginPage;