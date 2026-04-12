import React, { useState, useEffect } from "react";
import { X, Pencil, RotateCw, ArrowRightLeft, Plus, ArrowLeft, Search } from "lucide-react";
import apiFetch from "./utils/apiClient";
import { toastAlert } from "./alerts";

// Types that get the new ArrowRightLeft reassign drawer
const REASSIGN_TYPES = ["subcategory", "brand"];

const ManageAttributeModal = ({ type, data = [], onClose, categories, 
  subcategories, 
  brands, refreshData }) => {
    const [newName, setNewName] = useState("");
    const [editingId, setEditingId] = useState(null);
    const [editingValue, setEditingValue] = useState("");
    const [replaceMode, setReplaceMode] = useState(null); // Stores the ID of the item being replaced

    // ── NEW: reassign drawer state ─────────────────────────────────────────
    const [reassignItem, setReassignItem] = useState(null); // { id, name }
    const [drawerSearch, setDrawerSearch] = useState("");
    const [reassigning, setReassigning]   = useState(false);
    const [selectedTargetIds, setSelectedTargetIds] = useState([]);

    // Reset selections when reassignItem changes
    useEffect(() => {
        setSelectedTargetIds([]);
    }, [reassignItem]);

    const toggleTargetId = (id) => {
        setSelectedTargetIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const dataMap = {
        category: categories,
        subcategory: subcategories,
        brand: brands
    };

    const titleMap = {
        category: "Manage Product Categories",
        subcategory: "Manage Product Subcategories",
        brand: "Manage Product Brands"
    };

    // Drawer config: what list to show and how to label each option
    const drawerConfig = {
        subcategory: {
            drawerTitle:    "Select New Category",
            drawerSubtitle: "This subcategory will be moved to the selected category.",
            options:        categories,
            getLabel:       (item) => item.category,
        },
        brand: {
            drawerTitle:    "Select New Subcategory",
            drawerSubtitle: "All existing subcategory mappings for this brand will be replaced.",
            options:        subcategories,
            getLabel:       (item) => item.name || item.sub_category,
        },
    };

    const currentData = dataMap[type] || [];

    // ── Existing: add ─────────────────────────────────────────────────────
    const handleAdd = async () => {
    if (!newName.trim()) return;

    try {
      await apiFetch("/api/manage-attribute/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          action: "add",
          name: newName
        })
      });

      toastAlert(`${type} added successfully`, "success");
      setNewName("");
      refreshData();
    } catch (err) {
      toastAlert("Failed to add", "error");
    }
  };

    // ── Existing: replace/migrate ─────────────────────────────────────────
    const handleReplaceSubmit = async (targetId) => {
        if (replaceMode === targetId) {
            toastAlert("Source and Target cannot be the same", "error");
            return;
        }

        try {
            await apiFetch("/api/manage-attribute/", {
                method: "POST",
                body: JSON.stringify({
                    type,
                    action: "replace",
                    id: replaceMode,
                    target_id: targetId
                })
            });
            toastAlert("Success! All relations migrated.", "success");
            setReplaceMode(null);
            refreshData();
        } catch (err) {
            toastAlert("Migration failed", "error");
        }
    };

    // ── NEW: reassign (subcategory→category / brand→subcategory) ──────────
    const handleReassign = async (targetId = null) => {
        if (!reassignItem) return;

        const isBrand = type === "brand";

        if (isBrand && selectedTargetIds.length === 0) {
            toastAlert("Select at least one subcategory", "error");
            return;
        }

        const payload = isBrand
            ? { type, id: reassignItem.id, target_ids: selectedTargetIds }
            : { type, id: reassignItem.id, target_id: targetId };

        setReassigning(true);
        try {
            const res = await apiFetch("/api/reassign-attribute/", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (res?.success === false) {
                toastAlert(res.error || "Reassignment failed", "error");
                return;
            }

            // ✅ Show success first, then close/reset
            toastAlert(res?.message || "Reassigned successfully!", "success");
            setReassignItem(null);
            setSelectedTargetIds([]);
            setDrawerSearch("");

            // ✅ Refresh separately — errors here won't trigger "Reassignment failed"
            try {
                await refreshData();
            } catch (refreshErr) {
                console.error("Refresh failed after reassign:", refreshErr);
            }

        } catch (err) {
            console.error("Reassign error:", err);
            toastAlert("Reassignment failed", "error");
        } finally {
            setReassigning(false);
        }
    };

    const closeDrawer = () => { setReassignItem(null); setDrawerSearch(""); };

    // Filtered options for the drawer search
    const drawerOptions = REASSIGN_TYPES.includes(type)
        ? (drawerConfig[type]?.options || []).filter((opt) =>
            drawerConfig[type].getLabel(opt)?.toLowerCase().includes(drawerSearch.toLowerCase())
          )
        : [];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">

      {/* ── Main Modal — original markup, only ArrowRightLeft button added ── */}
      <div className={`w-full max-w-md bg-white rounded-xl shadow-2xl overflow-hidden animate-in zoom-in duration-200 transition-all ${
        reassignItem ? "-translate-x-16 opacity-50 scale-95 pointer-events-none select-none" : ""
      }`}>
        
        {/* Header - Matching the Image */}
        <div className="px-6 py-4 flex justify-between items-center border-b bg-white">
          <h2 className="text-md font-bold text-gray-800">{titleMap[type]}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="p-6">
        {/* Add New Input Group */}
        <div className="flex gap-2 mb-6">
            <input
            type="text"
            placeholder={`New ${type} name`}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 outline-none placeholder:text-gray-300"
            />
            <button
            onClick={handleAdd}
            className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 flex items-center gap-1 transition-all"
            >
            <Plus size={14} /> Add
            </button>
        </div>

        {/* --- CURRENT LIST LAYER --- */}
        <div className="border-t border-gray-100 pt-2">
            <p className="text-[10px] uppercase font-bold text-gray-400 mb-2 px-2 tracking-wider">
            Current {type}s
            </p>
            <div className="space-y-1 max-h-60 overflow-y-auto pr-1">
            {currentData.length > 0 ? (
                <>
                {currentData.map((item) => (
                    <div key={item.id} className="flex items-center justify-between py-2 px-2 border-b border-gray-50">
                    <span className="text-sm font-medium text-gray-700">
                        {item.category || item.name || item.brand}
                    </span>

                    {replaceMode ? (
                        // Existing replace mode — unchanged
                        item.id !== replaceMode && (
                        <button
                            onClick={() => handleReplaceSubmit(item.id)}
                            className="text-[10px] bg-green-50 text-green-600 px-2 py-1 rounded border border-green-200 hover:bg-green-100 transition-all"
                        >
                            Move Data Here
                        </button>
                        )
                    ) : (
                        // Normal Mode
                        <div className="flex gap-3">
                        
                        {/* Existing Pencil — unchanged */}
                        <button onClick={() => setEditingId(item.id)} className="text-gray-400 hover:text-blue-500 transition-colors">
                            <Pencil size={14} />
                        </button>

                        {/* Existing RotateCw — unchanged */}
                        <button
                            onClick={() => setReplaceMode(item.id)}
                            className="text-red-400 hover:text-red-600 transition-colors"
                            title="Replace / migrate data"
                        >
                            <RotateCw size={14} />
                        </button>

                        {/* NEW: ArrowRightLeft — only for subcategory and brand */}
                        {REASSIGN_TYPES.includes(type) && (
                            <button
                                onClick={() => setReassignItem({
                                    id: item.id,
                                    name: item.category || item.name || item.sub_category || item.brand
                                })}
                                className="text-indigo-400 hover:text-indigo-600 transition-colors"
                                title={
                                    type === "subcategory"
                                        ? "Reassign to a different category"
                                        : "Reassign to a different subcategory"
                                }
                            >
                                <ArrowRightLeft size={14} />
                            </button>
                        )}
                        </div>
                    )}
                    </div>
                ))}

                {/* This button stays inside the 'currentData exists' block */}
                {replaceMode && (
                    <button
                    onClick={() => setReplaceMode(null)}
                    className="w-full mt-2 py-2 text-[10px] text-gray-500 bg-gray-50 rounded hover:bg-gray-100 underline transition-all"
                    >
                    Cancel Selection
                    </button>
                )}
                </>
            ) : (
                <div className="p-4 text-center text-xs text-gray-400 italic">
                No {type}s found.
                </div>
            )}
            </div>
        </div>

        {/* Footer Note */}
        <div className="mt-6 pt-4 border-t">
            <p className="text-[11px] leading-relaxed text-gray-400 italic">
            Note: Replacing a {type} name will automatically update all existing products linked to it across the entire database.
            </p>

            <div className="flex justify-end gap-2 mt-4">
            <button onClick={onClose} className="px-4 py-2 bg-gray-100 text-gray-600 text-xs font-bold rounded-lg hover:bg-gray-200 transition-all">
                Cancel
            </button>
            <button onClick={onClose} className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 shadow-md transition-all">
                Save Changes
            </button>
            </div>
        </div>
        </div>
      </div>

      {/* ── NEW: Reassign Side Drawer — only mounts when reassignItem is set ── */}
      {reassignItem && REASSIGN_TYPES.includes(type) && (
        <div
          className="absolute w-72 bg-white rounded-xl shadow-2xl border border-gray-100 flex flex-col overflow-hidden animate-in slide-in-from-right duration-200"
          style={{
            right: "calc(50% - 22rem)",
            top: "50%",
            transform: "translateY(-50%) translateX(100%)",
            maxHeight: "460px",
          }}
        >
          {/* Drawer Header */}
          <div className="px-4 py-3 border-b flex items-center gap-2">
            <button onClick={closeDrawer} className="text-gray-400 hover:text-gray-700 transition-colors">
              <ArrowLeft size={15} />
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-gray-800">{drawerConfig[type].drawerTitle}</p>
              <p className="text-[10px] text-gray-400 truncate mt-0.5">
                Moving: <span className="font-semibold text-indigo-600">{reassignItem.name}</span>
              </p>
            </div>
            <button onClick={closeDrawer} className="text-gray-300 hover:text-gray-600 transition-colors">
              <X size={15} />
            </button>
          </div>

          {/* Warning Banner */}
          <div className="px-4 py-2 bg-amber-50 border-b border-amber-100">
            <p className="text-[10px] text-amber-700 leading-relaxed">{drawerConfig[type].drawerSubtitle}</p>
          </div>

          {/* Search */}
          <div className="px-4 py-2.5 border-b">
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" />
              <input
                autoFocus
                type="text"
                placeholder="Search..."
                value={drawerSearch}
                onChange={(e) => setDrawerSearch(e.target.value)}
                className="w-full pl-7 pr-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-indigo-400 outline-none"
              />
            </div>
          </div>

          {/* Options list */}
          <div className="flex-1 overflow-y-auto py-1">
              {drawerOptions
                  .filter(opt => opt.name.toLowerCase().includes(drawerSearch.toLowerCase()))
                  .map(opt => {
                      const isBrand = type === "brand";
                      const isChecked = selectedTargetIds.includes(opt.id);

                      return (
                          <div
                              key={opt.id}
                              onClick={() => isBrand ? toggleTargetId(opt.id) : handleReassign(opt.id)}
                              className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors text-sm
                                  ${isBrand && isChecked
                                      ? "bg-indigo-50 text-indigo-700 font-medium"
                                      : "text-gray-700 hover:bg-gray-50"
                                  }`}
                          >
                              {isBrand && (
                                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all
                                      ${isChecked
                                          ? "bg-indigo-500 border-indigo-500"
                                          : "border-gray-300"
                                      }`}
                                  >
                                      {isChecked && (
                                          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                          </svg>
                                      )}
                                  </div>
                              )}
                              <span>{opt.name}</span>
                          </div>
                      );
                  })
              }
          </div>

          {/* Confirm button — only shown for brand */}
          {type === "brand" && (
              <div className="px-4 py-3 border-t border-gray-100">
                  <button
                      onClick={() => handleReassign()}
                      disabled={reassigning || selectedTargetIds.length === 0}
                      className="w-full py-2 bg-indigo-500 text-white text-xs font-bold rounded-lg hover:bg-indigo-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                      {reassigning
                          ? "Saving..."
                          : `Assign ${selectedTargetIds.length > 0 ? `(${selectedTargetIds.length})` : ""} Subcategor${selectedTargetIds.length === 1 ? "y" : "ies"}`
                      }
                  </button>
              </div>
          )}

          {/* Drawer Footer */}
          <div className="px-4 py-2.5 border-t bg-gray-50">
            <button
              onClick={closeDrawer}
              className="w-full py-1.5 text-xs text-gray-500 bg-white rounded-lg border border-gray-200 hover:bg-gray-100 transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageAttributeModal;