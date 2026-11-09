import React, { useState, useEffect, useRef } from 'react';
import { useRestaurant } from '../../context/RestaurantContext';
import { ServiceRequestType } from '../../types';
import { X, Bell, GlassWater, Receipt, UtensilsCrossed, Sparkles, Send, Check } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const ServiceRequestModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { mutationError, createServiceRequest, activeTable } = useRestaurant();
  const [selectedType, setSelectedType] = useState<ServiceRequestType>('need_water');
  const [customMessage, setCustomMessage] = useState<string>('');
  const [sentSuccess, setSentSuccess] = useState<boolean>(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const [submitting, setSubmitting] = useState(false);
  const sending = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  if (!isOpen) return null;

  const requestOptions: {
    type: ServiceRequestType;
    label: string;
    icon: React.ReactNode;
    defaultMsg: string;
  }[] = [
    {
      type: 'need_water',
      label: 'Need Water',
      icon: <GlassWater className="w-5 h-5" />,
      defaultMsg: 'Could we get still/sparkling water please?',
    },
    {
      type: 'call_waiter',
      label: 'Call Waiter',
      icon: <Bell className="w-5 h-5" />,
      defaultMsg: 'Table assistance needed',
    },
    {
      type: 'request_bill',
      label: 'Request Bill',
      icon: <Receipt className="w-5 h-5" />,
      defaultMsg: 'Ready for final bill / card machine',
    },
    {
      type: 'extra_cutlery',
      label: 'Extra Cutlery',
      icon: <UtensilsCrossed className="w-5 h-5" />,
      defaultMsg: 'Extra forks, spoons or napkins',
    },
    {
      type: 'clean_table',
      label: 'Clean Table',
      icon: <Sparkles className="w-5 h-5" />,
      defaultMsg: 'Table wipe down requested',
    },
  ];

  const handleSend = async () => {
    if (sending.current) return;
    sending.current = true;
    setSubmitting(true);
    const selectedOption = requestOptions.find((o) => o.type === selectedType);
    const msg = customMessage.trim() || selectedOption?.defaultMsg || 'Staff assistance requested';
    const accepted = await createServiceRequest(selectedType, msg);
    sending.current = false;
    setSubmitting(false);
    if (!accepted) return;
    setSentSuccess(true);
    timer.current = setTimeout(() => {
      setSentSuccess(false);
      onClose();
    }, 1500);
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[#fcfcfb] w-full max-w-md rounded-t-2xl sm:rounded-2xl overflow-hidden shadow-2xl border border-[#ebebe8] animate-in zoom-in-95 duration-150"
      >
        {mutationError && (
          <p role="alert" className="p-3 text-red-700 bg-red-50 text-sm">
            {mutationError}
          </p>
        )}
        <div className="p-4 border-b border-[#ebebe8] flex items-center justify-between bg-[#fcfcfb]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#e8e8e6] text-[#16342b] flex items-center justify-center">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-[#16342b]">Call Staff / Table Assistance</h3>
              <p className="text-[11px] text-[#70706b]">
                Table {activeTable?.tableNumber || '12'} • Active Dine-in
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#f4f4f2] text-[#242424] flex items-center justify-center hover:bg-[#ebebe8] transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {sentSuccess ? (
          <div className="p-8 text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-[#c8eadc] text-[#16342b] mx-auto flex items-center justify-center animate-in zoom-in-75 duration-200">
              <Check className="w-8 h-8 stroke-[3]" />
            </div>
            <h3 className="font-bold text-base text-[#16342b]">Waiter Notified!</h3>
            <p className="text-xs text-[#70706b]">
              Your service request has been sent to our floor terminal. Staff is on their way to
              Table {activeTable?.tableNumber || '12'}.
            </p>
          </div>
        ) : (
          <div className="p-5 space-y-5">
            <div className="grid grid-cols-2 gap-2.5">
              {requestOptions.map((opt) => {
                const isSelected = selectedType === opt.type;
                return (
                  <button
                    key={opt.type}
                    type="button"
                    onClick={() => setSelectedType(opt.type)}
                    className={`p-3.5 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#16342b] border-[#16342b] text-white shadow-sm'
                        : 'bg-[#f4f4f2] border-[#ebebe8] text-[#242424] hover:bg-[#ebebe8]'
                    }`}
                  >
                    <span className={isSelected ? 'text-[#c8eadc]' : 'text-[#16342b]'}>
                      {opt.icon}
                    </span>
                    <span className="text-xs font-semibold">{opt.label}</span>
                  </button>
                );
              })}
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#16342b] mb-1.5">
                Optional Note for Server
              </label>
              <textarea
                rows={2}
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                placeholder="e.g. Extra napkins and sparkling water please..."
                className="w-full p-3 rounded-xl bg-[#f4f4f2] border border-[#ebebe8] text-xs text-[#242424] focus:outline-none focus:bg-[#fcfcfb] focus:border-[#16342b]"
              />
            </div>

            <button
              disabled={submitting}
              onClick={handleSend}
              className="w-full bg-[#16342b] text-white py-3.5 rounded-xl font-semibold text-xs uppercase tracking-wider hover:bg-[#2d4b41] transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>Send Call to Waiter</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
