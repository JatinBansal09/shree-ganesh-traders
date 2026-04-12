// src/ConsumerFormModal.jsx
import { useState, useEffect } from "react";
import {
  X, User, Phone, MapPin,
  ChevronRight, ChevronLeft, Check,
} from "lucide-react";

// ── Steps ─────────────────────────────────────────────────────────────────────
const STEPS = [
  { id: 0, label: "Personal Info", icon: User,   desc: "Name & contact details" },
  { id: 1, label: "Address",       icon: MapPin,  desc: "Location & GST info"    },
];

const DEFAULT_FORM = {
  customer_name:    "",
  phone_number:     "",
  gst_id:           "",
  customer_address: "",
};

const ConsumerFormModal = ({ isOpen, onClose, mode = "add", userData = null, onSave }) => {
  const [formData, setFormData] = useState(DEFAULT_FORM);
  const [errors,   setErrors]   = useState({});
  const [step,     setStep]     = useState(0);
  const [saving,   setSaving]   = useState(false);

  // ── Populate on open ────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    setStep(0);
    setErrors({});
    if (userData) {
      setFormData({
        consumer_id:      userData.id            || "",
        customer_name:    userData.customer_name  || "",
        phone_number:     userData.phone_number   || "",
        gst_id:           userData.gst_id         || "",
        customer_address: userData.customer_address || "",
      });
    } else {
      setFormData(DEFAULT_FORM);
    }
  }, [isOpen, userData]);

  // ── Handlers ────────────────────────────────────────────────────────────
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: null }));
  };

  const validateStep = (s) => {
    const errs = {};
    if (s === 0) {
      if (!formData.customer_name.trim())
        errs.customer_name = "Full name is required.";
      else if (!/^[a-zA-Z\s.'-]{2,}$/.test(formData.customer_name.trim()))
        errs.customer_name = "Enter a valid name.";

      if (!formData.phone_number.trim())
        errs.phone_number = "Phone number is required.";
      else if (!/^[6-9]\d{9}$/.test(formData.phone_number.trim()))
        errs.phone_number = "Enter a valid 10-digit number.";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNext = () => {
    if (validateStep(step))
      setStep(s => Math.min(STEPS.length - 1, s + 1));
  };

  const handleBack = () => {
    setErrors({});
    setStep(s => Math.max(0, s - 1));
  };

  const handleSave = async () => {
    if (!validateStep(step)) return;
    setSaving(true);
    try {
      await onSave(formData, mode);
      onClose();
    } catch {
      // errors handled in parent
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  // ── Reusable Field ───────────────────────────────────────────────────────
  const Field = ({ label, error, children, required }) => (
    <div>
      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
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
    `w-full px-3.5 py-2.5 border-2 rounded-xl outline-none text-sm text-gray-800 bg-white transition-all ${
      errors[field]
        ? "border-red-400 bg-red-50"
        : "border-gray-200 hover:border-gray-300 focus:border-[#F7941D] focus:shadow-[0_0_0_3px_rgba(247,148,29,0.12)]"
    }`;

  // ── Step content ─────────────────────────────────────────────────────────
  const renderStep = () => {
    if (step === 0) return (
      <div className="flex flex-col gap-5">
        <Field label="Full Name" error={errors.customer_name} required>
          <input
            type="text" name="customer_name"
            placeholder="e.g. Ramesh Kumar"
            value={formData.customer_name}
            onChange={handleChange}
            className={inputCls("customer_name")}
          />
        </Field>

        <Field label="Phone Number" error={errors.phone_number} required>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium select-none">
              +91
            </span>
            <input
              type="text" name="phone_number"
              placeholder="10-digit number"
              value={formData.phone_number}
              onChange={handleChange}
              className={`${inputCls("phone_number")} pl-12`}
              maxLength={10}
            />
          </div>
        </Field>
      </div>
    );

    if (step === 1) return (
      <div className="flex flex-col gap-5">
        <Field label="GST ID" error={errors.gst_id}>
          <input
            type="text" name="gst_id"
            placeholder="e.g. 27AAPFU0939F1ZV (optional)"
            value={formData.gst_id}
            onChange={handleChange}
            className={inputCls("gst_id")}
          />
        </Field>

        <Field label="Address" error={errors.customer_address}>
          <textarea
            name="customer_address"
            placeholder="Shop or delivery address..."
            value={formData.customer_address}
            onChange={handleChange}
            rows={4}
            className={`${inputCls("customer_address")} resize-none`}
          />
        </Field>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex overflow-hidden"
           style={{ maxHeight: "90vh" }}>

        {/* ── LEFT SIDEBAR ──────────────────────────────────────────── */}
        <div className="w-56 flex-shrink-0 flex flex-col p-7"
          style={{
            background: "linear-gradient(180deg, #fff7ed 0%, #ffffff 100%)",
            borderRight: "1px solid #e2e8f0",
          }}>

          {/* Title */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-1">
              <span className="h-3 w-1 rounded-full bg-[#F7941D]" />
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#F7941D]">
                {mode === "edit" ? "Edit Consumer" : "Add Consumer"}
              </p>
            </div>
            <h2 className="text-slate-800 text-xl font-semibold leading-tight capitalize">
              {formData.customer_name || "New Consumer"}
            </h2>
          </div>

          {/* Step indicators */}
          <div className="flex flex-col gap-7 flex-1">
            {STEPS.map((s, i) => {
              const Icon      = s.icon;
              const isActive    = step === i;
              const isCompleted = step > i;
              return (
                <div key={s.id} className="relative flex items-center gap-3">
                  {i !== STEPS.length - 1 && (
                    <div className="absolute left-[19px] top-10 w-[2px] h-6 bg-slate-100" />
                  )}
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{
                      backgroundColor: isActive    ? "#F7941D"
                                      : isCompleted ? "#fef3c7"
                                      : "#ffffff",
                      border: "1px solid " + (isActive ? "#F7941D" : "#e2e8f0"),
                    }}>
                    {isCompleted
                      ? <Check size={16} color="#F7941D" strokeWidth={3} />
                      : <Icon  size={16} color={isActive ? "#ffffff" : "#94a3b8"} />
                    }
                  </div>
                  <div>
                    <p className={`text-sm font-semibold ${isActive ? "text-slate-900" : "text-slate-400"}`}>
                      {s.label}
                    </p>
                    <p className="text-[10px] text-slate-400">{s.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Progress bar */}
          <div className="mt-auto pt-5 border-t border-slate-100">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Progress
              </span>
              <span className="text-sm font-bold text-[#F7941D]">
                {Math.round(((step + 1) / STEPS.length) * 100)}%
              </span>
            </div>
            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${((step + 1) / STEPS.length) * 100}%`,
                  backgroundColor: "#F7941D",
                }}
              />
            </div>
          </div>
        </div>

        {/* ── RIGHT CONTENT ──────────────────────────────────────────── */}
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
            {renderStep()}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-7 py-4 border-t border-gray-100 bg-gray-50">
            <button
              onClick={handleBack}
              disabled={step === 0}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 disabled:opacity-0 disabled:pointer-events-none transition"
            >
              <ChevronLeft size={16} /> Back
            </button>

            {/* Dots */}
            <div className="flex gap-1.5 items-center">
              {STEPS.map((_, i) => (
                <div key={i} className="rounded-full transition-all duration-300"
                  style={{
                    width:           i === step ? "20px" : "8px",
                    height:          "8px",
                    backgroundColor: i === step ? "#F7941D"
                                    : i < step  ? "rgba(247,148,29,0.35)"
                                    : "#e5e7eb",
                  }}
                />
              ))}
            </div>

            {step < STEPS.length - 1 ? (
              <button
                onClick={handleNext}
                className="flex items-center gap-2 px-5 py-2 text-white text-sm font-semibold rounded-xl transition-all"
                style={{ backgroundColor: "#F7941D" }}
              >
                Next <ChevronRight size={16} />
              </button>
            ) : (
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2 text-white text-sm font-semibold rounded-xl transition-all"
                style={{ backgroundColor: saving ? "#9ca3af" : "#1a1a2e" }}
              >
                <Check size={16} />
                {saving ? "Saving..." : mode === "edit" ? "Update Consumer" : "Add Consumer"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConsumerFormModal;