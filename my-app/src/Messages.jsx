// src/Messages.jsx
// Day 1 — Static layout, no API. Matches Figma exactly.

import { useState, useEffect, useRef } from "react";
import {
  Search, Package, Clock, ChevronRight, CheckCheck,
  Eye, BarChart2, ShoppingBag, Star,
  MoreVertical, Send, Paperclip,
  Check, X, Forward, MessageSquare, AlertCircle, User,
} from "lucide-react";
import apiFetch from "./utils/apiClient";
import {getUserInfo, getActualUserRole} from './auth_utils';
import { useTranslation } from "./i18n";
import RecordPaymentModal, { DEFERRED_TYPES } from "./RecordPaymentModal";


// ── Static Data ───────────────────────────────────────────────────────────────
const TYPE_COLORS = {
  Retailer: "text-[#F7941D] bg-orange-50",
  Builder: "text-gray-600 bg-gray-100",
  Distributor: "text-blue-600 bg-blue-50",
  Contractor: "text-green-600 bg-green-50",
  Consumer: "text-purple-600 bg-purple-50",
};

const STATUS_COLORS = {
  Pending: "text-amber-600 bg-amber-50",
  Processing: "text-blue-600 bg-blue-50",
  Completed: "text-green-600 bg-green-50",
  Cancelled: "text-red-600 bg-red-50",
};

const REJECTION_REASONS = [
  "Out of Stock",
  "Quantity Not Available",
  "Delivery Not Possible",
  "Pricing Not Approved",
  "Customer Credit Issue",
  "Duplicate Order",
  "Other",
];

const PAYMENT_COLORS = {
  full:    "text-green-600 bg-green-50",
  partial: "text-amber-600 bg-amber-50",
  due:     "text-red-600 bg-red-50",
};

const monthsAgo = (isoDate) => {
  const then = new Date(isoDate);
  const now  = new Date();
  return Math.max(0, (now.getFullYear() - then.getFullYear()) * 12 + (now.getMonth() - then.getMonth()));
};

// ── Sub-components ─────────────────────────────────────────────────────────────

const ConversationItem = ({ conv, isActive, onClick, userRole }) => {
  const isPending = conv.order?.order_status === "pending";

  return (
    <div
      onClick={onClick}
      className={`flex items-start gap-3 px-4 py-3.5 cursor-pointer border-b border-gray-100 hover:bg-gray-50 transition ${
        isActive ? "bg-orange-50 border-l-2 border-l-[#F7941D]" : ""
      }`}
    >
    <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
      <ShoppingBag size={18} className="text-gray-400" />
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex justify-between items-start">
        <p className="text-sm font-medium text-gray-800 truncate">{conv.name}</p>
        <span className="text-xs text-gray-400 flex-shrink-0 ml-2">{conv.time}</span>
      </div>
      
      <div className="flex items-center gap-1.5 mt-0.5 mb-1">
        {userRole === "Employee" && conv.type !== "direct" && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${TYPE_COLORS[conv.type] || "text-gray-500 bg-gray-100"}`}>
            {conv.type}
          </span>
        )}
        {conv.rewards > 0 && (
          <span className="text-[10px] text-yellow-600 flex items-center gap-0.5">
            <Star size={9} fill="currentColor" /> {conv.rewards}
          </span>
        )}
      </div>
      <div className="flex justify-between items-center">

        {conv.lastMessage && (
          isPending
          ? <p className="text-xs text-gray-400 truncate italic">🔔 {conv.lastMessage}</p>
          : <p className="text-xs text-gray-400 truncate">{conv.lastMessage}</p>
        )}
        {conv.unread > 0 && (
          <span className="ml-2 bg-[#F7941D] text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0">
            {conv.unread}
          </span>
        )}
      </div>
    </div>
  </div>
  );
};

const OrderRequestCard = ({ orderRequest, onAccept, onReject, onForward, onAskDetails, userRole }) => {
  const { t } = useTranslation();
  return (
    <div className="mx-4 my-3 border border-orange-200 rounded-xl bg-orange-50 p-4">
    <div className="flex items-center gap-2 mb-2">
      <Package size={15} className="text-[#F7941D]" />
      <span className="text-xs font-semibold text-[#F7941D] uppercase tracking-wide">{t("order_request")}</span>
    </div>
    <p className="text-sm font-medium text-gray-800 mb-0.5">
      {t("product")} : {orderRequest.product} (×{orderRequest.qty})
    </p>
    <p className="text-xs text-gray-400 flex items-center gap-1 mb-3">
      <Clock size={11} /> {t("requested")} : {orderRequest.requestedAt}
    </p>
    <div className="flex flex-wrap gap-2">
      <button onClick={onAccept} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 text-white text-xs rounded-lg hover:bg-green-600 transition">
        <Check size={13} /> {t("accept")}
      </button>
      <button onClick={onReject} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 text-white text-xs rounded-lg hover:bg-red-600 transition">
        <X size={13} /> {t("reject")}
      </button>
      {/* ✅ Only show Forward for Employee */}
      {userRole === "Employee" && (
        <button onClick={onForward} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 text-white text-xs rounded-lg hover:bg-blue-600 transition">
          <Forward size={13} /> {t("forward_to_owner")}
        </button>
      )}
      <button onClick={onAskDetails} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-200 text-gray-700 text-xs rounded-lg hover:bg-gray-300 transition">
        <MessageSquare size={13} /> {t("ask_details")}
      </button>
    </div>
  </div>
);
};

// ── Modals ─────────────────────────────────────────────────────────────────────

const AcceptModal = ({ onClose, orderRequest, onSuccess }) => {
  const { t } = useTranslation();
  const [deliveryDate, setDeliveryDate] = useState("");
  const [note, setNote]                 = useState("");
  const [orderData, setOrderData]       = useState(null);
  const [loading, setLoading]           = useState(true);
  const [submitting, setSubmitting]     = useState(false);

  useEffect(() => {
    const fetchOrderItems = async () => {
      try {
        const res = await apiFetch(`/api/orders/${orderRequest.order_id}/accept/`);
        setOrderData(res);
      } catch (err) {
        console.error("Failed to fetch order items:", err);
      } finally {
        setLoading(false);
      }
    };
    if (orderRequest?.order_id) fetchOrderItems();
  }, [orderRequest]);

  const handleConfirm = async () => {
    try {
      setSubmitting(true);
      await apiFetch(`/api/orders/${orderRequest.order_id}/accept/`, {
        method: "POST",
        body: JSON.stringify({
          delivery_date: deliveryDate.replace("T", " "),  // ✅ "2026-03-10T14:30" → "2026-03-10 14:30"
          note,
        }),
      });
      onSuccess?.();
      onClose();
    } catch (err) {
      console.error("Failed to accept order:", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalWrapper title={t("accept_order")} onClose={onClose}>
      {loading ? (
        <p className="text-sm text-gray-400 text-center py-4">{t("loading_order_details")}</p>
      ) : (
        <div className="space-y-3">

          {/* ✅ Order Items Table */}
          <div>
            <p className="text-xs text-gray-500 mb-1">{t("order_items")}</p>
            <div className="border border-gray-100 rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-3 py-2 text-gray-500 font-medium">{t("product")}</th>
                    <th className="text-center px-3 py-2 text-gray-500 font-medium">{t("qty")}</th>
                    <th className="text-right px-3 py-2 text-gray-500 font-medium">{t("price")}</th>
                    <th className="text-right px-3 py-2 text-gray-500 font-medium">{t("total")}</th>
                  </tr>
                </thead>
                <tbody>
                  {orderData?.items?.map((item, i) => (
                    <tr key={i} className="border-t border-gray-50">
                      <td className="px-3 py-2 text-gray-700">{item.product_name}</td>
                      <td className="px-3 py-2 text-center text-gray-600">{item.qty}</td>
                      <td className="px-3 py-2 text-right text-gray-600">₹{item.selling_price}</td>
                      <td className="px-3 py-2 text-right text-gray-700 font-medium">₹{item.line_total}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t border-gray-200 bg-gray-50">
                  <tr>
                    <td colSpan={3} className="px-3 py-2 text-xs text-gray-500 font-medium">Total</td>
                    <td className="px-3 py-2 text-right text-sm font-semibold text-gray-800">
                      ₹{orderData?.total_amount?.toLocaleString("en-IN")}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* ✅ Delivery Date & Time */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">{t("expected_delivery")}</label>
            <input
              type="datetime-local"
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#F7941D]"
            />
          </div>

          {/* ✅ Note */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">{t("note_optional")}</label>
            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("additional_instructions")}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#F7941D] resize-none"
            />
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2 mt-5">
        <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition">
          {t("cancel")}
        </button>
        <button
          onClick={handleConfirm}
          disabled={!deliveryDate || submitting}
          className={`px-4 py-2 text-sm text-white rounded-lg transition ${
            !deliveryDate || submitting ? "bg-gray-300 cursor-not-allowed" : "bg-green-500 hover:bg-green-600"
          }`}
        >
          {submitting ? t("confirming") : t("confirm_order")}
        </button>
      </div>
    </ModalWrapper>
  );
};

const RejectModal = ({ onClose, orderRequest, onSuccess }) => {
  const { t } = useTranslation();
  const [reason, setReason]       = useState("");
  const [note, setNote]           = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async () => {
    try {
      setSubmitting(true);
      await apiFetch(`/api/orders/${orderRequest.order_id}/reject/`, {
        method: "POST",
        body: JSON.stringify({ reason, note }),
      });
      onSuccess?.();
      onClose();
    } catch (err) {
      console.error("Failed to reject order:", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalWrapper title={t("reject_order")} onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">{t("rejection_reason")}</label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#F7941D]"
          >
            <option value="">{t("select_rejection_reason_option")}</option>
            {REJECTION_REASONS.map((r) => <option key={r}>{r}</option>)}
          </select>
          {!reason && (
            <p className="text-[10px] text-red-400 mt-1 flex items-center gap-1">
              <AlertCircle size={10} /> {t("please_select_rejection_reason")}
            </p>
          )}
        </div>
        {reason === "Other" && (
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Specify Reason</label>
            <textarea rows={2} placeholder="Describe the reason..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#F7941D] resize-none" />
          </div>
        )}
        <div>
          <label className="text-xs text-gray-500 mb-1 block">{t("note_optional")}</label>
          <textarea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t("additional_instructions")}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#F7941D] resize-none"
          />
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-5">
        <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition">
          {t("cancel")}
        </button>
        <button
          onClick={handleConfirm}
          disabled={!reason || submitting}
          className={`px-4 py-2 text-sm text-white rounded-lg transition ${
            !reason || submitting ? "bg-gray-300 cursor-not-allowed" : "bg-red-500 hover:bg-red-600"
          }`}
        >
          {submitting ? t("rejecting") : t("reject_order")}
        </button>
      </div>
    </ModalWrapper>
  );
};

const ForwardModal = ({ onClose, orderRequest, onSuccess }) => {
  const { t } = useTranslation();
  const [note, setNote]             = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState("");

  const handleConfirm = async () => {
    try {
      setSubmitting(true);
      setError("");
      await apiFetch(`/api/orders/${orderRequest.order_id}/forward/`, {
        method: "POST",
        body: JSON.stringify({ note }),
      });
      onSuccess?.();
      onClose();
    } catch (err) {
      setError("Failed to forward order. Please try again.");
      console.error("Failed to forward order:", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalWrapper title={t("forward_to_owner")} onClose={onClose}>
      <p className="text-xs text-gray-500 mb-3">
        {t("forward_description")}
      </p>
      <div>
        <label className="text-xs text-gray-500 mb-1 block">{t("note_optional")}</label>
        <textarea
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t("forward_note_placeholder")}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#F7941D] resize-none"
        />
      </div>
      {error && (
        <p className="text-xs text-red-400 mt-2 flex items-center gap-1">
          <AlertCircle size={11} /> {error}
        </p>
      )}
      <div className="flex justify-end gap-2 mt-5">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
        >
          {t("cancel")}
        </button>
        <button
          onClick={handleConfirm}
          disabled={submitting}
          className={`px-4 py-2 text-sm text-white rounded-lg transition ${
            submitting ? "bg-gray-300 cursor-not-allowed" : "bg-blue-500 hover:bg-blue-600"
          }`}
        >
          {submitting ? t("forwarding") : t("forward_to_owner")}
        </button>
      </div>
    </ModalWrapper>
  );
};

const OrderDetailModal = ({ order, onClose }) => {
  const { t } = useTranslation();
  const months     = monthsAgo(order.date);
  const remaining  = order.totalAmount - order.amountPaid;
  const isPartialOrDue = order.paymentType === "partial" || order.paymentType === "due";

  return (
    <ModalWrapper title={`${t("order_details")} — ${order.id}`} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-xs text-gray-400">
          {new Date(order.date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
          <span className="ml-2 text-gray-300">·</span>
          <span className="ml-2">{months} {t("months_ago")}</span>
        </p>
        <div>
          <p className="text-xs text-gray-400 mb-1">{t("items")}</p>
          {order.items.map((item, i) => (
            <p key={i} className="text-sm text-gray-700">• {item}</p>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">{t("payment_type")}</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${PAYMENT_COLORS[order.paymentType]}`}>
            {order.paymentType === "full" ? t("full_payment")
              : order.paymentType === "partial" ? `${t("partial_payment")} (${order.paidPercent}%)`
              : t("due_unpaid")}
          </span>
        </div>
        <div className="bg-gray-50 rounded-xl p-3 space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-gray-500">{t("total_amount")}</span>
            <span className="text-gray-800 font-medium">
              ₹{order.totalAmount?.toLocaleString("en-IN")}
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-500">{t("amount_paid")}</span>
            {/* ✅ Show 0 if fully due */}
            <span className="text-green-600 font-medium">
              ₹{order.paymentType === "due" ? "0" : order.amountPaid?.toLocaleString("en-IN")}
            </span>
          </div>
          {/* ✅ Always show Remaining/Due when not fully paid */}
          {isPartialOrDue && (
            <div className="flex justify-between text-xs border-t border-gray-200 pt-2">
              <span className="text-red-500">Remaining / Due</span>
              <span className="text-red-600 font-medium">
                ₹{remaining?.toLocaleString("en-IN")}
              </span>
            </div>
          )}
        </div>
        {isPartialOrDue && (
          <p className="text-[11px] text-red-400 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
            {order.paymentType === "due" ? t("payment_fully_pending")
              : `${t("only_paid_percent")} ${order.paidPercent}%`}
            {" · "}{months} {t("months_since_order_date")}
          </p>
        )}
      </div>
      <div className="flex justify-end mt-5">
        <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition">
          Close
        </button>
      </div>
    </ModalWrapper>
  );
};

// ── Reusable form bits ─────────────────────────────────────────────────────────

const ModalWrapper = ({ title, onClose, children }) => (
  <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
    <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
      <div className="flex justify-between items-center px-5 pt-5 pb-3 border-b border-gray-100">
        <h3 className="text-base font-medium text-gray-800">{title}</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  </div>
);

const ModalFooter = ({ onClose, confirmLabel, confirmColor, disabled }) => (
  <div className="flex justify-end gap-2 mt-5">
    <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition">Cancel</button>
    <button disabled={disabled} className={`px-4 py-2 text-sm text-white rounded-lg transition ${disabled ? "bg-gray-300 cursor-not-allowed" : confirmColor}`}>{confirmLabel}</button>
  </div>
);

const Field = ({ label, value }) => (
  <div>
    <p className="text-xs text-gray-400">{label}</p>
    <p className="text-sm text-gray-800 font-medium">{value}</p>
  </div>
);

const InputField = ({ label, placeholder, type = "text" }) => (
  <div>
    <label className="text-xs text-gray-500 mb-1 block">{label}</label>
    <input type={type} placeholder={placeholder} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#F7941D]" />
  </div>
);

const TextareaField = ({ label, placeholder }) => (
  <div>
    <label className="text-xs text-gray-500 mb-1 block">{label}</label>
    <textarea rows={3} placeholder={placeholder} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#F7941D] resize-none" />
  </div>
);

// ── Customer Details Panel ────────────────────────────────────────────────────
const OrderHistoryModal = ({ customer, orders, onClose }) => {
  const partialOrDueCount = orders.filter(
    o => o.paymentType === "partial" || o.paymentType === "due"
  ).length;
  const monthsSinceLast = orders.length > 0 ? monthsAgo(orders[0].date) : 0;

  return (
    <ModalWrapper title="Order History" onClose={onClose}>
      {/* Credibility summary */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-red-50 rounded-xl p-3 text-center">
          <p className="text-2xl font-medium text-red-500">{partialOrDueCount}</p>
          <p className="text-[11px] text-red-400 mt-0.5">Partial / Due Orders</p>
        </div>
        <div className="bg-amber-50 rounded-xl p-3 text-center">
          <p className="text-2xl font-medium text-amber-500">{monthsSinceLast}</p>
          <p className="text-[11px] text-amber-400 mt-0.5">Months Since Last Order</p>
        </div>
      </div>

      <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
        {orders.map((order) => {
          const months    = monthsAgo(order.date);
          const remaining = order.totalAmount - order.amountPaid;

          // ✅ Status badge: "Processing" if due, "Pending" if partial
          const displayStatus = order.paymentType === "due"
            ? "Processing"
            : order.paymentType === "partial"
            ? "Pending"
            : order.status;

          return (
            <div key={order.id} className="border border-gray-100 rounded-xl p-3">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs font-medium text-gray-800">{order.id}</p>
                  <p className="text-[10px] text-gray-400">
                    {months} month{months !== 1 ? "s" : ""} ago
                  </p>
                </div>
                {/* ✅ Payment type badge */}
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${PAYMENT_COLORS[order.paymentType] || "text-gray-500 bg-gray-100"}`}>
                  {order.paymentType === "partial" ? `Partial ${order.paidPercent}%`
                    : order.paymentType === "due" ? "Due"
                    : "Paid"}
                </span>
              </div>

              {/* ✅ Status row */}
              <div className="mt-1.5">
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${STATUS_COLORS[displayStatus] || "text-gray-500 bg-gray-100"}`}>
                  {displayStatus}
                </span>
              </div>

              <div className="flex justify-between text-xs mt-2">
                <span className="text-gray-500">Total</span>
                <span className="text-gray-700">
                  ₹{order.totalAmount?.toLocaleString("en-IN")}
                </span>
              </div>

              {/* ✅ Remaining/Due row when not fully paid */}
              {order.paymentType !== "full" && (
                <div className="flex justify-between text-xs mt-0.5">
                  <span className="text-red-400">Remaining / Due</span>
                  <span className="text-red-500">
                    ₹{remaining?.toLocaleString("en-IN")}
                  </span>
                </div>
              )}

              {/* ✅ NO View Details button here */}
            </div>
          );
        })}
      </div>

      <div className="flex justify-end mt-4">
        <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition">
          Close
        </button>
      </div>
    </ModalWrapper>
  );
};

// ── Consumer Order History Modal (for System chat) ────────────────────────────
const ConsumerOrderHistoryModal = ({ consumer, onClose }) => {
  const [orders, setOrders]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch_ = async () => {
      try {
        const res = await apiFetch(`/api/customers/${consumer.customer_id}/orders/`);
        setOrders(res.orders || []);
      } catch (err) {
        console.error("Failed to fetch consumer orders:", err);
      } finally {
        setLoading(false);
      }
    };
    fetch_();
  }, [consumer]);

  return (
    <ModalWrapper title={`Orders — ${consumer.name}`} onClose={onClose}>
      {loading ? (
        <p className="text-sm text-gray-400 text-center py-4">Loading...</p>
      ) : orders.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">No orders found.</p>
      ) : (
        <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
          {orders.map((order) => {
            const months    = monthsAgo(order.date);
            const remaining = order.totalAmount - order.amountPaid;
            return (
              <div key={order.id} className="border border-gray-100 rounded-xl p-3">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-medium text-gray-800">{order.id}</p>
                    <p className="text-[10px] text-gray-400">{months} month{months !== 1 ? "s" : ""} ago</p>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[order.status] || "text-gray-500 bg-gray-100"}`}>
                    {order.status}
                  </span>
                </div>
                {order.items.map((item, i) => (
                  <p key={i} className="text-[11px] text-gray-500 mt-1">• {item}</p>
                ))}
                <div className="flex justify-between text-xs mt-2">
                  <span className="text-gray-500">Total</span>
                  <span className="text-gray-700">₹{order.totalAmount.toLocaleString("en-IN")}</span>
                </div>
                {order.paymentType !== "full" && (
                  <div className="flex justify-between text-xs mt-0.5">
                    <span className="text-red-400">Remaining</span>
                    <span className="text-red-500">₹{remaining.toLocaleString("en-IN")}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      <div className="flex justify-end mt-4">
        <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition">
          Close
        </button>
      </div>
    </ModalWrapper>
  );
};


// ── Customer Details Panel ────────────────────────────────────────────────────
const CustomerDetailsPanel = ({ onClose, activeConv, userRole }) => {
  const [detailOrder, setDetailOrder]           = useState(null);
  const [showHistory, setShowHistory]           = useState(false);
  const [customerData, setCustomerData]         = useState(null);
  const [consumers, setConsumers]               = useState([]);
  const [selectedConsumer, setSelectedConsumer] = useState(null);
  const [loading, setLoading]                   = useState(true);

  const isSystemChat = activeConv?.id === "system";

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        if (isSystemChat) {
          const res = await apiFetch(`/api/customers/consumers/`);
          setConsumers(res.consumers || []);
        } else {
          const customerId = activeConv?.order?.customer_id;
          if (!customerId) {
            setLoading(false); // ✅ don't leave it spinning
            return;
          }
          const res = await apiFetch(`/api/customers/${customerId}/orders/`);
          setCustomerData(res);
        }
      } catch (err) {
        console.error("Failed to fetch details:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [activeConv?.id]);

  return (
    <div className="w-[300px] flex-shrink-0 overflow-y-auto bg-white border-l border-gray-200 flex flex-col">
      {/* Header */}
      <div className="px-5 pt-5 pb-3 border-b border-gray-100 flex justify-between items-center">
        <p className="text-sm font-medium text-gray-700">
          {isSystemChat ? "Final Consumer Details" : "Customer Details"}
        </p>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
          <X size={16} />
        </button>
      </div>

      {loading ? (
        <p className="text-xs text-gray-400 text-center mt-10">Loading...</p>
      ) : isSystemChat ? (

        // ── System chat: consumer list ──────────────────────────────────
        <div className="flex-1 overflow-y-auto">
          {consumers.length === 0 ? (
            <p className="text-xs text-gray-400 text-center mt-10">No consumers found.</p>
          ) : (
            consumers.map((consumer) => (
              <div key={consumer.customer_id}
                className="flex items-center justify-between px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{consumer.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${TYPE_COLORS[consumer.type] || "text-gray-500 bg-gray-100"}`}>
                      {consumer.type}
                    </span>
                    <span className="text-[10px] text-gray-400">
                      {consumer.totalOrders} order{consumer.totalOrders !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    Last: {consumer.lastOrderId} · {consumer.lastOrderStatus}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedConsumer(consumer)}
                  className="ml-3 p-1.5 text-gray-400 hover:text-teal-600 transition flex-shrink-0"
                >
                  <Eye size={15} />
                </button>
              </div>
            ))
          )}
        </div>

      ) : (

        // ── Retailer/Builder/etc: customer details ──────────────────────
        <>
          {/* ── Total Orders & Total Spent ── */}
          {customerData && (
            <div className="border-b border-gray-100">
              <div className="flex items-center justify-between px-5 py-3 border-b border-gray-50">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Package size={15} className="text-[#F7941D]" /> Total Orders
                </div>
                <span className="text-sm font-medium text-gray-800">
                  {customerData.customer?.totalOrders ?? 0}
                </span>
              </div>
              <div className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <BarChart2 size={15} className="text-[#F7941D]" /> Total Spent
                </div>
                <span className="text-sm font-medium text-gray-800">
                  {customerData.customer?.totalSpent ?? "₹0"}
                </span>
              </div>
            </div>
          )}

          {/* ── Recent Orders ── */}
          <div className="px-5 py-3 border-b border-gray-100">
            <div className="flex justify-between items-center mb-3">
              <p className="text-sm text-gray-700">Recent Orders</p>
              {/* ✅ View All opens the Order History modal */}
              <button
                onClick={() => setShowHistory(true)}
                className="text-xs text-[#F7941D] hover:underline"
              >
                View All
              </button>
            </div>

            {!customerData?.orders?.length ? (
              <p className="text-xs text-gray-400">No orders yet.</p>
            ) : (
              <div className="space-y-3">
                {/* ✅ Show only latest 2 orders in panel */}
                {customerData.orders.slice(0, 2).map((order) => (
                  <div key={order.id} className="border border-gray-100 rounded-xl p-3">
                    <div className="flex justify-between items-start mb-1">
                      <div>
                        <p className="text-xs font-medium text-gray-800">{order.id}</p>
                        <p className="text-[10px] text-gray-400">{monthsAgo(order.date)} months ago</p>
                      </div>
                      {(() => {
                        const displayStatus = order.paymentType === "due"
                          ? "Processing"
                          : order.paymentType === "partial"
                          ? "Pending"
                          : order.status;
                        return (
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${STATUS_COLORS[displayStatus] || "text-gray-500 bg-gray-100"}`}>
                            <Clock size={9} /> {displayStatus}
                          </span>
                        );
                      })()}
                    </div>
                    {order.items.map((item, i) => (
                      <p key={i} className="text-[11px] text-gray-500">• {item}</p>
                    ))}
                    <div className="mt-1.5">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${PAYMENT_COLORS[order.paymentType]}`}>
                        {order.paymentType === "partial" ? `Partial ${order.paidPercent}%`
                          : order.paymentType === "due" ? "Due" : "Paid"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-xs text-gray-600">Total</span>
                      <span className="text-xs font-medium text-gray-800">
                        ₹{order.totalAmount?.toLocaleString("en-IN")}
                      </span>
                    </div>
                    {/* ✅ View Details opens individual order modal */}
                    <button
                      onClick={() => setDetailOrder(order)}
                      className="mt-2 w-full flex items-center justify-center gap-1.5 py-1.5 bg-teal-600 text-white text-xs rounded-lg hover:bg-teal-700 transition">
                      <Eye size={12} /> View Details
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Quick Actions ── */}
          <div className="px-5 py-3">
            <p className="text-sm text-gray-700 mb-3">Quick Actions</p>
            <div className="space-y-1">
              {[
                { icon: <Package size={15} />, label: "Create New Order", onClick: undefined },
                { icon: <BarChart2 size={15} />, label: "View Analytics", onClick: undefined },
              ].map((action) => (
                <button key={action.label} onClick={action.onClick}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition text-left">
                  <span className="text-gray-400">{action.icon}</span>
                  {action.label}
                  <ChevronRight size={14} className="ml-auto text-gray-300" />
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── Modals ── */}
      {detailOrder && (
        <OrderDetailModal order={detailOrder} onClose={() => setDetailOrder(null)} />
      )}
      {/* ✅ View All → Order History modal with credibility stats */}
      {showHistory && customerData && (
        <OrderHistoryModal
          customer={customerData.customer}
          orders={customerData.orders}
          onClose={() => setShowHistory(false)}
        />
      )}
      {selectedConsumer && (
        <ConsumerOrderHistoryModal
          consumer={selectedConsumer}
          onClose={() => setSelectedConsumer(null)}
        />
      )}
    </div>
  );
};

// ── 🛍 Place Order Modal ──────────────────────────────────────────────────────
const PlaceOrderModal = ({ onClose, onSuccess }) => (
  <ModalWrapper title="🛍 Place New Order" onClose={onClose}>
    <p className="text-sm text-gray-500 text-center py-6">
      To place a new order, please browse the catalogue and add items to your cart.
    </p>
    <div className="flex justify-end gap-2 mt-2">
      <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition">
        Cancel
      </button>
      <button
        onClick={() => { window.location.href = "/catalogue"; }}
        className="px-4 py-2 text-sm text-white bg-[#F7941D] rounded-lg hover:bg-[#e8860f] transition"
      >
        Go to Catalogue
      </button>
    </div>
  </ModalWrapper>
);

// ── 🔄 Return Items Modal ─────────────────────────────────────────────────────
const ReturnItemsModal = ({ activeConv, onClose, onSuccess }) => {
  const [orders, setOrders]               = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [returnItems, setReturnItems]     = useState({});
  const [loading, setLoading]             = useState(true);
  const [loadingItems, setLoadingItems]   = useState(false);
  const [submitting, setSubmitting]       = useState(false);
  const [error, setError]                 = useState("");

  const RETURN_REASONS = [
    "Damaged Product",
    "Wrong Item Delivered",
    "Quality Issue",
    "Changed Mind",
    "Duplicate Order",
    "Other",
  ];

  // ✅ Step 1: Fetch lightweight order list on mount
  useEffect(() => {
    const fetchOrders = async () => {
      try {
        // ✅ Always call without customer_id — backend resolves from session
        const res = await apiFetch(`/api/customers/accepted-orders/`);
        setOrders(res.orders || []);
      } catch (err) {
        console.error("Failed to fetch orders:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
  }, []);

  // ✅ Step 2: Fetch full item details when user selects an order
  const handleOrderSelect = async (order) => {
    setLoadingItems(true);
    setReturnItems({});  // ✅ reset selections when changing order
    try {
      const res = await apiFetch(`/api/orders/${order.order_id}/accept/`);
      setSelectedOrder({ ...order, items: res.items });
    } catch (err) {
      console.error("Failed to fetch order items:", err);
      setError("Failed to load order items. Please try again.");
    } finally {
      setLoadingItems(false);
    }
  };

  const handleItemToggle = (itemIndex, item) => {
    setReturnItems(prev => {
      const key = `${selectedOrder?.order_id}_${itemIndex}`;
      if (prev[key]) {
        const updated = { ...prev };
        delete updated[key];
        return updated;
      }
      return { ...prev, [key]: { item, qty: 1, reason: "" } };
    });
  };

  const handleQtyChange = (key, qty) => {
    setReturnItems(prev => ({
      ...prev,
      [key]: { ...prev[key], qty: parseInt(qty) || 1 }
    }));
  };

  const handleReasonChange = (key, reason) => {
    setReturnItems(prev => ({
      ...prev,
      [key]: { ...prev[key], reason }
    }));
  };

  const handleSubmit = async () => {
    const selectedItems = Object.entries(returnItems);
    if (!selectedOrder || selectedItems.length === 0) {
      setError("Please select at least one item to return.");
      return;
    }
    const missingReason = selectedItems.some(([, v]) => !v.reason);
    if (missingReason) {
      setError("Please select a reason for each item.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      await apiFetch(`/api/orders/${selectedOrder.order_id}/return/`, {
        method: "POST",
        body: JSON.stringify({
          conversation_id: activeConv.id,
          items: selectedItems.map(([, v]) => ({
            item_id: v.item.item_id,  // ✅ OrderItem PK for Return FK
            qty:     v.qty,
            reason:  v.reason,
          })),
        }),
      });
      onSuccess?.();
    } catch (err) {
      setError("Failed to submit return request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalWrapper title="🔄 Return Items" onClose={onClose}>

      {/* ── Step 1: Order List ── */}
      {loading ? (
        <p className="text-sm text-gray-400 text-center py-6">Loading your orders...</p>

      ) : orders.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">No completed orders found to return.</p>

      ) : !selectedOrder ? (
        <div>
          <p className="text-xs text-gray-500 mb-2">Select the order you want to return from:</p>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {orders.map((order) => (
              <button
                key={order.order_id}
                onClick={() => handleOrderSelect(order)}
                className="w-full text-left border border-gray-200 rounded-xl px-4 py-3 hover:border-[#F7941D] hover:bg-orange-50 transition"
              >
                <p className="text-sm font-medium text-gray-800">Order #{order.order_id}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {order.item_count} item{order.item_count !== 1 ? "s" : ""} · ₹{order.total_amount?.toLocaleString("en-IN")}
                </p>
                <p className="text-[10px] text-gray-400 mt-0.5">{order.date}</p>
              </button>
            ))}
          </div>
        </div>

      ) : loadingItems ? (
        /* ── Loading items for selected order ── */
        <p className="text-sm text-gray-400 text-center py-6">Loading order items...</p>

      ) : (
        /* ── Step 2: Item Selection ── */
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-gray-700">
              Order #{selectedOrder.order_id} · {selectedOrder.date}
            </p>
            <button
              onClick={() => { setSelectedOrder(null); setReturnItems({}); setError(""); }}
              className="text-xs text-[#F7941D] hover:underline"
            >
              ← Change Order
            </button>
          </div>

          <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
            {selectedOrder.items?.map((item, idx) => {
              const key = `${selectedOrder.order_id}_${idx}`;
              const isChecked = !!returnItems[key];
              return (
                <div
                  key={idx}
                  className={`border rounded-xl p-3 transition ${
                    isChecked ? "border-[#F7941D] bg-orange-50" : "border-gray-100"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleItemToggle(idx, item)}
                      className="mt-0.5 accent-[#F7941D]"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800">{item.product_name}</p>
                      <p className="text-xs text-gray-400">Qty ordered: {item.qty}</p>

                      {isChecked && (
                        <div className="mt-2 space-y-2">
                          {/* Return Qty */}
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 w-20">Return Qty:</span>
                            <input
                              type="number"
                              min={1}
                              max={item.qty}
                              value={returnItems[key]?.qty || 1}
                              onChange={(e) => handleQtyChange(key, e.target.value)}
                              className="w-16 border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-[#F7941D]"
                            />
                            <span className="text-xs text-gray-400">/ {item.qty}</span>
                          </div>
                          {/* Reason */}
                          <select
                            value={returnItems[key]?.reason || ""}
                            onChange={(e) => handleReasonChange(key, e.target.value)}
                            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-[#F7941D]"
                          >
                            <option value="">Select reason...</option>
                            {RETURN_REASONS.map(r => <option key={r}>{r}</option>)}
                          </select>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Error ── */}
      {error && (
        <p className="text-xs text-red-400 mt-3 flex items-center gap-1">
          <AlertCircle size={11} /> {error}
        </p>
      )}

      {/* ── Footer buttons — only show on step 2 ── */}
      {selectedOrder && !loadingItems && (
        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || Object.keys(returnItems).length === 0}
            className={`px-4 py-2 text-sm text-white rounded-lg transition ${
              submitting || Object.keys(returnItems).length === 0
                ? "bg-gray-300 cursor-not-allowed"
                : "bg-blue-500 hover:bg-blue-600"
            }`}
          >
            {submitting ? "Submitting..." : "Submit Return Request"}
          </button>
        </div>
      )}

    </ModalWrapper>
  );
};

// ── 🔄 Employee Return Modal (for System chat) ────────────────────────────────
const EmployeeReturnModal = ({ activeConv, onClose, onSuccess }) => {
  const [consumers, setConsumers]         = useState([]);
  const [selectedConsumer, setSelectedConsumer] = useState(null);
  const [orders, setOrders]               = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [returnItems, setReturnItems]     = useState({});
  const [loading, setLoading]             = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [loadingItems, setLoadingItems]   = useState(false);
  const [submitting, setSubmitting]       = useState(false);
  const [error, setError]                 = useState("");

  const RETURN_REASONS = [
    "Damaged Product",
    "Wrong Item Delivered",
    "Quality Issue",
    "Changed Mind",
    "Duplicate Order",
    "Other",
  ];

  // ✅ Step 1: Fetch consumers from system chat
  useEffect(() => {
    const fetchConsumers = async () => {
      try {
        const res = await apiFetch(`/api/customers/consumers/`);
        setConsumers(res.consumers || []);
      } catch (err) {
        console.error("Failed to fetch consumers:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchConsumers();
  }, []);

  // ✅ Step 2: Fetch completed orders for selected consumer
  const handleConsumerSelect = async (consumer) => {
    setSelectedConsumer(consumer);
    setLoadingOrders(true);
    setOrders([]);
    try {
      const res = await apiFetch(
        `/api/customers/${consumer.customer_id}/accepted-orders/`
      );
      setOrders(res.orders || []);
    } catch (err) {
      setError("Failed to load orders for this consumer.");
    } finally {
      setLoadingOrders(false);
    }
  };

  // ✅ Step 3: Fetch items for selected order
  const handleOrderSelect = async (order) => {
    setLoadingItems(true);
    setReturnItems({});
    try {
      const res = await apiFetch(`/api/orders/${order.order_id}/accept/`);
      setSelectedOrder({ ...order, items: res.items });
    } catch (err) {
      setError("Failed to load order items.");
    } finally {
      setLoadingItems(false);
    }
  };

  const handleItemToggle = (idx, item) => {
    const key = `${selectedOrder?.order_id}_${idx}`;
    setReturnItems(prev => {
      if (prev[key]) {
        const updated = { ...prev };
        delete updated[key];
        return updated;
      }
      return { ...prev, [key]: { item, qty: 1, reason: "" } };
    });
  };

  const handleQtyChange = (key, qty) => {
    setReturnItems(prev => ({
      ...prev,
      [key]: { ...prev[key], qty: parseInt(qty) || 1 }
    }));
  };

  const handleReasonChange = (key, reason) => {
    setReturnItems(prev => ({
      ...prev,
      [key]: { ...prev[key], reason }
    }));
  };

  const handleSubmit = async () => {
    const selectedItems = Object.entries(returnItems);
    if (!selectedOrder || selectedItems.length === 0) {
      setError("Please select at least one item to return.");
      return;
    }
    if (selectedItems.some(([, v]) => !v.reason)) {
      setError("Please select a reason for each item.");
      return;
    }

    // ✅ Find the conv_id for this order from system chat orders
    const matchingOrder = activeConv.orders?.find(
      o => o.order_id === selectedOrder.order_id
    );
    const conversationId = matchingOrder?.conv_id;

    if (!conversationId) {
      setError("Could not find conversation for this order.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      await apiFetch(`/api/orders/${selectedOrder.order_id}/return/`, {
        method: "POST",
        body: JSON.stringify({
          conversation_id: conversationId,
          items: selectedItems.map(([, v]) => ({
            item_id: v.item.item_id,
            qty:     v.qty,
            reason:  v.reason,
          })),
        }),
      });
      onSuccess?.();
    } catch (err) {
      setError("Failed to submit return request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalWrapper title="🔄 Return Items (Consumer Order)" onClose={onClose}>

      {/* ── Step 1: Select Consumer ── */}
      {loading ? (
        <p className="text-sm text-gray-400 text-center py-6">Loading consumers...</p>

      ) : !selectedConsumer ? (
        <div>
          <p className="text-xs text-gray-500 mb-2">Select the consumer whose items to return:</p>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {consumers.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">No consumers found.</p>
            ) : consumers.map((consumer) => (
              <button
                key={consumer.customer_id}
                onClick={() => handleConsumerSelect(consumer)}
                className="w-full text-left border border-gray-200 rounded-xl px-4 py-3 hover:border-[#F7941D] hover:bg-orange-50 transition"
              >
                <p className="text-sm font-medium text-gray-800">{consumer.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {consumer.totalOrders} order{consumer.totalOrders !== 1 ? "s" : ""}
                  <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded font-medium ${TYPE_COLORS[consumer.type] || "text-gray-500 bg-gray-100"}`}>
                    {consumer.type}
                  </span>
                </p>
              </button>
            ))}
          </div>
        </div>

      /* ── Step 2: Select Order ── */
      ) : !selectedOrder ? (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-gray-700">{selectedConsumer.name}</p>
            <button
              onClick={() => { setSelectedConsumer(null); setOrders([]); setError(""); }}
              className="text-xs text-[#F7941D] hover:underline"
            >
              ← Change Consumer
            </button>
          </div>
          {loadingOrders ? (
            <p className="text-sm text-gray-400 text-center py-4">Loading orders...</p>
          ) : orders.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No completed orders found.</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {orders.map((order) => (
                <button
                  key={order.order_id}
                  onClick={() => handleOrderSelect(order)}
                  className="w-full text-left border border-gray-200 rounded-xl px-4 py-3 hover:border-[#F7941D] hover:bg-orange-50 transition"
                >
                  <p className="text-sm font-medium text-gray-800">Order #{order.order_id}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {order.item_count} item{order.item_count !== 1 ? "s" : ""} · ₹{order.total_amount?.toLocaleString("en-IN")}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{order.date}</p>
                </button>
              ))}
            </div>
          )}
        </div>

      /* ── Step 3: Select Items ── */
      ) : loadingItems ? (
        <p className="text-sm text-gray-400 text-center py-6">Loading items...</p>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-gray-700">
              Order #{selectedOrder.order_id} · {selectedConsumer.name}
            </p>
            <button
              onClick={() => { setSelectedOrder(null); setReturnItems({}); setError(""); }}
              className="text-xs text-[#F7941D] hover:underline"
            >
              ← Change Order
            </button>
          </div>
          <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
            {selectedOrder.items?.map((item, idx) => {
              const key = `${selectedOrder.order_id}_${idx}`;
              const isChecked = !!returnItems[key];
              return (
                <div key={idx} className={`border rounded-xl p-3 transition ${isChecked ? "border-[#F7941D] bg-orange-50" : "border-gray-100"}`}>
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleItemToggle(idx, item)}
                      className="mt-0.5 accent-[#F7941D]"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800">{item.product_name}</p>
                      <p className="text-xs text-gray-400">Qty ordered: {item.qty}</p>
                      {isChecked && (
                        <div className="mt-2 space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 w-20">Return Qty:</span>
                            <input
                              type="number" min={1} max={item.qty}
                              value={returnItems[key]?.qty || 1}
                              onChange={(e) => handleQtyChange(key, e.target.value)}
                              className="w-16 border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-[#F7941D]"
                            />
                            <span className="text-xs text-gray-400">/ {item.qty}</span>
                          </div>
                          <select
                            value={returnItems[key]?.reason || ""}
                            onChange={(e) => handleReasonChange(key, e.target.value)}
                            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-[#F7941D]"
                          >
                            <option value="">Select reason...</option>
                            {RETURN_REASONS.map(r => <option key={r}>{r}</option>)}
                          </select>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {error && (
        <p className="text-xs text-red-400 mt-3 flex items-center gap-1">
          <AlertCircle size={11} /> {error}
        </p>
      )}

      {selectedOrder && !loadingItems && (
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || Object.keys(returnItems).length === 0}
            className={`px-4 py-2 text-sm text-white rounded-lg transition ${
              submitting || Object.keys(returnItems).length === 0
                ? "bg-gray-300 cursor-not-allowed"
                : "bg-blue-500 hover:bg-blue-600"
            }`}
          >
            {submitting ? "Submitting..." : "Submit Return Request"}
          </button>
        </div>
      )}
    </ModalWrapper>
  );
};

const OrderReceivedModal = ({ activeConv, onClose, onSuccess }) => {
  const [note, setNote]             = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState("");
 
  const orderId = activeConv?.order?.order_id ?? activeConv?.order?.Order_Id;
 
  const handleConfirm = async () => {
    try {
      setSubmitting(true);
      setError("");
      await apiFetch(`/api/orders/${orderId}/received/`, {
        method: "POST",
        body: JSON.stringify({ note: note.trim() || undefined }),
      });
      onSuccess?.();
      onClose();
    } catch (err) {
      setError("Failed to confirm receipt. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };
 
  return (
    <ModalWrapper title="✅ Confirm Order Received" onClose={onClose}>
      <div className="space-y-4">
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3">
          <p className="text-sm text-green-700 font-medium">
            Confirming receipt for Order #{orderId}
          </p>
          <p className="text-xs text-green-600 mt-1">
            This will mark the order as completed and close the delivery process.
            A new order can be placed after confirmation.
          </p>
        </div>
 
        <div>
          <label className="text-xs text-gray-500 mb-1 block">
            Note (optional)
          </label>
          <textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Received in good condition"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#F7941D] resize-none"
          />
        </div>
 
        {error && (
          <p className="text-xs text-red-400 flex items-center gap-1">
            <AlertCircle size={11} /> {error}
          </p>
        )}
      </div>
 
      <div className="flex justify-end gap-2 mt-5">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
        >
          Cancel
        </button>
        <button
          onClick={handleConfirm}
          disabled={submitting}
          className={`px-4 py-2 text-sm text-white rounded-lg transition ${
            submitting ? "bg-gray-300 cursor-not-allowed" : "bg-green-500 hover:bg-green-600"
          }`}
        >
          {submitting ? "Confirming..." : "Confirm Receipt"}
        </button>
      </div>
    </ModalWrapper>
  );
};

// ── ❓ Ask a Question Modal ────────────────────────────────────────────────────
const AskQuestionModal = ({ onClose, onSend }) => {
  const QUICK_QUESTIONS = [
    "What is the delivery timeline for my order?",
    "Can I get a bulk discount?",
    "Is this product available in a different size?",
    "What is your return policy?",
    "Can I change my order?",
    "I need a price quote for a large quantity.",
  ];

  return (
    <ModalWrapper title="❓ Ask a Question" onClose={onClose}>
      <p className="text-xs text-gray-500 mb-3">Select a common question or type your own:</p>
      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
        {QUICK_QUESTIONS.map((q) => (
          <button
            key={q}
            onClick={() => onSend(q)}
            className="w-full text-left px-3 py-2.5 text-sm text-gray-700 border border-gray-100 rounded-xl hover:border-[#F7941D] hover:bg-orange-50 transition"
          >
            {q}
          </button>
        ))}
      </div>
      <div className="flex justify-end mt-4">
        <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition">
          Cancel
        </button>
      </div>
    </ModalWrapper>
  );
};

// ── 📦 Track Order Modal ──────────────────────────────────────────────────────
const TrackOrderModal = ({ activeConv, onClose }) => {
  const [orderInfo, setOrderInfo] = useState(null);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    const fetchOrderStatus = async () => {
      try {
        if (activeConv?.order?.order_id) {
          const res = await apiFetch(`/api/orders/${activeConv.order.order_id}/accept/`);
          setOrderInfo(res);
        }
      } catch (err) {
        console.error("Failed to fetch order status:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchOrderStatus();
  }, [activeConv]);

  const STATUS_STEPS = ["pending", "completed"];
  const currentStep = orderInfo ? STATUS_STEPS.indexOf(orderInfo.status?.toLowerCase()) : -1;

  const STATUS_LABELS = {
    pending:   { label: "Order Placed",      color: "text-amber-600",  bg: "bg-amber-50",  border: "border-amber-200" },
    completed: { label: "Order Accepted",     color: "text-green-600",  bg: "bg-green-50",  border: "border-green-200" },
    cancelled: { label: "Order Cancelled",    color: "text-red-600",    bg: "bg-red-50",    border: "border-red-200"   },
  };

  const currentStatus = orderInfo?.status?.toLowerCase();
  const statusInfo    = STATUS_LABELS[currentStatus] || STATUS_LABELS["pending"];

  return (
    <ModalWrapper title="📦 Track Order" onClose={onClose}>
      {loading ? (
        <p className="text-sm text-gray-400 text-center py-6">Loading order status...</p>
      ) : !orderInfo ? (
        <p className="text-sm text-gray-400 text-center py-6">No active order found.</p>
      ) : (
        <div className="space-y-4">
          {/* Order ID + Status Badge */}
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-800">Order #{orderInfo.order_id}</p>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium border ${statusInfo.color} ${statusInfo.bg} ${statusInfo.border}`}>
              {statusInfo.label}
            </span>
          </div>

          {/* Progress bar */}
          {currentStatus !== "cancelled" && (
            <div className="flex items-center gap-2">
              {STATUS_STEPS.map((step, idx) => (
                <div key={step} className="flex items-center flex-1">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    idx <= currentStep
                      ? "bg-[#F7941D] text-white"
                      : "bg-gray-100 text-gray-400"
                  }`}>
                    {idx <= currentStep ? "✓" : idx + 1}
                  </div>
                  <p className={`text-[10px] ml-1 ${idx <= currentStep ? "text-gray-700" : "text-gray-400"}`}>
                    {idx === 0 ? "Placed" : "Accepted"}
                  </p>
                  {idx < STATUS_STEPS.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-2 ${idx < currentStep ? "bg-[#F7941D]" : "bg-gray-200"}`} />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Order Items */}
          <div>
            <p className="text-xs text-gray-500 mb-1">Items</p>
            <div className="space-y-1">
              {orderInfo.items?.map((item, i) => (
                <div key={i} className="flex justify-between text-xs text-gray-600">
                  <span>{item.product_name} × {item.qty}</span>
                  <span>₹{item.line_total?.toLocaleString("en-IN")}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Total */}
          <div className="flex justify-between text-sm border-t border-gray-100 pt-3">
            <span className="text-gray-500">Total Amount</span>
            <span className="font-semibold text-gray-800">₹{orderInfo.total_amount?.toLocaleString("en-IN")}</span>
          </div>
        </div>
      )}
      <div className="flex justify-end mt-5">
        <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition">
          Close
        </button>
      </div>
    </ModalWrapper>
  );
};

// ── Main Page ──────────────────────────────────────────────────────────────────

const Messages = () => {
  const [conversations, setConversations]   = useState([]);
  const [activeConv, setActiveConv]         = useState(null);
  const [chatMessages, setChatMessages]     = useState([]);
  const [orderRequest, setOrderRequest]     = useState(null);
  const [searchQuery, setSearchQuery]       = useState("");
  const [message, setMessage]               = useState("");
  const [modal, setModal]                   = useState(null);
  const [showDetails, setShowDetails]       = useState(false);
  const [loadingConvs, setLoadingConvs]     = useState(true);
  const [loadingMsgs, setLoadingMsgs]       = useState(false);
  const [quickAction, setQuickAction] = useState(null); 

  const [userRole, setUserRole] = useState(null);
  const [actualUserRole, setActualUserRole] = useState(null);
  const [translatedMsgs, setTranslatedMsgs] = useState({});

  const translateMessage = async (msgId, text) => {
    try {
      const targetLang = localStorage.getItem("language") || "en";
      if (targetLang === "en") return; // already English

      const res = await fetch(
        `https://translation.googleapis.com/language/translate/v2?key=YOUR_API_KEY`,
        {
          method: "POST",
          body: JSON.stringify({
            q: text,
            target: targetLang,
            format: "text",
          }),
          headers: { "Content-Type": "application/json" },
        }
      );
      const data = await res.json();
      const translated = data?.data?.translations?.[0]?.translatedText;
      if (translated) {
        setTranslatedMsgs(prev => ({ ...prev, [msgId]: translated }));
      }
    } catch (err) {
      console.error("Translation failed:", err);
    }
  };

  const isSystemChat = activeConv?.id === "system";
  const order = activeConv?.order;

  const canEmployeeRecord =
  userRole === "Employee" &&
  isSystemChat &&
  order &&  // ✅ Just check if order exists
  order?.payment_status !== "full";  // ✅ Remove conv_status check

  // retailer/builder/dealer/plumber flow (their own chat, accepted)
  const canDeferredUserRecord =
    DEFERRED_TYPES.has(actualUserRole) &&
    !isSystemChat &&
    order &&  // ✅ Just check if order exists
    order?.payment_status !== "full";  // ✅ Remove conv_status check

  const canRecordPayment = canEmployeeRecord || canDeferredUserRecord;

  console.log("userRole:", userRole);
  console.log("actualUserRole:", actualUserRole);
  console.log("DEFERRED_TYPES.has(actualUserRole):", DEFERRED_TYPES.has(actualUserRole));
  console.log("order:", order);
  console.log("canDeferredUserRecord:", canDeferredUserRecord);

  useEffect(() => {
    const fetchUserData = async () => {
      const data = await getUserInfo();
      if (data && !data.isRateLimited) {
        setUserRole(data.user_role);
      }
      const actualRole = await getActualUserRole();
      if (actualRole) {
        setActualUserRole(actualRole);
      }
    };
    fetchUserData();
  }, []);

  // ── Step 1: Fetch conversation list on mount ──────────────────────────────
  // ✅ Extract as standalone function
  const fetchConversations = async () => {
    try {
        const res  = await apiFetch("/api/messages/conversations/");
        const data = res.conversations || [];
        setConversations(data);

        setActiveConv((prev) => {
            if (!prev) return prev;
            const updated = data.find((c) => c.id === prev.id);
            return updated || prev;
        });

        return data; // ✅ return data so init() can use it
    } catch (err) {
        console.error("Failed to fetch conversations:", err);
        return [];
    }
  };

  useEffect(() => {
      const params = new URLSearchParams(window.location.search);
      const convIdFromUrl = params.get("conversation_id");

      const init = async () => {
          try {
              setLoadingConvs(true);

              const data = await fetchConversations(); // ✅ reuse, no duplicate call

              if (convIdFromUrl) {
                  const match = data.find((c) => String(c.id) === String(convIdFromUrl));
                  if (match) {
                      setActiveConv(match);
                      fetchMessages(match.id);
                  }
              } else if (data.length > 0) {
                  setActiveConv(data[0]);
                  fetchMessages(data[0].id);
              }

              const prefillText = params.get("prefill");
              if (prefillText) {
                  setMessage(decodeURIComponent(prefillText));
              }
          } catch (err) {
              console.error("Failed to init:", err);
          } finally {
              setLoadingConvs(false);
          }
      };

      init();
  }, []);

  // ── Step 2: Fetch messages when a conversation is clicked ─────────────────
  const fetchMessages = async (convId) => {
    try {
      setLoadingMsgs(true);
      setChatMessages([]);
      setOrderRequest(null);
      const res = await apiFetch(`/api/messages/${convId}/`);
      setChatMessages(res.messages     || []);
      setOrderRequest(res.orderRequest || null);
      console.log(orderRequest.latest_action);
      console.log(orderRequest.order_id);
    } catch (err) {
      console.error("Failed to fetch messages:", err);
    } finally {
      setLoadingMsgs(false);
    }
  };

  const handleConvClick = async (conv) => {
    setActiveConv(conv);          // ✅ set immediately for instant UI response
    setShowDetails(false);
    fetchMessages(conv.id);
    await fetchConversations();   // ✅ then refresh to get latest status/unread
  };

  // ✅ Poll for new messages every 5 seconds when a conversation is active
  const wsRef = useRef(null);

  // ── Connect WebSocket when active conversation changes ────
  useEffect(() => {
    if (!activeConv) return;

    let isMounted = true;  // ✅ track if effect is still active

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    const ws = new WebSocket(`ws://localhost:8000/ws/messages/${activeConv.id}/`);

    ws.onopen = () => {
      console.log("WS connected:", activeConv.id);
    };

    ws.onmessage = (event) => {
      if (!isMounted) return;
      const data = JSON.parse(event.data);

      if (data.type === "new_message") {
        setChatMessages((prev) => [...prev, data]);
      }

      if (data.type === "conversation_update") {
        fetchConversations();
      }
    };

    ws.onclose = () => console.log("WS closed");
    ws.onerror = (err) => console.error("WS error:", err);

    wsRef.current = ws;

    return () => {
      isMounted = false;  // ✅ mark as unmounted
      // ✅ Delay close slightly to avoid Strict Mode double-invoke issue
      setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      }, 100);
    };
  }, [activeConv]);

  const getConvStatus = (msg) => {
    if (activeConv?.id === "system" && activeConv?.orders) {
      const match = activeConv.orders.find(o => o.order_id === msg.order_id);
      return match?.conv_status ?? msg.conv_status;
    }
    return activeConv?.order?.conv_status ?? msg.conv_status;
  };

  const filtered = conversations.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.customerName && c.customerName.toLowerCase().includes(searchQuery.toLowerCase()))
  );
  
  const handleSend = async () => {
    if (!message.trim() || !activeConv) return;

    let conversationId = activeConv.id;

    if (activeConv.id === "system" && activeConv.orders) {
      const targetOrder = activeConv.orders[0];
      if (!targetOrder) return;
      conversationId = targetOrder.conv_id;
    }

    const optimisticMsg = {
      id: Date.now(),           // ✅ temporary id
      from: userRole.toLowerCase(),
      sender_label: userRole,
      text: message.trim(),
      time: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
      messageType: "text",
      is_read: false,
      order_id: null,
      order_status: null,
      conv_status: activeConv?.order?.conv_status ?? null,
      customer_name: null,
    };

    setChatMessages((prev) => [...prev, optimisticMsg]);  // ✅ show immediately
    setMessage("");

    try {
      const res = await apiFetch(`/api/messages/send/`, {
        method: "POST",
        body: JSON.stringify({
          conversation_id: conversationId,
          message_text: optimisticMsg.text,
        }),
      });

      // ✅ Replace the optimistic message with the real one from backend
      setChatMessages((prev) =>
        prev.map((m) => m.id === optimisticMsg.id ? res.message : m)
      );
    } catch (err) {
      // ✅ Remove the optimistic message on failure
      setChatMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
      console.error("Failed to send message:", err);
    }
  };

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loadingConvs) return (
    <div className="flex h-full items-center justify-center text-gray-400 text-sm">
      Loading conversations...
    </div>
  );

  return (
    <div className="flex h-full bg-white overflow-hidden">

      {/* ── LEFT: Conversation List ─────────────────────────── */}
      <div className="w-[300px] flex-shrink-0 border-r border-gray-200 flex flex-col bg-white">
        <div className="px-3 py-3 border-b border-gray-100">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search contacts..."
              className="w-full pl-8 pr-3 py-2 bg-gray-50 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[#F7941D] border border-gray-100"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="text-xs text-gray-400 text-center mt-10">No conversations found</p>
          ) : (
            filtered.map((conv) => (
              <ConversationItem
                key={conv.id}
                conv={conv}
                isActive={activeConv?.id === conv.id}
                onClick={() => handleConvClick(conv)}
                userRole={userRole}
              />
            ))
          )}
        </div>
      </div>

      {/* ── CENTER: Chat Window ─────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-gray-200">

        {activeConv ? (
          <>
            {/* Chat Header */}
            <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between bg-white">
              <div>
                <p className="text-sm font-medium text-gray-800">{activeConv.name}</p>
                <p className="text-[10px] text-gray-400">{activeConv?.order?.conv_status}</p>
                {activeConv.customerName && (
                  <p className="text-[11px] text-gray-400">{activeConv.customerName}</p>
                )}
                {userRole === "Employee" && activeConv.type !== "direct" && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${TYPE_COLORS[activeConv.type] || "text-gray-500 bg-gray-100"}`}>
                    {activeConv.type}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {(userRole === "Employee" && !activeConv?.isDirect || 
                    (userRole === "Owner" && (
                      activeConv?.order?.conv_status === "order forwarded" ||
                      activeConv?.orders?.some(o => o.conv_status === "order forwarded")
                    ))
                  ) && (
                    <button
                      onClick={() => setShowDetails((prev) => !prev)}
                      className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition ${
                        showDetails
                          ? "bg-[#F7941D] text-white border-[#F7941D]"
                          : "text-[#F7941D] border-[#F7941D] hover:bg-orange-50"
                      }`}
                    >
                      <User size={13} />
                      {showDetails
                        ? (activeConv?.id === "system" ? "Hide Consumers" : "Hide Details")
                        : (activeConv?.id === "system" ? "Final Consumer Details" : "Customer Details")
                      }
                    </button>
                  )}
                  {userRole === "Employee" && activeConv?.id === "system" && (
                    <button
                      onClick={() => setQuickAction("employee_return")}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 transition"
                    >
                      🔄 Return Items
                    </button>
                  )}
                <button className="p-1.5 text-gray-400 hover:text-gray-600 transition">
                  <MoreVertical size={17} />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 bg-gray-50">
              {loadingMsgs ? (
                <div className="flex justify-center items-center h-full text-gray-400 text-sm">
                  Loading messages...
                </div>
              ) : chatMessages.length === 0 ? (
                <div className="flex justify-center items-center h-full text-gray-400 text-sm">
                  No messages yet
                </div>
              ) : (
                chatMessages.map((msg) => {
                  if (msg.from === "system") {
                    // ✅ Pick color based on message type
                    const isAccepted    = msg.messageType === "order_accepted";
                    const isRejected    = msg.messageType === "rejected";
                    const isPayment     = msg.messageType === "payment_recorded";
                    const isPacked      = msg.messageType === "order_packed";
                    const isLoaded      = msg.messageType === "order_loaded";
                    const isOnTheWay    = msg.messageType === "order_on_the_way";
                    const isDelayed     = msg.messageType === "order_delayed";
                    const isResumed     = msg.messageType === "order_resumed";
                    const isReceived    = msg.messageType === "order_received";

                    const bubbleClass =
                      isAccepted    ? "bg-green-50 text-green-700 border border-green-200"
                      : isRejected  ? "bg-red-50 text-red-700 border border-red-200"
                      : isPayment   ? "bg-blue-50 text-blue-700 border border-blue-200"
                      : isDelayed   ? "bg-red-50 text-red-700 border border-red-200"
                      : isResumed   ? "bg-amber-50 text-amber-700 border border-amber-200"
                      : isReceived  ? "bg-green-50 text-green-700 border border-green-200"
                      : isPacked || isLoaded || isOnTheWay
                                    ? "bg-purple-50 text-purple-700 border border-purple-200"
                      : "bg-gray-100 text-gray-400";

                    const icon =
                      isAccepted  ? "✅"
                      : isRejected ? "❌"
                      : isPayment  ? "💰"
                      : isDelayed  ? "⚠️"
                      : isResumed  ? "🔄"
                      : isReceived ? "📦"
                      : isPacked   ? "📦"
                      : isLoaded   ? "🚛"
                      : isOnTheWay ? "🛣️"
                      : "🔔";

                    return (
                      <div key={msg.id} className="flex flex-col items-center gap-2">
                        <div className={`flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-full italic ${bubbleClass}`}>
                          {icon} {msg.text}
                        </div>

                        {/* ✅ Action buttons — only for pending order_received messages */}
                        {msg.messageType === "order_request" &&          // ✅ correct message type
                          msg.is_actionable === true &&                   // ✅ boolean check
                          (
                            (userRole === "Employee" && getConvStatus(msg) !== "order forwarded") ||
                            (userRole === "Owner" && getConvStatus(msg) === "order forwarded")
                          ) && (
                          <div className="flex flex-wrap justify-center gap-2 mt-1">
                            <button
                              onClick={() => { setOrderRequest({ order_id: msg.order_id }); setModal("accept"); }}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 text-white text-xs rounded-lg hover:bg-green-600 transition">
                              <Check size={13} /> Accept
                            </button>
                            <button
                              onClick={() => { setOrderRequest({ order_id: msg.order_id }); setModal("reject"); }}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 text-white text-xs rounded-lg hover:bg-red-600 transition">
                              <X size={13} /> Reject
                            </button>
                            {userRole === "Employee" && getConvStatus(msg) !== "order forwarded" && (
                              <button
                                onClick={() => { setOrderRequest({ order_id: msg.order_id }); setModal("forward"); }}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 text-white text-xs rounded-lg hover:bg-blue-600 transition">
                                <Forward size={13} /> Forward to Owner
                              </button>
                            )}
                            <button
                              onClick={() => setMessage("Please share the size/brand/quantity details.")}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-200 text-gray-700 text-xs rounded-lg hover:bg-gray-300 transition">
                              <MessageSquare size={13} /> Ask Details
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  }
                  
                  const isOwnMessage = userRole && msg.from === userRole.toLowerCase();
                  return (
                    <div key={msg.id} className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}>
                      <div className={`translate-content max-w-[70%] px-4 py-2.5 rounded-2xl text-sm ${
                        isOwnMessage
                          ? "bg-[#F7941D] text-white rounded-br-sm"
                          : "bg-white text-gray-800 shadow-sm rounded-bl-sm border border-gray-100"
                      }`}>
                        {/* ✅ Show sender label for Owner viewing forwarded chat */}
                        {userRole === "Owner" && !isOwnMessage && (
                          <p className="text-[10px] font-semibold mb-1 capitalize" style={{
                            color: msg.from === "employee" ? "#6366f1" : "#F7941D"
                          }}>
                            {msg.sender_label}
                          </p>
                        )}
                        <div className="translate-content">
                          <p>{translatedMsgs[msg.id] || msg.text}</p>
                        </div>
                        {localStorage.getItem("language") !== "en" && (
                          <button
                            onClick={() => {
                              if (translatedMsgs[msg.id]) {
                                // ✅ Toggle back to original
                                setTranslatedMsgs(prev => {
                                  const updated = { ...prev };
                                  delete updated[msg.id];
                                  return updated;
                                });
                              } else {
                                translateMessage(msg.id, msg.text);
                              }
                            }}
                            className="text-[9px] text-blue-400 hover:underline mt-0.5"
                          >
                            {translatedMsgs[msg.id] ? "Show original" : "Translate"}
                          </button>
                        )}
                        <p className={`text-[10px] mt-1 text-right ${isOwnMessage ? "text-orange-100" : "text-gray-400"}`}>
                          {msg.time} {isOwnMessage && <CheckCheck size={11} className="inline ml-0.5" />}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Order Request Card — only if order is still pending */}
            {/* For normal conversations — use orderRequest state as before */}
            {activeConv?.id !== "system" &&
              !activeConv?.isDirect &&
              orderRequest &&
              orderRequest.status === 'pending' &&
              !["accepted", "rejected", "order_packed", "order_loaded", "order_on_the_way", "order_received"].includes(orderRequest?.latest_action) && // ✅ use orderRequest not activeConv
              (
                (userRole === "Employee" && activeConv?.order?.conv_status !== "order forwarded") ||
                (userRole === "Owner" && activeConv?.order?.conv_status === "order forwarded")
              ) && (
              <OrderRequestCard
                orderRequest={orderRequest}
                onAccept={() => setModal("accept")}
                onReject={() => setModal("reject")}
                onForward={() => setModal("forward")}
                onAskDetails={() => setMessage("Please share the size/brand/quantity details.")}
                userRole={userRole}
              />
            )}

            {/* Message Input */}
            {activeConv?.order?.conv_status === "order forwarded" && userRole === "Employee" && !activeConv?.isDirect ? (
              <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-center gap-2">
                <Forward size={14} className="text-gray-400" />
                <p className="text-xs text-gray-400 italic">
                  This conversation has been forwarded to the Owner for review.
                </p>
              </div>
            ) : (
                  <div className="flex flex-col border-t border-gray-100 bg-white">


                    {/* ✅ Quick Actions — only for Customer roles */}
                    {userRole && !["Employee", "Owner"].includes(userRole) && (
                      <div className="px-4 pt-3 pb-1 flex flex-wrap gap-2">
                        <button
                          onClick={() => setQuickAction("place_order")}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-orange-50 text-[#F7941D] border border-orange-200 rounded-lg hover:bg-orange-100 transition"
                        >
                          🛍 Place Order
                        </button>
                        <button
                          onClick={() => setQuickAction("return_items")}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-50 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-100 transition"
                        >
                          🔄 Return Items
                        </button>
                        <button
                          onClick={() => setQuickAction("ask_question")}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-gray-50 text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-100 transition"
                        >
                          ❓ Ask a Question
                        </button>
                        <button
                          onClick={() => setQuickAction("track_order")}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-green-50 text-green-600 border border-green-200 rounded-lg hover:bg-green-100 transition"
                        >
                          📦 Track Order
                        </button>
                      </div>
                    )}

                    {canRecordPayment && (
                      <div className="px-4 pt-3 pb-1 flex flex-wrap gap-2">
                        <button
                          onClick={() => setQuickAction("record_payment")}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-orange-50 text-[#F7941D] border border-orange-200 rounded-lg hover:bg-orange-100 transition"
                        >
                          💰 Record Payment
                        </button>
                      </div>
                    )}

                    {!["Employee", "Owner"].includes(userRole) &&
                      activeConv?.id !== "system" &&
                      !activeConv?.isDirect &&
                      activeConv?.order?.latest_action === "order_on_the_way" &&
                      activeConv?.order?.order_status !== "completed" && (
                      <div className="px-4 pt-3 pb-1">
                        <button
                          onClick={() => setQuickAction("order_received")}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-green-50 text-green-600 border border-green-200 rounded-lg hover:bg-green-100 transition"
                        >
                          ✅ Order Received
                        </button>
                      </div>
                    )}

                    {/* Normal input */}
                    <div className="px-4 py-3 flex items-center gap-3">
                      <button className="text-gray-400 hover:text-gray-600 transition flex-shrink-0">
                        <Paperclip size={18} />
                      </button>
                      <input
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSend()}
                        placeholder="Type a message..."
                        className="flex-1 text-sm bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:border-[#F7941D]"
                      />
                      <button
                        onClick={handleSend}
                        className="w-9 h-9 bg-[#F7941D] rounded-xl flex items-center justify-center text-white hover:bg-[#e8860f] transition flex-shrink-0"
                      >
                        <Send size={15} />
                      </button>
                    </div>
                  </div>
                )}
          </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
              Select a conversation to start chatting
            </div>
          )}
      </div>

      {/* ── RIGHT: Customer Details Panel ── */}
      {showDetails && activeConv && (
        <CustomerDetailsPanel
          onClose={() => setShowDetails(false)}
          activeConv={activeConv}      // ✅ new
          userRole={userRole}          // ✅ new
        />
      )}

      {/* ── Modals ─────────────────────────────────────────── */}

      {/* ── Quick Action Modals ─────────────────────────────── */}
      {quickAction === "place_order" && (
        <PlaceOrderModal
          onClose={() => setQuickAction(null)}
          onSuccess={() => {
            setQuickAction(null);
            fetchConversations();
          }}
        />
      )}
      {quickAction === "return_items" && (
        <ReturnItemsModal
          activeConv={activeConv}
          onClose={() => setQuickAction(null)}
          onSuccess={() => {
            setQuickAction(null);
            fetchMessages(activeConv.id);
          }}
        />
      )}
      {quickAction === "ask_question" && (
        <AskQuestionModal
          onClose={() => setQuickAction(null)}
          onSend={(text) => {
            setMessage(text);
            setQuickAction(null);
          }}
        />
      )}
      {quickAction === "track_order" && (
        <TrackOrderModal
          activeConv={activeConv}
          onClose={() => setQuickAction(null)}
        />
      )}
      {quickAction === "employee_return" && (
        <EmployeeReturnModal
          activeConv={activeConv}
          onClose={() => setQuickAction(null)}
          onSuccess={() => {
            setQuickAction(null);
            fetchMessages(activeConv.id);
          }}
        />
      )}
      {quickAction === "record_payment" && (
        <RecordPaymentModal
          activeConv={activeConv}
          onClose={() => setQuickAction(null)}
          onSuccess={() => {
            setQuickAction(null);
            fetchMessages(activeConv.id);
            fetchConversations();
          }}
        />
      )}
      {quickAction === "order_received" && (
        <OrderReceivedModal
          activeConv={activeConv}
          onClose={() => setQuickAction(null)}
          onSuccess={() => {
            setQuickAction(null);
            fetchMessages(activeConv.id);
            fetchConversations();
          }}
        />
      )}

      {modal === "accept" && (
        <AcceptModal
          onClose={() => setModal(null)}
          orderRequest={orderRequest}
          onSuccess={() => fetchMessages(activeConv.id)}  // ✅ refresh chat after accept
        />
      )}
      {modal === "reject" && (
        <RejectModal
          onClose={() => setModal(null)}
          orderRequest={orderRequest}
          onSuccess={() => fetchMessages(activeConv.id)}  // ✅ refresh chat after reject
        />
      )}
      {modal === "forward" && (
        <ForwardModal
          onClose={() => setModal(null)}
          orderRequest={orderRequest}
          onSuccess={() => {
            fetchMessages(activeConv.id);
            fetchConversations();
          }}
        />
      )}
      
    </div>
  );
};

export default Messages;