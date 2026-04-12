import { X, Search, Check } from "lucide-react";
import { useState } from "react";

const SelectCustomerModal = ({ isOpen, onClose, consumers, onConfirm, loading }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedId, setSelectedId] = useState(null);

  if (!isOpen) return null;

  const filtered = consumers.filter(c => 
    c.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone_number.includes(searchTerm)
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl w-full max-w-md flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="p-4 flex justify-between items-center border-b">
          <h3 className="text-lg font-semibold">Select Customer</h3>
          <button onClick={onClose}><X size={20} className="text-gray-400" /></button>
        </div>

        {/* Search */}
        <div className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
            <input
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-orange-400"
              placeholder="Search customers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <p className="text-center py-10 text-gray-500">Loading customers...</p>
          ) : filtered.map((user) => (
            <div 
              key={user.id}
              onClick={() => setSelectedId(user.id)}
              className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition ${
                selectedId === user.id ? "bg-orange-50" : "hover:bg-gray-50"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center font-bold text-gray-500">
                  {user.customer_name[0]}
                </div>
                <div>
                  <p className="font-medium text-gray-800">{user.customer_name}</p>
                  <p className="text-xs text-gray-500">{user.phone_number} • {user.userGroup}</p>
                </div>
              </div>
              <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                selectedId === user.id ? "bg-orange-500 border-orange-500" : "border-gray-300"
              }`}>
                {selectedId === user.id && <Check size={12} className="text-white" />}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t">
          <button 
            disabled={!selectedId}
            onClick={() => onConfirm(consumers.find(c => c.id === selectedId))}
            className="w-full py-3 bg-orange-500 text-white rounded-lg font-semibold disabled:opacity-50"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};

export default SelectCustomerModal;