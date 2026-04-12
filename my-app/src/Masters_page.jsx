import React, { useMemo, useRef, useState, useEffect } from "react";
import { useTranslation } from "./i18n";
import ProductFormModal from "./ProductFormModal";
import { ChevronRight, ChevronLeft, ChevronDown, Settings, Search, Eye, Pencil, Users, Package, X, Trash2, Plus } from "lucide-react";
import { toastAlert } from './alerts';
import apiFetch from './utils/apiClient';
import BulkDiscountModal from "./BulkDiscountModal";
import ManageAttributeModal from "./ManageAttributeModal";
import DiscountGroupSettingsModal from "./Discountgroupsettingsmodal";
import { useNavigate } from "react-router-dom";

// ─── Customer Assignment Modal ────────────────────────────────────────────────
const CustomerAssignmentModal = ({ isOpen, onClose, customer, discountGroups }) => {
  const { t } = useTranslation();
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading]         = useState(false);

  useEffect(() => {
    if (!isOpen || !customer) return;

    setLoading(true);
    apiFetch(`/api/customers/${customer.user_id}/discount-groups/`)
      .then(res => setAssignments(Array.isArray(res) ? res : (res?.data ?? [])))
      .catch(err => console.error('❌ Failed to fetch assignments:', err))
      .finally(() => setLoading(false));
  }, [isOpen, customer]);

  const handleAdd = () => {
    setAssignments(prev => [...prev, { id: null, discount_group: '' }]);
  };

  const handleChange = (index, value) => {
    setAssignments(prev => prev.map((a, i) => i === index ? { ...a, discount_group: value } : a));
  };

  const handleRemove = (index) => {
    setAssignments(prev => prev.filter((_, i) => i !== index));
  };

const handleSave = async () => {
    try {
        await apiFetch(`/api/customers/${customer.user_id}/discount-groups/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                discount_groups: assignments.map(a => a.discount_group).filter(Boolean)
            }),
        });
        toastAlert('Assignments saved successfully', 'success');
        onClose();
    } catch (err) {
        const errData = err?.data;

        if (errData?.conflicts?.length > 0) {
            toastAlert(`${errData.conflicts[0]}`, 'error');
        } else if (errData?.error) {
            toastAlert(errData.error, 'error');
        } else {
            toastAlert('Failed to save assignments', 'error');
        }
    }
};

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col max-h-[80vh] overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">{t("discount_assignments")}</h2>
            <p className="text-sm text-gray-500">{customer?.customer_name}</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full transition">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-3 flex-1">
          {loading ? (
            [...Array(3)].map((_, i) => (
              <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />
            ))
          ) : assignments.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No discount groups assigned yet</p>
          ) : (
            assignments.map((assignment, index) => {
              const selectedGroup = discountGroups.find(g => String(g.disc_id) === String(assignment.discount_group));
              return (
                <div key={index} className="flex items-center gap-3">
                  <select
                    value={assignment.discount_group}
                    onChange={(e) => handleChange(index, e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="" disabled>Select Discount Group</option>
                    {discountGroups.map(grp => (
                      <option key={grp.disc_id} value={grp.disc_id}>
                        {grp.name} ({grp.base_percent}%)
                      </option>
                    ))}
                  </select>
                  {selectedGroup && (
                    <span className="text-xs text-gray-400 whitespace-nowrap">
                      {selectedGroup.category?.name ?? 'All'} › {selectedGroup.sub_category ?? 'All'}
                    </span>
                  )}
                  <button onClick={() => handleRemove(index)} className="p-1.5 hover:bg-red-50 rounded-lg transition">
                    <Trash2 size={15} className="text-red-400" />
                  </button>
                </div>
              );
            })
          )}

          {/* Add Row */}
          <button
            onClick={handleAdd}
            className="flex items-center gap-2 text-sm text-orange-500 hover:text-orange-600 font-medium mt-2"
          >
            <Plus size={16} />
            {t("add_discount_group")}
          </button>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 bg-gray-50 border-t">
          <button onClick={onClose} className="px-5 py-2 text-gray-600 hover:text-gray-800 text-sm transition">
            {t("cancel")}
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-orange-500 text-white rounded-lg text-sm shadow-sm hover:bg-orange-600 transition"
          >
            {t("save")}
          </button>
        </div>
      </div>
    </div>
  );
};


// ─── Main Component ───────────────────────────────────────────────────────────
const Masters_data = () => {
  const { t, language } = useTranslation();

  // ── Tab state ──────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('products'); // 'products' | 'customers'
  const [bulkTarget, setBulkTarget] = useState(null);

  // ── Product Pricing state ──────────────────────────────────────────────────
  const [products, setProducts]           = useState([]);
  const [productLoading, setProductLoading] = useState(false);
  const [searchQuery, setSearchQuery]     = useState("");
  const [category, setCategory]           = useState("");
  const [subCategory, setSubCategory]     = useState("");
  const [brand, setBrand]                 = useState("");
  const [filterdata, setfilterdata]       = useState(false);
  const tableRef                          = useRef(null);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editProduct, setEditProduct]     = useState(null);

  // ── Discount group selector state ──────────────────────────────────────────
  const [discountGroups, setDiscountGroups] = useState([]);
  const [activeGroupIndex, setActiveGroupIndex] = useState(0);
  const activeGroup = discountGroups[activeGroupIndex] ?? null;

  // ── Customer Assignments state ─────────────────────────────────────────────
  const [groupedData, setGroupedData]       = useState([]);   // { group_name, total, page, total_pages, customers }[]
  const [consumerSummary, setConsumerSummary] = useState(null);
  const [groupPages, setGroupPages]         = useState({}); 
  const [customers, setCustomers]             = useState([]);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [customerSearch, setCustomerSearch]   = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);
  const [categories, setCategories]         = useState([]);
  const [subcategories, setSubCategories]  = useState([]);
  const [managesubcategories, setManageSubCategories]  = useState([]);
  const [brands, setBrands]                 = useState([]);
  const [managebrands, setmanageBrands]                 = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [manageType, setManageType] = useState(null);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [groupDropdownOpen, setGroupDropdownOpen] = useState(false);
  const navigate = useNavigate();
// 2. State
  const [isDiscountSettingsOpen, setIsDiscountSettingsOpen] = useState(false);

  const openManageModal = (type) => {
    setManageType(type);
    setIsManageModalOpen(true);
  };


  // ─── Scroll indicator ─────────────────────────────────────────────────────
  useEffect(() => {
    const el = tableRef.current;
    if (!el) return;
    const checkScroll = () => setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 5);
    checkScroll();
    el.addEventListener("scroll", checkScroll);
    window.addEventListener("resize", checkScroll);
    return () => { el.removeEventListener("scroll", checkScroll); window.removeEventListener("resize", checkScroll); };
  }, [products]);

  
  // ─── Fetch customers when Customer tab is active ───────────────────────────
  useEffect(() => {
    if (activeTab !== 'customers') return;
    setCustomerLoading(true);

    const payload = {
      search:      customerSearch,
      groupname:   activeGroupIndex === 0 ? null : activeGroup?.disc_id,
      group_pages: groupPages,   // send current page per group
      page_size:   10,
    };

    apiFetch('/api/users/customers-disc/', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    })
      .then(res => {
        console.log('Fetched customers:', res);
        setGroupedData(res.groups ?? []);
        setConsumerSummary(res.consumer_summary ?? null);
      })
      .catch(err => console.error('❌ Failed to fetch customers:', err))
      .finally(() => setCustomerLoading(false));

  }, [activeTab, customerSearch, activeGroupIndex, groupPages]);

  useEffect(() => {
    fetchFormOptions();
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [searchQuery, category, subCategory, brand, currentPage]);

  const fetchFormOptions = async () => {
    try {
      const res = await apiFetch('/api/product/form-options/');
      const groups = res.data?.discount_groups ?? [];

      // 👇 Inject "All Groups" at top
      const updatedGroups = [
        { disc_id: 'null', name: "All Groups" },
        ...groups
      ];

      setCategories(res.data?.categories ?? []);
      setDiscountGroups(updatedGroups ?? []);
    } catch (err) {
      console.error('❌ Failed to fetch form options:', err);
    }
  };

  const filteredCustomers = useMemo(() =>
  customers.filter(c =>
    c.customer_name?.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.phone_number?.includes(customerSearch)
  ), [customers, customerSearch]);

  // Group filtered customers by User Group
  const groupedCustomers = useMemo(() => {
    return filteredCustomers.reduce((acc, customer) => {
      const group = customer.customer_type || 'Unassigned';
      if (!acc[group]) acc[group] = [];
      acc[group].push(customer);
      return acc;
    }, {});
  }, [filteredCustomers]);

  const handleGroupPageChange = (groupName, newPage) => {
    setGroupPages(prev => ({ ...prev, [groupName]: newPage }));
  };

  const fetchProducts = async () => {
    try {
      setProductLoading(true);

      const payload = {
        search: searchQuery || "",
        category: category || "",
        sub_category: subCategory || "",
        brand: brand || "",
        page: currentPage || 1,
      };

      const res = await apiFetch('/api/product/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      console.log(res.data?? [])

      setProducts(res.data?? []);
      setTotalPages(res.total_pages?? 1);

    } catch (err) {
      console.error("❌ Failed to fetch products:", err);
      setProducts([]);
    } finally {
      setProductLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab !== 'products' || products.length === 0 || language === 'en') return;

    let cancelled = false;
    const triggerGoogleRetry = () => {
      const translateCombo = document.querySelector('.goog-te-combo');
      if (!translateCombo || cancelled) return false;
      const changeEvent = new Event('change', { bubbles: true });
      translateCombo.dispatchEvent(changeEvent);
      return true;
    };

    if (!triggerGoogleRetry()) {
      const retryId = window.setTimeout(() => {
        if (!cancelled) triggerGoogleRetry();
      }, 500);

      return () => {
        cancelled = true;
        window.clearTimeout(retryId);
      };
    }

    return () => {
      cancelled = true;
    };
  }, [products.length, activeTab, language]);

  useEffect(() => {
      if (!isManageModalOpen) return;

      // Fetch all subcategories (no category filter)
      apiFetch('/api/product/subcategories/', {
          method: 'POST',
          body: JSON.stringify({})   // empty body = return all
      })
      .then(data => setManageSubCategories(Array.isArray(data) ? data : (data?.data ?? [])))
      .catch(err => console.error('❌ Failed to fetch all subcategories:', err));

      // Fetch all brands (no subcategory filter)
      apiFetch('/api/product/brands-by-subcategory/', {
          method: 'POST',
          body: JSON.stringify({})   // empty body = return all
      })
      .then(data => setmanageBrands(Array.isArray(data) ? data : (data?.data ?? [])))
      .catch(err => console.error('❌ Failed to fetch all brands:', err));

  }, [isManageModalOpen]);

  useEffect(() => {
    if (!category) { setSubCategories([]); return; }
  
    const payload = { category: category };
    apiFetch('/api/product/subcategories/', { method: 'POST', body: JSON.stringify(payload) })
      .then(data => {
        const finalData = Array.isArray(data) ? data : (data?.data ?? []);
        setSubCategories(finalData);
      })
      .catch(err => console.error('❌ Failed to fetch subcategories:', err));
  }, [category]);

  useEffect(() => {
    if (!subCategory) { setBrands([]); return; }

    const payload = { sub_category: subCategory };
    apiFetch('/api/product/brands-by-subcategory/', { method: 'POST', body: JSON.stringify(payload) })
      .then(data => setBrands(Array.isArray(data) ? data : []))
      .catch(err => console.error('❌ Failed to fetch brands:', err));
  }, [subCategory]);


  const handleSaveProduct = async (formData, mode) => {
      // 1. Determine the correct URL based on mode
      // If adding: /api/product/register/
      // If editing: /api/product/register/ID/
      const url = mode === "add" 
        ? "/api/product/register/" 
        : `/api/product/register/${formData.id}/`;

      const payload = {
        product_name:        formData.product_name,
        category:            formData.category,
        sub_category:        formData.sub_category,
        brand:               formData.brand,
        current_stock:       formData.current_stock      ?? 0,
        discount_grp:        formData.discount_grp        || null,
        discount_percentage: formData.discount_percentage || null,
        unit:                formData.unit,
        price:               formData.price,
        material:            formData.material            || null,
        size:                formData.size                || "",
        product_description: formData.product_description || "",
        capacity:            formData.capacity            || "",
        warranty:            formData.warranty            || "",
        max_head:            formData.max_head            ?? 0,
      };

      try {
        const data = await apiFetch(url, { 
          method: mode === "add" ? "POST" : "PUT", 
          headers: { "Content-Type": "application/json" }, 
          body: JSON.stringify(payload) 
        });

        if (data.success) {
          console.log("Product saved:", data.data);

          toastAlert(mode === "add" ? "Product created successfully" : "Product updated successfully", "success");
          setIsProductModalOpen(false);
        } else { 
          // Handles duplicate error (409) or validation errors (400)
          toastAlert(data.error || "Failed to save product", "error"); 
        }
      } catch (err) {
        console.error(err);
        toastAlert("Server error", "error");
      }
    };

  // ── 4. SMALL reusable pagination bar component (add near top of file) ─────────
  const GroupPagination = ({ groupName, page, totalPages, onPageChange }) => {
    if (totalPages <= 1) return null;

    return (
      <div className="flex items-center justify-between px-6 py-3 border-t border-gray-100 bg-gray-50/50">
        <p className="text-xs text-gray-400">
          Page <span className="font-semibold text-gray-600">{page}</span> of {totalPages}
        </p>
        <div className="flex items-center gap-1">
          {/* Previous */}
          <button
            onClick={() => onPageChange(groupName, page - 1)}
            disabled={page === 1}
            className="p-1.5 rounded-lg text-gray-400 hover:bg-white hover:text-orange-500 disabled:opacity-30 disabled:cursor-not-allowed transition border border-transparent hover:border-gray-200"
          >
            <ChevronLeft size={15} />
          </button>

          {/* Page numbers */}
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
            .reduce((acc, p, idx, arr) => {
              if (idx > 0 && arr[idx - 1] !== p - 1) acc.push('...');
              acc.push(p);
              return acc;
            }, [])
            .map((p, i) =>
              p === '...' ? (
                <span key={`ellipsis-${i}`} className="px-1 text-gray-300 text-xs">…</span>
              ) : (
                <button
                  key={p}
                  onClick={() => onPageChange(groupName, p)}
                  className="w-7 h-7 rounded-lg text-xs font-semibold transition"
                  style={{
                    backgroundColor: p === page ? '#F7941D' : 'transparent',
                    color:           p === page ? '#ffffff' : '#6b7280',
                  }}
                >
                  {p}
                </button>
              )
            )}

          {/* Next */}
          <button
            onClick={() => onPageChange(groupName, page + 1)}
            disabled={page === totalPages}
            className="p-1.5 rounded-lg text-gray-400 hover:bg-white hover:text-orange-500 disabled:opacity-30 disabled:cursor-not-allowed transition border border-transparent hover:border-gray-200"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>
    );
  };

  const scrollRight = () => tableRef.current.scrollBy({ left: 300, behavior: "smooth" });

  const resetFilters = () => {
    setSearchQuery(""); setCategory(""); setSubCategory(""); setBrand(""); setfilterdata(false);
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="bg-gray-50 min-h-screen p-6">

      {/* Page Title */}
      <h1 className="text-2xl font-semibold mb-6 text-gray-800">{t("master_data_discount_management")}</h1>

      {/* ── TABS ──────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 mb-6 bg-white border border-gray-200 rounded-xl p-1 w-fit">
        <button
          onClick={() => setActiveTab('products')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'products'
              ? 'bg-[#F7941D] text-white shadow-sm'
              : 'text-gray-600 hover:bg-[#0c7c9d] hover:text-white'
          }`}
        >
          <Package size={16} />
          {t("product_pricing")}
        </button>
        <button
          onClick={() => setActiveTab('customers')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'customers'
              ? 'bg-[#F7941D] text-white shadow-sm'
              : 'text-gray-600 hover:bg-[#0c7c9d] hover:text-white'
          }`}
        >
          <Users size={16} />
          {t("customer_assignments")}
        </button>
      </div>


      {/* ══════════════════════════════════════════════════════════════════════
          TAB 1 — PRODUCT PRICING
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'products' && (
        <>
          {/* FILTER & SEARCH CARD */}
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 mb-10 space-y-4">

            {/* Top Row */}
            <div className="flex flex-col lg:flex-row gap-3 items-center">
              <div className="relative w-full lg:max-w-md">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder={t("search_product")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                />
              </div>

              <div className="flex flex-wrap gap-2 w-full lg:w-auto">
                <div className="relative flex-1 lg:w-36">

                  <select 
                    value={category} 
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2.5 pr-10 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:border-orange-500"
                  >
                    <option value="">{t("all_categories")}</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id} translate="yes">
                        {cat.category}
                      </option>
                    ))}
                  </select>

                  {/* Circular Edit Icon */}
                  <button
                    onClick={() => openManageModal('category')}
                    className="absolute -top-3 -right-2 
                              w-7 h-7 
                              bg-gray-800 text-white 
                              rounded-full 
                              flex items-center justify-center 
                              shadow-md 
                              hover:bg-orange-500 
                              transition-all
                              hidden sm:flex"  
                    title={t("manage_categories")}
                  >
                    <Pencil size={12} />
                  </button>

                </div>
                <div className="relative flex-1 lg:w-36">
                    <select 
                      value={subCategory} 
                      onChange={(e) => setSubCategory(e.target.value)}
                      className="flex-1 lg:w-36 px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:border-orange-500"
                    >
                      <option value="">{t("all_subcategories")}</option>
                      
                      {subcategories.length > 0 ? (
                        subcategories.map((sub, index) => (
                          // Using index as key if subcategories are just strings, 
                          // or sub.id if it's an object
                          <option key={sub.id || index} value={sub.id || sub} translate="yes">
                            {sub.name || sub}
                          </option>
                        ))
                      ) : (
                        <option disabled>
                          {category ? t("no_subcategories_found") : t("select_category_first")}
                        </option>
                      )}
                    </select>
                                      
                    {/* Circular Edit Icon */}
                    <button
                      onClick={() => openManageModal('subcategory')}
                      className="absolute -top-3 -right-2 
                                w-7 h-7 
                                bg-gray-800 text-white 
                                rounded-full 
                                flex items-center justify-center 
                                shadow-md 
                                hover:bg-orange-500 
                                transition-all
                                hidden sm:flex"
                      title={t("manage_subcategories")}
                    >
                      <Pencil size={12} />
                    </button>
                </div>
                <div className="relative flex-1 lg:w-36">

                  <select 
                    value={brand} 
                    onChange={(e) => setBrand(e.target.value)}
                    className="flex-1 lg:w-36 px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:border-orange-500"
                  >
                    <option value="">{t("all_brands")}</option>
                    
                    {brands.length > 0 ? (
                      brands.map((b, index) => (
                        <option key={b.id || index} value={b.id || b} translate="yes">
                          {b.name || b}
                        </option>
                      ))
                    ) : (
                      <option disabled>
                        {subCategory ? t("no_brands_found") : t("select_subcategory_first")}
                      </option>
                    )}
                  </select>

                  {/* Circular Edit Icon */}
                  <button
                    onClick={() => openManageModal('brand')}
                    className="absolute -top-3 -right-2 
                              w-7 h-7 
                              bg-gray-800 text-white 
                              rounded-full 
                              flex items-center justify-center 
                              shadow-md 
                              hover:bg-orange-500 
                              transition-all
                              hidden sm:flex"
                    title={t("manage_brands")}
                  >
                    <Pencil size={12} />
                  </button>

                </div>
              </div>
            </div>

            <div className="flex justify-between items-center mt-4 mb-4 w-full gap-2">
              {/* Left Side: Pagination Control */}
              <div className="flex items-center gap-3">
                <div className="flex items-center border border-gray-200 bg-white rounded-lg overflow-hidden">
                  <button 
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-2 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all border-r border-gray-200"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  
                  <div className="px-4 py-2 text-sm font-medium text-gray-700 bg-white">
                    {t("page")} <span className="text-[#F7941D]">{currentPage}</span> {t("of")} {totalPages}
                  </div>

                  <button 
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-2 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all border-l border-gray-200"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>

                {/* Reset Button (Optional, kept for utility) */}
                <button onClick={resetFilters}
                  className="px-4 py-2 border border-gray-200 bg-white text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-all">
                  {t("reset")}
                </button>
              </div>

              {/* Right Side: Add Product Button */}
              {/* Right Side: Add Product Button - Hidden on mobile */}
              <button
                onClick={() => { setEditProduct(null); setIsProductModalOpen(true); }}
                className="px-5 py-2.5 bg-[#F7941D] text-white rounded-lg font-semibold text-sm hover:bg-[#F7941DE6] transition-colors shadow-sm active:scale-95 flex items-center gap-2 mr-13
                          hidden sm:flex" 
              >
                <Plus size={16} />
                {t("add_product")}
              </button>
            </div>
          </div>

          {/* PRODUCT TABLE */}
          <div className="bg-white mt-5 border border-gray-200 rounded-2xl shadow-sm overflow-hidden relative">
            <div ref={tableRef} className="overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 rounded-xl">
              <table className="w-full text-sm text-left border-collapse min-w-[900px]">
                <thead className="bg-gray-200 text-gray-600 tracking-wide">
                  <tr>
                    <th className="px-2 py-1 font-bold border-b border-gray-200">{t("product_id")}</th>
                    <th className="px-2 py-1 font-bold border-b border-gray-200 min-w-[180px]">{t("product_name")}</th>
                    <th className="px-2 py-1 font-bold border-b border-gray-200">{t("category_label")}</th>
                    <th className="px-2 py-1 font-bold border-b border-gray-200">{t("brand_label")}</th>
                    <th className="px-2 py-1 font-bold border-b border-gray-200">{t("base_price")}</th>
                    <th className="px-2 py-1 font-bold border-b border-gray-200 text-center">{t("status_label")}</th>
                    <th className="px-2 py-1 font-bold border-b border-gray-200 text-right">{t("actions_label")}</th>
                  </tr>
                </thead>

                <tbody className="font-['Poppins'] text-gray-700">
                  {productLoading ? (
                    [...Array(5)].map((_, i) => (
                      <tr key={i} className="border-b border-gray-100">
                        {[...Array(9)].map((_, j) => (
                          <td key={j} className="px-4 py-3">
                            <div className="h-4 bg-gray-100 rounded animate-pulse" />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : products.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-16 text-gray-400">
                        <div className="flex flex-col items-center gap-2">
                          <Package size={36} className="text-gray-200" />
                          <p className="text-sm font-medium">{t("no_products_found")}</p>
                          <p className="text-xs">{t("try_adjusting_filters")}</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    products.map((product) => (
                      <tr key={product.id} className="border-b border-gray-200 hover:bg-orange-50 transition-colors">
                        <td className="px-4 py-3 text-gray-400 text-xs">#{product.id}</td>
                        <td className="px-4 py-3 font-medium"><span translate="yes">{product.product_name}</span></td>
                        <td className="px-4 py-3 text-gray-500"><span translate="yes">{product.category_name ?? '—'}</span></td>
                        <td className="px-4 py-3 text-gray-500"><span translate="yes">{product.brand_name ?? '—'}</span></td>
                        <td className="px-4 py-3 font-medium">₹{product.price}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${product.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-500'}`}>
                            {product.is_active ? t("active") : t("inactive")}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-1.5">
                            <button onClick={() => { setEditProduct(product); setIsProductModalOpen(true); }}
                              className="p-1.5 hover:bg-orange-100 rounded-lg transition" title={t("edit") ?? "Edit"}>
                              <Pencil size={14} className="text-orange-500" />
                            </button>
                            <button className="p-1.5 hover:bg-gray-100 rounded-lg transition" title={t("view") ?? "View"}>
                              <Eye size={14} className="text-gray-400" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {canScrollRight && (
              <button onClick={scrollRight}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-white shadow-lg border rounded-full p-2 hover:bg-orange-500 hover:text-white transition">
                <ChevronRight size={18} />
              </button>
            )}
          </div>
        </>
      )}


      {/* ══════════════════════════════════════════════════════════════════════
          TAB 2 — CUSTOMER ASSIGNMENTS
      ══════════════════════════════════════════════════════════════════════
      
        // ── Add this import at the top of your Masters_data file ──────────────────────
        // import DiscountGroupSettingsModal from "./DiscountGroupSettingsModal";

        // ── Add this state near your other state declarations ─────────────────────────
        // const [isDiscountSettingsOpen, setIsDiscountSettingsOpen] = useState(false);
        // 
      */}
    


      {activeTab === 'customers' && (
        <div className="space-y-8 animate-in fade-in duration-500">
          {/* Search & Global Actions */}
          <div className="flex justify-between mb-5 gap-2">
            <div className="relative w-full lg:max-w-md">
              <Search size={18} className="absolute left-3 top-7/24 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder={t("search_by_name_or_phone")}
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none transition-all"
              />
            </div>

            {/* ── Discount Group Selector ── */}
            <div className="flex items-center gap-2 mb-6">

              <div className="relative">
                <button
                  onClick={() => setGroupDropdownOpen(prev => !prev)}
                  className="flex items-center gap-3 pl-4 pr-3 py-2.5 bg-[#F7941D] text-white text-sm rounded-lg font-semibold shadow-sm hover:bg-[#e8850a] active:scale-95 transition-all min-w-[200px] justify-between"
                >
                  <span className="truncate">
                    {activeGroup ? <span translate="yes">{activeGroup.name}</span> : t("select_group")}
                  </span>
                  <ChevronDown
                    size={15}
                    className={`opacity-80 shrink-0 transition-transform duration-200 ${groupDropdownOpen ? "rotate-180" : ""}`}
                  />
                </button>

                {groupDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setGroupDropdownOpen(false)} />
                    <div className="absolute top-full left-0 mt-2 w-full min-w-[220px] bg-white border border-gray-200 rounded-xl shadow-xl z-20 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                      <div className="px-3 py-2 border-b border-gray-100 bg-gray-50">
                        <p className="text-[10px] uppercase font-bold text-gray-400 tracking-widest">
                          Discount Groups
                        </p>
                      </div>
                      <div className="py-1 max-h-52 overflow-y-auto">
                        {discountGroups.map((group, index) => (
                          <button
                            key={group.disc_id}
                            onClick={() => { setActiveGroupIndex(index); setGroupDropdownOpen(false); }}
                            className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors ${
                              activeGroupIndex === index
                                ? "bg-orange-50 text-orange-600 font-semibold"
                                : "text-gray-700 hover:bg-gray-50 font-medium"
                            }`}
                          >
                            <span translate="yes">{group.name}</span>
                            {activeGroupIndex === index && (
                              <span className="w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Settings icon — opens DiscountGroupSettingsModal */}
              <button
                onClick={() => setIsDiscountSettingsOpen(true)}
                className="p-2 bg-white border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 hover:text-orange-500 transition-all shadow-sm"
                title="Manage Discount Groups"
              >
                Edit Groups
              </button>
              <button
                onClick={() => navigate("/discount-group-settings")}
                className="p-2.5 bg-white border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 hover:text-orange-500 transition-all shadow-sm"
                title="Manage Discount Groups"
              >
                <Settings size={18} />
              </button>
            </div>
          </div>

          {/* GROUPED CONTENT */}
          {customerLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-40 bg-white rounded-2xl border border-gray-100 animate-pulse" />
              ))}
            </div>
          ) : groupedData.length === 0 && !consumerSummary ? (
            <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-200">
              <Users size={48} className="mx-auto text-gray-200 mb-4" />
              <h3 className="text-lg font-medium text-gray-900">No customers found</h3>
              <p className="text-sm text-gray-500">Try adjusting your search or filters.</p>
            </div>
          ) : (
            <div className="space-y-6">

              {groupedData.map(({ group_name, total, page, total_pages, customers }) => (
                <div key={group_name} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-all">
                  <div className="px-6 py-4 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100 flex flex-wrap justify-between items-center gap-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-orange-100 rounded-lg">
                        <Users size={20} className="text-orange-600" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-gray-800 uppercase tracking-tight">
                          <span translate="yes">{group_name}</span>s
                        </h3>
                        <p className="text-xs text-gray-500 font-medium">
                          {total} Active <span translate="yes">{group_name}</span>s
                          {total_pages > 1 && (
                            <span className="ml-2 text-gray-400">
                              · showing {((page - 1) * 10) + 1}–{Math.min(page * 10, total)}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setBulkTarget(group_name)}
                      className="flex items-center gap-2 px-4 py-2 bg-white border border-orange-200 text-orange-600 rounded-xl text-xs font-bold hover:bg-orange-50 transition-all shadow-sm active:scale-95"
                    >
                      <Settings size={14} />
                      Set Bulk Discount for <span translate="yes">{group_name}</span>s
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-gray-50/50 text-gray-400 uppercase text-[10px] font-bold tracking-widest border-b border-gray-100">
                        <tr>
                          <th className="px-6 py-4">{t("customer_name_label")}</th>
                          <th className="px-6 py-4">{t("contact_detail_label")}</th>
                          <th className="px-6 py-4">{t("current_discounts_label")}</th>
                          <th className="px-6 py-4 text-right">{t("individual_action_label")}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {customers.map((customer) => (
                          <tr key={customer.user_id} className="hover:bg-orange-50/30 transition-colors">
                            <td className="px-6 py-4 font-semibold text-gray-700">{customer.customer_name}</td>
                            <td className="px-6 py-4 text-gray-500 font-medium">
                              {customer.phone_number || <span className="text-gray-300 italic">No Phone</span>}
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-wrap gap-1.5">
                                {customer.discount_groups?.length > 0 ? (
                                  customer.discount_groups.map(dg => (
                                    <span key={dg} className="px-2.5 py-1 bg-blue-50 text-[#0c7c9d] rounded-lg text-[10px] font-bold border border-blue-100">
                                      {dg}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-[10px] text-gray-400 bg-gray-50 px-2 py-1 rounded-md">Default Pricing</span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <button
                                onClick={() => { setSelectedCustomer(customer); setIsAssignmentModalOpen(true); }}
                                className="p-2 text-gray-400 hover:text-orange-500 hover:bg-orange-100 rounded-xl transition-all"
                              >
                                <Pencil size={16} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <GroupPagination
                    groupName={group_name}
                    page={page}
                    totalPages={total_pages}
                    onPageChange={handleGroupPageChange}
                  />
                </div>
              ))}

              {consumerSummary && (
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-all">
                  <div className="px-6 py-4 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100 flex flex-wrap justify-between items-center gap-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-orange-100 rounded-lg">
                        <Users size={20} className="text-orange-600" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-gray-800 uppercase tracking-tight">Consumers</h3>
                        <p className="text-xs text-gray-500 font-medium">{consumerSummary.count} Active Users</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setBulkTarget('Employee')}
                      className="flex items-center gap-2 px-4 py-2 bg-white border border-orange-200 text-orange-600 rounded-xl text-xs font-bold hover:bg-orange-50 transition-all shadow-sm active:scale-95"
                    >
                      <Settings size={14} />
                      Set Bulk Discount for Consumers
                    </button>
                  </div>
                  <div className="px-6 py-5 flex items-center gap-3 text-sm text-gray-400">
                    <Users size={16} className="text-gray-300" />
                    <span>
                      Discount is managed at the group level for all Consumers.
                      Use <span className="font-semibold text-orange-500">Set Bulk Discount</span> above to assign.
                    </span>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* ── Discount Group Settings Modal ── */}
          <DiscountGroupSettingsModal
            isOpen={isDiscountSettingsOpen}
            onClose={() => setIsDiscountSettingsOpen(false)}
            discountGroups={discountGroups}
            refreshData={fetchFormOptions}
          />

        </div>
      )}

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      <ProductFormModal
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        mode={editProduct ? "edit" : "add"}
        userData={editProduct}
        onSave={handleSaveProduct}
      />

      <CustomerAssignmentModal
        isOpen={isAssignmentModalOpen}
        onClose={() => { setIsAssignmentModalOpen(false); setSelectedCustomer(null); }}
        customer={selectedCustomer}
        discountGroups={discountGroups}
      />

      <BulkDiscountModal
          isOpen={!!bulkTarget}
          onClose={() => setBulkTarget(null)}
          groupName={bulkTarget}
          discountGroups={discountGroups}
          onSaved={() => { setBulkTarget(null); /* optionally refetch */ }}
      />

      {isManageModalOpen && (
        <ManageAttributeModal
          type={manageType}
          onClose={() => setIsManageModalOpen(false)}
          categories={categories}
          subcategories={managesubcategories}
          brands={managebrands}
          refreshData={fetchFormOptions}
        />
      )}

    </div>
  );
};

export default Masters_data;