import { useMemo } from "react";
import usersData from "./User_list";
import UserFormModal from "./UserFormModal";
import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { useRef, useState, useEffect } from "react";
import { Search, Eye, Pencil } from "lucide-react";
import { toastAlert, toastConfirm, toastPrompt } from './alerts';
import apiFetch from './utils/apiClient';

const USER_GROUPS = [
  "All User Groups",
  "Retailer",
  "Plumber",
  "Builder",
  "Dealer",
  "Employee",
];

const Users = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [userGroup, setUserGroup] = useState("All User Groups");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterdata, setfilterdata] = useState(false);
  const tableRef = useRef(null);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const navigate = useNavigate();

// Update the useEffect in Users component:
useEffect(() => {
  const el = tableRef.current;
  if (!el) return;

  const checkScroll = () => {
    setCanScrollRight(
      el.scrollLeft + el.clientWidth < el.scrollWidth - 5
    );
  };

  checkScroll();
  el.addEventListener("scroll", checkScroll);
  window.addEventListener("resize", checkScroll);

  return () => {
    el.removeEventListener("scroll", checkScroll);
    window.removeEventListener("resize", checkScroll);
  };
}, [users]); // Add users as dependency to re-check when data loads


  const handleSaveUser = async (formData, mode) => {
    // ---------------- BASIC VALIDATION ----------------
    if (!formData.username || !formData.customer_name || !formData.phone_number) {
      toastAlert("Username, Name & Phone are required", "error");
      return;
    }

    // Password required only on ADD
    if (mode === "add" && !formData.password) {
      toastAlert("Password is required", "error");
      return;
    }

    if (formData.password && formData.password !== formData.confirmPassword) {
      toastAlert("Passwords do not match", "error");
      return;
    }

    // ---------------- PAYLOAD ----------------
    const payload = {
      user_id: formData.user_id,
      username: formData.username,
      email: formData.email,
      shopName: formData.shopName,
      customer_name: formData.customer_name,
      phone_number: formData.phone_number,
      customer_address: formData.address || "",
      gst_id: formData.gstId || "",
      customer_userGroup: formData.userGroup,
      status: formData.status === "Active" || formData.status === true,
    };


    // Include password only if present
    if (formData.password) payload.password = formData.password;

    try {
      const data = await apiFetch("/api/register/", {
        method: mode === "add" ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      toastAlert(mode === "add" ? "User created!" : "User updated!", "success");
      setIsModalOpen(false);

    } catch (err) {
      console.error("Full Error Object:", err);

      // Access the .data property we just attached in apiClient.js
      const backendData = err.data;

      if (backendData && backendData.errors) {
        // This will now find {"phone_number": "Already registered"}
        Object.keys(backendData.errors).forEach((key) => {
          const msg = backendData.errors[key];
          // Handle if it's an array or string
          const cleanMsg = Array.isArray(msg) ? msg[0] : msg;
          toastAlert(`${key.replace("_", " ")}: ${cleanMsg}`, "error");
        });
      } else if (backendData && backendData.detail) {
        toastAlert(backendData.detail, "error");
      } else {
        toastAlert(err.message || "Server error", "error");
      }
    }
  };

  const scrollRight = () => {
      tableRef.current.scrollBy({
        left: 300,
        behavior: "smooth",
      });
    };

const fetchUsers = async () => {
  try {
    setLoading(true);
    const data = await apiFetch('/api/users/customers/');
    console.log('Fetched users:', data);
    const uniqueData = Array.from(new Map(data.map(item => [item.user_id, item])).values());
    console.log('Fetched unique users:', uniqueData);
    setUsers(uniqueData);
  } catch (err) {
    console.error('Fetch error:', err);
    if (err && err.code === 'session_expired') {
      // apiFetch already handled redirect, but show a friendly toast
      toastAlert('Your session has expired. Please log in again.', 'error');
      console.log('Your session has expired. Please log in again.');
    } else if (err && err.code === 'forbidden') {
      setTimeout(() => {
        toastAlert("Access denied. You don't have permission.", 'error');
        console.log("Access denied. You don't have permission.");
      }, 4000);
    } else {
      toastAlert('Could not load users from server', 'error');
    }
  } finally {
    setLoading(false);
  }
};

  useEffect(() => {
    fetchUsers();
  }, []);

  const filteredUsers = useMemo(() => {
      // If search hasn't been triggered, show all fetched users
      if (!filterdata) return users;

      return users.filter((user) => {
        const matchesGroup =
          userGroup === "All User Groups" || user.customer_type === userGroup;

        const searchableText = `
          ${user.customer_name}
          ${user.email}
          ${user.phone_number}
          ${user.customer_type}
          ${user.address}
          ${user.user_id}
        `.toLowerCase();

        const matchesSearch =
          searchQuery === "" || searchableText.includes(searchQuery.toLowerCase());

        return matchesGroup && matchesSearch;
      });
    }, [filterdata, users, userGroup, searchQuery]);

  useEffect(() => {
    if (searchQuery === "") {
      setfilterdata(false);
    }
  }, [searchQuery]);


  const resetFilters = () => {
    setUserGroup("All User Groups");
    setSearchQuery("");
  };

    // 1. Loading state
  {loading && (
    <div className="bg-white rounded-xl p-6">
      <div className="animate-pulse space-y-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-4 bg-gray-200 rounded" />
        ))}
      </div>
    </div>
  )}


  // 2. Empty state (after loading is false)
  if (users.length === 0 && !loading) {
    return (
      <div className="bg-gray-50 p-5">
        <h1 className="text-2xl font-semibold mb-4">Customers</h1>
        <div className="flex flex-col items-center justify-center h-64 bg-white rounded-xl border">
          <p className="text-gray-500">No customers found</p>
          <button 
            onClick={fetchUsers}
            className="mt-4 px-4 py-2 bg-[#F7941D] text-white rounded"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const toggleUserStatus = async (userId, currentStatus) => {
    try {
      console.log('🔄 Toggling user', userId, 'from', currentStatus, 'to', !currentStatus);
      
      const response = await apiFetch(`/api/users/toggle-status/`, {
        method: 'POST',
        body: JSON.stringify({
          is_active: !currentStatus,  // Backend expects is_active
          user_id: userId,
        }),
      });

      console.log('✅ Backend response:', response);

      if (response.success) {
        // ⬇️ Update 'status' field (matches your serializer)
        setUsers(prevUsers => 
          prevUsers.map(u => 
            u.user_id === userId 
              ? { ...u, status: !currentStatus }  // ⬅️ Update status
              : u
          )
        );
        
        toastAlert(
          `User ${!currentStatus ? 'activated' : 'deactivated'} successfully`, 
          'success'
        );
      }
    } catch (err) {
      console.error('❌ Toggle error:', err);
      
      if (err.code === 'session_expired') {
        toastAlert('Session expired. Please login again.', 'error');
      } else if (err.code === 'forbidden') {
        toastAlert("You don't have permission to change user status.", 'error');
      } else {
        toastAlert('Failed to update user status', 'error');
      }
    }
  };
  return (

      <div className="bg-gray-50 p-5">
        <h1 className="text-2xl font-semibold mb-4">Customers</h1>
        <PendingApprovalsCard onApproved={fetchUsers} />

        {/* SEARCH ROW */}
        <div className="flex flex-col sm:flex-row flex-wrap gap-3 mb-6">
          
          {/* Row 1 on Mobile: Dropdown and Search Input */}
          <div className="flex gap-2 w-full sm:w-auto flex-1">
            <select
              value={userGroup}
              onChange={(e) => setUserGroup(e.target.value)}
              className="w-1/3 sm:w-auto px-3 py-2 border bg-white border-gray-200 rounded-lg text-sm"
            >
              {USER_GROUPS.map((group) => (
                <option key={group}>{group}</option>
              ))}
            </select>

            <div className="relative flex-1">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm"
              />
            </div>
          </div>

          {/* Row 2 on Mobile: Search and Reset Buttons */}
          <div className="grid grid-cols-2 gap-2 w-full sm:w-auto">
            <button
              onClick={() => setfilterdata(true)}
              className="px-5 py-2 bg-[#F7941D] text-white rounded-lg font-medium text-sm active:scale-95 transition-transform"
            >
              Search
            </button>
            <button
              onClick={resetFilters}
              className="px-5 py-2 border bg-white border-gray-200 rounded-lg text-sm hover:bg-gray-50"
            >
              Reset Filters
            </button>
          </div>

          {/* Row 3 on Mobile: Add New User (Full Width) */}
          <button 
            onClick={() => {
              setEditUser(null);
              setIsModalOpen(true);
            }} 
            className="w-full sm:w-auto sm:ml-auto px-5 py-2 bg-white text-gray-700 border border-gray-200 rounded-lg flex items-center justify-center gap-3 font-medium hover:bg-gray-50 transition-all shadow-sm"
          >
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#F7941D] text-white text-xs font-bold">
              +
            </span>
            Add New User
          </button>
        </div>

        {/* SUMMARY CARDS */}
        <div className="hidden sm:block">
            <div className=" grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <SummaryCard label="Total Users" value={usersData.length} />
            <SummaryCard
              label="Builder"
              value={usersData.filter(u => u.customer_type === "Builder").length}
            />
            <SummaryCard
              label="Retailers"
              value={usersData.filter(u => u.customer_type === "Retailer").length}
            />
            <SummaryCard
              label="Distributors"
              value={usersData.filter(u => u.customer_type === "Distributor").length}
            />
            <SummaryCard label="Active Users" value={usersData.filter(u => u.status === "Active").length} />
          </div>
        </div>

        {/* TABLE */}
        <div className="pt-4">
          <div className="bg-white overflow-hidden relative border border-gray-200 rounded-xl">
            <div
              ref={tableRef}
              className="overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 rounded-xl"
            >
                <table className="w-full text-sm text-left border-collapse min-w-[1200px]">
                  <thead className="bg-gray-200 text-gray-600 tracking-wider">
                    <tr>
                      <th className="px-2 py-1 font-bold border-b border-gray-100 !text-left">ID</th>
                      <th className="px-2 py-1 font-bold border-b border-gray-100 !text-left min-w-[150px]">Name</th>
                      <th className="px-2 py-1 font-bold border-b border-gray-100 !text-left">Email</th>
                      <th className="px-2 py-1 font-bold border-b border-gray-100 !text-left">Phone</th>
                      <th className="px-2 py-1 font-bold border-b border-gray-100 !text-left min-w-[150px]">Shop Name</th>
                      <th className="px-2 py-1 font-bold border-b border-gray-100 !text-left">User Group</th>
                      <th className="px-2 py-1 font-bold border-b border-gray-100 !text-left min-w-[200px]">Address</th>
                      <th className="px-2 py-1 font-bold border-b border-gray-100 !text-left">Last Login</th>
                      <th className="px-2 py-1 font-bold border-b border-gray-100 text-center">Status</th>
                      <th className="px-2 py-1 font-bold border-b border-gray-100 text-right">Actions</th>
                    </tr>
                  </thead>

                  <tbody className="font-['Poppins'] text-gray-700">
                  {filteredUsers.map((user) => {
                    const isEmployee = user.customer_type === "Employee";

                    return (
                      <tr
                        key={user.user_id}  // ⬅️ FIXED
                        onMouseMove={(e) => {
                          if (!isEmployee) return;
                          const rect = e.currentTarget.getBoundingClientRect();
                          const x = e.clientX - rect.left;
                          e.currentTarget.style.setProperty('--mouse-x', `${x}px`);
                        }}
                        onClick={() => {
                          if (isEmployee) {
                            // ⬅️ FIXED with validation
                            if (!user.user_id) {
                              console.error('❌ Missing user_id:', user);
                              toastAlert('Cannot view customers: Invalid employee ID', 'error');
                              return;
                            }
                            
                            console.log('✅ Navigating to employee customers:', user.user_id);
                            navigate(`/owner/users/${user.user_id}/customers`);
                          }
                        }}
                        className={`
                          border-b border-gray-200 transition-colors relative group
                          ${isEmployee ? "cursor-pointer hover:bg-orange-50/50" : ""}
                        `}
                      >
                        <td className="px-2 py-1 font-medium">{user.user_id}</td>

                        <td className="px-2 py-1 font-semibold text-gray-900">
                          {user.customer_name}
                          
                          {/* 👇 The Tooltip is now absolute to the ROW, so it follows you everywhere */}
                          {isEmployee && (
                            <div
                              style={{ 
                                left: 'var(--mouse-x, 0px)', 
                                transform: 'translateX(-50%)' 
                              }}
                              className="
                                absolute -top-8
                                bg-gray-900 text-white
                                text-[10px]
                                px-2 py-1
                                rounded shadow-lg
                                opacity-0 
                                group-hover:opacity-100 
                                transition-opacity duration-150
                                pointer-events-none
                                whitespace-nowrap
                                z-50
                              "
                            >
                              Click to view the customer list
                              <div className="absolute left-1/2 -bottom-1 -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45" />
                            </div>
                          )}
                        </td>

                        <td className="px-2 py-2">{user.email}</td>
                        <td className="px-2 py-1 whitespace-nowrap">{user.phone_number}</td>
                        <td className="px-2 py-1 text-gray-500">{user.shopName || "N/A"}</td>
                        <td className="px-2 py-1">
                          <span className="bg-blue-50 text-blue-600 px-2 py-1 rounded-md text-[10px] font-bold">
                            {user.customer_type}
                          </span>
                        </td>
                        <td className="p-2 max-w-xs truncate">{user.address}</td>
                        <td className="p-2 text-gray-500">
                          {user.logged_in_at ? new Date(user.logged_in_at).toLocaleString() : "Never"}
                        </td>
                        {/* ⬇️ TOGGLE WITH LABEL */}
                        <td className="p-2 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="inline-flex items-center">
                            <button
                              onClick={() => toggleUserStatus(user.user_id, user.status)}  
                              className={`
                                relative inline-flex h-6 w-14 items-center rounded-full
                                transition-colors duration-200 ease-in-out focus:outline-none
                                ${user.status === true ? 'bg-[#F7941D]' : 'bg-gray-300'}  {/* ⬅️ user.status */}
                              `}
                              title={user.status ? 'Click to deactivate' : 'Click to activate'}
                            >
                              {/* Text label */}
                              <span className={`
                                absolute inset-0 flex items-center justify-center
                                text-[9px] font-bold text-white
                                ${user.status === true ? 'pr-4' : 'pl-8'}  {/* ⬅️ user.status */}
                              `}>
                                {user.status === true ? 'ON' : 'OFF'}  {/* ⬅️ user.status */}
                              </span>
                              
                              {/* Circle */}
                              <span
                                className={`
                                  inline-block h-4 w-4 transform rounded-full bg-white
                                  transition duration-200 ease-in-out shadow-md
                                  ${user.status === true ? 'translate-x-9' : 'translate-x-1'}  {/* ⬅️ user.status */}
                                `}
                              />
                            </button>
                          </div>
                        </td>
                        <td className="p-2 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-center gap-3 opacity-60 hover:opacity-100">
                            <button title="View Details" className="hover:text-[#F7941D]"><Eye size={18} /></button>
                            <button title="Edit" onClick={() => {setEditUser(user); setIsModalOpen(true);}} className="hover:text-[#F7941D]"><Pencil size={18} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  </tbody>
                </table>
            </div>

            {/* RIGHT SCROLL ARROW */}
            {canScrollRight && (
              <button
                onClick={scrollRight}
                className="absolute right-2 top-1/2 -translate-y-1/2
                          bg-white shadow-lg border rounded-full p-2
                          hover:bg-orange-500 hover:text-white transition"
                title="Scroll right"
              >
                <ChevronRight size={20} />
              </button>
            )}
            <UserFormModal
              isOpen={isModalOpen}
              onClose={() => setIsModalOpen(false)}
              mode={editUser ? "edit" : "add"}
              userData={editUser}
              onSave={handleSaveUser}
            />
          </div>
        </div>
      </div>
      
  );
};

// ── PendingApprovalsCard ──────────────────────────────────────────────────────
const PendingApprovalsCard = ({ onApproved }) => {
  const [pending, setPending]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [rejectModal, setRejectModal] = useState(null); // registration object
  const [rejectReason, setRejectReason] = useState("");
  const [processing, setProcessing] = useState({});

  const fetchPending = async () => {
    try {
      const res = await apiFetch("/api/registrations/pending/");
      setPending(res.pending || []);
    } catch (err) {
      console.error("Failed to fetch pending registrations:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPending(); }, []);

  const handleApprove = async (reg) => {
    setProcessing(prev => ({ ...prev, [reg.id]: "approving" }));
    try {
      await apiFetch(`/api/registrations/${reg.id}/approve/`, { method: "POST" });
      setPending(prev => prev.filter(r => r.id !== reg.id));
      onApproved?.();
    } catch (err) {
      console.error("Approval failed:", err);
    } finally {
      setProcessing(prev => ({ ...prev, [reg.id]: null }));
    }
  };

  const handleReject = async () => {
    if (!rejectModal) return;
    setProcessing(prev => ({ ...prev, [rejectModal.id]: "rejecting" }));
    try {
      await apiFetch(`/api/registrations/${rejectModal.id}/reject/`, {
        method: "POST",
        body: JSON.stringify({ reason: rejectReason || "Not approved at this time." }),
      });
      setPending(prev => prev.filter(r => r.id !== rejectModal.id));
      setRejectModal(null);
      setRejectReason("");
    } catch (err) {
      console.error("Rejection failed:", err);
    } finally {
      setProcessing(prev => ({ ...prev, [rejectModal?.id]: null }));
    }
  };

  if (loading) return null;
  if (pending.length === 0) return null;  // ✅ hide if no pending

  return (
    <>
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-lg">⏳</span>
          <h3 className="text-sm font-semibold text-amber-800">
            Pending Registrations ({pending.length})
          </h3>
          <span className="ml-auto text-[10px] text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">
            Owner approval required
          </span>
        </div>

        <div className="space-y-3">
          {pending.map((reg) => (
            <div key={reg.id} className="bg-white rounded-xl border border-amber-100 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-gray-800">{reg.customer_name}</p>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-50 text-orange-600 border border-orange-200">
                      {reg.customer_type}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    @{reg.username} · {reg.phone_number} · {reg.email}
                  </p>
                  {reg.shop_name && (
                    <p className="text-xs text-gray-400 mt-0.5">Shop: {reg.shop_name}</p>
                  )}
                  <p className="text-[10px] text-gray-400 mt-1">
                    Submitted: {reg.submitted_at}
                  </p>
                </div>

                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleApprove(reg)}
                    disabled={processing[reg.id]}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs text-white rounded-lg transition ${
                      processing[reg.id] === "approving"
                        ? "bg-gray-300 cursor-not-allowed"
                        : "bg-green-500 hover:bg-green-600"
                    }`}
                  >
                    ✓ {processing[reg.id] === "approving" ? "Approving..." : "Approve"}
                  </button>
                  <button
                    onClick={() => setRejectModal(reg)}
                    disabled={!!processing[reg.id]}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-white bg-red-500 hover:bg-red-600 rounded-lg transition"
                  >
                    ✕ Reject
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Reject Modal ── */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl">
            <div className="flex justify-between items-center px-5 pt-5 pb-3 border-b border-gray-100">
              <p className="text-base font-medium text-gray-800">Reject Registration</p>
              <button onClick={() => setRejectModal(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <p className="text-sm text-gray-600">
                Rejecting <strong>{rejectModal.customer_name}</strong> — this will delete their account
                and send them a rejection SMS.
              </p>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Reason (optional)</label>
                <textarea
                  rows={3}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="e.g. Incomplete information, already registered, etc."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-400 resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 pb-5">
              <button
                onClick={() => setRejectModal(null)}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={processing[rejectModal?.id]}
                className={`px-4 py-2 text-sm text-white rounded-lg transition ${
                  processing[rejectModal?.id] ? "bg-gray-300 cursor-not-allowed" : "bg-red-500 hover:bg-red-600"
                }`}
              >
                {processing[rejectModal?.id] === "rejecting" ? "Rejecting..." : "Confirm Reject"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const SummaryCard = ({ label, value }) => (
  <div className="bg-white p-4 rounded-xl shadow-sm">
    <p className="text-gray-500 text-xs">{label}</p>
    <p className="text-xl font-semibold">{value}</p>
  </div>
);

export default Users;