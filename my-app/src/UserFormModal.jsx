import React, { useState, useEffect } from 'react';
import { X, User, Phone, Lock, ChevronRight, ChevronLeft, Check, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { validateUsername, validatePassword, validatePhone, validateName } from "./utils/validation";

// ─── Step definitions ─────────────────────────────────────────────────────────
const STEPS = [
  { id: 0, label: 'Personal Info', icon: User,        desc: 'Name, email & group'   },
  { id: 1, label: 'Contact',       icon: Phone,       desc: 'Phone & shop details'  },
  { id: 2, label: 'Security',      icon: ShieldCheck, desc: 'Username & password'   },
];

const DEFAULT_FORM = {
  customer_name: '', username: '', email: '', phone_number: '',
  userGroup: '', shopName: '', address: '',
  password: '', confirmPassword: '', status: 'Active',
};

const UserFormModal = ({ isOpen, onClose, mode, userData = null, onSave }) => {
  const [formData, setFormData]     = useState(DEFAULT_FORM);
  const [errors, setErrors]         = useState({});
  const [step, setStep]             = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [autoGenerate, setAutoGenerate] = useState(true);

  // ─── Populate form when modal opens ───────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    setStep(0);
    setErrors({});

    if (userData) {
      setFormData({
        user_id:        userData.user_id        || '',
        customer_name:  userData.customer_name  || '',
        username:       userData.username       || '',
        email:          userData.email          || '',
        phone_number:   userData.phone_number   || '',
        userGroup:      userData.customer_type      || '',
        shopName:       userData.shopName       || '',
        address:        userData.address        || '',
        status:         userData.status         || 'Active',
        password:       '',
        confirmPassword:'',
      });
      setAutoGenerate(false);
    } else {
      setFormData(DEFAULT_FORM);
      setAutoGenerate(true);
    }
  }, [isOpen, userData]);

  // ─── Auto-generate password ───────────────────────────────────────────────
  useEffect(() => {
    if (autoGenerate) {
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
      let pwd = "";
      for (let i = 0; i < 10; i++) pwd += chars.charAt(Math.floor(Math.random() * chars.length));
      setFormData(prev => ({ ...prev, password: pwd, confirmPassword: pwd }));
    } else {
      setFormData(prev => ({ ...prev, password: '', confirmPassword: '' }));
    }
  }, [autoGenerate]);

  // ─── Auto-clear errors after 5s ───────────────────────────────────────────
  useEffect(() => {
    if (Object.keys(errors).length === 0) return;
    const t = setTimeout(() => setErrors({}), 5000);
    return () => clearTimeout(t);
  }, [errors]);

  // ─── Handlers ─────────────────────────────────────────────────────────────
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: null }));
  };

  const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const validateStep = (s) => {
    const newErrors = {};

    if (s === 0) {
      if (!formData.customer_name.trim())        newErrors.customer_name = 'Full name is required';
      else if (!validateName(formData.customer_name)) newErrors.customer_name = 'Name should be alphabetical';
      if (!formData.email.trim())                newErrors.email    = 'Email is required';
      else if (!validateEmail(formData.email))   newErrors.email    = 'Enter a valid email address';
      if (!formData.userGroup)                   newErrors.userGroup = 'Please select a user group';
    }

    if (s === 1) {
      if (!formData.phone_number.trim())              newErrors.phone_number = 'Phone number is required';
      else if (!validatePhone(formData.phone_number)) newErrors.phone_number = 'Enter a valid 10-digit phone number';
    }

    if (s === 2) {
      if (!formData.username.trim())             newErrors.username = 'Username is required';
      else if (formData.username.length < 4)     newErrors.username = 'Username must be at least 4 characters';
      else if (!validateUsername(formData.username)) newErrors.username = 'Only letters, numbers, and underscores allowed';
      if (!formData.password)                    newErrors.password = 'Password is required';
      else if (!validatePassword(formData.password)) newErrors.password = 'Must be 8+ chars with 1 uppercase, 1 number & 1 special character';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(step)) setStep(s => Math.min(STEPS.length - 1, s + 1));
  };

  const handleBack = () => {
    setErrors({});
    setStep(s => Math.max(0, s - 1));
  };

  const handleSave = () => {
    if (validateStep(step)) {
      onSave(formData, mode);
      onClose();
    }
  };

  if (!isOpen) return null;

  // ─── Reusable field wrapper ────────────────────────────────────────────────
  const Field = ({ label, error, children, span = false }) => (
    <div className={span ? 'col-span-2' : ''}>
      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
        {label}
      </label>
      {children}
      {error && (
        <p className="text-[11px] font-medium text-red-600 mt-1 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-red-600 inline-block" />
          {error}
        </p>
      )}
    </div>
  );

  const inputCls = (field) =>
    `w-full px-3.5 py-2.5 border-2 rounded-xl outline-none text-sm text-gray-800 bg-white transition-all duration-150 ${
      errors[field]
        ? 'border-red-400 bg-red-50'
        : 'border-gray-200 hover:border-gray-300 focus:border-orange-400 focus:shadow-[0_0_0_3px_rgba(249,115,22,0.12)]'
    }`;

  const selectCls = (field) =>
    `w-full px-3.5 py-2.5 border-2 rounded-xl outline-none text-sm text-gray-800 bg-white transition-all duration-150 cursor-pointer ${
      errors[field]
        ? 'border-red-400 bg-red-50'
        : 'border-gray-200 hover:border-gray-300 focus:border-orange-400 focus:shadow-[0_0_0_3px_rgba(249,115,22,0.12)]'
    }`;

  // ─── Step content ─────────────────────────────────────────────────────────
  const StepContent = () => {

    // Step 0 — Personal Info
    if (step === 0) return (
      <div className="grid grid-cols-2 gap-x-5 gap-y-5">

        <Field label="Full Name" error={errors.customer_name} span>
          <input
            type="text" name="customer_name"
            placeholder="e.g. Ramesh Kumar"
            value={formData.customer_name}
            onChange={handleChange}
            className={inputCls('customer_name')}
          />
        </Field>

        <Field label="Email Address" error={errors.email} span>
          <input
            type="email" name="email"
            placeholder="e.g. ramesh@email.com"
            value={formData.email}
            onChange={handleChange}
            className={inputCls('email')}
          />
        </Field>

        <Field label="User Group" error={errors.userGroup}>
          <select name="userGroup" value={formData.userGroup} onChange={handleChange} className={selectCls('userGroup')}>
            <option value="" disabled>Select group</option>
            <option value="Retailer">Retailer</option>
            <option value="Plumber">Plumber</option>
            <option value="Builder">Builder</option>
            <option value="Dealer">Dealer</option>
            <option value="Employee">Employee</option>
          </select>
        </Field>

        <Field label="Status" error={errors.status}>
          <select name="status" value={formData.status} onChange={handleChange} className={selectCls('status')}>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </Field>

      </div>
    );

    // Step 1 — Contact
    if (step === 1) return (
      <div className="grid grid-cols-2 gap-x-5 gap-y-5">

        <Field label="Phone Number" error={errors.phone_number} span>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium select-none">
              +91
            </span>
            <input
              type="text" name="phone_number"
              placeholder="10-digit number"
              value={formData.phone_number}
              onChange={handleChange}
              className={`${inputCls('phone_number')} pl-12`}
            />
          </div>
        </Field>

        <Field label="Shop Name (Optional)" error={errors.shopName} span>
          <input
            type="text" name="shopName"
            placeholder="e.g. Ramesh Hardware"
            value={formData.shopName}
            onChange={handleChange}
            className={inputCls('shopName')}
          />
        </Field>

        <Field label="Address (Optional)" error={errors.address} span>
          <textarea
            name="address"
            placeholder="Shop or delivery address..."
            value={formData.address}
            onChange={handleChange}
            rows={3}
            className={`${inputCls('address')} resize-none`}
          />
        </Field>

      </div>
    );

    // Step 2 — Security
    if (step === 2) return (
      <div className="grid grid-cols-2 gap-x-5 gap-y-5">

        <Field label="Username" error={errors.username} span>
          <input
            type="text" name="username"
            placeholder="e.g. ramesh_k"
            value={formData.username}
            onChange={handleChange}
            className={inputCls('username')}
          />
        </Field>

        {/* Password with auto-generate toggle */}
        <Field label="Password" error={errors.password} span>
          <div className="flex gap-3 items-center mb-2">
            <span className="text-xs text-gray-500 font-medium">Auto-generate</span>
            <button
              type="button"
              onClick={() => setAutoGenerate(!autoGenerate)}
              className="w-10 h-5 flex items-center rounded-full p-0.5 transition-colors"
              style={{ backgroundColor: autoGenerate ? '#0c7c9d' : '#d1d5db' }}
            >
              <div className={`bg-white w-4 h-4 rounded-full shadow transition-transform ${autoGenerate ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              name="password"
              placeholder={autoGenerate ? 'Auto-generated' : 'Enter password'}
              value={formData.password}
              onChange={handleChange}
              disabled={autoGenerate}
              className={`${inputCls('password')} pr-10 ${autoGenerate ? 'bg-gray-50 text-gray-400' : ''}`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </Field>

        <Field label="Confirm Password" error={errors.confirmPassword} span>
          <input
            type="password" name="confirmPassword"
            placeholder="Re-enter password"
            value={formData.confirmPassword}
            onChange={handleChange}
            disabled={autoGenerate}
            className={`${inputCls('confirmPassword')} ${autoGenerate ? 'bg-gray-50 text-gray-400' : ''}`}
          />
        </Field>

      </div>
    );
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex overflow-hidden"
           style={{ maxHeight: '90vh' }}>

        {/* ── LEFT SIDEBAR ─────────────────────────────────────────────────── */}
        <div className="w-64 flex-shrink-0 flex flex-col p-8 relative overflow-hidden"
          style={{
            background: 'linear-gradient(180deg, rgba(231,242,245,0.9) 0%, rgba(255,255,255,1) 100%)',
            borderRight: '1px solid #e2e8f0',
          }}>

          {/* Title */}
          <div className="relative z-10 mb-10">
            <div className="flex items-center gap-2 mb-2">
              <span className="h-3 w-1 rounded-full bg-[#F7941D]" />
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#F7941D]">
                {mode === 'edit' ? 'Update User' : 'Add New User'}
              </p>
            </div>
            <h2 className="text-slate-800 text-2xl font-semibold tracking-tight leading-tight break-words capitalize">
              {(formData.customer_name || 'New User')
                .toLowerCase().split(' ')
                .map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
            </h2>
            {formData.userGroup && (
              <span className="inline-block mt-2 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                style={{ backgroundColor: 'rgba(12,124,157,0.1)', color: '#0c7c9d' }}>
                {formData.userGroup}
              </span>
            )}
          </div>

          {/* Step indicators */}
          <div className="relative z-10 flex flex-col gap-8 flex-1">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const isActive    = step === i;
              const isCompleted = step > i;
              return (
                <div key={s.id} className="relative flex items-center gap-4">
                  {/* Connector line */}
                  {i !== STEPS.length - 1 && (
                    <div className="absolute left-[21px] top-12 w-[2px] h-7 bg-slate-100" />
                  )}

                  <div className="relative w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-300"
                    style={{
                      backgroundColor: isActive    ? '#0c7c9d' :
                                       isCompleted ? '#f0fdfa' : '#ffffff',
                      border: '1px solid ' + (isActive ? '#0c7c9d' : '#e2e8f0'),
                    }}
                  >
                    {isCompleted
                      ? <Check size={18} color="#0c7c9d" strokeWidth={3} />
                      : <Icon  size={18} color={isActive ? '#ffffff' : '#94a3b8'} />
                    }
                  </div>

                  <div className="flex flex-col">
                    <p className={`text-sm font-semibold transition-all ${isActive ? 'text-slate-900' : 'text-slate-400'}`}>
                      {s.label}
                    </p>
                    {isActive && (
                      <p className="text-[10px] font-medium mt-0.5" style={{ color: '#0c7c9d' }}>
                        Current Step
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Progress bar */}
          <div className="relative z-10 mt-auto pt-6 border-t border-slate-100">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Progress</span>
              <span className="text-sm font-bold" style={{ color: '#F7941D' }}>
                {Math.round(((step + 1) / STEPS.length) * 100)}%
              </span>
            </div>
            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${((step + 1) / STEPS.length) * 100}%`,
                  backgroundColor: '#F7941D',
                }}
              />
            </div>
          </div>
        </div>

        {/* ── RIGHT CONTENT ─────────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-7 py-5 border-b border-gray-100">
            <div>
              <h3 className="text-lg font-bold text-gray-900">{STEPS[step].label}</h3>
              <p className="text-sm text-gray-400 mt-0.5">{STEPS[step].desc}</p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition"
            >
              <X size={18} className="text-gray-400" />
            </button>
          </div>

          {/* Form body */}
          <div className="flex-1 overflow-y-auto px-7 py-6">
            <StepContent />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-7 py-4 border-t border-gray-100 bg-gray-50">

            <button
              onClick={handleBack}
              disabled={step === 0}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 disabled:opacity-0 disabled:pointer-events-none transition"
            >
              <ChevronLeft size={16} />
              Back
            </button>

            {/* Progress dots */}
            <div className="flex gap-1.5 items-center">
              {STEPS.map((_, i) => (
                <div key={i}
                  className="rounded-full transition-all duration-300"
                  style={{
                    width:           i === step ? '20px' : '8px',
                    height:          '8px',
                    backgroundColor: i === step ? '#F7941D' :
                                     i < step   ? 'rgba(247,148,29,0.35)' : '#e5e7eb',
                  }}
                />
              ))}
            </div>

            {step < STEPS.length - 1 ? (
              <button
                onClick={handleNext}
                className="flex items-center gap-2 px-5 py-2 text-white text-sm font-semibold rounded-xl active:scale-95 transition-all shadow-sm"
                style={{ backgroundColor: '#F7941D' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#e0841a'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = '#F7941D'}
              >
                Next
                <ChevronRight size={16} />
              </button>
            ) : (
              <button
                onClick={handleSave}
                className="flex items-center gap-2 px-6 py-2 text-white text-sm font-semibold rounded-xl active:scale-95 transition-all shadow-sm"
                style={{ backgroundColor: '#1a1a2e' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#2d2d4a'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = '#1a1a2e'}
              >
                <Check size={16} />
                Save User
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default UserFormModal;