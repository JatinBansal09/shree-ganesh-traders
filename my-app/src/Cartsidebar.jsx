// src/CartSidebar.jsx
import { useDispatch, useSelector } from "react-redux";
import { useEffect, useState } from "react"; // 1. Add these hooks
import {
  selectCartItems,
  selectCartTotal,
  selectCartOpen,
  removeFromCart,
  incrementQuantity,
  decrementQuantity,
  clearCart,
  closeCart,
} from "./store/cartSlice";
import { X, User } from "lucide-react";
import { getUserInfo } from "./auth_utils"; // 2. Import your utility
import SelectCustomerModal from "./SelectCustomerModal";
import apiFetch from "./utils/apiClient";
import { toastAlert } from './alerts';

const CartSidebar = () => {
  const dispatch = useDispatch();
  const items = useSelector(selectCartItems);
  const total = useSelector(selectCartTotal);
  const isOpen = useSelector(selectCartOpen);
  const [role, setRole] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [consumers, setConsumers] = useState([]);
  const [loadingConsumers, setLoadingConsumers] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [employeeId, setEmpId] = useState(null);

  useEffect(() => {
    const fetchUserData = async () => {
      const data = await getUserInfo(); // This calls your API
      
      // Check if data exists and isn't a rate-limit flag
      if (data && !data.isRateLimited) {
        // Map the backend keys to your state
        setRole(data.user_role);
        if (data.user_role==='Employee'){
          setEmpId(data.user_id);
        }
      } else if (data?.isRateLimited) {
        console.warn("Rate limited, retrying later...");
      }
    };
    
    fetchUserData();
  }, []);

  const handleCheckout = async () => {
      if (items.length === 0) return;

      if (role === "Employee" && !selectedCustomer) {
        toastAlert("Please select a customer", "error");
        return;
      }

      try {
        const payload = {
          employee_id: role === "Employee" ? employeeId : null,
          customer_id: role === "Employee" ? selectedCustomer?.id : null,
          items: items.map((item) => {
            const sellingPrice =
              item.base_percent > 0
                ? Math.round(item.price * (1 - item.base_percent / 100))
                : item.price;

            console.log(`Product: ${item.product_name} | Discount ID: ${item.discount_id} | Base %: ${item.base_percent}`);

            return {
              product_id: item.id,
              quantity: item.quantity,
              selling_price: sellingPrice,
              discount_id: item.discount_id || null,
            };
      }),
        };

        console.log("📦 Sending payload:", payload);

        const response = await apiFetch("/api/orders/create/", {
          method: "POST",
          body: JSON.stringify(payload),
        });

        toastAlert("Order placed successfully", "success");
        dispatch(clearCart());
        dispatch(closeCart());

        if (role === "Employee") {
          window.location.href = `/messages?conversation_id=${response.conversation_id}`;
        } else {
          // ✅ Retailer/Builder/etc — redirect with system_text in URL
          const encodedText = encodeURIComponent(response.system_text || "");
          window.location.href = `/messages?prefill=${encodedText}`;
        }

      } catch (err) {
        console.error("❌ Checkout error:", err);
        // 1. Try to get the specific error message from the backend response
        let errorMessage = "Order failed"; 
        
        if (err.responseData && err.responseData.error) {
            // This matches the {"error": "..."} format from your Django view
            errorMessage = err.responseData.error;
        } else if (err.message) {
            errorMessage = err.message;
        }

        // 2. Display the actual backend error (e.g., "Maximum 3 pending orders...")
        toastAlert(errorMessage, "error");
      }
    };


  const fetchConsumers = async () => {
    if (!employeeId) return;

    try {
      setLoadingConsumers(true);
      const data = await apiFetch(`/api/users/employee/consumers/`, {
        method: 'POST',
        body: JSON.stringify({ userId: employeeId }),
      });
      setConsumers(data);
    } catch (err) {
      console.error('❌ Fetch error:', err);
      toastAlert('Could not load consumers', 'error');
    } finally {
      setLoadingConsumers(false);
    }
  };

  const handleOpenModal = () => {
    setIsModalOpen(true);
    if (consumers.length === 0) fetchConsumers();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/30 z-40 transition-opacity duration-300 ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => dispatch(closeCart())}
      />

      {/* Sidebar Panel */}
      <div
        className={`fixed top-0 right-0 h-full w-full max-w-lg bg-white z-50 flex flex-col transition-transform duration-300 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-4">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-lg pb-2 font-medium text-gray-700">
                Shopping Cart ({items.length})
              </h2>
              <p className="text-sm text-gray-400 mt-0.5">
                Review and manage the items in your shopping cart.
              </p>
            </div>
            <button
              onClick={() => dispatch(closeCart())}
              className="text-gray-400 hover:text-gray-600 transition mt-1"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <hr className="border-gray-100" />

        {/* Items List */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-gray-400 pb-20">
              <p className="text-base font-medium">Your cart is empty</p>
              <p className="text-sm mt-1">Add products from the catalogue</p>
            </div>
          ) : (
            items.map((item) => {
              const discountedPrice =
                item.base_percent > 0
                  ? item.price * (1 - item.base_percent / 100)
                  : item.price;
              const lineTotal = Math.round(discountedPrice) * item.quantity;

              return (
                <div key={item.id} className="flex items-start gap-3">
                  {/* Product Image */}
                  <div className="w-20 h-20 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                    {item.imageSrc ? (
                      <img
                        src={item.imageSrc}
                        alt={item.product_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300 text-[10px] text-center px-1">
                        No Image
                      </div>
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    {/* Name + remove + line total */}
                    <div className="flex justify-between items-start gap-1">
                      <p className="text-gray-700 text-base leading-snug">
                        {item.product_name}
                      </p>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-1">
                        <button
                          onClick={() => dispatch(removeFromCart(item.id))}
                          className="text-gray-400 hover:text-red-400 transition"
                        >
                          <X size={15} />
                        </button>
                        <span className="text-sm font-medium text-gray-600 whitespace-nowrap">
                          ₹{lineTotal.toLocaleString("en-IN")}.00
                        </span>
                      </div>
                    </div>

                    {/* Unit price */}
                    <p className="text-sm text-gray-400 mt-0.5">
                      ₹{Math.round(discountedPrice).toLocaleString("en-IN")}.00
                    </p>

                    {/* Quantity Controls */}
                    <div className="flex items-center gap-3 mt-2">
                      <button
                        onClick={() => dispatch(decrementQuantity(item.id))}
                        className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:border-[#F7941D] hover:text-[#F7941D] transition font-medium text-base"
                      >
                        −
                      </button>
                      <span className="text-sm font-medium text-gray-500 w-4 text-center">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => dispatch(incrementQuantity(item.id))}
                        className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:border-[#F7941D] hover:text-[#F7941D] transition font-medium text-base"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer — always visible when items exist */}
        {items.length > 0 && (
          <div className="px-5 pb-6 pt-3 space-y-3">
            <hr className="border-gray-100" />

            {/* Select Customer */}
            {role === 'Employee' && (
              <>
                <button 
                  onClick={handleOpenModal}
                  className="inline-flex items-center gap-2 px-2 py-1.5 border border-[#F7941D] rounded-lg text-[#F7941D] text-sm hover:bg-orange-50 transition"
                >
                  <User size={17} />
                  {selectedCustomer ? `Customer: ${selectedCustomer.customer_name}` : "Select Customer"}
                </button>
                <hr className="border-gray-100" />
              </>
            )}

            <hr className="border-gray-100" />

            {/* Total */}
            <div className="flex pt-3 justify-between items-center py-1">
              <span className="text-gray-700 text-base">Total</span>
              <span className="text-2xl text-gray-900">
                ₹{total.toLocaleString("en-IN")}.00
              </span>
            </div>

            {/* Checkout */}
            <button
              onClick={handleCheckout}
              className="w-full mx-auto block py-2 bg-[#F7941D] text-white rounded-lg hover:bg-[#e8860f] transition text-xs tracking-wide">
              Checkout
            </button>

            {/* Clear Cart */}
            <button
              onClick={() => dispatch(clearCart())}
              className="w-full mx-auto block py-2 border border-gray-200 text-gray-800 rounded-lg hover:bg-gray-50 transition text-xs"
            >
              Clear Cart
            </button>
          </div>
        )}
      </div>

      <SelectCustomerModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        loading={loadingConsumers}
        consumers={consumers}
        onConfirm={(customer) => {
          setSelectedCustomer(customer);
          setIsModalOpen(false);
          console.log("Selected Customer ID:", customer.id);
        }}
      />
    </>
  );
};

export default CartSidebar;