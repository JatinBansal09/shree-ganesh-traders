import { Phone, Award, Truck } from "lucide-react";

import {useEffect, useState, useMemo, useCallback } from "react";

import apiFetch from "./utils/apiClient";

import getProductImage from "./productImages";
import { useOutletContext } from "react-router-dom";

import ProductModal from "./ProductModal";

import { useDispatch, useSelector } from "react-redux";
import { addToCart, selectCartItems } from "./store/cartSlice";

const Pill = ({ label, active, onClick }) => (

  <button

    onClick={onClick}

    className={`px-5 py-2 rounded-full border text-sm transition
      ${active
        ? "bg-[#F7941D] text-white border-[#F7941D]"
        : "bg-white text-gray-700 border-gray-300 hover:border-[#F7941D]"
      }`}
  >
    {label}
  </button>
);

const Catalogue = () => {

  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedSubCategories, setSelectedSubCategories] = useState([]);
  const [selectedBrands, setSelectedBrands] = useState([]);
  const [searchQuery, , setOnSearchEnter, setOnSearchClear] = useOutletContext() || [];
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [categories, setCategories]         = useState([]);
  const [subcategories, setSubCategories]  = useState([]);
  const [brands, setBrands]                 = useState([]);

  const [subLoading, setSubLoading] = useState(false);
  const [brandLoading, setBrandLoading] = useState(false);
  const [subError, setSubError] = useState(false);
  const [brandError, setBrandError] = useState(false);
  const [products, setProducts]         = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [isFiltered, setIsFiltered] = useState(false);
  
  // 2. Inside the Catalogue component, add:
  const dispatch = useDispatch();
  const cartItems = useSelector(selectCartItems);
  

  useEffect(() => {
      
      apiFetch('/api/product/categories/', { method: 'GET'})
        .then(data => {
          const finalData = Array.isArray(data) ? data : (data?.data ?? []);
          setCategories(finalData);
        })
        .catch(err => console.error('❌ Failed to fetch categories:', err));
  }, []);

  useEffect(() => {
    if (!selectedCategory) {
      setSubCategories([]);
      return;
    }

    let timer;

    setSubError(false);

    timer = setTimeout(() => {
      setSubLoading(true);
    }, 2000); // 2 seconds delay

    apiFetch('/api/product/subcategories/', {
      method: 'POST',
      body: JSON.stringify({ category: selectedCategory })
    })
      .then(data => {
        const finalData = Array.isArray(data) ? data : (data?.data ?? []);
        setSubCategories(finalData);
      })
      .catch(() => {
        setSubError(true);
      })
      .finally(() => {
        clearTimeout(timer);   // stop timer
        setSubLoading(false);  // hide loader
      });

  }, [selectedCategory]);
  
  useEffect(() => {
    if (!selectedSubCategories.length) {
      setBrands([]);
      return;
    }

    let timer;

    setBrandError(false);

    timer = setTimeout(() => {
      setBrandLoading(true);
    }, 2000);

    apiFetch('/api/product/brands-by-subcategory/', {
      method: 'POST',
      body: JSON.stringify({ sub_category: selectedSubCategories })
    })
      .then(data => {
        const finalData = Array.isArray(data) ? data : (data?.data ?? []);
        setBrands(finalData);
      })
      .catch(() => {
        setBrandError(true);
      })
      .finally(() => {
        clearTimeout(timer);
        setBrandLoading(false);
      });

  }, [selectedSubCategories]);

    // ── Core fetch helper ─────────────────────────────────────────────────────
  const fetchProducts = useCallback(async (filters = {}) => {
    setProductsLoading(true);
    try {
      let currentPage = 1;
      let totalPages  = 1;
      let allProducts = [];

      while (currentPage <= totalPages) {
        const res = await apiFetch('/api/product/', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ page: currentPage, ...filters })
        });

        const data = Array.isArray(res) ? res : (res?.data ?? []);
        allProducts = [...allProducts, ...data];
        totalPages   = res?.total_pages ?? 1;
        currentPage += 1;
      }

      setProducts(allProducts);
    } catch (err) {
      console.error('❌ Failed to fetch products:', err);
    } finally {
      setProductsLoading(false);
    }
  }, []);

  // ── Fetch all on mount ────────────────────────────────────────────────────
  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // ── Register Enter handler — always has latest searchQuery ────────────────
  useEffect(() => {
    setOnSearchEnter?.(() => () => {
      if (searchQuery) {
        fetchProducts({ search: searchQuery });
      }
    });
  }, [searchQuery, fetchProducts, setOnSearchEnter]);

  useEffect(() => {
    setOnSearchClear?.(() => () => {
        fetchProducts();  // ✅ fetch all products with no filters
    });
}, [fetchProducts, setOnSearchClear]);

  // ── Category click ────────────────────────────────────────────────────────
  const handleCategoryClick = (catId) => {
    setSelectedCategory(catId);
    setSelectedSubCategories([]);
    setSelectedBrands([]);

    if (catId) {
      fetchProducts({ category: catId });
    } else {
      fetchProducts(); // "All Categories" — no filters
    }
  };

  // ── Subcategory toggle ────────────────────────────────────────────────────
  const handleSubCategoryToggle = (id) => {
    const updated = selectedSubCategories.includes(id)
      ? selectedSubCategories.filter(x => x !== id)
      : [...selectedSubCategories, id];
    setSelectedSubCategories(updated);
    fetchProducts({
      category:     selectedCategory   || undefined,
      sub_category: updated.length === 1 ? updated[0] : undefined,
    });
  };

  // ── Brand toggle ──────────────────────────────────────────────────────────
  const handleBrandToggle = (id) => {
    const updated = selectedBrands.includes(id)
      ? selectedBrands.filter(x => x !== id)
      : [...selectedBrands, id];
    setSelectedBrands(updated);
    fetchProducts({
      category:     selectedCategory        || undefined,
      sub_category: selectedSubCategories.length === 1 ? selectedSubCategories[0] : undefined,
      brand:        updated.length === 1 ? updated[0] : undefined,
    });
  };

  // ── Client-side filter for multi-select on top of backend results ─────────
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const subCategoryMatch =
        selectedSubCategories.length === 0 ||
        selectedSubCategories.map(Number).includes(Number(product.sub_category_id));

      const brandMatch =
        selectedBrands.length === 0 ||
        selectedBrands.map(Number).includes(Number(product.brand_id));

      return subCategoryMatch && brandMatch;
    });
  }, [products, selectedSubCategories, selectedBrands]);

  const normalize     = (text = "") => text.toLowerCase().trim();
  const openProductModal  = (product) => { setSelectedProduct(product); setIsModalOpen(true); };
  const closeProductModal = () => { setSelectedProduct(null); setIsModalOpen(false); };

  return (

    < div className="w-full bg-white min-h-full" >
      <div className="bg-gray-50 px-8">
        <div className="grid grid-cols-1 pt-6 pb-12 lg:grid-cols-2 gap-8 bg-gray-50">
          {/* LEFT CONTENT */}
          <div className="flex flex-col justify-center h-full">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 text-center sm:text-left">
              Premium Sanitary Ware Solutions
            </h2>

            <p className="text-gray-600 leading-relaxed mb-6 max-w-xl text-center sm:text-left">
              Your trusted wholesale partner for high-quality bathroom products.
              We supply basins, faucets, water closets, and complete sanitary
              solutions for your projects.
            </p>

            <div className="flex justify-center sm:justify-start gap-2 sm:gap-4">
              <button className="flex items-center gap-1 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 bg-[#F7941D] text-white rounded-lg hover:opacity-90 transition text-sm sm:text-base">
                <Phone size={16} />
                {/* Mobile Text */}
                <span className="sm:hidden">
                  Contact
                </span>

                {/* Desktop Text */}
                <span className="hidden sm:inline">
                  Contact for Bulk Orders
                </span>
              </button>

              <button
                className="
                px-3 sm:px-5
                py-2 sm:py-2.5
                border
                border-gray-300
                rounded-lg
                bg-white
                hover:bg-gray-100
                transition
                text-sm sm:text-base
              "
              >
                View Catalogue
              </button>
            </div>
          </div>



          {/* RIGHT FEATURES */}
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <Award className="text-[#F7941D] mb-4" size={26} />
              <div>
                <h4 className="font-medium text-gray-900 mb-1">
                  Certified Quality
                </h4>
                <p className="text-gray-600 text-sm">
                  All products meet international quality standards with
                  manufacturer warranties.
                </p>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6">
              <Truck className="text-[#F7941D] mb-4" size={26} />
              <div>

                <h4 className="font-medium text-gray-900 mb-1">
                  Punjab-wide Delivery
                </h4>

                <p className="text-gray-600 text-sm">
                  Fast and reliable delivery across India for wholesale orders.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <hr className="border-gray-200" />

      <div className="px-4 sm:px-10 pt-8 pb-2 bg-white">
        <p className="text-gray-700 mt-1 font-medium">
          Browse by Categories
        </p>
      </div>

      {/* ---------- CATEGORY SELECTION ---------- */}
      {/* ---------- CATEGORY SELECTION (TABS) ---------- */}

      <div className="px-4 sm:px-10 pt-2 mb-6">
        {/* 🖥 DESKTOP TABS */}
        <div className="w-full">
          {/* The 'overflow-x-auto' allows scrolling, 'no-scrollbar' is optional for aesthetics */}
          <div className="flex flex-nowrap sm:flex-wrap overflow-x-auto border-b border-gray-200 scrollbar-hide">

            <button
              onClick={() => {
                handleCategoryClick(null)
              }}
              className={`whitespace-nowrap px-6 py-3 text-sm font-semibold transition-all duration-200 border-b-2 flex-shrink-0 ${selectedCategory === null
                  ? "border-[#ff7a00] text-[#ff7a00]"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
            >
              All Categories
            </button>

            {categories && categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => {
                  handleCategoryClick(cat.id)
                }}
                className={`whitespace-nowrap px-6 py-3 text-sm font-semibold transition-all duration-200 border-b-2 flex-shrink-0 ${selectedCategory === cat.id
                    ? "border-[#ff7a00] text-[#ff7a00]"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
              >
                {cat.name || cat.category}
              </button>
            ))}
          </div>
        </div>
      </div>


      {/* Check if subCategories exists at all */}
      {subError && (
        <p className="py-3 text-red-500 text-sm italic px-14">
          ⚠️ Failed to load sub-categories.
        </p>
      )}

      {subLoading && (
        <p className="py-3 text-gray-400 text-sm italic px-14">
          Loading sub-categories...
        </p>
      )}
      
        <>
          {/* If it exists, only show the section if a Category is selected */}
          {selectedCategory && (
            <div className="space-y-3 px-8 sm:px-14 transition-all mb-4">
              <h2 className="sm:hidden text-xs uppercase tracking-wider font-bold text-gray-400">
                Sub-Categories
              </h2>
              <h2 className="hidden sm:block text-xs uppercase tracking-wider font-bold text-gray-400">
                Sub-Categories ({selectedSubCategories.length} selected)
              </h2>

              <div className="flex flex-wrap gap-2">
                {/* Check if the filtered list has items */}
                {!subcategories || subcategories.length === 0 ? (
                  <p className="text-gray-400 text-sm italic py-2">
                    No sub-categories available for this category.
                  </p>
                ) : (
                  subcategories.map((sub) => (
                    <Pill key={sub.id} label={sub.name} active={selectedSubCategories.includes(sub.id)}
                      onClick={() => {
                        handleSubCategoryToggle(sub.id)
                      }}
                    />
                  ))
                )}
              </div>
            </div>
          )}
        </>

      {/* ---------- BRAND SELECTION ---------- */}
      {brandError && (
        <p className="py-3 text-red-500 text-sm italic px-14">
          ⚠️ Failed to load brands.
        </p>
      )}

      {brandLoading && (
        <p className="py-3 text-gray-400 text-sm italic px-14">
          Loading brands...
        </p>
      )}

        <>
          {selectedSubCategories && (
            <div className="space-y-3 px-8 sm:px-14 transition-all mb-4">
            {selectedCategory !== null && (
              <>
                <h2 className="sm:hidden text-xs uppercase tracking-wider font-bold text-gray-400">
                  Brands
                </h2>

                <h2 className="hidden sm:block text-xs uppercase tracking-wider font-bold text-gray-400">
                  Brands ({selectedBrands.length} selected)
                </h2>
              </>
            )}

              <div className="flex flex-wrap gap-3">
                {!brands || brands.length === 0 ? (
                  selectedCategory !== null ? (
                    <p className="text-gray-400 text-sm">
                      No brands available for this sub-category.
                    </p>
                  ) : null
                ) : (
                  brands.map((brand) => (
                    <Pill key={brand.id} label={brand.name} active={selectedBrands.includes(brand.id)}
                      onClick={() => handleBrandToggle(brand.id)}/>
                  ))
                )}
              </div>
            </div>
          )}
        </>



      <div className="px-8 pb-10 grid grid-cols-1 sm:px-14 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {productsLoading && (
          <div className="col-span-full flex justify-center py-20">
            <p className="text-gray-400 text-sm italic">Loading products...</p>
          </div>
        )}

        {!filteredProducts || filteredProducts.length === 0 ? (

          <div className="col-span-full min-h-[200px] flex flex-col items-center justify-center text-center">

            <p className="text-gray-500 text-lg font-medium">No products available</p>

            <p className="text-gray-400 text-sm mt-2">Try changing keywords, brand, or category</p>

          </div>

        ) : (

          filteredProducts.map((product) => {
            if (!product || !product.id) return null;
            
            
            // Inside filteredProducts.map((product) => { ...

            const isOutOfStock = product.current_stock <= 0;
            const isInCart = cartItems.some((c) => c.id === product.id);

            // Generate Image Source
            const imageKey = (product.brand_name || "") + "_" + product.product_name.replaceAll(" ", "_");
            const imageSrc = getProductImage(imageKey);

            return (
              <div 
                key={product.id} 
                onClick={() => !isOutOfStock && openProductModal(product)}
                className={`border border-gray-100 rounded-2xl bg-white p-4 shadow-sm transition-all flex flex-col h-full relative 
                  ${isOutOfStock ? "cursor-not-allowed" : "hover:shadow-md cursor-pointer"}`}
              >
                
                {/* --- IMAGE SECTION --- */}
                <div className="relative flex justify-center items-center w-full h-[200px] mb-4 rounded-xl overflow-hidden group bg-gray-50">
                  
                  {/* The Actual Product Image */}
                  {imageSrc ? (
                    <img
                      src={imageSrc}
                      alt={product.product_name}
                      className={`w-full h-full object-cover transition-transform duration-500 
                        ${isOutOfStock ? "opacity-40 grayscale" : "group-hover:scale-110"}`}
                    />
                  ) : (
                    <div className="flex items-center justify-center w-full h-full text-gray-400 text-xs">
                      No Image
                    </div>
                  )}

                  {/* --- OUT OF STOCK OVERLAY --- */}
                  {isOutOfStock && (
                    <div className="absolute inset-0 flex items-center justify-center z-10">
                      {/* Diagonal Cross Lines across the image */}
                      <div className="absolute w-[140%] h-[1.5px] bg-[#F7941D]/40 -rotate-45"></div>
                      
                      {/* Central Badge */}
                      <div className="bg-[#F7941D] text-white px-3 py-1.5 rounded-md shadow-lg transform -rotate-12 border-2 border-white">
                        <span className="text-[10px] font-black uppercase tracking-tighter">
                          Out of Stock
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Category Tag (Hidden if Out of Stock) */}
                  {!isOutOfStock && (
                    <span className="absolute top-2 right-2 bg-orange-500 text-white text-[10px] px-2 py-1 rounded-lg font-bold">
                      {product.category_name || 'New'}
                    </span>
                  )}
                </div>

                {/* --- DETAILS SECTION --- */}
                <div className="flex flex-col flex-grow">
                  <h3 className={`text-sm font-medium mb-1 truncate ${isOutOfStock ? "text-gray-400 line-through" : "text-gray-800"}`}>
                    {product.product_name}
                  </h3>
                  
                  <p className="text-2xl font-['Raleway'] text-gray-800 mb-4">
                    ₹{Math.round(product.price * (1 - (product.base_percent || 0) / 100)).toLocaleString("en-IN")}
                  </p>

                  {/* --- DISABLED BUTTON LOGIC --- */}
                  <button
                    disabled={isOutOfStock || isInCart || !product.price}
                    onClick={(e) => {
                      e.stopPropagation();
                      dispatch(addToCart({ ...product, quantity: 1, imageSrc }));
                    }}
                    className={`w-full py-3 rounded-xl font-semibold transition text-sm
                      ${isOutOfStock 
                        ? "bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200" 
                        : isInCart 
                        ? "bg-green-100 text-green-600" 
                        : "bg-[#F7941D] hover:bg-[#F7941D]/90 text-white shadow-sm"
                      }`}
                  >
                    {isOutOfStock ? "Currently Unavailable" : isInCart ? "Added ✓" : "Add to Cart"}
                  </button>
                </div>
              </div>
            );
        })
        )}

      </div>
      {isModalOpen && (
        <ProductModal
          product={selectedProduct}
          onClose={closeProductModal}
        />
      )}

    </div>
  );
};

export default Catalogue;