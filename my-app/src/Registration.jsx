import { useState, React } from "react";
import axios from "axios";
import { validateUsername, validatePassword, validateEmail, validatePhone } from "./utils/validation";
import { useTranslation } from "./i18n";

const API_REGISTER_URL = "http://localhost:8000/api/register/";

const RegistrationPage = () => {
    const { t } = useTranslation();
    const [formData, setFormData] = useState({
        username: "", email: "", password: "", confirmPassword: "",
        customerName: "", phoneNumber: "", shopName: "", userGroup: ""
    });
    
    const [validationErrors, setValidationErrors] = useState({});
    const [serverError, setServerError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });
        // Clear specific error when user starts typing
        if (validationErrors[name]) {
            setValidationErrors(prev => ({ ...prev, [name]: null }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setServerError(null);
        setSuccess(null);
        
        const errors = {};

        // ─── Validations from UserFormModal ───────────────────────
        if (!formData.customerName.trim()) errors.customerName = 'Full name is required';
        
        if (!formData.email.trim()) errors.email = 'Email is required';
        else if (!validateEmail(formData.email)) errors.email = 'Enter a valid email address';
        
        if (!formData.userGroup) errors.userGroup = 'Please select a user group';
        
        if (!formData.phoneNumber.trim()) errors.phoneNumber = 'Phone number is required';
        else if (!validatePhone(formData.phoneNumber)) errors.phoneNumber = 'Enter a valid 10-digit number';

        if (!formData.username.trim()) errors.username = 'Username is required';
        else if (formData.username.length < 4) errors.username = 'Minimum 4 characters';
        else if (!validateUsername(formData.username)) errors.username = 'Letters, numbers, underscores only';

        if (!formData.password) errors.password = 'Password is required';
        else if (!validatePassword(formData.password)) errors.password = 'Must be 8+ chars (1 Upper, 1 Num, 1 Special)';

        if (formData.password !== formData.confirmPassword) {
            errors.confirmPassword = 'Passwords do not match';
        }

        if (Object.keys(errors).length > 0) {
            setValidationErrors(errors);
            setServerError("Please fill all required fields correctly.");
            return;
        }

        setLoading(true);
        try {
            await axios.post(API_REGISTER_URL, {
                ...formData,
                customer_name: formData.customerName,
                phone_number: formData.phoneNumber,
                customer_userGroup: formData.userGroup,
                status: true
            });
            setSuccess("Registration successful!");
            setValidationErrors({});
        } catch (err) {
            setServerError(err.response?.data?.detail || "Registration failed. Check your details.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="relative min-h-screen w-full flex items-center justify-center font-sans overflow-hidden bg-gray-100">
            {/* Background Decorations */}
            <div className="absolute top-0 left-0 w-60 h-45 bg-[#048bb4] transform skew-y-[-18deg] -translate-x-1/2 -translate-y-1/40 opacity-90"></div>
            <div className="absolute top-[-7%] right-0 w-60 h-40 bg-[#f9ac19] transform skew-y-[18deg] translate-x-1/2 translate-y-1/4 opacity-90"></div>
            <div className="absolute bottom-[-8%] left-0 w-60 h-55 bg-[#f9ac19] transform skew-y-[15deg] -translate-x-1/2 -translate-y-1/70 opacity-90"></div>
            <div className="absolute bottom-0 right-0 w-60 h-55 bg-[#f15a24] transform -skew-y-[15deg] translate-x-1/2 translate-y-1/4 opacity-80"></div>

            <div className="relative z-10 bg-white rounded-xl shadow-2xl w-full max-w-lg h-[80vh] flex flex-col overflow-hidden">
                
                <div className="pt-8 pb-4 px-15 bg-white shrink-0">
                    <h2 className="text-3xl font-bold text-center text-gray-800 mb-2">{t("sign_up")}</h2>
                </div>

                <div className="flex-1 overflow-y-auto px-15 custom-scrollbar pb-6">
                    <form className="space-y-4">
                        <InputField label={t("username")} name="username" value={formData.username} onChange={handleChange} isRequired errorMsg={validationErrors.username} />
                        <InputField label="Email" name="email" type="email" value={formData.email} onChange={handleChange} isRequired errorMsg={validationErrors.email} />
                        <InputField label="Full Name" name="customerName" value={formData.customerName} onChange={handleChange} isRequired errorMsg={validationErrors.customerName} />
                        
                        <InputField label="Phone Number" name="phoneNumber" value={formData.phoneNumber} onChange={handleChange} isRequired errorMsg={validationErrors.phoneNumber} placeholder="10-digit number" />
                        
                        <InputField label="Shop Name" name="shopName" value={formData.shopName} onChange={handleChange} />
                        
                        {/* User Group Selection */}
                        <div className="mb-2 relative">
                            <label className="block text-gray-600 text-sm mb-2 font-normal">Register As <span className="text-red-500">*</span></label>
                            <div className="relative">
                                <select
                                    name="userGroup"
                                    value={formData.userGroup}
                                    onChange={handleChange}
                                    className={`w-full px-2 py-1 border rounded-md focus:outline-none focus:ring-2 bg-gray-50 text-sm transition-all appearance-none ${
                                        validationErrors.userGroup ? "border-red-500 ring-1 ring-red-100" : "border-gray-300 focus:ring-blue-300"
                                    }`}
                                >
                                    <option value="">Select a Group</option>
                                    <option value="Retailer">Retailer</option>
                                    <option value="Plumber">Plumber</option>
                                    <option value="Builder">Builder</option>
                                    <option value="Dealer">Dealer</option>
                                    <option value="Employee">Employee</option>
                                </select>
                                {validationErrors.userGroup && (
                                    <span className="absolute right-8 top-1/2 -translate-y-1/2 text-red-500 font-black text-lg animate-pulse">!</span>
                                )}
                                <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 text-xs">▼</div>
                            </div>
                            {validationErrors.userGroup && <p className="text-[10px] text-red-500 mt-1 font-medium">{validationErrors.userGroup}</p>}
                        </div>

                        <InputField label={t("password")} name="password" type="password" value={formData.password} onChange={handleChange} isRequired errorMsg={validationErrors.password} />
                        <InputField label={t("confirm_new_password")} name="confirmPassword" type="password" value={formData.confirmPassword} onChange={handleChange} isRequired errorMsg={validationErrors.confirmPassword} />
                    </form>
                </div>

                <div className="p-6 px-15 bg-white border-t border-gray-50 shrink-0">
                    <div className="flex flex-col items-center">
                        <button
                            onClick={handleSubmit}
                            disabled={loading}
                            className="w-[50%] bg-[#048bb4] hover:bg-[#f15a24] text-white font-semibold py-2.5 px-4 rounded-3xl transition duration-300 text-sm disabled:opacity-50"
                        >
                            {loading ? t("signing_up") : t("sign_up_button")}
                        </button>
                        
                        {serverError && (
                            <p className="text-red-500 text-[12px] mt-3 font-semibold flex items-center gap-1">
                                ⚠️ {serverError}
                            </p>
                        )}
                        
                        {success && (
                        <p className="text-green-600 text-[12px] mt-3 font-bold text-center">
                            ✅ Registration submitted! The owner will review and approve your account shortly.
                            You'll receive a WhatsApp confirmation once approved.
                        </p>
                        )}
                    </div>

                    <div className="text-center text-gray-500 mt-4 text-sm font-semibold">
                        {t("already_have_account")} <a href="/" className="text-blue-500 hover:text-blue-700">{t("sign_in")}</a>
                    </div>
                </div>
            </div>

            <style dangerouslySetInnerHTML={{ __html: `
                .custom-scrollbar::-webkit-scrollbar { width: 5px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
            `}} />
        </div>
    );
};

const InputField = ({ label, name, type = "text", value, onChange, isRequired, errorMsg, placeholder }) => (
    <div className="mb-2 relative">
        <label className="block text-gray-600 text-sm mb-2 font-normal">
            {label} {isRequired && <span className="text-red-500">*</span>}
        </label>
        <div className="relative">
            <input
                type={type}
                name={name}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                className={`w-full px-2 py-1 border rounded-md focus:outline-none focus:ring-2 bg-gray-50 text-sm transition-all ${
                    errorMsg ? "border-red-500 ring-1 ring-red-100 pr-8" : "border-gray-300 focus:ring-blue-300"
                }`}
            />
            {errorMsg && (
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-red-500 font-black text-lg animate-pulse">
                    !
                </span>
            )}
        </div>
        {errorMsg && <p className="text-[10px] text-red-500 mt-1 font-medium">{errorMsg}</p>}
    </div>
);

export default RegistrationPage;