import React, { useState, useEffect } from 'react';
import { MenuItem, SelectedModifier } from '../../types';
import { X, Plus, Minus, Check, Flame } from 'lucide-react';

interface Props {
  item: MenuItem | null;
  currency: string;
  onClose: () => void;
  onAddToCart: (
    item: MenuItem,
    quantity: number,
    modifiers: SelectedModifier[],
    notes?: string
  ) => void;
}

export const ItemCustomizerModal: React.FC<Props> = ({
  item,
  currency,
  onClose,
  onAddToCart,
}) => {
  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && item) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [item, onClose]);

  const [quantity, setQuantity] = useState<number>(1);
  const [selectedModifiers, setSelectedModifiers] = useState<SelectedModifier[]>(() => {
    if (!item) return [];
    const defaults: SelectedModifier[] = [];
    item.modifierGroups?.forEach(group => {
      group.options.forEach(opt => {
        if (opt.isDefault) {
          defaults.push({
            groupId: group.id,
            groupName: group.name,
            optionId: opt.id,
            optionName: opt.name,
            priceDelta: opt.priceDelta,
          });
        }
      });
    });
    return defaults;
  });
  const [specialInstructions, setSpecialInstructions] = useState<string>('');

  if (!item) return null;

  const handleToggleModifier = (
    group: NonNullable<MenuItem['modifierGroups']>[0],
    option: NonNullable<MenuItem['modifierGroups']>[0]['options'][0]
  ) => {
    const isSingleChoice = group.maxSelections === 1;

    setSelectedModifiers(prev => {
      const isAlreadySelected = prev.some(m => m.groupId === group.id && m.optionId === option.id);

      if (isSingleChoice) {
        // Replace selection in this group
        const withoutGroup = prev.filter(m => m.groupId !== group.id);
        return [
          ...withoutGroup,
          {
            groupId: group.id,
            groupName: group.name,
            optionId: option.id,
            optionName: option.name,
            priceDelta: option.priceDelta,
          },
        ];
      } else {
        // Multiple choice toggle
        if (isAlreadySelected) {
          return prev.filter(m => !(m.groupId === group.id && m.optionId === option.id));
        } else {
          // Check max limit
          const countInGroup = prev.filter(m => m.groupId === group.id).length;
          if (group.maxSelections && countInGroup >= group.maxSelections) {
            return prev;
          }
          return [
            ...prev,
            {
              groupId: group.id,
              groupName: group.name,
              optionId: option.id,
              optionName: option.name,
              priceDelta: option.priceDelta,
            },
          ];
        }
      }
    });
  };

  const modifierTotal = selectedModifiers.reduce((sum, mod) => sum + mod.priceDelta, 0);
  const unitPrice = item.price + modifierTotal;
  const totalPrice = unitPrice * quantity;

  const handleAdd = () => {
    onAddToCart(item, quantity, selectedModifiers, specialInstructions.trim() || undefined);
    onClose();
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-150"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="bg-[#fcfcfb] w-full max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl border border-[#ebebe8] animate-in zoom-in-95 duration-150"
      >
        {/* Header Image & Close */}
        <div className="relative h-56 w-full bg-[#eeeeec] flex-shrink-0">
          <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/90 text-[#242424] flex items-center justify-center shadow-md hover:bg-white transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
          {item.isBestseller && (
            <div className="absolute top-3 left-3 bg-[#8d4e2d] text-white px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1 shadow-sm">
              <Flame className="w-3.5 h-3.5" />
              Bestseller
            </div>
          )}
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto flex-grow space-y-6">
          <div>
            <div className="flex justify-between items-start gap-2">
              <h2 className="text-xl font-bold text-[#16342b]">{item.name}</h2>
              <span className="text-lg font-bold text-[#16342b]">
                {currency}
                {item.price.toFixed(2)}
              </span>
            </div>
            <p className="text-xs text-[#70706b] mt-1 leading-relaxed">{item.description}</p>
            {item.calories && (
              <span className="inline-block mt-2 text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-[#e8e8e6] text-[#242424]">
                {item.calories} kcal • {item.preparationTimeMinutes} min prep
              </span>
            )}
          </div>

          {/* Modifier Groups */}
          {item.modifierGroups && item.modifierGroups.length > 0 && (
            <div className="space-y-4">
              {item.modifierGroups.map(group => {
                const isSingleChoice = group.maxSelections === 1;

                return (
                  <div key={group.id} className="bg-[#f4f4f2] p-4 rounded-xl border border-[#ebebe8] space-y-3">
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="font-semibold text-xs text-[#16342b]">{group.name}</h4>
                        <p className="text-[11px] text-[#70706b]">
                          {isSingleChoice
                            ? 'Select 1 option (Required)'
                            : `Choose up to ${group.maxSelections || 'multiple'}`}
                        </p>
                      </div>
                      {group.required && (
                        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[#ffdbcc] text-[#351000]">
                          Required
                        </span>
                      )}
                    </div>

                    <div className="space-y-2">
                      {group.options.map(opt => {
                        const isSelected = selectedModifiers.some(
                          m => m.groupId === group.id && m.optionId === opt.id
                        );

                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => handleToggleModifier(group, opt)}
                            className={`w-full p-3 rounded-xl border flex items-center justify-between text-xs transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-[#fcfcfb] border-[#16342b] text-[#16342b] shadow-sm font-semibold'
                                : 'bg-[#fcfcfb] border-[#ebebe8] text-[#242424] hover:bg-[#ebebe8]'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <div
                                className={`w-4 h-4 rounded-${
                                  isSingleChoice ? 'full' : 'md'
                                } border flex items-center justify-center ${
                                  isSelected
                                    ? 'bg-[#16342b] border-[#16342b] text-white'
                                    : 'border-[#ebebe8] bg-white'
                                }`}
                              >
                                {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                              </div>
                              <span>{opt.name}</span>
                            </div>
                            <span className="font-medium text-[#70706b]">
                              {opt.priceDelta > 0 ? `+${currency}${opt.priceDelta.toFixed(2)}` : 'Included'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Special Instructions Note */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-[#16342b]">Special Kitchen Notes</label>
            <textarea
              rows={2}
              value={specialInstructions}
              onChange={e => setSpecialInstructions(e.target.value)}
              placeholder="e.g. Extra dressing on the side, no onions please..."
              className="w-full p-3 rounded-xl bg-[#f4f4f2] border border-[#ebebe8] text-xs text-[#242424] focus:outline-none focus:bg-[#fcfcfb] focus:border-[#16342b]"
            />
          </div>
        </div>

        {/* Sticky Footer */}
        <div className="p-4 bg-[#f4f4f2] border-t border-[#ebebe8] flex items-center justify-between gap-4 flex-shrink-0">
          {/* Quantity Stepper */}
          <div className="flex items-center gap-2 bg-[#fcfcfb] border border-[#ebebe8] rounded-xl p-1 shadow-sm">
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-[#242424] hover:bg-[#ebebe8] transition-colors cursor-pointer"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="w-6 text-center font-bold text-sm text-[#16342b]">{quantity}</span>
            <button
              onClick={() => setQuantity(quantity + 1)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-[#242424] hover:bg-[#ebebe8] transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Add to Cart Button */}
          <button
            onClick={handleAdd}
            className="flex-grow bg-[#16342b] text-white py-3.5 px-4 rounded-xl font-semibold text-xs uppercase tracking-wider hover:bg-[#2d4b41] transition-all shadow-sm flex items-center justify-between cursor-pointer"
          >
            <span>Add to Order</span>
            <span>
              {currency}
              {totalPrice.toFixed(2)}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
