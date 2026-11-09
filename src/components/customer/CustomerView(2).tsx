import React, { useState, useRef } from 'react';
import { useRestaurant } from '../../context/RestaurantContext';
import { MenuItem } from '../../types';
import {
  Search,
  SlidersHorizontal,
  Flame,
  Sparkles,
  Plus,
  ShoppingBag,
  Bell,
  Star,
  Clock,
  Leaf,
  ArrowRight,
  ChevronRight,
  Home,
  UtensilsCrossed,
  Award,
  MoreHorizontal,
  Globe,
  User,
  ShieldCheck,
  Phone,
} from 'lucide-react';
import { ItemCustomizerModal } from './ItemCustomizerModal';
import { CheckoutDrawer } from './CheckoutDrawer';
import { OrderTrackerModal } from './OrderTrackerModal';
import { ServiceRequestModal } from './ServiceRequestModal';
import { LoyaltyDrawer } from './LoyaltyDrawer';
import { ReviewModal } from './ReviewModal';
import { TableSelectorModal } from './TableSelectorModal';

export const CustomerView: React.FC = () => {
  const {
    restaurant,
    activeTable,
    areas,
    categories,
    menuItems,
    selectedCategory,
    setSelectedCategory,
    searchQuery,
    setSearchQuery,
    dietaryFilters,
    setDietaryFilters,
    cart,
    addToCart,
    cartItemCount,
    cartTotalAmount,
    activeOrder,
  } = useRestaurant();

  if (!restaurant) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center text-sm text-[#6b6b6b]">
        No restaurant loaded.
      </div>
    );
  }

  // Modals & Drawers state
  const [customizingItem, setCustomizingItem] = useState<MenuItem | null>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState<boolean>(false);
  const [isTrackerOpen, setIsTrackerOpen] = useState<boolean>(false);
  const [isServiceOpen, setIsServiceOpen] = useState<boolean>(false);
  const [isLoyaltyOpen, setIsLoyaltyOpen] = useState<boolean>(false);
  const [isReviewOpen, setIsReviewOpen] = useState<boolean>(false);
  const [isTableSelectorOpen, setIsTableSelectorOpen] = useState<boolean>(false);
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState<boolean>(false);
  const [activeBottomNav, setActiveBottomNav] = useState<'home' | 'menu' | 'orders' | 'loyalty' | 'more'>('menu');

  const menuSectionRef = useRef<HTMLDivElement>(null);
  const currentArea = activeTable ? areas.find(a => a.id === activeTable.areaId) : null;

  // Filtered menu items
  const filteredItems = menuItems.filter(item => {
    // Search query match
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = item.name.toLowerCase().includes(q);
      const matchDesc = item.description.toLowerCase().includes(q);
      if (!matchName && !matchDesc) return false;
    }

    // Category match
    if (selectedCategory && selectedCategory !== 'cat_popular') {
      if (item.categoryId !== selectedCategory) return false;
    }

    // Dietary filters
    if (dietaryFilters.vegetarian && !item.isVegetarian && !item.isVegan) return false;
    if (dietaryFilters.vegan && !item.isVegan) return false;
    if (dietaryFilters.glutenFree && !item.isGlutenFree) return false;

    return true;
  });

  const popularItems = menuItems.filter(i => i.isBestseller || i.isFeatured);
  const chefsPicks = menuItems.filter(i => i.id === 'item_07' || i.id === 'item_06' || i.id === 'item_05' || i.id === 'item_02');

  const scrollToMenu = () => {
    setActiveBottomNav('menu');
    menuSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[#f9f9f7] text-[#242424] pb-32 md:pb-20 flex flex-col items-center">
      {/* Container simulating mobile-first responsive PWA layout */}
      <div className="w-full max-w-md md:max-w-4xl bg-[#f9f9f7] min-h-screen shadow-md relative md:border-x md:border-[#ebebe8]">
        {/* Top Header */}
        <header className="sticky top-0 z-40 bg-[#f9f9f7]/95 backdrop-blur-md px-4 py-3.5 border-b border-[#ebebe8] flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#e8e8e6] flex items-center justify-center text-[#16342b] shadow-sm">
              <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                restaurant
              </span>
            </div>
            <div>
              <h1 className="font-bold text-base text-[#16342b] tracking-tight leading-none">
                {restaurant.name}
              </h1>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="w-2 h-2 rounded-full bg-[#16342b] inline-block animate-pulse"></span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#70706b]">Open Now</span>
                <span className="text-[#c1c8c4]">•</span>
                <span className="text-[10px] font-semibold text-[#16342b]">Table {activeTable?.tableNumber || '12'}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsServiceOpen(true)}
              className="px-2.5 py-1.5 rounded-full bg-[#e8e8e6] text-[#16342b] text-xs font-semibold flex items-center gap-1 hover:bg-[#dadad8] transition-colors cursor-pointer"
              title="Call Waiter"
            >
              <Bell className="w-3.5 h-3.5 text-[#16342b]" />
              <span className="hidden sm:inline">Call Waiter</span>
            </button>

            <button
              onClick={() => setIsLoyaltyOpen(true)}
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[#ebebe8] text-[#16342b] transition-colors cursor-pointer"
              title="Loyalty Rewards"
            >
              <Award className="w-4 h-4 text-[#8d4e2d]" />
            </button>

            <button
              onClick={() => setIsReviewOpen(true)}
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[#ebebe8] text-[#16342b] transition-colors cursor-pointer"
              title="Reviews & Rating"
            >
              <Star className="w-4 h-4 text-[#8d4e2d] fill-[#8d4e2d]" />
            </button>
          </div>
        </header>

        {/* Hero Section with Floating Glassmorphic Info Card */}
        <section className="relative px-4 pt-3 pb-12">
          <div className="relative h-64 sm:h-72 w-full rounded-2xl overflow-hidden shadow-sm border border-[#ebebe8]">
            <img
              src={restaurant.coverImageUrl || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&auto=format&fit=crop&q=80'}
              alt="Harbor Bistro Terrace"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#16342b]/70 via-transparent to-transparent"></div>
          </div>

          {/* Floating Table Info Card */}
          <div className="absolute left-6 right-6 -bottom-4 bg-[#fcfcfb]/95 backdrop-blur-md p-4 sm:p-5 rounded-2xl shadow-[0_8px_24px_rgba(22,52,43,0.08)] border border-white/60 z-10 flex flex-col gap-2.5">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] uppercase tracking-widest font-semibold text-[#70706b]">
                  You're ordering from
                </p>
                <h2 className="text-xl font-bold text-[#16342b] mt-0.5">
                  Table {activeTable?.tableNumber || '12'}
                </h2>
                <p className="text-xs text-[#70706b]">
                  {currentArea?.name || 'Outdoor Terrace'}
                </p>
              </div>

              <button
                onClick={() => setIsTableSelectorOpen(true)}
                className="text-xs font-medium text-[#16342b] underline decoration-[#16342b]/30 hover:decoration-[#16342b] transition-colors cursor-pointer"
              >
                Wrong table?
              </button>
            </div>

            <div className="h-[1px] w-full bg-[#ebebe8]"></div>

            <div className="flex justify-between items-center text-xs text-[#414845] font-medium">
              <div className="flex items-center gap-1 text-[#8d4e2d]">
                <Star className="w-4 h-4 fill-[#8d4e2d] text-[#8d4e2d]" />
                <span className="font-bold text-[#242424]">4.8</span>
                <span className="text-[#70706b]">(384)</span>
              </div>
              <div className="flex items-center gap-1 text-[#70706b]">
                <Clock className="w-4 h-4" />
                <span>15-20 min</span>
              </div>
              <div className="flex items-center gap-1 text-[#16342b]">
                <Leaf className="w-4 h-4 text-[#16342b]" />
                <span>Vegan / GF</span>
              </div>
            </div>
          </div>
        </section>

        {/* View Full Menu Action CTA */}
        <div className="px-4 mt-6">
          <button
            onClick={scrollToMenu}
            className="w-full bg-[#16342b] text-white py-4 rounded-xl font-semibold text-xs uppercase tracking-widest hover:bg-[#2d4b41] transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>View Full Menu</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Popular Now Carousel Section */}
        <section className="mt-8">
          <div className="px-4 flex justify-between items-end mb-3">
            <div>
              <h3 className="text-lg font-bold text-[#16342b] tracking-tight">Popular Now</h3>
              <p className="text-xs text-[#70706b]">Guest favorites & freshly prepared dishes</p>
            </div>
          </div>

          <div className="flex overflow-x-auto hide-scrollbar gap-3.5 px-4 pb-2 snap-x">
            {popularItems.map(item => (
              <div
                key={item.id}
                onClick={() => setCustomizingItem(item)}
                className="snap-start shrink-0 w-60 sm:w-64 bg-[#fcfcfb] rounded-2xl overflow-hidden shadow-sm border border-[#ebebe8] flex flex-col group cursor-pointer hover:shadow-md transition-shadow"
              >
                <div className="h-32 w-full relative overflow-hidden bg-[#eeeeec]">
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  {item.isBestseller && (
                    <div className="absolute top-2.5 left-2.5 bg-[#8d4e2d] text-white px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1 shadow-sm">
                      <Flame className="w-3 h-3" />
                      Bestseller
                    </div>
                  )}
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      setCustomizingItem(item);
                    }}
                    className="absolute top-2.5 right-2.5 w-8 h-8 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center text-[#16342b] shadow-sm hover:bg-white cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <div className="p-4 flex flex-col justify-between flex-grow">
                  <div>
                    <h4 className="font-semibold text-sm text-[#16342b] line-clamp-1">{item.name}</h4>
                    <p className="text-xs text-[#70706b] line-clamp-2 mt-0.5">{item.description}</p>
                  </div>
                  <div className="mt-3 flex justify-between items-center">
                    <span className="font-bold text-sm text-[#16342b]">
                      {restaurant.currencySymbol}
                      {item.price.toFixed(2)}
                    </span>
                    <span className="text-[11px] font-medium text-[#16342b] bg-[#c8eadc] px-2 py-0.5 rounded-full">
                      Customize
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Chef's Picks Section */}
        <section className="mt-6 px-4">
          <div className="flex justify-between items-end mb-3">
            <h3 className="text-lg font-bold text-[#16342b] tracking-tight">Chef's Picks</h3>
          </div>
          <div className="flex flex-col gap-3">
            {chefsPicks.slice(0, 2).map(item => (
              <div
                key={item.id}
                onClick={() => setCustomizingItem(item)}
                className="flex bg-[#fcfcfb] rounded-2xl overflow-hidden shadow-sm border border-[#ebebe8] p-3 gap-3.5 items-center cursor-pointer hover:shadow-md transition-shadow"
              >
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden shrink-0 bg-[#eeeeec]">
                  <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                </div>
                <div className="flex-grow flex flex-col justify-center">
                  <h4 className="font-semibold text-sm text-[#16342b] mb-0.5">{item.name}</h4>
                  <p className="text-xs text-[#70706b] line-clamp-2 mb-1.5">{item.description}</p>
                  <span className="font-bold text-sm text-[#16342b]">
                    {restaurant.currencySymbol}
                    {item.price.toFixed(2)}
                  </span>
                </div>
                <button
                  onClick={e => {
                    e.stopPropagation();
                    setCustomizingItem(item);
                  }}
                  className="w-9 h-9 bg-[#f4f4f2] rounded-full flex items-center justify-center text-[#16342b] hover:bg-[#ebebe8] transition-colors shrink-0 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Search & Filter Toolbar */}
        <section ref={menuSectionRef} className="mt-8 px-4 sticky top-[57px] z-30 bg-[#f9f9f7]/95 backdrop-blur-md py-2 border-b border-[#ebebe8]">
          <div className="flex gap-2 items-center">
            <div className="relative flex-grow">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#727975]" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search dishes, drinks..."
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#fcfcfb] border border-[#ebebe8] text-sm text-[#242424] focus:outline-none focus:border-[#16342b] transition-colors shadow-sm"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#727975] font-bold cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            <button
              onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
              className={`w-11 h-11 rounded-xl border flex items-center justify-center transition-colors shadow-sm cursor-pointer ${
                dietaryFilters.vegetarian || dietaryFilters.vegan || dietaryFilters.glutenFree
                  ? 'bg-[#16342b] border-[#16342b] text-white'
                  : 'bg-[#fcfcfb] border-[#ebebe8] text-[#242424] hover:bg-[#f4f4f2]'
              }`}
              title="Dietary filters"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
          </div>

          {/* Filter Popover Dropdown */}
          {isFilterDropdownOpen && (
            <div className="mt-2 p-3 bg-[#fcfcfb] rounded-xl border border-[#ebebe8] shadow-lg flex flex-wrap gap-2 animate-in fade-in duration-150">
              <button
                onClick={() => setDietaryFilters(p => ({ ...p, vegetarian: !p.vegetarian }))}
                className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                  dietaryFilters.vegetarian
                    ? 'bg-[#16342b] text-white border-[#16342b]'
                    : 'bg-[#f4f4f2] text-[#242424] border-[#ebebe8]'
                }`}
              >
                Vegetarian (V)
              </button>
              <button
                onClick={() => setDietaryFilters(p => ({ ...p, vegan: !p.vegan }))}
                className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                  dietaryFilters.vegan
                    ? 'bg-[#16342b] text-white border-[#16342b]'
                    : 'bg-[#f4f4f2] text-[#242424] border-[#ebebe8]'
                }`}
              >
                Vegan (VG)
              </button>
              <button
                onClick={() => setDietaryFilters(p => ({ ...p, glutenFree: !p.glutenFree }))}
                className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                  dietaryFilters.glutenFree
                    ? 'bg-[#16342b] text-white border-[#16342b]'
                    : 'bg-[#f4f4f2] text-[#242424] border-[#ebebe8]'
                }`}
              >
                Gluten Free (GF)
              </button>
            </div>
          )}
        </section>

        {/* Category Carousel (Popular, Starters, Mains, Burgers, Pizza, Desserts, Drinks) */}
        <section className="px-4 py-3">
          <div className="flex overflow-x-auto no-scrollbar gap-2 pb-1">
            {categories.map(cat => {
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-semibold transition-all shadow-sm cursor-pointer ${
                    isSelected
                      ? 'bg-[#16342b] text-white shadow-sm'
                      : 'bg-[#fcfcfb] border border-[#ebebe8] text-[#242424] hover:bg-[#f4f4f2]'
                  }`}
                >
                  {cat.name}
                </button>
              );
            })}
          </div>
        </section>

        {/* Main Food Menu Grid */}
        <section className="px-4 py-2">
          {filteredItems.length === 0 ? (
            <div className="text-center py-16 px-4 bg-[#fcfcfb] rounded-2xl border border-[#ebebe8] space-y-2">
              <span className="material-symbols-outlined text-4xl text-[#727975]">no_food</span>
              <h4 className="font-bold text-[#242424]">No dishes found</h4>
              <p className="text-xs text-[#70706b]">Try changing your search terms or dietary filters.</p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('cat_popular');
                  setDietaryFilters({ vegetarian: false, vegan: false, glutenFree: false });
                }}
                className="mt-2 text-xs font-bold text-[#16342b] underline cursor-pointer"
              >
                Reset All Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredItems.map(item => (
                <article
                  key={item.id}
                  onClick={() => !item.isSoldOut && setCustomizingItem(item)}
                  className={`bg-[#fcfcfb] rounded-2xl overflow-hidden shadow-[0_4px_12px_rgba(22,52,43,0.04)] border border-[#ebebe8] flex flex-col group transition-all ${
                    item.isSoldOut
                      ? 'opacity-60 grayscale-[30%] cursor-not-allowed'
                      : 'cursor-pointer hover:shadow-[0_8px_24px_rgba(22,52,43,0.08)]'
                  }`}
                >
                  <div className="relative h-48 w-full overflow-hidden bg-[#eeeeec]">
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />

                    {/* Sold out overlay */}
                    {item.isSoldOut && (
                      <div className="absolute inset-0 bg-[#f9f9f7]/60 backdrop-blur-[1px] flex items-center justify-center z-10">
                        <span className="bg-[#f4f4f2] text-[#242424] px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border border-[#ebebe8] shadow-sm">
                          Sold Out
                        </span>
                      </div>
                    )}

                    {item.isBestseller && !item.isSoldOut && (
                      <div className="absolute top-3 left-3 bg-[#8d4e2d] text-white px-2.5 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1 shadow-sm">
                        <Flame className="w-3.5 h-3.5" />
                        Bestseller
                      </div>
                    )}

                    {item.isNew && !item.isSoldOut && (
                      <div className="absolute top-3 left-3 bg-[#ffdbcc] text-[#351000] px-2.5 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1 shadow-sm">
                        <Sparkles className="w-3.5 h-3.5" />
                        New
                      </div>
                    )}
                  </div>

                  <div className="p-4 flex flex-col flex-grow justify-between">
                    <div>
                      <div className="flex justify-between items-start gap-2 mb-1.5">
                        <h3 className="font-semibold text-[16px] text-[#242424] leading-snug">
                          {item.name}
                        </h3>
                        <span className="font-bold text-[16px] text-[#16342b]">
                          {restaurant.currencySymbol}
                          {item.price.toFixed(2)}
                        </span>
                      </div>
                      <p className="text-xs text-[#70706b] line-clamp-2 leading-relaxed mb-4">{item.description}</p>
                    </div>

                    <div className="flex justify-between items-center mt-auto">
                      {/* Dietary Icons */}
                      <div className="flex gap-1.5">
                        {item.isVegan && (
                          <span
                            className="w-6 h-6 rounded-full bg-[#e8e8e6] text-[#242424] flex items-center justify-center text-[10px] font-bold"
                            title="Vegan"
                          >
                            VG
                          </span>
                        )}
                        {item.isGlutenFree && (
                          <span
                            className="w-6 h-6 rounded-full bg-[#e8e8e6] text-[#242424] flex items-center justify-center text-[10px] font-bold"
                            title="Gluten Free"
                          >
                            GF
                          </span>
                        )}
                        {item.isVegetarian && !item.isVegan && (
                          <span
                            className="w-6 h-6 rounded-full bg-[#e8e8e6] text-[#242424] flex items-center justify-center text-[10px] font-bold"
                            title="Vegetarian"
                          >
                            V
                          </span>
                        )}
                      </div>

                      {/* Add Button */}
                      <button
                        disabled={item.isSoldOut}
                        onClick={e => {
                          e.stopPropagation();
                          if (!item.isSoldOut) setCustomizingItem(item);
                        }}
                        className={`w-10 h-10 rounded-full flex items-center justify-center shadow-sm transition-colors cursor-pointer ${
                          item.isSoldOut
                            ? 'bg-[#dadad8] text-[#727975]'
                            : 'bg-[#16342b] text-white hover:bg-[#2d4b41]'
                        }`}
                      >
                        <Plus className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {/* Floating Cart Button */}
        {cartItemCount > 0 && (
          <div className="fixed bottom-[84px] md:bottom-8 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-[360px]">
            <button
              onClick={() => setIsCheckoutOpen(true)}
              className="w-full bg-[#16342b] text-white rounded-full py-3.5 px-5 flex items-center justify-between shadow-[0_8px_24px_rgba(22,52,43,0.25)] hover:bg-[#2d4b41] transition-all cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="bg-white/20 rounded-full w-8 h-8 flex items-center justify-center">
                  <ShoppingBag className="w-4 h-4" />
                </div>
                <span className="font-semibold text-sm">
                  {cartItemCount} {cartItemCount === 1 ? 'item' : 'items'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm">
                  {restaurant.currencySymbol}
                  {cartTotalAmount.toFixed(2)}
                </span>
                <ArrowRight className="w-4 h-4" />
              </div>
            </button>
          </div>
        )}

        {/* Active Order Tracker Pill */}
        {activeOrder && activeOrder.status !== 'completed' && activeOrder.status !== 'cancelled' && (
          <div className="fixed bottom-36 md:bottom-24 right-4 z-40">
            <button
              onClick={() => setIsTrackerOpen(true)}
              className="bg-[#16342b] text-white px-4 py-2 rounded-full shadow-lg text-xs font-bold flex items-center gap-2 hover:bg-[#2d4b41] animate-bounce cursor-pointer border border-[#3e6357]"
            >
              <Clock className="w-3.5 h-3.5 text-[#c8eadc]" />
              <span>Track Order {activeOrder.orderNumber}</span>
            </button>
          </div>
        )}

        {/* Bottom Navigation Bar */}
        <nav className="fixed bottom-0 left-0 right-0 max-w-md md:max-w-4xl mx-auto bg-[#f9f9f7]/90 backdrop-blur-xl border-t border-[#ebebe8] z-40 pb-safe shadow-[0_-4px_16px_rgba(22,52,43,0.06)]">
          <div className="flex justify-around items-center px-4 py-2">
            <button
              onClick={() => {
                setActiveBottomNav('home');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className={`flex flex-col items-center justify-center transition-all cursor-pointer ${
                activeBottomNav === 'home'
                  ? 'bg-[#2d4b41] text-[#99baad] rounded-full px-4 py-1'
                  : 'text-[#414845] hover:text-[#16342b]'
              }`}
            >
              <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: activeBottomNav === 'home' ? "'FILL' 1" : "'FILL' 0" }}>
                home
              </span>
              <span className="text-[10px] font-semibold mt-0.5">Home</span>
            </button>

            <button
              onClick={() => {
                setActiveBottomNav('menu');
                scrollToMenu();
              }}
              className={`flex flex-col items-center justify-center transition-all cursor-pointer ${
                activeBottomNav === 'menu'
                  ? 'bg-[#2d4b41] text-[#99baad] rounded-full px-4 py-1'
                  : 'text-[#414845] hover:text-[#16342b]'
              }`}
            >
              <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: activeBottomNav === 'menu' ? "'FILL' 1" : "'FILL' 0" }}>
                restaurant_menu
              </span>
              <span className="text-[10px] font-semibold mt-0.5">Menu</span>
            </button>

            <button
              onClick={() => {
                setActiveBottomNav('orders');
                if (activeOrder) setIsTrackerOpen(true);
                else setIsCheckoutOpen(true);
              }}
              className={`flex flex-col items-center justify-center transition-all cursor-pointer ${
                activeBottomNav === 'orders'
                  ? 'bg-[#2d4b41] text-[#99baad] rounded-full px-4 py-1'
                  : 'text-[#414845] hover:text-[#16342b]'
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">receipt_long</span>
              <span className="text-[10px] font-semibold mt-0.5">Orders</span>
            </button>

            <button
              onClick={() => {
                setActiveBottomNav('loyalty');
                setIsLoyaltyOpen(true);
              }}
              className={`flex flex-col items-center justify-center transition-all cursor-pointer ${
                activeBottomNav === 'loyalty'
                  ? 'bg-[#2d4b41] text-[#99baad] rounded-full px-4 py-1'
                  : 'text-[#414845] hover:text-[#16342b]'
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">military_tech</span>
              <span className="text-[10px] font-semibold mt-0.5">Loyalty</span>
            </button>

            <button
              onClick={() => {
                setActiveBottomNav('more');
                setIsServiceOpen(true);
              }}
              className={`flex flex-col items-center justify-center transition-all cursor-pointer ${
                activeBottomNav === 'more'
                  ? 'bg-[#2d4b41] text-[#99baad] rounded-full px-4 py-1'
                  : 'text-[#414845] hover:text-[#16342b]'
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">more_horiz</span>
              <span className="text-[10px] font-semibold mt-0.5">More</span>
            </button>
          </div>
        </nav>
      </div>

      {/* Modals & Drawers */}
      <ItemCustomizerModal
        item={customizingItem}
        currency={restaurant.currencySymbol}
        onClose={() => setCustomizingItem(null)}
        onAddToCart={addToCart}
      />

      <CheckoutDrawer
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        onOrderPlaced={orderId => setIsTrackerOpen(true)}
      />

      <OrderTrackerModal
        isOpen={isTrackerOpen}
        order={activeOrder}
        currency={restaurant.currencySymbol}
        onClose={() => setIsTrackerOpen(false)}
        onRequestService={() => {
          setIsTrackerOpen(false);
          setIsServiceOpen(true);
        }}
      />

      <ServiceRequestModal
        isOpen={isServiceOpen}
        onClose={() => setIsServiceOpen(false)}
      />

      <LoyaltyDrawer
        isOpen={isLoyaltyOpen}
        onClose={() => setIsLoyaltyOpen(false)}
      />

      <ReviewModal
        isOpen={isReviewOpen}
        onClose={() => setIsReviewOpen(false)}
      />

      <TableSelectorModal
        isOpen={isTableSelectorOpen}
        onClose={() => setIsTableSelectorOpen(false)}
      />
    </div>
  );
};
