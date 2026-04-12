// ── PaymentsTodayCard.jsx ─────────────────────────────────────────────────────
//
// Drop into your Owner dashboard. Fetches /api/payments/today/ on mount.
// Shows total collected today, a scrollable list of individual payments,
// and color-coded payment mode badges.

import { useState, useEffect } from "react";
import { TrendingUp, ChevronRight } from "lucide-react";
import apiFetch from "./utils/apiClient";

const MODE_COLORS = {
  cash:   "text-green-700 bg-green-50 border-green-200",
  cheque: "text-blue-700 bg-blue-50 border-blue-200",
  neft:   "text-purple-700 bg-purple-50 border-purple-200",
  upi:    "text-orange-700 bg-orange-50 border-orange-200",
  other:  "text-gray-600 bg-gray-100 border-gray-200",
};

const MODE_LABELS = {
  cash:   "Cash",
  cheque: "Cheque",
  neft:   "NEFT",
  upi:    "UPI",
  other:  "Other",
};

const STATUS_COLORS = {
  full:    "text-green-600 bg-green-50",
  partial: "text-amber-600 bg-amber-50",
  due:     "text-red-600 bg-red-50",
};

const PaymentsTodayCard = () => {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const fetch_ = async () => {
      try {
        const res = await apiFetch("/api/payments/today/");
        setData(res);
      } catch (err) {
        console.error("Failed to fetch today's payments:", err);
      } finally {
        setLoading(false);
      }
    };
    fetch_();
    // Refresh every 2 minutes
    const interval = setInterval(fetch_, 120_000);
    return () => clearInterval(interval);
  }, []);

  const visiblePayments = expanded
    ? data?.payments
    : data?.payments?.slice(0, 5);

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <TrendingUp size={16} className="text-[#F7941D]" />
          <p className="text-sm font-medium text-gray-800">Payments Received Today</p>
        </div>
        {!loading && data && (
          <span className="text-xs text-gray-400">{data.count} payment{data.count !== 1 ? "s" : ""}</span>
        )}
      </div>

      {/* ── Total ── */}
      {!loading && data && (
        <div className="px-5 py-4 border-b border-gray-100 bg-orange-50">
          <p className="text-2xl font-medium text-[#F7941D]">
            ₹{data.total_today?.toLocaleString("en-IN")}
          </p>
          <p className="text-xs text-orange-400 mt-0.5">Total collected today</p>
        </div>
      )}

      {/* ── Payment list ── */}
      {loading ? (
        <p className="text-xs text-gray-400 text-center py-6">Loading...</p>
      ) : !data?.payments?.length ? (
        <p className="text-xs text-gray-400 text-center py-6">No payments recorded today.</p>
      ) : (
        <>
          <div className="divide-y divide-gray-50">
            {visiblePayments.map((p) => (
              <div key={p.payment_id} className="flex items-center gap-3 px-5 py-3">

                {/* Mode badge */}
                <span className={`text-[10px] px-2 py-0.5 rounded border font-medium flex-shrink-0 ${MODE_COLORS[p.mode] || MODE_COLORS.other}`}>
                  {MODE_LABELS[p.mode] || p.mode}
                </span>

                {/* Customer + Order */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-800 truncate">{p.customer_name}</p>
                  <p className="text-[10px] text-gray-400">
                    Order #{p.order_id} · {p.recorded_by} · {p.recorded_at}
                  </p>
                </div>

                {/* Amount */}
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-medium text-gray-800">
                    ₹{p.amount?.toLocaleString("en-IN")}
                  </p>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${STATUS_COLORS[p.payment_status]}`}>
                    {p.payment_status === "full" ? "Fully paid"
                      : p.payment_status === "partial" ? "Partial"
                      : "Due"}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Show more / less toggle */}
          {data.payments.length > 5 && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="w-full flex items-center justify-center gap-1 py-3 text-xs text-[#F7941D] hover:bg-orange-50 transition border-t border-gray-100"
            >
              {expanded ? "Show less" : `Show all ${data.payments.length} payments`}
              <ChevronRight
                size={13}
                className={`transition-transform ${expanded ? "rotate-90" : ""}`}
              />
            </button>
          )}
        </>
      )}
    </div>
  );
};

export default PaymentsTodayCard;