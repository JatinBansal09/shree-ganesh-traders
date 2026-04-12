// ─── BulkDiscountModal.jsx ────────────────────────────────────────────────────
import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Users } from 'lucide-react';
import { toastAlert } from './alerts';
import apiFetch from './utils/apiClient';

const BulkDiscountModal = ({ isOpen, onClose, groupName, discountGroups, onSaved }) => {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading]         = useState(false);
  const [saving, setSaving]           = useState(false);

  // ─── Fetch existing bulk assignments whenever modal opens ─────────────────
  // ✅ FIX: added `fetchAssignments` as a named function so it can be called
  //         both on open AND after a successful save to refresh the list
  const fetchAssignments = () => {
    if (!groupName) return;
    setLoading(true);
    apiFetch(`/api/customer-type/${encodeURIComponent(groupName)}/bulk-discounts/`)
      .then(res => {
        const data = Array.isArray(res) ? res : (res?.data ?? []);
        setAssignments(data.map(a => ({
          id:             a.id ?? null,
          discount_group: String(a.discount_group),   // disc_id as string for <select> matching
        })));
      })
      .catch(err => console.error('❌ Failed to fetch bulk assignments:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!isOpen) return;
    fetchAssignments();
  }, [isOpen, groupName]);

  // ─── Handlers ────────────────────────────────────────────────────────────
  const handleAdd = () => {
    setAssignments(prev => [...prev, { id: null, discount_group: '' }]);
  };

  const handleChange = (index, value) => {
    setAssignments(prev =>
      prev.map((a, i) => i === index ? { ...a, discount_group: value } : a)
    );
  };

  const handleRemove = (index) => {
    setAssignments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
      const ids = assignments
          .map(a => a.discount_group)
          .filter(Boolean)
          .map(Number);

      const unique = new Set(ids);
      if (unique.size !== ids.length) {
          toastAlert('Each discount group can only be assigned once', 'error');
          return;
      }

      setSaving(true);
      try {
          const res = await apiFetch(
              `/api/customer-type/${encodeURIComponent(groupName)}/bulk-discounts/`,
              {
                  method:  'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body:    JSON.stringify({ discount_groups: ids }),
              }
          );

          if (res?.success === false) {
              if (res.conflicts?.length > 0) {
                  toastAlert(`Conflict: ${res.conflicts[0]}`, 'error');
              } else {
                  toastAlert(res.error || 'Failed to save', 'error');
              }
              return;
          }

          toastAlert(`Bulk discounts saved for ${groupName}s`, 'success');
          fetchAssignments();
          onSaved?.();

      } catch (err) {
    console.log("err.data:", err.data);  // ← keep this temporarily
    const errData = err?.data;

    if (errData?.conflicts?.length > 0) {
        toastAlert(`${errData.conflicts[0]}`, 'error');
    } else if (errData?.error) {
        toastAlert(errData.error, 'error');
    } else {
        toastAlert('Failed to save bulk discounts', 'error');
    }
} finally {
          setSaving(false);
      }
  };

  if (!isOpen) return null;

  const selectableGroups = discountGroups.filter(g => g.disc_id !== 'null');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col max-h-[80vh] overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Users size={18} className="text-orange-500" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-800">
                Bulk Discount — {groupName}s
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                These discounts apply to{' '}
                <span className="font-semibold text-gray-600">all {groupName}s</span> by default
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-full transition">
            <X size={18} className="text-gray-400" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-3 flex-1">
          {loading ? (
            [...Array(3)].map((_, i) => (
              <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />
            ))
          ) : assignments.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">
              No bulk discounts assigned yet for {groupName}s
            </p>
          ) : (
            assignments.map((assignment, index) => (
              <div key={index} className="flex items-center gap-3">
                <select
                  value={assignment.discount_group}
                  onChange={(e) => handleChange(index, e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-orange-400 transition"
                >
                  <option value="" disabled>Select Discount Group</option>
                  {selectableGroups.map(grp => (
                    <option key={grp.disc_id} value={String(grp.disc_id)}>
                      {grp.name} ({grp.base_percent}%)
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => handleRemove(index)}
                  className="p-1.5 hover:bg-red-50 rounded-lg transition shrink-0"
                >
                  <Trash2 size={15} className="text-red-400" />
                </button>
              </div>
            ))
          )}

          {/* Add row */}
          <button
            onClick={handleAdd}
            className="flex items-center gap-2 text-sm text-orange-500 hover:text-orange-600 font-medium mt-1"
          >
            <Plus size={15} />
            Add Discount Group
          </button>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 bg-gray-50 border-t">
          <button
            onClick={onClose}
            className="px-5 py-2 text-gray-600 hover:text-gray-800 text-sm transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 text-white rounded-lg text-sm shadow-sm transition"
            style={{ backgroundColor: saving ? '#f9b56e' : '#F7941D' }}
          >
            {saving ? 'Saving...' : `Save for All ${groupName}s`}
          </button>
        </div>

      </div>
    </div>
  );
};

export default BulkDiscountModal;