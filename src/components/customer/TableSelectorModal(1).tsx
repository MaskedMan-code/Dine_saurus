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
        onClick={e => e.stopPropagation()}
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

        <div className="p-5 overflow-y-auto space-y-5 flex-grow">
          {areas.map(area => {
            const areaTables = tables.filter(t => t.areaId === area.id);
            if (areaTables.length === 0) return null;

            return (
              <div key={area.id} className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#16342b]">
                  <MapPin className="w-3.5 h-3.5 text-[#8d4e2d]" />
                  <span>{area.name}</span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {areaTables.map(table => {
                    const isSelected = activeTable?.id === table.id;
                    return (
                      <button
                        key={table.id}
                        type="button"
                        onClick={() => {
                          setActiveTable(table);
                          onClose();
                        }}
                        className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#16342b] border-[#16342b] text-white shadow-sm'
                            : 'bg-[#f4f4f2] border-[#ebebe8] text-[#242424] hover:bg-[#ebebe8]'
                        }`}
                      >
                        <span className="text-xs font-bold">{table.name}</span>
                        <span className={`text-[10px] ${isSelected ? 'text-[#c8eadc]' : 'text-[#70706b]'}`}>
                          {table.capacity} Seats
                        </span>
                        {isSelected && <Check className="w-3 h-3 text-[#c8eadc] mt-0.5" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
