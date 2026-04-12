import { useState, React } from "react";
import axios from "axios";
import { validateUsername, validatePassword, validateEmail, validatePhone, validateName} from "./utils/validation";
import { useTranslation } from "./i18n";

const API_REGISTER_URL = "http://localhost:8000/api/register/";

const RegistrationPage = () => {
    const { t } = useTranslation();

    const [formData, setFormData] = useState({
        username: "",
        email: "",
        password: "",
        confirmPassword: "",
        customerName: "",
        phoneNumber: "",
        shopName: "",
        userGroup: "Customer"
    });

    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);

        // Validation
        if (!validateUsername(formData.username)) { setError("Invalid Username"); return; }
        if (!validateEmail(formData.email)) { setError("Invalid Email"); return; }
        if (formData.password !== formData.confirmPassword) { setError("Passwords do not match"); return; }

        setLoading(true);
        try {
            await axios.post(API_REGISTER_URL, {
                username: formData.username,
                email: formData.email,
                password: formData.password,
                customer_name: formData.customerName,
                phone_number: formData.phoneNumber,
                shopName: formData.shopName,
                customer_userGroup: formData.userGroup,
                status: true
            });
            setSuccess("Registration successful!");
        } catch (err) {
            setError(err.response?.data?.detail || "Registration failed.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="relative min-h-screen flex items-center justify-center bg-gray-100 font-sans overflow-hidden">
            {/* Top Left Blue-ish */}
            <div className="absolute top-0 left-0 w-60 h-45 bg-[#048bb4] transform skew-y-[-18deg] -translate-x-1/2 -translate-y-1/40 opacity-90"></div>
            {/* Top Right Orange-ish */}
            <div className="absolute top-[-7%] right-0 w-60 h-40 bg-[#f9ac19] transform skew-y-[18deg] translate-x-1/2 translate-y-1/4 opacity-90"></div>
            {/* Bottom Left Orange-ish */}
            <div className="absolute bottom-[-8%] left-0 w-60 h-55 bg-[#f9ac19] transform skew-y-[15deg] -translate-x-1/2 -translate-y-1/70 opacity-90"></div>
            {/* Bottom Right Red-ish */}
            <div className="absolute bottom-0 right-0 w-60 h-55 bg-[#f15a24] transform -skew-y-[15deg] translate-x-1/2 translate-y-1/4 opacity-80"></div>
            <div className="relative z-10 bg-white p-8 rounded-xl shadow-2xl max-w-lg w-full">
                <h2 className="text-3xl font-bold text-center text-gray-800 mb-6">{t("sign_up")}</h2>
                
                <form 
                    onSubmit={handleSubmit} 
                    className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-4"
                >
                    <div className="space-y-4">
                        <InputField label={t("username")} name="username" value={formData.username} onChange={handleChange} />
                        <InputField label="Email" name="email" type="email" value={formData.email} onChange={handleChange} />
                        <InputField label="Full Name" name="customerName" value={formData.customerName} onChange={handleChange} />
                        <InputField label="Phone Number" name="phoneNumber" value={formData.phoneNumber} onChange={handleChange} />
                        <InputField label="Shop Name" name="shopName" value={formData.shopName} onChange={handleChange} />
                        
                        <div>
                            <label className="block text-gray-600 text-xs mb-1 font-semibold">Register As</label>
                            <select
                                name="userGroup"
                                value={formData.userGroup}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-sm outline-none focus:ring-2 focus:ring-blue-300"
                            >
                                <option value="Customer">Customer</option>
                                <option value="Employee">Employee</option>
                                <option value="Wholesaler">Wholesaler</option>
                            </select>
                        </div>

                        <InputField label={t("password")} name="password" type="password" value={formData.password} onChange={handleChange} />
                        <InputField label={t("confirm_new_password")} name="confirmPassword" type="password" value={formData.confirmPassword} onChange={handleChange} />
                    </div>
                </form>
                <div className="mt-6 pt-4 border-t border-gray-100 shrink-0">
                    <button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="w-full bg-[#048bb4] hover:bg-[#f15a24] text-white font-semibold py-3 rounded-3xl transition duration-300 disabled:opacity-50"
                    >
                        {loading ? t("signing_up") : t("sign_up_button")}
                    </button>

                    {error && <p className="text-red-500 text-xs text-center mt-3">{error}</p>}
                    {success && <p className="text-green-500 text-xs text-center mt-3">{success}</p>}

                    <div className="text-center text-gray-500 mt-4 text-sm">
                        {t("already_have_account")}{" "}
                        <a href="/" className="text-blue-500 hover:text-blue-700 font-semibold">
                            {t("sign_in")}
                        </a>
                    </div>
                </div>
            </div>
            <style jsx>{`
                .custom-scrollbar::-webkit-scrollbar { width: 5px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: #f1f1f1; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #ccc; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #048bb4; }
            `}</style>
        </div>
    );
};

const InputField = ({ label, name, type = "text", value, onChange }) => (
    <div>
        <label className="block text-gray-600 text-xs mb-1 font-semibold">{label}</label>
        <input
            type={type}
            name={name}
            value={value}
            onChange={onChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-sm outline-none focus:ring-2 focus:ring-blue-300"
            required
        />
    </div>
);

export default RegistrationPage;
