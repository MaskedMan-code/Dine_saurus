import React, { useState, useEffect, useRef } from 'react';
import { useRestaurant } from '../../context/RestaurantContext';
import { X, Star, MessageSquare, Check, Sparkles } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const ReviewModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { mutationError, submitReview, activeTable } = useRestaurant();
  const [rating, setRating] = useState<number>(5);
  const [comment, setComment] = useState<string>('');
  const [selectedTags, setSelectedTags] = useState<string[]>(['Fresh Ingredients', 'Fast Service']);
  const [submitted, setSubmitted] = useState<boolean>(false);

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

  const availableTags = [
    'Fresh Ingredients',
    'Fast Service',
    'Great Ambience',
    'Crispy Sourdough',
    'Savory Salmon',
    'Tasty Truffle',
    'Generous Portion',
    'Friendly Staff',
  ];

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const handleSubmit = async () => {
    if (sending.current) return;
    sending.current = true;
    setSubmitting(true);
    const accepted = await submitReview(
      rating,
      comment.trim() || 'Had a great dining experience!',
      selectedTags,
    );
    sending.current = false;
    setSubmitting(false);
    if (!accepted) return;
    setSubmitted(true);
    timer.current = setTimeout(() => {
      setSubmitted(false);
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
        {/* Header */}
        <div className="p-4 border-b border-[#ebebe8] flex items-center justify-between bg-[#fcfcfb]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#fdaa83]/20 text-[#8d4e2d] flex items-center justify-center">
              <Star className="w-4 h-4 fill-current" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-[#16342b]">Rate Your Experience</h3>
              <p className="text-[11px] text-[#70706b]">
                Table {activeTable?.tableNumber || '12'} • Feedback
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

        {submitted ? (
          <div className="p-8 text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-[#c8eadc] text-[#16342b] mx-auto flex items-center justify-center animate-in zoom-in-75 duration-200">
              <Check className="w-8 h-8 stroke-[3]" />
            </div>
            <h3 className="font-bold text-base text-[#16342b]">Thank You for Your Feedback!</h3>
            <p className="text-xs text-[#70706b]">
              Your review helps us maintain the highest standard of culinary quality and
              hospitality.
            </p>
          </div>
        ) : (
          <div className="p-5 space-y-5">
            {/* Star Picker */}
            <div className="flex flex-col items-center justify-center py-2">
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    className="p-1 text-[#8d4e2d] hover:scale-110 transition-transform cursor-pointer"
                  >
                    <Star
                      className={`w-8 h-8 ${
                        star <= rating ? 'fill-[#8d4e2d] text-[#8d4e2d]' : 'text-[#ebebe8]'
                      }`}
                    />
                  </button>
                ))}
              </div>
              <span className="text-xs font-semibold text-[#16342b] mt-2">
                {rating === 5 && 'Outstanding Experience! ⭐⭐⭐⭐⭐'}
                {rating === 4 && 'Very Good / Enjoyed it! ⭐⭐⭐⭐'}
                {rating === 3 && 'Good / Met Expectations ⭐⭐⭐'}
                {rating === 2 && 'Fair / Room for Improvement ⭐⭐'}
                {rating === 1 && 'Disappointing ⭐'}
              </span>
            </div>

            {/* Quick Experience Tags */}
            <div>
              <label className="block text-xs font-semibold text-[#16342b] mb-2">
                What did you like most?
              </label>
              <div className="flex flex-wrap gap-1.5">
                {availableTags.map((tag) => {
                  const isSelected = selectedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className={`px-3 py-1 rounded-full text-xs font-medium border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#16342b] border-[#16342b] text-white'
                          : 'bg-[#f4f4f2] border-[#ebebe8] text-[#242424] hover:bg-[#ebebe8]'
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Textarea */}
            <div>
              <label className="block text-xs font-semibold text-[#16342b] mb-1.5">
                Share details about your meal (Optional)
              </label>
              <textarea
                rows={3}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="The Arctic Salmon was grilled to perfection and the sauce was amazing..."
                className="w-full p-3 rounded-xl bg-[#f4f4f2] border border-[#ebebe8] text-xs text-[#242424] focus:outline-none focus:bg-[#fcfcfb] focus:border-[#16342b]"
              />
            </div>

            {/* Submit */}
            <button
              disabled={submitting}
              onClick={handleSubmit}
              className="w-full bg-[#16342b] text-white py-3.5 rounded-xl font-semibold text-xs uppercase tracking-wider hover:bg-[#2d4b41] transition-all shadow-sm cursor-pointer"
            >
              Submit Guest Review
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
