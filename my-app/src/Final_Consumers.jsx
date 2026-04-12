import { useMemo, useRef, useState, useEffect } from "react";
import { Search, Eye, Pencil, ChevronRight } from "lucide-react";
import { useParams } from "react-router-dom";
import apiFetch from "./utils/apiClient";
import { toastAlert } from "./alerts";
import ConsumerFormModal from "./ConsumerFormModal";  // ✅ import modal

const Consumers = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editUser,    setEditUser]    = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterdata,  setFilterdata]  = useState(false);
  const [consumers,   setConsumers]   = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [userRole,    setUserRole]    = useState(null);
  const tableRef = useRef(null);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const { employeeId } = useParams();

  // ── Fetch user role ──────────────────────────────────────────────────────
  useEffect(() => {
    const fetchRole = async () => {
      const data = await import("./auth_utils").then(m => m.getUserInfo());
      if (data) setUserRole(data.user_role);
    };
    fetchRole();
  }, []);

  // ── Fetch consumers ──────────────────────────────────────────────────────
  const fetchConsumers = async () => {
    try {
      setLoading(true);
      const data = await apiFetch(`/api/users/employee/consumers/`, {
        method: "POST",
        body: JSON.stringify({ userId: employeeId }),
      });
      setConsumers(data);
    } catch (err) {
      if (err.code === "session_expired") {
        toastAlert("Session expired. Please login again.", "warning");
      } else {
        toastAlert("Could not load consumers from server", "error");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchConsumers(); }, [employeeId]);

  // ── Scroll detection ─────────────────────────────────────────────────────
  useEffect(() => {
    const el = tableRef.current;
    if (!el) return;
    const check = () =>
      setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 5);
    check();
    el.addEventListener("scroll", check);
    window.addEventListener("resize", check);
    return () => {
      el.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
    };
  }, [consumers]);

  // ── Filter ───────────────────────────────────────────────────────────────
  const filteredConsumers = useMemo(() => {
    if (!filterdata) return consumers;
    return consumers.filter((c) => {
      const text = `${c.customer_name} ${c.phone_number} ${c.customer_address}`.toLowerCase();
      return searchQuery === "" || text.includes(searchQuery.toLowerCase());
    });
  }, [filterdata, searchQuery, consumers]);

  useEffect(() => {
    if (searchQuery === "") setFilterdata(false);
  }, [searchQuery]);

  // ── Save handler (create or edit) ────────────────────────────────────────
  const handleSaveConsumer = async (formData, mode) => {
    try {
      if (mode === "edit") {
        await apiFetch("/api/consumer/register/", {
          method: "PUT",
          body: JSON.stringify({
            consumer_id:      formData.consumer_id,
            customer_name:    formData.customer_name,
            phone_number:     formData.phone_number,
            gst_id:           formData.gst_id,
            customer_address: formData.customer_address,
          }),
        });
        toastAlert("Consumer updated successfully!", "success");
      } else {
        await apiFetch("/api/consumer/register/", {
          method: "POST",
          body: JSON.stringify({
            customer_name:    formData.customer_name,
            phone_number:     formData.phone_number,
            gst_id:           formData.gst_id,
            customer_address: formData.customer_address,
          }),
        });
        toastAlert("Consumer added successfully!", "success");
      }
      await fetchConsumers();  // ✅ refresh list
    } catch (err) {
      toastAlert(err?.message || "Failed to save consumer.", "error");
      throw err;  // ✅ let modal know save failed
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#F7941D]" />
      <p className="ml-4 text-gray-600">Loading consumers...</p>
    </div>
  );

  return (
    <div className="bg-gray-50 p-5">
      <h1 className="text-2xl font-semibold mb-4">Final Consumers</h1>

      {/* ── Search row ── */}
      <div className="flex flex-col gap-3 mb-6 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search consumers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg outline-none"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setFilterdata(true)}
            className="px-5 py-2 bg-[#F7941D] text-white rounded-lg text-sm"
          >
            Search
          </button>
          <button
            onClick={() => setSearchQuery("")}
            className="px-5 py-2 border bg-white border-gray-200 rounded-lg text-sm"
          >
            Reset
          </button>

          {/* ✅ Only Employee can add consumers */}
          {userRole === "Employee" && (
            <button
              onClick={() => { setEditUser(null); setIsModalOpen(true); }}
              className="px-5 py-2 bg-white text-gray-700 border border-gray-200 rounded-lg flex items-center gap-2 font-medium hover:bg-gray-50 transition shadow-sm text-sm"
            >
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#F7941D] text-white text-xs font-bold">
                +
              </span>
              Add New Consumer
            </button>
          )}
        </div>
      </div>

      {/* ── Summary ── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl shadow-sm">
          <p className="text-gray-500 text-xs">Total Consumers</p>
          <p className="text-xl font-semibold">{consumers.length}</p>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="overflow-hidden relative border border-gray-200 rounded-xl">
        <div ref={tableRef} className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse min-w-[900px]">
            <thead className="bg-gray-200 text-gray-600">
              <tr>
                <th className="px-3 py-3 font-bold">ID</th>
                <th className="px-3 py-3 font-bold">Name</th>
                <th className="px-3 py-3 font-bold">Phone</th>
                <th className="px-3 py-3 font-bold">GST ID</th>
                <th className="px-3 py-3 font-bold">Address</th>
                {/* ✅ Only show Actions column to Employee */}
                {userRole === "Employee" && (
                  <th className="px-3 py-3 font-bold text-right">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="text-gray-700">
              {filteredConsumers.length > 0 ? (
                filteredConsumers.map((con) => (
                  <tr key={con.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-3 text-gray-400 text-xs">{con.id}</td>
                    <td className="px-3 py-3 font-medium">{con.customer_name}</td>
                    <td className="px-3 py-3">{con.phone_number}</td>
                    <td className="px-3 py-3 text-gray-400 text-xs">
                      {con.gst_id || "—"}
                    </td>
                    <td className="px-3 py-3 max-w-xs truncate text-gray-500 text-xs">
                      {con.customer_address || "—"}
                    </td>
                    {/* ✅ Only Employee sees edit button */}
                    {userRole === "Employee" && (
                      <td className="px-3 py-3 text-right">
                        <div className="flex justify-end gap-3">
                          <button
                            title="Edit"
                            onClick={() => {
                              setEditUser(con);
                              setIsModalOpen(true);
                            }}
                            className="text-gray-400 hover:text-[#F7941D] transition"
                          >
                            <Pencil size={16} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={userRole === "Employee" ? 6 : 5} className="py-20 text-center">
                    <p className="text-gray-400">No consumers found.</p>
                    <button
                      onClick={fetchConsumers}
                      className="mt-3 text-[#F7941D] font-medium hover:underline text-sm"
                    >
                      Refresh
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {canScrollRight && (
          <button
            onClick={() => tableRef.current.scrollBy({ left: 300, behavior: "smooth" })}
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-white shadow-lg border rounded-full p-2 hover:bg-orange-500 hover:text-white transition"
          >
            <ChevronRight size={20} />
          </button>
        )}
      </div>

      {/* ── Modal ── */}
      <ConsumerFormModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditUser(null); }}
        mode={editUser ? "edit" : "add"}
        userData={editUser}
        onSave={handleSaveConsumer}
      />
    </div>
  );
};

export default Consumers;