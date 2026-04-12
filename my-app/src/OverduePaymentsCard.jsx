// OverduePaymentsCard.jsx
import { useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";
import apiFetch from "./utils/apiClient";

const OverduePaymentsCard = () => {
  const [data, setData]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [notifying, setNotifying] = useState({});   // { order_id: "idle"|"sending"|"sent"|"error" }

  useEffect(() => {
    apiFetch("/api/payments/overdue/")
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleNotify = async (orderId) => {
    setNotifying(prev => ({ ...prev, [orderId]: "sending" }));
    try {
      await apiFetch("/api/payments/overdue/notify/", {
        method: "POST",
        body: JSON.stringify({ order_id: orderId }),
      });
      setNotifying(prev => ({ ...prev, [orderId]: "sent" }));
    } catch {
      setNotifying(prev => ({ ...prev, [orderId]: "error" }));
    }
  };

  if (loading) return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4">
      <p className="text-xs text-gray-400 text-center py-4">Loading overdue payments...</p>
    </div>
  );

  if (!data || data.count === 0) return (
    <div className="bg-white rounded-2xl border border-green-100 p-4">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center">
          <span className="text-sm">✅</span>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-700">No Overdue Payments</p>
          <p className="text-xs text-gray-400">All customer payments are up to date.</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="bg-white rounded-2xl border border-red-100 p-4">

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <AlertCircle size={16} className="text-red-500" />
          <p className="text-sm font-semibold text-gray-800">Overdue Payments</p>
        </div>
        <span className="bg-red-100 text-red-600 text-[10px] font-bold px-2 py-0.5 rounded-full">
          {data.count} order{data.count !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Orders */}
      <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
        {data.orders.map((order) => {
          const status = notifying[order.order_id];
          return (
            <div
              key={order.order_id}
              className="border border-gray-100 rounded-xl p-3 hover:border-red-100 transition"
            >
              {/* Customer & amount */}
              <div className="flex justify-between items-start mb-1">
                <div>
                  <p className="text-sm font-medium text-gray-800">{order.customer_name}</p>
                  <p className="text-[10px] text-gray-400">
                    Order #{order.order_id} · {order.order_date}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-red-500">
                    ₹{order.due_amount.toLocaleString("en-IN")}
                  </p>
                  <p className="text-[10px] text-gray-400">due</p>
                </div>
              </div>

              {/* Payment progress bar */}
              <div className="flex items-center gap-2 mb-2">
                <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                  <div
                    className="bg-amber-400 h-1.5 rounded-full"
                    style={{
                      width: `${Math.min(
                        100,
                        (order.amount_paid / order.total_amount) * 100
                      )}%`,
                    }}
                  />
                </div>
                <span className="text-[10px] text-gray-400 flex-shrink-0">
                  ₹{order.amount_paid.toLocaleString("en-IN")} paid
                </span>
              </div>

              {/* Overdue badge + WhatsApp button */}
              <div className="flex items-center justify-between">
                <span className="text-[10px] bg-red-50 text-red-500 border border-red-100 px-2 py-0.5 rounded-full">
                  ⏱ {order.months_overdue} month{order.months_overdue !== 1 ? "s" : ""} overdue
                </span>

                <button
                  onClick={() => handleNotify(order.order_id)}
                  disabled={status === "sending" || status === "sent"}
                  className={`flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg font-medium transition ${
                    status === "sent"
                      ? "bg-green-50 text-green-600 border border-green-200 cursor-default"
                      : status === "error"
                      ? "bg-red-50 text-red-500 border border-red-200"
                      : status === "sending"
                      ? "bg-gray-100 text-gray-400 cursor-wait"
                      : "bg-green-500 text-white hover:bg-green-600"
                  }`}
                >
                  {status === "sent"    ? "✓ Sent"
                   : status === "error" ? "⚠ Retry"
                   : status === "sending" ? "Sending..."
                   : "📲 WhatsApp"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default OverduePaymentsCard;