import React, { useEffect } from 'react';
import { useRestaurant } from '../../context/RestaurantContext';
import { X, Award, Gift, Sparkles, Check, ChevronRight, Lock } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const LoyaltyDrawer: React.FC<Props> = ({ isOpen, onClose }) => {
  const { customerProfile, redeemReward } = useRestaurant();

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
  if (!customerProfile.id)
    return (
      <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-6 max-w-sm space-y-4">
          <h2 className="font-bold text-[#16342b]">Loyalty rewards</h2>
          <p className="text-sm">
            Your guest order does not verify loyalty ownership. Please ask restaurant staff about
            rewards.
          </p>
          <button onClick={onClose} className="p-3 bg-[#16342b] text-white rounded-xl">
            Close
          </button>
        </div>
      </div>
    );

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[#fcfcfb] w-full max-w-md rounded-t-2xl sm:rounded-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl border border-[#ebebe8] animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="bg-[#16342b] text-white p-5 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-[#2d4b41] text-[#99baad] border border-[#3e6357]">
              {customerProfile.tier} Member
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <div>
              <p className="text-xs text-[#99baad]">Your Balance</p>
              <h2 className="text-3xl font-bold tracking-tight flex items-center gap-1.5 mt-0.5 text-white">
                <span>{customerProfile.pointsBalance}</span>
                <span className="text-lg text-[#fdaa83] font-normal">pts</span>
              </h2>
            </div>
            <div className="text-right">
              <span className="text-xs font-semibold text-[#c8eadc]">{customerProfile.name}</span>
              <p className="text-[11px] text-[#99baad]">83% to Platinum Tier</p>
            </div>
          </div>

          {/* Tier Progress Bar */}
          <div className="w-full bg-[#2d4b41] h-2 rounded-full overflow-hidden mt-3">
            <div className="bg-[#fdaa83] h-full w-[83%] rounded-full"></div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-grow">
          {/* Stamp Card */}
          <div className="bg-[#f4f4f2] p-4 rounded-xl border border-[#ebebe8] shadow-sm">
            <div className="flex justify-between items-center mb-3">
              <div>
                <h4 className="font-bold text-sm text-[#16342b]">Dining Passport</h4>
                <p className="text-xs text-[#70706b]">
                  Collect 6 stamps to unlock €25 dining voucher
                </p>
              </div>
              <span className="text-xs font-bold px-2.5 py-0.5 bg-[#c8eadc] text-[#16342b] rounded-full">
                {customerProfile.stampsCount} / 6
              </span>
            </div>

            {/* Stamp Circles */}
            <div className="grid grid-cols-6 gap-2">
              {[0, 1, 2, 3, 4, 5].map((idx) => {
                const isStamped = idx < customerProfile.stampsCount;
                const isFinalReward = idx === 5;

                return (
                  <div
                    key={idx}
                    className={`aspect-square rounded-xl border flex flex-col items-center justify-center text-xs font-bold transition-all ${
                      isStamped
                        ? 'bg-[#16342b] border-[#16342b] text-white shadow-sm'
                        : isFinalReward
                          ? 'bg-[#fcfcfb] border-dashed border-[#8d4e2d] text-[#8d4e2d]'
                          : 'bg-[#fcfcfb] border-[#ebebe8] text-[#70706b]'
                    }`}
                  >
                    {isStamped ? (
                      <Check className="w-4 h-4 text-[#c8eadc] stroke-[3]" />
                    ) : isFinalReward ? (
                      <Gift className="w-4 h-4 text-[#8d4e2d]" />
                    ) : (
                      <span>#{idx + 1}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Available Rewards Marketplace */}
          <div>
            <h4 className="font-bold text-xs uppercase tracking-wider text-[#16342b] mb-3">
              Redeemable Member Perks
            </h4>

            <div className="space-y-3">
              {customerProfile.savedRewards.map((reward) => {
                const canAfford = customerProfile.pointsBalance >= reward.pointsCost;

                return (
                  <div
                    key={reward.id}
                    className="p-3.5 bg-[#fcfcfb] rounded-xl border border-[#ebebe8] flex items-center justify-between shadow-sm hover:border-[#16342b] transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#e8e8e6] text-[#16342b] flex items-center justify-center">
                        <Gift className="w-5 h-5" />
                      </div>
                      <div>
                        <h5 className="font-semibold text-xs text-[#16342b]">{reward.title}</h5>
                        <p className="text-[11px] text-[#70706b]">{reward.description}</p>
                      </div>
                    </div>

                    <button
                      disabled={!canAfford}
                      onClick={() => redeemReward(reward.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                        canAfford
                          ? 'bg-[#16342b] text-white hover:bg-[#2d4b41] shadow-sm'
                          : 'bg-[#f4f4f2] text-[#70706b] cursor-not-allowed border border-[#ebebe8]'
                      }`}
                    >
                      {!canAfford && <Lock className="w-3 h-3 text-[#70706b]" />}
                      <span>{reward.pointsCost} pts</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
