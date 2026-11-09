import { MENU_IMAGE_PLACEHOLDER } from '../../lib/placeholder';
import React, { useRef, useState } from 'react';
import { useRestaurant } from '../../context/RestaurantContext';
import { MenuItem, MenuCategory, ModifierGroup } from '../../types';
import {
  BookOpen,
  Plus,
  Search,
  SlidersHorizontal,
  Edit,
  Trash2,
  Check,
  X,
  Sparkles,
  Flame,
  Clock,
  Leaf,
  Layers,
  DollarSign,
  AlertCircle,
  Eye,
  EyeOff,
} from 'lucide-react';

export const MenuAdminView: React.FC = () => {
  const {
    restaurant,
    categories,
    menuItems,
    selectedCategory,
    setSelectedCategory,
    toggleItemSoldOut,
    saveMenuItem,
    deleteMenuItem,
    saveCategory,
    mutationError,
  } = useRestaurant();

  const writeLock = useRef(false);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeTabCategory, setActiveTabCategory] = useState<string>('all');
  const [editingItem, setEditingItem] = useState<Partial<MenuItem> | null>(null);
  const [isItemModalOpen, setIsItemModalOpen] = useState<boolean>(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState<boolean>(false);
  const [newCatName, setNewCatName] = useState<string>('');

  if (!restaurant) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center text-sm text-[#6b6b6b]">
        No restaurant loaded.
      </div>
    );
  }

  const filteredItems = menuItems.filter((item) => {
    if (activeTabCategory !== 'all' && item.categoryId !== activeTabCategory) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return item.name.toLowerCase().includes(q) || item.description.toLowerCase().includes(q);
    }
    return true;
  });

  const openAddItem = () => {
    setEditingItem({
      categoryId: categories[0]?.id || 'cat_mains',
      name: '',
      description: '',
      price: 12.0,
      currency: restaurant.currencyCode || 'USD',
      imageUrl:
        'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80',
      isVegetarian: false,
      isVegan: false,
      isGlutenFree: false,
      isFeatured: false,
      isBestseller: false,
      isSoldOut: false,
      preparationTimeMinutes: 15,
      modifierGroups: [],
    });
    setIsItemModalOpen(true);
  };

  const openEditItem = (item: MenuItem) => {
    setEditingItem({ ...item });
    setIsItemModalOpen(true);
  };

  const handleSaveItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (writeLock.current || !editingItem || !editingItem.name || !editingItem.categoryId) return;
    writeLock.current = true;
    setSaving(true);
    try {
      const itemToSave: MenuItem = {
        id: editingItem.id || `item_${Date.now()}`,
        categoryId: editingItem.categoryId,
        name: editingItem.name,
        description: editingItem.description || '',
        price: Number(editingItem.price) || 0,
        currency: editingItem.currency || restaurant.currencyCode || 'USD',
        imageUrl: editingItem.imageUrl || '',
        isVegetarian: !!editingItem.isVegetarian,
        isVegan: !!editingItem.isVegan,
        isGlutenFree: !!editingItem.isGlutenFree,
        isFeatured: !!editingItem.isFeatured,
        isBestseller: !!editingItem.isBestseller,
        isSoldOut: !!editingItem.isSoldOut,
        preparationTimeMinutes: Number(editingItem.preparationTimeMinutes) || 15,
        modifierGroups: editingItem.modifierGroups || [],
      };

      if (!(await saveMenuItem(itemToSave))) return;
      setIsItemModalOpen(false);
      setEditingItem(null);
    } finally {
      writeLock.current = false;
      setSaving(false);
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (writeLock.current || !newCatName.trim()) return;
    writeLock.current = true;
    setSaving(true);
    try {
      const newCat: MenuCategory = {
        id: `cat_${Date.now()}`,
        name: newCatName.trim(),
        sortOrder: categories.length + 1,
        isActive: true,
      };

      if (!(await saveCategory(newCat))) return;
      setNewCatName('');
      setIsCategoryModalOpen(false);
    } finally {
      writeLock.current = false;
      setSaving(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header Card */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-sm">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-semibold text-lg text-slate-900">Menu & Catalog Management</h2>
            <p className="text-xs text-slate-500">
              Curate dishes, customize modifiers, price points, and manage live 86/sold-out status
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsCategoryModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition font-medium text-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Category</span>
          </button>
          <button
            onClick={openAddItem}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition font-medium text-xs shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Menu Item</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Categories Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto no-scrollbar">
          <button
            onClick={() => setActiveTabCategory('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap ${
              activeTabCategory === 'all'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            All Items ({menuItems.length})
          </button>
          {categories.map((cat) => {
            const count = menuItems.filter((i) => i.categoryId === cat.id).length;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveTabCategory(cat.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap ${
                  activeTabCategory === cat.id
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {cat.name} ({count})
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search items by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50"
          />
        </div>
      </div>

      {/* Menu Items Table / Grid */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Item Details</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Price</th>
                <th className="py-3 px-4">Tags & Modifiers</th>
                <th className="py-3 px-4">Availability (86)</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredItems.map((item) => {
                const cat = categories.find((c) => c.id === item.categoryId);

                return (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* Item info */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={item.imageUrl || MENU_IMAGE_PLACEHOLDER}
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = MENU_IMAGE_PLACEHOLDER;
                          }}
                          alt={item.name}
                          className="w-12 h-12 rounded-lg object-cover border border-slate-200 flex-shrink-0"
                        />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-slate-900 text-sm">
                              {item.name}
                            </span>
                            {item.isBestseller && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                Bestseller
                              </span>
                            )}
                            {item.isFeatured && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                Featured
                              </span>
                            )}
                          </div>
                          <p className="text-slate-500 line-clamp-1 text-[11px] max-w-sm">
                            {item.description}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Category */}
                    <td className="py-3 px-4">
                      <span className="px-2.5 py-1 rounded-full text-xs bg-slate-100 text-slate-700 font-medium">
                        {cat?.name || 'General'}
                      </span>
                    </td>

                    {/* Price */}
                    <td className="py-3 px-4 font-semibold text-slate-900 text-sm">
                      {restaurant.currencySymbol}
                      {item.price.toFixed(2)}
                    </td>

                    {/* Dietary Tags & Modifiers */}
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap items-center gap-1">
                        {item.isVegetarian && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Vegetarian
                          </span>
                        )}
                        {item.isVegan && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-50 text-green-700 border border-green-200">
                            Vegan
                          </span>
                        )}
                        {item.isGlutenFree && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                            Gluten-Free
                          </span>
                        )}
                        {item.modifierGroups && item.modifierGroups.length > 0 && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                            {item.modifierGroups.length} Mod Groups
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Sold out toggle */}
                    <td className="py-3 px-4">
                      <button
                        onClick={() => toggleItemSoldOut(item.id)}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition cursor-pointer ${
                          item.isSoldOut
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}
                      >
                        {item.isSoldOut ? (
                          <EyeOff className="w-3.5 h-3.5" />
                        ) : (
                          <Eye className="w-3.5 h-3.5" />
                        )}
                        <span>{item.isSoldOut ? 'Sold Out (86)' : 'In Stock'}</span>
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEditItem(item)}
                          className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition cursor-pointer"
                          title="Edit Item"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Delete "${item.name}" from menu?`)) {
                              deleteMenuItem(item.id);
                            }
                          }}
                          className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition cursor-pointer"
                          title="Delete Item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Item Modal */}
      {isItemModalOpen && editingItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-lg w-full p-6 my-8">
            <h3 className="font-semibold text-base text-slate-900 mb-4">
              {editingItem.id ? 'Edit Menu Item' : 'Create New Menu Item'}
            </h3>

            {mutationError && (
              <p role="alert" className="text-red-700 bg-red-50 p-3 rounded-lg mb-3 text-sm">
                {mutationError}
              </p>
            )}
            <form onSubmit={handleSaveItemSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Item Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Nordic Gravlax Toast"
                  value={editingItem.name || ''}
                  onChange={(e) => setEditingItem((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Category</label>
                  <select
                    value={editingItem.categoryId || categories[0]?.id}
                    onChange={(e) =>
                      setEditingItem((prev) => ({ ...prev, categoryId: e.target.value }))
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-xs"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Price ({restaurant.currencySymbol})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={editingItem.price || 0}
                    onChange={(e) =>
                      setEditingItem((prev) => ({ ...prev, price: parseFloat(e.target.value) }))
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Description & Ingredients
                </label>
                <textarea
                  rows={3}
                  placeholder="Describe flavors, allergens, origins..."
                  value={editingItem.description || ''}
                  onChange={(e) =>
                    setEditingItem((prev) => ({ ...prev, description: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Image URL (Unsplash or direct asset)
                </label>
                <input
                  type="url"
                  placeholder="https://images.unsplash.com/..."
                  value={editingItem.imageUrl || ''}
                  onChange={(e) =>
                    setEditingItem((prev) => ({ ...prev, imageUrl: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Prep Time (minutes)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={editingItem.preparationTimeMinutes || 15}
                    onChange={(e) =>
                      setEditingItem((prev) => ({
                        ...prev,
                        preparationTimeMinutes: Number(e.target.value),
                      }))
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs"
                  />
                </div>

                <div className="flex flex-col justify-end">
                  <label className="flex items-center gap-2 font-medium text-slate-700 cursor-pointer mb-2">
                    <input
                      type="checkbox"
                      checked={!!editingItem.isSoldOut}
                      onChange={(e) =>
                        setEditingItem((prev) => ({ ...prev, isSoldOut: e.target.checked }))
                      }
                      className="rounded text-rose-600 focus:ring-rose-500"
                    />
                    <span className="text-rose-700 font-semibold">Mark as Sold Out (86)</span>
                  </label>
                </div>
              </div>

              {/* Badges toggles */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                <p className="font-semibold text-slate-800 text-[11px] uppercase tracking-wider">
                  Dietary & Flags
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!editingItem.isVegetarian}
                      onChange={(e) =>
                        setEditingItem((prev) => ({ ...prev, isVegetarian: e.target.checked }))
                      }
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-slate-700">Vegetarian</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!editingItem.isVegan}
                      onChange={(e) =>
                        setEditingItem((prev) => ({ ...prev, isVegan: e.target.checked }))
                      }
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-slate-700">Vegan</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!editingItem.isGlutenFree}
                      onChange={(e) =>
                        setEditingItem((prev) => ({ ...prev, isGlutenFree: e.target.checked }))
                      }
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-slate-700">Gluten-Free</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!editingItem.isBestseller}
                      onChange={(e) =>
                        setEditingItem((prev) => ({ ...prev, isBestseller: e.target.checked }))
                      }
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-slate-700">Bestseller</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!editingItem.isFeatured}
                      onChange={(e) =>
                        setEditingItem((prev) => ({ ...prev, isFeatured: e.target.checked }))
                      }
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-slate-700">Featured</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsItemModalOpen(false);
                    setEditingItem(null);
                  }}
                  className="px-3 py-2 font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition shadow-sm cursor-pointer"
                >
                  Save Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Category Modal */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-sm w-full p-6">
            <h3 className="font-semibold text-base text-slate-900 mb-4">Add Menu Category</h3>
            {mutationError && (
              <p role="alert" className="text-red-700 bg-red-50 p-3 rounded-lg mb-3 text-sm">
                {mutationError}
              </p>
            )}
            <form onSubmit={handleAddCategory} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Category Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Artisan Desserts"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition shadow-sm cursor-pointer"
                >
                  Create Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
