import { useState, useEffect } from "react";
import { X, AlertCircle, CheckCircle } from "lucide-react";
import apiFetch from "./utils/apiClient";

const PAYMENT_MODES = [
  { value: "cash",   label: "Cash" },
  { value: "cheque", label: "Cheque" },
  { value: "neft",   label: "NEFT" },
  { value: "upi",    label: "UPI" },
  { value: "other",  label: "Other" },
];

export const DEFERRED_TYPES = new Set(["Retailer", "Builder", "Dealer", "Plumber"]);

const ModalWrapper = ({ title, onClose, children }) => (
  <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
    <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
      <div className="flex justify-between items-center px-5 pt-5 pb-3 border-b border-gray-100">
        <h3 className="text-base font-medium text-gray-800">{title}</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <X size={18} />
        </button>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  </div>
);

const RecordPaymentModal = ({ activeConv, onClose, onSuccess }) => {
  const [amount, setAmount]             = useState("");
  const [mode, setMode]                 = useState("cash");
  const [note, setNote]                 = useState("");
  const [submitting, setSubmitting]     = useState(false);
  const [error, setError]               = useState("");
  const [success, setSuccess]           = useState(false);

  // ── For system chat: list of due orders to pick from ──────────────────────
  const isSystemChat = activeConv?.id === "system";

  const [dueOrders, setDueOrders]         = useState([]);   // for system chat
  const [selectedOrder, setSelectedOrder] = useState(null); // { order_id, conv_id }
  const [orderInfo, setOrderInfo]         = useState(null); // payment summary
  const [loadingOrders, setLoadingOrders] = useState(true);  // ✅ always true on mount
  const [loadingInfo, setLoadingInfo]     = useState(false);  // ✅ not needed anymore

  // ── Step 1: For system chat — fetch all due orders for this employee ───────
  useEffect(() => {
    if (isSystemChat) return;
    const fetchDueOrders = async () => {
      try {
        const res = await apiFetch(`/api/orders/customer-due/`);
        const orders = res.orders || [];
        setDueOrders(orders);

        // ✅ If only one order due, skip selection and go straight to payment form
        if (orders.length === 1) {
          setSelectedOrder({ order_id: orders[0].order_id, conv_id: orders[0].conv_id });
          const info = await apiFetch(`/api/orders/${orders[0].order_id}/payments/`);
          setOrderInfo(info);
        }
      } catch (err) {
        setError("Failed to load due orders.");
      } finally {
        setLoadingOrders(false);
      }
    };
    fetchDueOrders();
  }, [isSystemChat]);

  // ── Step 2 (system chat): when user selects an order, fetch its info ──────
  const handleOrderSelect = async (order) => {
    setSelectedOrder(order);
    setOrderInfo(null);
    setAmount("");
    setError("");
    try {
      const res = await apiFetch(`/api/orders/${order.order_id}/payments/`);
      setOrderInfo(res);
    } catch (err) {
      setError("Failed to load order details.");
    }
  };

  // ── Payment math ──────────────────────────────────────────────────────────
  const amountNum = parseFloat(amount) || 0;
  const remaining = orderInfo ? orderInfo.remaining : 0;
  const afterPay  = Math.max(0, remaining - amountNum);
  const isOverPay = amountNum > remaining + 0.01;

  const handleSubmit = async () => {
    if (!amountNum || amountNum <= 0) {
      setError("Please enter a valid amount.");
      return;
    }
    if (isOverPay) {
      setError(`Amount exceeds remaining balance of ₹${remaining.toLocaleString("en-IN")}.`);
      return;
    }
    try {
      setSubmitting(true);
      setError("");
      await apiFetch(`/api/orders/${selectedOrder.order_id}/payment/`, {
        method: "POST",
        body: JSON.stringify({
          amount:          amountNum,
          mode,
          note:            note.trim() || undefined,
          conversation_id: selectedOrder.conv_id,
        }),
      });
      setSuccess(true);
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 1200);
    } catch (err) {
      setError("Failed to record payment. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <ModalWrapper title="Payment Recorded" onClose={onClose}>
        <div className="flex flex-col items-center gap-3 py-6">
          <CheckCircle size={40} className="text-green-500" />
          <p className="text-sm text-gray-700 font-medium">
            ₹{amountNum.toLocaleString("en-IN")} recorded via{" "}
            {PAYMENT_MODES.find((m) => m.value === mode)?.label}
          </p>
          <p className="text-xs text-gray-400">Owner has been notified.</p>
        </div>
      </ModalWrapper>
    );
  }

  return (
    <ModalWrapper title="💰 Record Payment" onClose={onClose}>

      {/* ── System chat: Step 1 — select order ── */}
      {!selectedOrder ? (
        loadingOrders ? (
          <p className="text-sm text-gray-400 text-center py-6">Loading due orders...</p>
        ) : dueOrders.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">No due orders found.</p>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-gray-500">Select the order to record payment for:</p>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {dueOrders.map((order) => (
                <button
                  key={order.order_id}
                  onClick={() => handleOrderSelect(order)}
                  className="w-full text-left border border-gray-200 rounded-xl px-4 py-3 hover:border-[#F7941D] hover:bg-orange-50 transition"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium text-gray-800">
                        Order #{order.order_id}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {order.customer_name}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-medium text-red-500">
                        Due: ₹{order.remaining?.toLocaleString("en-IN")}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        Total: ₹{order.total_amount?.toLocaleString("en-IN")}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )

      ) : (
        /* ── Step 2: Payment form ── */
        <>
          {/* ── Back button for system chat ── */}
          {isSystemChat && (
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-medium text-gray-700">
                Order #{selectedOrder.order_id}
              </p>
              <button
                onClick={() => { setSelectedOrder(null); setOrderInfo(null); setAmount(""); setError(""); }}
                className="text-xs text-[#F7941D] hover:underline"
              >
                ← Change Order
              </button>
            </div>
          )}

          {!orderInfo ? (
            <p className="text-sm text-gray-400 text-center py-6">Loading order details...</p>
          ) : (
            <div className="space-y-4">

              {/* ── Order summary strip ── */}
              <div className="bg-gray-50 rounded-xl p-3 grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-[10px] text-gray-400 mb-0.5">Order total</p>
                  <p className="text-sm font-medium text-gray-800">
                    ₹{orderInfo.total_amount?.toLocaleString("en-IN")}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 mb-0.5">Already paid</p>
                  <p className="text-sm font-medium text-green-600">
                    ₹{orderInfo.amount_paid?.toLocaleString("en-IN")}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 mb-0.5">Remaining</p>
                  <p className="text-sm font-medium text-red-500">
                    ₹{orderInfo.remaining?.toLocaleString("en-IN")}
                  </p>
                </div>
              </div>

              {/* ── Payment mode ── */}
              <div>
                <label className="text-xs text-gray-500 mb-1.5 block">Payment mode</label>
                <div className="flex gap-2 flex-wrap">
                  {PAYMENT_MODES.map((m) => (
                    <button
                      key={m.value}
                      onClick={() => setMode(m.value)}
                      className={`px-3 py-1.5 text-xs rounded-lg border transition ${
                        mode === m.value
                          ? "bg-[#F7941D] text-white border-[#F7941D]"
                          : "text-gray-600 border-gray-200 hover:border-[#F7941D] hover:text-[#F7941D]"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Amount ── */}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Amount received *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">₹</span>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder={`Max ₹${orderInfo.remaining?.toLocaleString("en-IN")}`}
                    className={`w-full pl-7 pr-3 py-2.5 border rounded-lg text-sm focus:outline-none transition ${
                      isOverPay
                        ? "border-red-400 focus:border-red-400"
                        : "border-gray-200 focus:border-[#F7941D]"
                    }`}
                  />
                </div>
                {amountNum > 0 && !isOverPay && (
                  <p className="text-[11px] text-green-600 mt-1">
                    Remaining after this payment: ₹{afterPay.toLocaleString("en-IN")}
                    {afterPay === 0 && " · Order fully paid ✓"}
                  </p>
                )}
                {isOverPay && (
                  <p className="text-[11px] text-red-400 mt-1 flex items-center gap-1">
                    <AlertCircle size={10} /> Exceeds remaining balance.
                  </p>
                )}
              </div>

              {/* ── Note ── */}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Note (optional)</label>
                <textarea
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder='e.g. "Collected at site by Ramesh"'
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#F7941D] resize-none"
                />
              </div>

              {error && (
                <p className="text-xs text-red-400 flex items-center gap-1">
                  <AlertCircle size={11} /> {error}
                </p>
              )}
            </div>
          )}

          {/* ── Footer ── */}
          {orderInfo && (
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!amount || amountNum <= 0 || isOverPay || submitting}
                className={`px-4 py-2 text-sm text-white rounded-lg transition ${
                  !amount || amountNum <= 0 || isOverPay || submitting
                    ? "bg-gray-300 cursor-not-allowed"
                    : "bg-[#F7941D] hover:bg-[#e8860f]"
                }`}
              >
                {submitting ? "Recording..." : "Record Payment"}
              </button>
            </div>
          )}
        </>
      )}
    </ModalWrapper>
  );
};

export default RecordPaymentModal;