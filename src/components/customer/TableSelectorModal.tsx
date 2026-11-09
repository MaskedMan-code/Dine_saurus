import React, { useEffect } from 'react';
import { useRestaurant } from '../../context/RestaurantContext';
import { X, Table as TableIcon, Check, MapPin } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const TableSelectorModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { tables, areas, activeTable, setActiveTable } = useRestaurant();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[#fcfcfb] w-full max-w-md rounded-t-2xl sm:rounded-2xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl border border-[#ebebe8] animate-in zoom-in-95 duration-150"
      >
        <div className="p-4 border-b border-[#ebebe8] flex items-center justify-between bg-[#fcfcfb]">
          <div>
            <h3 className="font-bold text-sm text-[#16342b]">Select Your Table</h3>
            <p className="text-[11px] text-[#70706b]">Choose your physical table or seating area</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#f4f4f2] text-[#242424] flex items-center justify-center hover:bg-[#ebebe8] transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 text-sm text-[#70706b]">
          Please scan the QR printed on your current table to change tables. Restaurant staff can
          help if the code is missing.
        </div>
      </div>
    </div>
  );
};
