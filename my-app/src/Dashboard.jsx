import { useEffect, useState } from "react";
import { FileX } from "lucide-react";
import ActiveOrdersCard from "./ActiveOrdersCard";
import { getUserInfo } from "./auth_utils";
import { useTranslation } from "./i18n";
import OverduePaymentsCard from "./OverduePaymentsCard";
import TT from "./utils/TT";

const EmptyState = ({
  title = "No Data Found",
  description = "There is no content available to show right now.",
  actionLabel,
  onAction,
}) => (
  <div className="flex items-center justify-center h-full">
    <div className="text-center max-w-md px-4">
      <div className="flex justify-center mb-4">
        <div className="h-14 w-14 rounded-full bg-gray-100 flex items-center justify-center">
          <FileX className="text-gray-400" size={28} />
        </div>
      </div>
      <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
      <p className="text-sm text-gray-500 mt-2">{description}</p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-5 px-4 py-2 bg-[#F7941D] text-white text-sm rounded-lg hover:opacity-90 transition"
        >
          {actionLabel}
        </button>
      )}
    </div>
  </div>
);

const Dashboard = () => {
  const { t } = useTranslation();
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading]  = useState(true);

  useEffect(() => {
    const fetchRole = async () => {
      const data = await getUserInfo();
      if (data && !data.isRateLimited) {
        setUserRole(data.user_role);
      }
      setLoading(false);
    };
    fetchRole();
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-full text-gray-400 text-sm">
      {t("loading")}
    </div>
  );

  // ✅ Only Employee and Owner see the active orders dashboard
  if (["Employee", "Owner"].includes(userRole)) {
    return (
      <div className="w-full p-4 space-y-4">
        <ActiveOrdersCard />
        {userRole === "Owner" && <OverduePaymentsCard />}  {/* ← Owner only */}
      </div>
    );
  }
  // ✅ All other roles (Retailer, Builder, Plumber, Dealer) see empty state
  return (
    <EmptyState
      title={<TT>nothing_here_yet</TT>}
      description={<TT>dashboard_empty_description</TT>}
      actionLabel={<TT>browse_catalogue</TT>}
      onAction={() => window.location.href = "/catalogue"}
    />
  );
};

export default Dashboard;