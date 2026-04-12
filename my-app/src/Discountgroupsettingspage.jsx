import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Tag, Layers, ShoppingBag, Plus, X,
  Search, ChevronRight, Percent, AlertCircle, Check
} from "lucide-react";
import apiFetch from "./utils/apiClient";
import { toastAlert } from "./alerts";

// ─── Section panel for each association type ──────────────────────────────────
const AssociationSection = ({ title, icon: Icon, color, linked, available, type, onAdd, onRemove, getLabel }) => {
  const [showAdd, setShowAdd]     = useState(false);
  const [search, setSearch]       = useState("");
  const [removing, setRemoving]   = useState(null); // id being removed

  const filteredAvailable = available.filter(opt =>
    getLabel(opt).toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = async (opt) => {
    await onAdd(type, opt.id ?? opt.cat_id ?? opt.sub_id ?? opt.brand_id);
    setShowAdd(false);
    setSearch("");
  };

  const handleRemove = async (item) => {
    // In handleRemove inside AssociationSection:
    const targetId = item.linked_cat_id ?? item.linked_sub_id ?? item.linked_brand_id;
    setRemoving(targetId);
    await onRemove(type, targetId);
    setRemoving(null);
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Section header */}
      <div className={`px-6 py-4 flex items-center justify-between border-b border-gray-100 ${color.bg}`}>
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl ${color.icon}`}>
            <Icon size={16} className={color.iconText} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-800">{title}</h3>
            <p className="text-[11px] text-gray-400">{linked.length} linked</p>
          </div>
        </div>
        <button
          onClick={() => { setShowAdd(prev => !prev); setSearch(""); }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            showAdd
              ? "bg-gray-100 text-gray-600"
              : `${color.btn} text-white shadow-sm`
          }`}
        >
          {showAdd ? <X size={13} /> : <Plus size={13} />}
          {showAdd ? "Cancel" : "Add"}
        </button>
      </div>

      {/* Add picker dropdown */}
      {showAdd && (
        <div className="border-b border-gray-100 p-4 bg-gray-50/60">
          <div className="relative mb-3">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" />
            <input
              autoFocus
              type="text"
              placeholder={`Search ${title.toLowerCase()}...`}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 bg-white border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-orange-400 outline-none"
            />
          </div>
          <div className="max-h-40 overflow-y-auto space-y-0.5">
            {filteredAvailable.length > 0 ? (
              filteredAvailable.map(opt => (
                <button
                  key={opt.id ?? opt.cat_id ?? opt.sub_id ?? opt.brand_id}
                  onClick={() => handleAdd(opt)}
                  className="w-full text-left px-3 py-2 text-xs font-medium text-gray-700 rounded-lg hover:bg-orange-50 hover:text-orange-700 transition-all flex items-center justify-between group"
                >
                  <span>{getLabel(opt)}</span>
                  <span className="opacity-0 group-hover:opacity-100 text-orange-400 transition-opacity">
                    Link →
                  </span>
                </button>
              ))
            ) : (
              <p className="text-center text-xs text-gray-400 py-4 italic">
                {available.length === 0 ? `All ${title.toLowerCase()} already linked` : "No results found"}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Linked items list */}
      <div className="divide-y divide-gray-50">
        {linked.length === 0 ? (
          <div className="px-6 py-8 text-center">
            <p className="text-xs text-gray-400 italic">No {title.toLowerCase()} linked yet</p>
          </div>
        ) : (
          linked.map(item => {
            const targetId = item.linked_cat_id ?? item.linked_sub_id ?? item.linked_brand_id;


            const isRemoving = removing === targetId;
            return (
              <div
                key={item.id}
                className="flex items-center justify-between px-6 py-3 hover:bg-gray-50/60 transition-colors group"
              >
                <div className="flex items-center gap-2.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${color.dot}`} />
                  <span className="text-sm font-medium text-gray-700">{item.name}</span>
                </div>
                <button
                  onClick={() => handleRemove(item)}
                  disabled={isRemoving}
                  className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all disabled:opacity-50"
                  title="Remove association"
                >
                  {isRemoving ? (
                    <div className="w-3.5 h-3.5 border-2 border-red-300 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <X size={13} />
                  )}
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
const DiscountGroupSettingsPage = () => {
  const navigate = useNavigate();

  // ── Group picker state ────────────────────────────────────────────────────
  const [allGroups, setAllGroups]         = useState([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [groupSearch, setGroupSearch]     = useState("");

  // ── Associations state ────────────────────────────────────────────────────
  const [assocData, setAssocData]         = useState(null);
  const [assocLoading, setAssocLoading]   = useState(false);

  // ── Fetch all groups on mount ─────────────────────────────────────────────
  useEffect(() => {
    apiFetch("/api/discount-groups/")
      .then(res => setAllGroups(Array.isArray(res) ? res : (res?.data ?? [])))
      .catch(err => console.error("Failed to fetch groups:", err))
      .finally(() => setGroupsLoading(false));
  }, []);

  // ── Fetch associations when a group is selected ───────────────────────────
  const fetchAssociations = (discId) => {
    setAssocLoading(true);
    apiFetch(`/api/discount-groups/${discId}/associations/`)
      .then(res => setAssocData(res?.success ? res : null))
      .catch(err => console.error("Failed to fetch associations:", err))
      .finally(() => setAssocLoading(false));
  };

  const handleSelectGroup = (group) => {
    setSelectedGroup(group);
    fetchAssociations(group.disc_id);
  };

  // ── Add association ───────────────────────────────────────────────────────
  const handleAdd = async (type, targetId) => {
    try {
      const res = await apiFetch(`/api/discount-groups/${selectedGroup.disc_id}/associations/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, target_id: targetId }),
      });
      if (res?.success === false) { toastAlert(res.error || "Failed to link", "error"); return; }
      toastAlert(res?.message || "Linked!", "success");
      fetchAssociations(selectedGroup.disc_id);
    } catch {
      toastAlert("Failed to add association", "error");
    }
  };

  // ── Remove association ────────────────────────────────────────────────────
  const handleRemove = async (type, targetId) => {
    try {
      const res = await apiFetch(`/api/discount-groups/${selectedGroup.disc_id}/associations/`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, target_id: targetId }),
      });
      if (res?.success === false) { toastAlert(res.error || "Failed to remove", "error"); return; }
      toastAlert("Association removed", "success");
      fetchAssociations(selectedGroup.disc_id);
    } catch {
      toastAlert("Failed to remove association", "error");
    }
  };

  const filteredGroups = allGroups.filter(g =>
    g.name.toLowerCase().includes(groupSearch.toLowerCase())
  );

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Top bar ── */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4 sticky top-0 z-10 shadow-sm">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors font-medium"
        >
          <ArrowLeft size={16} />
          Back
        </button>
        <div className="w-px h-5 bg-gray-200" />
        <div>
          <h1 className="text-base font-bold text-gray-800">Discount Group Associations</h1>
          <p className="text-[11px] text-gray-400">
            Manage which categories, subcategories, and brands each discount group applies to
          </p>
        </div>
      </div>

      <div className="flex h-[calc(100vh-65px)]">

        {/* ── Left sidebar: group picker ── */}
        <div className="w-72 shrink-0 bg-white border-r border-gray-100 flex flex-col">
          <div className="p-4 border-b border-gray-100">
            <p className="text-[10px] uppercase font-bold text-gray-400 tracking-widest mb-3">
              Discount Groups
            </p>
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" />
              <input
                type="text"
                placeholder="Search groups..."
                value={groupSearch}
                onChange={e => setGroupSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-orange-400 outline-none"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto py-2">
            {groupsLoading ? (
              [...Array(5)].map((_, i) => (
                <div key={i} className="mx-3 mb-2 h-14 bg-gray-100 rounded-xl animate-pulse" />
              ))
            ) : filteredGroups.length === 0 ? (
              <p className="text-center text-xs text-gray-400 italic py-8">No groups found</p>
            ) : (
              filteredGroups.map(group => (
                <button
                  key={group.disc_id}
                  onClick={() => handleSelectGroup(group)}
                  className={`w-full text-left px-4 py-3 mx-0 flex items-center justify-between transition-all group ${
                    selectedGroup?.disc_id === group.disc_id
                      ? "bg-orange-50 border-r-2 border-orange-500"
                      : "hover:bg-gray-50"
                  }`}
                >
                  <div>
                    <p className={`text-sm font-semibold ${
                      selectedGroup?.disc_id === group.disc_id ? "text-orange-700" : "text-gray-700"
                    }`}>
                      {group.name}
                    </p>
                    <p className="text-[11px] text-gray-400 flex items-center gap-1 mt-0.5">
                      <Percent size={10} />
                      {group.base_percent}% base discount
                    </p>
                  </div>
                  <ChevronRight
                    size={14}
                    className={`transition-colors ${
                      selectedGroup?.disc_id === group.disc_id
                        ? "text-orange-400"
                        : "text-gray-200 group-hover:text-gray-400"
                    }`}
                  />
                </button>
              ))
            )}
          </div>
        </div>

        {/* ── Right panel: associations ── */}
        <div className="flex-1 overflow-y-auto p-6">
          {!selectedGroup ? (
            // Empty state
            <div className="h-full flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 bg-orange-50 rounded-2xl flex items-center justify-center mb-4">
                <Tag size={28} className="text-orange-300" />
              </div>
              <h2 className="text-base font-bold text-gray-700 mb-1">Select a Discount Group</h2>
              <p className="text-sm text-gray-400 max-w-xs">
                Choose a group from the left panel to view and manage its category, subcategory, and brand associations.
              </p>
            </div>
          ) : assocLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-48 bg-white rounded-2xl border border-gray-100 animate-pulse" />
              ))}
            </div>
          ) : assocData ? (
            <div className="space-y-5 max-w-3xl">

              {/* Group info banner */}
              <div className="bg-gradient-to-r from-[#F7941D] to-[#e8850a] rounded-2xl px-6 py-4 flex items-center justify-between text-white shadow-md">
                <div>
                  <p className="text-[10px] uppercase tracking-widest opacity-70 font-bold">Configuring</p>
                  <h2 className="text-lg font-bold mt-0.5">{assocData.group.name}</h2>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-widest opacity-70 font-bold">Base Discount</p>
                  <p className="text-2xl font-bold">{assocData.group.base_percent}%</p>
                </div>
              </div>

              {/* Categories */}
              <AssociationSection
                title="Categories"
                icon={Tag}
                type="category"
                color={{
                  bg:       "bg-blue-50/40",
                  icon:     "bg-blue-100",
                  iconText: "text-blue-600",
                  btn:      "bg-blue-500 hover:bg-blue-600",
                  dot:      "bg-blue-400",
                }}
                linked={assocData.associations.categories}
                available={assocData.available.categories}
                onAdd={handleAdd}
                onRemove={handleRemove}
                getLabel={opt => opt.category ?? opt.name}
              />

              {/* Subcategories */}
              <AssociationSection
                title="Subcategories"
                icon={Layers}
                type="subcategory"
                color={{
                  bg:       "bg-violet-50/40",
                  icon:     "bg-violet-100",
                  iconText: "text-violet-600",
                  btn:      "bg-violet-500 hover:bg-violet-600",
                  dot:      "bg-violet-400",
                }}
                linked={assocData.associations.subcategories}
                available={assocData.available.subcategories}
                onAdd={handleAdd}
                onRemove={handleRemove}
                getLabel={opt => opt.sub_category ?? opt.name}
              />

              {/* Brands */}
              <AssociationSection
                title="Brands"
                icon={ShoppingBag}
                type="brand"
                color={{
                  bg:       "bg-emerald-50/40",
                  icon:     "bg-emerald-100",
                  iconText: "text-emerald-600",
                  btn:      "bg-emerald-500 hover:bg-emerald-600",
                  dot:      "bg-emerald-400",
                }}
                linked={assocData.associations.brands}
                available={assocData.available.brands}
                onAdd={handleAdd}
                onRemove={handleRemove}
                getLabel={opt => opt.brand ?? opt.name}
              />

            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <AlertCircle size={32} className="text-red-300" />
              <p className="text-sm text-gray-500">Failed to load associations. Try again.</p>
              <button
                onClick={() => fetchAssociations(selectedGroup.disc_id)}
                className="px-4 py-2 bg-orange-500 text-white text-xs font-bold rounded-lg hover:bg-orange-600 transition"
              >
                Retry
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DiscountGroupSettingsPage;