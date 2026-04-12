import React, { useState } from "react";
import { X, Plus, Pencil, Trash2, Check, AlertTriangle } from "lucide-react";
import apiFetch from "./utils/apiClient";
import { toastAlert } from "./alerts";

/**
 * DiscountGroupSettingsModal
 *
 * Props:
 *  - isOpen        : boolean
 *  - onClose       : () => void
 *  - discountGroups: [{ disc_id, name, base_percent }]
 *  - refreshData   : () => void   — call after any mutation to reload parent state
 */
const DiscountGroupSettingsModal = ({ isOpen, onClose, discountGroups = [], refreshData }) => {
  if (!isOpen) return null;

  // ── Add state ──────────────────────────────────────────────────────────────
  const [newName, setNewName]               = useState("");
  const [newPercent, setNewPercent]         = useState("");
  const [adding, setAdding]                 = useState(false);

  // ── Edit state ─────────────────────────────────────────────────────────────
  const [editingId, setEditingId]           = useState(null);
  const [editName, setEditName]             = useState("");
  const [editPercent, setEditPercent]       = useState("");
  const [saving, setSaving]                 = useState(false);

  // ── Delete confirm state ───────────────────────────────────────────────────
  // Stores disc_id of the group pending confirmation, null otherwise
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deleting, setDeleting]               = useState(false);

  // ─── Add ──────────────────────────────────────────────────────────────────
  const handleAdd = async () => {
    if (!newName.trim()) return;
    setAdding(true);
    try {
      const res = await apiFetch("/api/discount-groups/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:         newName.trim(),
          base_percent: parseFloat(newPercent) || 0.0,
        }),
      });
      if (res?.success === false) { toastAlert(res.error || "Failed to add", "error"); return; }
      toastAlert("Discount group created!", "success");
      setNewName("");
      setNewPercent("");
      refreshData();
    } catch {
      toastAlert("Failed to add discount group", "error");
    } finally {
      setAdding(false);
    }
  };

  // ─── Start editing a row ──────────────────────────────────────────────────
  const startEdit = (group) => {
    setEditingId(group.disc_id);
    setEditName(group.name);
    setEditPercent(String(group.base_percent));
    setConfirmDeleteId(null); // close any open delete confirm
  };

  // ─── Save rename / percent update ─────────────────────────────────────────
  const handleSave = async (discId) => {
    if (!editName.trim()) return;
    setSaving(true);
    try {
      const res = await apiFetch(`/api/discount-groups/${discId}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:         editName.trim(),
          base_percent: parseFloat(editPercent) || 0.0,
        }),
      });
      if (res?.success === false) { toastAlert(res.error || "Failed to save", "error"); return; }
      toastAlert("Discount group updated!", "success");
      setEditingId(null);
      refreshData();
    } catch {
      toastAlert("Failed to update discount group", "error");
    } finally {
      setSaving(false);
    }
  };

  // ─── Delete ───────────────────────────────────────────────────────────────
  const handleDelete = async (discId) => {
    setDeleting(true);
    try {
      const res = await apiFetch(`/api/discount-groups/${discId}/`, {
        method: "DELETE",
      });
      if (res?.success === false) { toastAlert(res.error || "Failed to delete", "error"); return; }
      toastAlert("Discount group deleted.", "success");
      setConfirmDeleteId(null);
      refreshData();
    } catch {
      toastAlert("Failed to delete discount group", "error");
    } finally {
      setDeleting(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in duration-200">

        {/* Header */}
        <div className="px-6 py-4 flex justify-between items-center border-b bg-white">
          <div>
            <h2 className="text-sm font-bold text-gray-800">Discount Group Settings</h2>
            <p className="text-[11px] text-gray-400 mt-0.5">Add, rename, or delete discount groups</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">

          {/* ── Add New Group ─────────────────────────────────────────────── */}
          <div>
            <p className="text-[10px] uppercase font-bold text-gray-400 tracking-widest mb-2">
              New Group
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Group name  e.g. Retailers Gold"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-orange-400 outline-none placeholder:text-gray-300"
              />
              <input
                type="number"
                placeholder="% discount"
                value={newPercent}
                min="0"
                max="100"
                step="0.1"
                onChange={(e) => setNewPercent(e.target.value)}
                className="w-28 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-orange-400 outline-none placeholder:text-gray-300"
              />
              <button
                onClick={handleAdd}
                disabled={adding || !newName.trim()}
                className="px-4 py-2 bg-[#F7941D] text-white text-xs font-bold rounded-lg hover:bg-[#e8850a] flex items-center gap-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus size={14} />
                {adding ? "Adding..." : "Add"}
              </button>
            </div>
          </div>

          {/* ── Existing Groups List ──────────────────────────────────────── */}
          <div>
            <p className="text-[10px] uppercase font-bold text-gray-400 tracking-widest mb-2">
              Existing Groups
            </p>

            <div className="border border-gray-100 rounded-xl overflow-hidden divide-y divide-gray-50 max-h-72 overflow-y-auto">
              {discountGroups.length === 0 ? (
                <div className="px-4 py-6 text-center text-xs text-gray-400 italic">
                  No discount groups found.
                </div>
              ) : (
                discountGroups.map((group) => (
                  <div key={group.disc_id}>

                    {/* ── Normal row ── */}
                    {editingId !== group.disc_id && confirmDeleteId !== group.disc_id && (
                      <div className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
                        <div>
                          <p className="text-sm font-semibold text-gray-700">{group.name}</p>
                          <p className="text-[11px] text-gray-400">{group.base_percent}% base discount</p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => startEdit(group)}
                            className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all"
                            title="Rename"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => { setConfirmDeleteId(group.disc_id); setEditingId(null); }}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* ── Inline edit row ── */}
                    {editingId === group.disc_id && (
                      <div className="px-4 py-3 bg-blue-50/40 border-l-2 border-blue-400">
                        <div className="flex gap-2 items-center">
                          <input
                            autoFocus
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleSave(group.disc_id)}
                            className="flex-1 px-3 py-1.5 border border-blue-200 rounded-lg text-sm focus:ring-1 focus:ring-blue-400 outline-none bg-white"
                          />
                          <input
                            type="number"
                            value={editPercent}
                            min="0" max="100" step="0.1"
                            onChange={(e) => setEditPercent(e.target.value)}
                            className="w-24 px-3 py-1.5 border border-blue-200 rounded-lg text-sm focus:ring-1 focus:ring-blue-400 outline-none bg-white"
                          />
                          <button
                            onClick={() => handleSave(group.disc_id)}
                            disabled={saving}
                            className="p-1.5 text-white bg-blue-500 hover:bg-blue-600 rounded-lg transition-all disabled:opacity-50"
                            title="Save"
                          >
                            <Check size={14} />
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
                            title="Cancel"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* ── Inline delete confirm row ── */}
                    {confirmDeleteId === group.disc_id && (
                      <div className="px-4 py-3 bg-red-50/60 border-l-2 border-red-400">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <AlertTriangle size={14} className="text-red-500 shrink-0" />
                            <p className="text-xs text-red-700 font-medium leading-tight">
                              Delete <span className="font-bold">"{group.name}"</span>? This will remove all
                              customer &amp; product mappings linked to it.
                            </p>
                          </div>
                          <div className="flex gap-2 shrink-0">
                            <button
                              onClick={() => handleDelete(group.disc_id)}
                              disabled={deleting}
                              className="px-3 py-1.5 bg-red-500 text-white text-[11px] font-bold rounded-lg hover:bg-red-600 transition-all disabled:opacity-50"
                            >
                              {deleting ? "Deleting..." : "Yes, Delete"}
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-3 py-1.5 bg-white text-gray-600 text-[11px] font-bold rounded-lg border border-gray-200 hover:bg-gray-50 transition-all"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                  </div>
                ))
              )}
            </div>
          </div>

          {/* Danger note */}
          <p className="text-[11px] text-gray-400 italic leading-relaxed">
            ⚠️ Deleting a discount group permanently removes all customer assignments and product
            mappings tied to it. This cannot be undone.
          </p>
        </div>
      </div>
    </div>
  );
};

export default DiscountGroupSettingsModal;