import React, { useState, useEffect } from 'react';
import { X, Package, Tag, Layers, ChevronRight, ChevronLeft, Check } from 'lucide-react';
import apiFetch from './utils/apiClient';

const DEFAULT_FORM = {
  product_name: '',
  category: '',
  sub_category: '',
  brand: '',
  current_stock: 0,
  unit: '',
  price: '',
  material: '',
  size: '',
  product_description: '',
  capacity: '',
  warranty: '',
  max_head: 0,
};

// ─── Step definitions ─────────────────────────────────────────────────────────
const STEPS = [
  { id: 0, label: 'Basic Info',    icon: Package, desc: 'Name, category & brand'  },
  { id: 1, label: 'Pricing',       icon: Tag,     desc: 'Unit, price & stock'      },
  { id: 2, label: 'Specifications',icon: Layers,  desc: 'Material, size & details' },
];

const ProductFormModal = ({ isOpen, onClose, userData = null, onSave, mode }) => {
  const [formData, setFormData]           = useState(DEFAULT_FORM);
  const [errors, setErrors]               = useState({});
  const [step, setStep]                   = useState(0);

  // ─── Reference data ───────────────────────────────────────────────────────
  const [categories, setCategories]       = useState([]);
  const [subCategories, setSubCategories] = useState([]);
  const [brands, setBrands]               = useState([]);
  const [units, setUnits]                 = useState([]);
  const [materials, setMaterials]         = useState([]);

  // ─── Populate form when modal opens ───────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    setStep(0);
    setErrors({});

    if (userData) {
      setFormData({
        id: userData.id || '',
        product_name:        userData.product_name        || '',
        category:            userData.category            || '',
        sub_category:        userData.sub_category        || '',
        brand:               userData.brand               || '',
        current_stock:       userData.current_stock       ?? 0,
        unit:                userData.unit                || '',
        price:               userData.price               || '',
        material:            userData.material            || '',
        size:                userData.size                || '',
        product_description: userData.product_description || '',
        capacity:            userData.capacity            || '',
        warranty:            userData.warranty            || '',
        max_head:            userData.max_head            ?? 0,
      });
    } else {
      setFormData(DEFAULT_FORM);
    }
  }, [isOpen, userData]);

  // ─── Fetch static reference data ──────────────────────────────────────────
  useEffect(() => {
    apiFetch('/api/product/form-options/')
      .then(res => {
        setCategories(res.data?.categories ?? []);
        setUnits(res.data?.units           ?? []);
        setMaterials(res.data?.materials   ?? []);
      })
      .catch(err => console.error('❌ Failed to fetch form options:', err));
  }, []);

  // ─── Fetch sub-categories ─────────────────────────────────────────────────
  useEffect(() => {
    if (!formData.category) { setSubCategories([]); return; }
    console.log("Here's the Category: ", formData.category);
    const payload = { category: formData.category };
    apiFetch('/api/product/subcategories/', { method: 'POST', body: JSON.stringify(payload) })
      .then(data => {
        const finalData = Array.isArray(data) ? data : (data?.data ?? []);
        setSubCategories(finalData);
      })
      .catch(err => console.error('❌ Failed to fetch subcategories:', err));
  }, [formData.category]);

  // ─── Fetch brands ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!formData.sub_category) { setBrands([]); return; }
    console.log("Here's the sub_category: ",formData.sub_category);
    const payload = { sub_category: formData.sub_category };
    apiFetch('/api/product/brands-by-subcategory/', { method: 'POST', body: JSON.stringify(payload) })
      .then(data => setBrands(Array.isArray(data) ? data : []))
      .catch(err => console.error('❌ Failed to fetch brands:', err));
  }, [formData.sub_category]);

  // ─── Handlers ─────────────────────────────────────────────────────────────
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: null }));
  };

  const validateStep = (s) => {
    const newErrors = {};
    if (s === 0) {
      if (!formData.product_name?.trim()) newErrors.product_name = 'Product name is required';
      if (!formData.category)             newErrors.category     = 'Please select a category';
      if (!formData.sub_category)         newErrors.sub_category = 'Please select a sub-category';
      if (!formData.brand)                newErrors.brand        = 'Please select a brand';
    }
    if (s === 1) {
      if (!formData.unit)                         newErrors.unit  = 'Unit is required';
      if (!formData.price || formData.price <= 0) newErrors.price = 'Enter a valid price';
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

  // ─── Reusable field components (Contrast Improved) ────────────────────────────
  const Field = ({ label, error, children, span = false }) => (
    <div className={span ? 'col-span-2' : ''}>
      {/* Darker label for better contrast */}
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
    if (step === 0) return (
      <div className="grid grid-cols-2 gap-x-5 gap-y-5">

        <Field label="Product Name" error={errors.product_name} span>
          <input
            type="text"
            name="product_name"
            placeholder="e.g. Brass Bib Cock"
            value={formData.product_name}
            onChange={handleChange}
            className={inputCls('product_name')}
          />
        </Field>

        <Field label="Category" error={errors.category}>
          <select name="category" value={formData.category} onChange={handleChange} className={selectCls('category')}>
            <option value="" disabled>Select category</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.category}</option>
            ))}
          </select>
        </Field>

        <Field label="Sub-Category" error={errors.sub_category}>
          <select 
            name="sub_category" 
            value={formData.sub_category} 
            onChange={handleChange} 
            className={selectCls('sub_category')}
            disabled={!formData.category}
          >
            <option value="" disabled>Select sub-category</option>
            {subCategories.map((sub) => (
              <option key={sub.id} value={sub.id}>
                {sub.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Brand" error={errors.brand} span>
          <select name="brand" value={formData.brand} onChange={handleChange} className={selectCls('brand')}
            disabled={!formData.sub_category}>
            <option value="" disabled>
              {formData.sub_category ? 'Select brand' : 'Select sub-category first'}
            </option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </Field>

      </div>
    );

    if (step === 1) return (
      <div className="grid grid-cols-2 gap-x-5 gap-y-5">

        <Field label="Unit" error={errors.unit}>
          <select name="unit" value={formData.unit} onChange={handleChange} className={selectCls('unit')}>
            <option value="" disabled>Select unit</option>
            {units.map(u => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </Field>

        <Field label="Price (₹)" error={errors.price}>
          <input
            type="number"
            name="price"
            placeholder="e.g. 499"
            value={formData.price}
            onChange={handleChange}
            min={0}
            className={inputCls('price')}
          />
        </Field>

        <Field label="Initial Stock" error={errors.current_stock} span>
          <input
            type="number"
            name="current_stock"
            value={formData.current_stock}
            onChange={handleChange}
            min={0}
            className={inputCls('current_stock')}
          />
        </Field>

      </div>
    );

    if (step === 2) return (
      <div className="grid grid-cols-2 gap-x-5 gap-y-5">

        <Field label="Material" error={errors.material}>
          <select name="material" value={formData.material} onChange={handleChange} className={selectCls('material')}>
            <option value="" disabled>Select material</option>
            {materials.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </Field>

        <Field label="Size" error={errors.size}>
          <input
            type="text"
            name="size"
            placeholder='e.g. 1/2"'
            value={formData.size}
            onChange={handleChange}
            className={inputCls('size')}
          />
        </Field>

        <Field label="Capacity" error={errors.capacity}>
          <input
            type="text"
            name="capacity"
            placeholder="e.g. 10 Litres"
            value={formData.capacity}
            onChange={handleChange}
            className={inputCls('capacity')}
          />
        </Field>

        <Field label="Warranty" error={errors.warranty}>
          <input
            type="text"
            name="warranty"
            placeholder="e.g. 1 Year"
            value={formData.warranty}
            onChange={handleChange}
            className={inputCls('warranty')}
          />
        </Field>

        <Field label="Max Heads" error={errors.max_head}>
          <input
            type="number"
            name="max_head"
            value={formData.max_head}
            onChange={handleChange}
            min={0}
            className={inputCls('max_head')}
          />
        </Field>

        <Field label="Description" error={errors.product_description} span>
          <textarea
            name="product_description"
            value={formData.product_description}
            onChange={handleChange}
            rows={3}
            placeholder="Brief product description..."
            className={`${inputCls('product_description')} resize-none`}
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

        {/* ── LEFT SIDEBAR (Refined Typography - No Shadows) ─────────────────── */}
        <div className="w-64 flex-shrink-0 flex flex-col p-8 relative overflow-hidden" 
            style={{ 
              background: 'linear-gradient(180deg, rgba(231, 242, 245, 0.9) 0%, rgba(255, 255, 255, 1) 100%)',
              borderRight: '1px solid #e2e8f0' 
            }}>
          
          {/* Header Section */}
          <div className="relative z-10 mb-10">
            <div className="flex items-center gap-2 mb-2">
              <span className="h-3 w-1 rounded-full bg-[#F7941D]" />
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#F7941D]">
                {mode === 'edit' ? 'Update' : 'Add New Product'}
              </p>
            </div>
            
            {/* IMPROVED: Changed to font-semibold and text-slate-800 for a more 'premium' feel */}
            <h2 className="text-slate-800 text-2xl font-semibold tracking-tight leading-tight break-words capitalize">
              {(formData.product_name || 'Untitled')
                .toLowerCase()
                .split(' ')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ')}
            </h2>
          </div>

          {/* Step indicators */}
          <div className="relative z-10 flex flex-col gap-8 flex-1">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const isActive = step === i;
              const isCompleted = step > i;
              
              return (
                <div key={s.id} className="relative flex items-center gap-4">
                  {/* Connector Line */}
                  {i !== STEPS.length - 1 && (
                    <div className="absolute left-[21px] top-12 w-[2px] h-7 bg-slate-100" />
                  )}

                  <div className="relative w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-300"
                    style={{
                      backgroundColor: isActive ? '#0c7c9d' : isCompleted ? '#f0fdfa' : '#ffffff',
                      border: '1px solid ' + (isActive ? '#0c7c9d' : '#e2e8f0'),
                    }}
                  >
                    {isCompleted 
                      ? <Check size={18} color="#0c7c9d" strokeWidth={3} />
                      : <Icon size={18} color={isActive ? '#ffffff' : '#94a3b8'} />
                    }
                  </div>

                  <div className="flex flex-col">
                    <p className={`text-sm font-semibold transition-all ${isActive ? 'text-slate-900' : 'text-slate-400'}`}>
                      {s.label}
                    </p>
                    {isActive && (
                      <p className="text-[10px] text-[#0c7c9d] font-medium mt-0.5">Current Step</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Progress Tracker */}
          <div className="relative z-10 mt-auto pt-6 border-t border-slate-100">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Progress</span>
              <span className="text-sm font-bold text-[#F7941D]">
                {Math.round(((step + 1) / STEPS.length) * 100)}%
              </span>
            </div>
            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-[#F7941D] transition-all duration-700"
                style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
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

            {/* Back */}
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
                                     i < step   ? 'rgba(247,148,29,0.35)' :
                                                  '#e5e7eb',
                  }}
                />
              ))}
            </div>

            {/* Next / Save */}
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
                Save Product
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default ProductFormModal;