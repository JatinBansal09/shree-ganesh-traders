// ── ActiveOrdersCard.jsx ──────────────────────────────────────────────────────
//
// Drop into your Employee / Owner dashboard.
// Shows all accepted-but-not-yet-completed orders.
// Employee can update status (packed → loaded → on_the_way),
// mark delayed, resume, or mark received — all from here.

import { useState, useEffect, useCallback } from "react";
import {
  ChevronDown, AlertTriangle,
  CheckCircle, RefreshCw, Truck, ArrowRight,
} from "lucide-react";
import apiFetch from "./utils/apiClient";

// ── Constants ─────────────────────────────────────────────────────────────────

const ACTION_LABELS = {
  accepted:          "Accepted",
  order_packed:      "Packed",
  order_loaded:      "Loaded",
  order_on_the_way:  "On the way",
  delayed:           "Delayed",
  order_received:    "Received",
};

const NEXT_ACTION_LABELS = {
  order_packed:     "Mark as Packed",
  order_loaded:     "Mark as Loaded",
  order_on_the_way: "Mark as On the Way",
  delayed:          "Mark as Delayed",
  resume:           "Resume Delivery",
  order_received:   "Mark as Received",
};

const STATUS_COLORS = {
  accepted:         "text-blue-700 bg-blue-50 border-blue-200",
  order_packed:     "text-purple-700 bg-purple-50 border-purple-200",
  order_loaded:     "text-purple-700 bg-purple-50 border-purple-200",
  order_on_the_way: "text-teal-700 bg-teal-50 border-teal-200",
  delayed:          "text-red-700 bg-red-50 border-red-200",
  order_received:   "text-green-700 bg-green-50 border-green-200",
};

const TYPE_COLORS = {
  Retailer:   "text-[#F7941D] bg-orange-50",
  Builder:    "text-gray-600 bg-gray-100",
  Dealer:     "text-blue-600 bg-blue-50",
  Plumber:    "text-green-600 bg-green-50",
  Employee:   "text-purple-600 bg-purple-50",  // consumer order
};

const PAYMENT_COLORS = {
  full:    "text-green-600",
  partial: "text-amber-600",
  due:     "text-red-500",
};

// ── UpdateModal ───────────────────────────────────────────────────────────────

const UpdateModal = ({ order, onClose, onSuccess }) => {
  const [selectedAction, setSelectedAction] = useState(
    order.next_valid_actions[0] || ""
  );
  const [note, setNote]         = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]       = useState("");

  const needsNote = selectedAction === "delayed";
  const isReceived = selectedAction === "order_received";

  const handleSubmit = async () => {
    if (needsNote && !note.trim()) {
      setError("A note is required when marking as delayed.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");

      const endpoint = isReceived
        ? `/api/orders/${order.order_id}/received/`
        : `/api/orders/${order.order_id}/status/`;

      const body = isReceived
        ? { note: note.trim() || undefined }
        : { action_type: selectedAction, note: note.trim() || undefined };

      await apiFetch(endpoint, {
        method: "POST",
        body: JSON.stringify(body),
      });

      onSuccess?.();
      onClose();
    } catch (err) {
      setError("Failed to update order status. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl">
        <div className="flex justify-between items-center px-5 pt-5 pb-3 border-b border-gray-100">
          <h3 className="text-base font-medium text-gray-800">
            Update Order #{order.order_id}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Customer info strip */}
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs font-medium text-gray-800">{order.customer_name}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">
              {order.items.map(i => `${i.product_name} ×${i.qty}`).join(", ")}
            </p>
          </div>

          {/* Action selector */}
          <div>
            <label className="text-xs text-gray-500 mb-1.5 block">Action</label>
            <div className="space-y-2">
              {order.next_valid_actions.map((action) => (
                <label
                  key={action}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border cursor-pointer transition ${
                    selectedAction === action
                      ? "border-[#F7941D] bg-orange-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="action"
                    value={action}
                    checked={selectedAction === action}
                    onChange={() => setSelectedAction(action)}
                    className="accent-[#F7941D]"
                  />
                  <span className="text-sm text-gray-700">
                    {NEXT_ACTION_LABELS[action] || action}
                  </span>
                  {action === "delayed" && (
                    <AlertTriangle size={13} className="text-red-400 ml-auto" />
                  )}
                  {action === "order_received" && (
                    <CheckCircle size={13} className="text-green-500 ml-auto" />
                  )}
                </label>
              ))}
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">
              Note {needsNote ? "(required)" : "(optional)"}
            </label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                selectedAction === "delayed"
                  ? "e.g. Vehicle breakdown, will deliver tomorrow"
                  : selectedAction === "resume"
                  ? "e.g. Vehicle repaired, back on route"
                  : "Any additional notes..."
              }
              className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none resize-none transition ${
                needsNote && !note.trim()
                  ? "border-red-300 focus:border-red-400"
                  : "border-gray-200 focus:border-[#F7941D]"
              }`}
            />
          </div>

          {error && (
            <p className="text-xs text-red-400 flex items-center gap-1">
              ⚠ {error}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 pb-5">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!selectedAction || submitting || (needsNote && !note.trim())}
            className={`px-4 py-2 text-sm text-white rounded-lg transition ${
              !selectedAction || submitting || (needsNote && !note.trim())
                ? "bg-gray-300 cursor-not-allowed"
                : selectedAction === "delayed"
                ? "bg-red-500 hover:bg-red-600"
                : selectedAction === "order_received"
                ? "bg-green-500 hover:bg-green-600"
                : "bg-[#F7941D] hover:bg-[#e8860f]"
            }`}
          >
            {submitting ? "Updating..." : NEXT_ACTION_LABELS[selectedAction] || "Update"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── OrderRow ──────────────────────────────────────────────────────────────────

const OrderRow = ({ order, onUpdate }) => {
  const [expanded, setExpanded] = useState(false);

  const statusClass = STATUS_COLORS[order.conv_status] || "text-gray-600 bg-gray-100 border-gray-200";
  const statusLabel = ACTION_LABELS[order.conv_status] || order.conv_status;

  return (
    <div className={`border rounded-xl overflow-hidden transition ${
      order.is_delayed ? "border-red-200" : "border-gray-100"
    }`}>
      {/* ── Main row ── */}
      <div className={`px-4 py-3 ${order.is_delayed ? "bg-red-50" : "bg-white"}`}>
        <div className="flex items-start justify-between gap-3">

          {/* Left: customer + order info */}
          <div className="flex-1 min-w-0">
            <div className="translate-content flex items-center gap-2 flex-wrap">
              <p className="text-sm font-medium text-gray-800">
                {order.customer_name}
              </p>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                TYPE_COLORS[order.customer_type] || "text-gray-500 bg-gray-100"
              }`}>
                {order.is_employee_order ? "Consumer" : order.customer_type}
              </span>
            </div>
            <p className="translate-content text-[10px] text-gray-400 mt-0.5">
              Order #{order.order_id} · {order.order_date}
              {order.expected_delivery && ` · Due ${order.expected_delivery}`}
            </p>
            {/* Items preview */}
            <p className="translate-content text-[11px] text-gray-500 mt-1 truncate">
              {order.items.slice(0, 2).map(i => `${i.product_name} ×${i.qty}`).join(", ")}
              {order.items.length > 2 && ` +${order.items.length - 2} more`}
            </p>
          </div>

          {/* Right: status badge + amount */}
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${statusClass}`}>
              {order.is_delayed ? "⚠ Delayed" : statusLabel}
            </span>
            <p className="text-xs font-medium text-gray-700">
              ₹{order.total_amount?.toLocaleString("en-IN")}
            </p>
            <span className={`text-[10px] font-medium ${PAYMENT_COLORS[order.payment_status]}`}>
              {order.payment_status === "full" ? "Paid"
                : order.payment_status === "partial" ? "Partial"
                : "Due"}
            </span>
          </div>
        </div>

        {/* ── Action buttons ── */}
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          {order.next_valid_actions.length > 0 && (
            <button
              onClick={() => onUpdate(order)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs text-white rounded-lg transition focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 ${
                order.is_delayed
                  ? "bg-amber-500 hover:bg-amber-600"
                  : order.next_valid_actions.includes("order_received")
                  ? "bg-green-500 hover:bg-green-600"
                  : "bg-[#F7941D] hover:bg-[#e8860f]"
              }`}
            >
              {order.is_delayed
                ? <><RefreshCw size={12} /> Resume</>
                : order.next_valid_actions.includes("order_received") && order.next_valid_actions.length === 1
                ? <><CheckCircle size={12} /> Mark Received</>
                : <><ArrowRight size={12} /> Update Status</>
              }
            </button>
          )}
          <button
            onClick={() => setExpanded(v => !v)}
            className="flex items-center gap-1 px-2 py-1.5 text-xs text-gray-400 hover:text-gray-600 transition focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0"
          >
            <ChevronDown size={13} className={`transition-transform ${expanded ? "rotate-180" : ""}`} />
            {expanded ? "Less" : "Details"}
          </button>
        </div>

        {/* ── Expanded items ── */}
        {expanded && (
          <div className="mt-3 pt-3 border-t border-gray-100 space-y-1">
            {order.items.map((item, i) => (
              <div key={i} className="flex justify-between text-xs text-gray-600">
                <span>{item.product_name}</span>
                <span>×{item.qty}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ── ActiveOrdersCard ──────────────────────────────────────────────────────────

const ActiveOrdersCard = () => {
  const [orders, setOrders]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [updating, setUpdating]   = useState(null);   // order being updated
  const [filter, setFilter]       = useState("all");  // all | delayed | consumer

  const fetchOrders = useCallback(async () => {
    try {
      const res = await apiFetch("/api/orders/active/");
      setOrders(res.orders || []);
    } catch (err) {
      console.error("Failed to fetch active orders:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
    // Refresh every 90 seconds
    const interval = setInterval(fetchOrders, 90_000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  const filtered = orders.filter(o => {
    if (filter === "delayed")  return o.is_delayed;
    if (filter === "consumer") return o.is_employee_order;
    return true;
  });

  const delayedCount  = orders.filter(o => o.is_delayed).length;
  const consumerCount = orders.filter(o => o.is_employee_order).length;

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Truck size={16} className="text-[#F7941D]" />
          <p className="text-sm font-medium text-gray-800">Active Orders</p>
          {orders.length > 0 && (
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
              {orders.length}
            </span>
          )}
          {delayedCount > 0 && (
            <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full flex items-center gap-1">
              <AlertTriangle size={10} /> {delayedCount} delayed
            </span>
          )}
        </div>
        <button
          onClick={fetchOrders}
          className="text-gray-400 hover:text-gray-600 transition"
          title="Refresh"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* ── Filter tabs ── */}
      {orders.length > 0 && (
        <div className="flex gap-1 px-4 pt-3">
          {[
            { key: "all",      label: `All (${orders.length})` },
            { key: "delayed",  label: `Delayed (${delayedCount})`,  hide: delayedCount === 0 },
            { key: "consumer", label: `Consumer (${consumerCount})`, hide: consumerCount === 0 },
          ]
            .filter(t => !t.hide)
            .map(tab => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`px-3 py-1 text-xs rounded-lg transition ${
                  filter === tab.key
                    ? "bg-[#F7941D] text-white"
                    : "text-gray-500 hover:bg-gray-50"
                }`}
              >
                {tab.label}
              </button>
            ))
          }
        </div>
      )}

      {/* ── Order list ── */}
      <div className="p-4 space-y-3">
        {loading ? (
          <p className="text-xs text-gray-400 text-center py-6">Loading active orders...</p>
        ) : filtered.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-6">
            {orders.length === 0
              ? "No active orders right now."
              : "No orders match this filter."}
          </p>
        ) : (
          filtered.map(order => (
            <OrderRow
              key={order.order_id}
              order={order}
              onUpdate={(o) => setUpdating(o)}
            />
          ))
        )}
      </div>

      {/* ── Update modal ── */}
      {updating && (
        <UpdateModal
          order={updating}
          onClose={() => setUpdating(null)}
          onSuccess={() => {
            setUpdating(null);
            fetchOrders();
          }}
        />
      )}
    </div>
  );
};

export default ActiveOrdersCard;