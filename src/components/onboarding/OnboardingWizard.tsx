import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import {
  Building2,
  MapPin,
  LayoutGrid,
  Table as TableIcon,
  Loader2,
  ArrowRight,
  ArrowLeft,
  Check,
  Plus,
  X,
} from 'lucide-react';

type Step = 'restaurant' | 'location' | 'area' | 'tables' | 'done';
interface DraftTable {
  name: string;
  capacity: number;
}
interface GeoapifyFeature {
  properties?: {
    formatted?: string;
    address_line1?: string;
    address_line2?: string;
    city?: string;
    state?: string;
    state_code?: string;
    postcode?: string;
    country?: string;
    country_code?: string;
    name?: string;
    timezone?: { name?: string };
    place_id?: string;
    lat?: number;
    lon?: number;
  };
  geometry?: { coordinates?: [number, number] };
}

const COUNTRY_CURRENCY: Record<string, string> = {
  IN: 'INR',
  US: 'USD',
  GB: 'GBP',
  DE: 'EUR',
  FR: 'EUR',
  ES: 'EUR',
  IT: 'EUR',
  NL: 'EUR',
  AE: 'AED',
  CA: 'CAD',
  AU: 'AUD',
  SG: 'SGD',
  NZ: 'NZD',
  JP: 'JPY',
  KR: 'KRW',
  BR: 'BRL',
  MX: 'MXN',
  ZA: 'ZAR',
};

const fieldClass =
  'w-full px-3 py-2.5 rounded-xl border border-[#e5e3dd] text-sm focus:outline-none focus:ring-2 focus:ring-[#16342b]/20';

export const OnboardingWizard: React.FC = () => {
  const { staff, user } = useAuth();
  const { retry } = useTenant();

  const [step, setStep] = useState<Step>('restaurant');
  const submitLock = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [restaurantName, setRestaurantName] = useState('');
  const [restaurantType, setRestaurantType] = useState('');

  const [locationName, setLocationName] = useState('Main Location');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [countryCode, setCountryCode] = useState('IN');
  const [currency, setCurrency] = useState('INR');
  const [timezone, setTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  );
  const [stateRegion, setStateRegion] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [placeId, setPlaceId] = useState('');
  const [locationSuggestions, setLocationSuggestions] = useState<GeoapifyFeature[]>([]);
  const [searchingLocation, setSearchingLocation] = useState(false);
  const [locationSearchError, setLocationSearchError] = useState<string | null>(null);
  const [activeSearchField, setActiveSearchField] = useState<'locationName' | 'address'>('address');
  const addressSearchTimer = useRef<number | undefined>(undefined);
  const addressAbortController = useRef<AbortController | null>(null);
  // The draft key is stable for the authenticated user + organization.
  // Keep the old key as a migration source so existing in-progress onboarding is not lost.
  const onboardingDraftKey =
    staff && user ? `dinesaurus:onboardingDraft:v3:${staff.organizationId}:${user.id}` : null;
  const legacyOnboardingDraftKey =
    staff && user ? `dinesaurus:onboardingDraft:${staff.organizationId}:${user.id}` : null;
  const [hydratedDraftKey, setHydratedDraftKey] = useState<string | null>(null);

  const [areaName, setAreaName] = useState('Main Dining Room');
  const [tables, setTables] = useState<DraftTable[]>([
    { name: 'Table 1', capacity: 2 },
    { name: 'Table 2', capacity: 4 },
  ]);

  // Hydrate the draft first. We deliberately keep persistence in a separate effect that
  // only runs after the hydration render completes. This prevents the initial default state
  // from overwriting an existing draft during a remount/tab wake-up.
  useEffect(() => {
    if (!onboardingDraftKey) return;

    let raw: string | null = null;
    try {
      raw = localStorage.getItem(onboardingDraftKey);
      if (!raw && legacyOnboardingDraftKey) {
        raw = localStorage.getItem(legacyOnboardingDraftKey);
        if (raw) localStorage.setItem(onboardingDraftKey, raw);
      }
    } catch {
      // Ignore blocked/unavailable storage.
    }

    if (raw) {
      try {
        const draft = JSON.parse(raw);
        if (draft && typeof draft === 'object') {
          const validSteps: Step[] = ['restaurant', 'location', 'area', 'tables'];
          if (validSteps.includes(draft.step)) setStep(draft.step);
          if (typeof draft.restaurantName === 'string') setRestaurantName(draft.restaurantName);
          if (typeof draft.restaurantType === 'string') setRestaurantType(draft.restaurantType);
          if (typeof draft.locationName === 'string') setLocationName(draft.locationName);
          if (typeof draft.address === 'string') setAddress(draft.address);
          if (typeof draft.city === 'string') setCity(draft.city);
          if (typeof draft.countryCode === 'string') setCountryCode(draft.countryCode);
          if (typeof draft.currency === 'string') setCurrency(draft.currency);
          if (typeof draft.timezone === 'string') setTimezone(draft.timezone);
          if (typeof draft.stateRegion === 'string') setStateRegion(draft.stateRegion);
          if (typeof draft.postalCode === 'string') setPostalCode(draft.postalCode);
          if (typeof draft.latitude === 'number' || draft.latitude === null)
            setLatitude(draft.latitude ?? null);
          if (typeof draft.longitude === 'number' || draft.longitude === null)
            setLongitude(draft.longitude ?? null);
          if (typeof draft.placeId === 'string') setPlaceId(draft.placeId);
          if (typeof draft.areaName === 'string') setAreaName(draft.areaName);
          if (Array.isArray(draft.tables)) {
            setTables(
              draft.tables.map((t: any) => ({
                name: String(t?.name ?? ''),
                capacity:
                  Number.isFinite(Number(t?.capacity)) && Number(t?.capacity) > 0
                    ? Number(t.capacity)
                    : 1,
              })) as DraftTable[],
            );
          }
        }
      } catch {
        // Ignore malformed drafts and keep the defaults.
      }
    }

    setHydratedDraftKey(onboardingDraftKey);
  }, [onboardingDraftKey, legacyOnboardingDraftKey]);

  useEffect(() => {
    // Do not persist until the exact current key has completed hydration and therefore
    // has had at least one React render with the restored values.
    if (!onboardingDraftKey || hydratedDraftKey !== onboardingDraftKey) return;
    if (step === 'done') {
      try {
        localStorage.removeItem(onboardingDraftKey);
        if (legacyOnboardingDraftKey) localStorage.removeItem(legacyOnboardingDraftKey);
      } catch {
        /* Storage unavailable. */
      }
      return;
    }

    const draft = {
      step,
      restaurantName,
      restaurantType,
      locationName,
      address,
      city,
      countryCode,
      currency,
      timezone,
      stateRegion,
      postalCode,
      latitude,
      longitude,
      placeId,
      areaName,
      tables,
      savedAt: new Date().toISOString(),
    };

    try {
      localStorage.setItem(onboardingDraftKey, JSON.stringify(draft));
    } catch {
      // Ignore blocked/full storage.
    }
  }, [
    onboardingDraftKey,
    legacyOnboardingDraftKey,
    hydratedDraftKey,
    step,
    restaurantName,
    restaurantType,
    locationName,
    address,
    city,
    countryCode,
    currency,
    timezone,
    stateRegion,
    postalCode,
    latitude,
    longitude,
    placeId,
    areaName,
    tables,
  ]);

  // Flush the latest React state to storage when the page is backgrounded or unloaded.
  // This is a last-resort durability layer for browsers that freeze or discard the page.
  useEffect(() => {
    if (!onboardingDraftKey || hydratedDraftKey !== onboardingDraftKey) return;

    const persistNow = () => {
      if (step === 'done') return;
      const draft = {
        step,
        restaurantName,
        restaurantType,
        locationName,
        address,
        city,
        countryCode,
        currency,
        timezone,
        stateRegion,
        postalCode,
        latitude,
        longitude,
        placeId,
        areaName,
        tables,
        savedAt: new Date().toISOString(),
      };
      try {
        localStorage.setItem(onboardingDraftKey, JSON.stringify(draft));
      } catch {
        // Ignore blocked/full storage.
      }
    };

    window.addEventListener('pagehide', persistNow);
    document.addEventListener('visibilitychange', persistNow);
    return () => {
      window.removeEventListener('pagehide', persistNow);
      document.removeEventListener('visibilitychange', persistNow);
    };
  }, [
    onboardingDraftKey,
    legacyOnboardingDraftKey,
    hydratedDraftKey,
    step,
    restaurantName,
    restaurantType,
    locationName,
    address,
    city,
    countryCode,
    currency,
    timezone,
    stateRegion,
    postalCode,
    latitude,
    longitude,
    placeId,
    areaName,
    tables,
  ]);

  useEffect(() => {
    const apiKey = import.meta.env.VITE_GEOAPIFY_API_KEY as string | undefined;
    const rawQuery = activeSearchField === 'locationName' ? locationName.trim() : address.trim();
    const query = rawQuery === 'Main Location' ? '' : rawQuery;

    if (!apiKey || query.length < 3) {
      setLocationSuggestions([]);
      setSearchingLocation(false);
      setLocationSearchError(null);
      return;
    }

    if (addressSearchTimer.current) window.clearTimeout(addressSearchTimer.current);
    addressAbortController.current?.abort();

    addressSearchTimer.current = window.setTimeout(async () => {
      const controller = new AbortController();
      addressAbortController.current = controller;
      setSearchingLocation(true);
      setLocationSearchError(null);

      try {
        const url = new URL('https://api.geoapify.com/v1/geocode/autocomplete');
        url.searchParams.set('text', query);
        url.searchParams.set('format', 'geojson');
        url.searchParams.set('limit', '6');
        url.searchParams.set('apiKey', apiKey);

        const response = await fetch(url.toString(), { signal: controller.signal });
        if (!response.ok) throw new Error(`Geoapify request failed (${response.status})`);
        const data = await response.json();
        const features = Array.isArray(data?.features) ? data.features : [];
        setLocationSuggestions(features);
      } catch (e) {
        if ((e as Error)?.name !== 'AbortError') {
          setLocationSuggestions([]);
          setLocationSearchError(e instanceof Error ? e.message : 'Unable to search addresses.');
        }
      } finally {
        if (!controller.signal.aborted) setSearchingLocation(false);
      }
    }, 250);

    return () => {
      if (addressSearchTimer.current) window.clearTimeout(addressSearchTimer.current);
      addressAbortController.current?.abort();
    };
  }, [activeSearchField, address, locationName]);

  if (!staff) return null;

  const selectLocationSuggestion = (feature: GeoapifyFeature) => {
    const props = feature.properties || {};
    const coords = feature.geometry?.coordinates;
    const nextCountry = (props.country_code || '').toUpperCase();
    const nextCurrency = COUNTRY_CURRENCY[nextCountry] || currency;
    const nextTimezone = props.timezone?.name || timezone;

    setAddress(props.address_line1 || props.formatted || '');
    setCity(props.city || '');
    setStateRegion(props.state || '');
    setPostalCode(props.postcode || '');
    setCountryCode(nextCountry || countryCode);
    setCurrency(nextCurrency);
    setTimezone(nextTimezone);
    setPlaceId(props.place_id || '');
    setLatitude(typeof props.lat === 'number' ? props.lat : (coords?.[1] ?? null));
    setLongitude(typeof props.lon === 'number' ? props.lon : (coords?.[0] ?? null));
    if (activeSearchField === 'locationName' || !locationName || locationName === 'Main Location') {
      setLocationName(props.name || props.city || 'Main Location');
    }
    setLocationSuggestions([]);
    setLocationSearchError(null);
    setError(null);
  };

  const validateRestaurantStep = () => {
    if (restaurantName.trim().length < 2) {
      setError('Restaurant name is required.');
      return false;
    }
    return true;
  };

  const validateLocationStep = () => {
    if (locationName.trim().length < 2) {
      setError('Location name is required.');
      return false;
    }
    if (city.trim().length < 2) {
      setError('City is required.');
      return false;
    }
    if (countryCode.trim().length !== 2) {
      setError('Country code must be exactly 2 letters, for example IN.');
      return false;
    }
    if (currency.trim().length !== 3) {
      setError('Currency must be exactly 3 letters, for example INR.');
      return false;
    }
    if (!timezone.trim()) {
      setError('Timezone is required.');
      return false;
    }
    return true;
  };

  const validateAreaStep = () => {
    if (areaName.trim().length < 2) {
      setError('Seating area name is required.');
      return false;
    }
    return true;
  };

  const validateTablesStep = () => {
    if (tables.length === 0) {
      setError('Add at least one table.');
      return false;
    }

    const seen = new Set<string>();
    for (let i = 0; i < tables.length; i += 1) {
      const name = tables[i].name.trim();
      const capacity = Number(tables[i].capacity);

      if (!name) {
        setError(`Table ${i + 1} needs a name.`);
        return false;
      }
      if (!Number.isInteger(capacity) || capacity < 1) {
        setError(`Table ${i + 1} must have a whole-number capacity of at least 1.`);
        return false;
      }

      const normalized = name.toLocaleLowerCase();
      if (seen.has(normalized)) {
        setError(`Table name "${name}" is duplicated. Each table needs a unique name.`);
        return false;
      }
      seen.add(normalized);
    }

    return true;
  };

  const goToStep = (nextStep: Step) => {
    if (!submitting) {
      setError(null);
      setStep(nextStep);
    }
  };

  const createRestaurant = () => {
    if (validateRestaurantStep()) goToStep('location');
  };

  const createLocation = () => {
    if (validateLocationStep()) goToStep('area');
  };

  const createArea = () => {
    if (validateAreaStep()) goToStep('tables');
  };

  const finishOnboarding = async () => {
    if (!staff || submitLock.current || !validateTablesStep()) return;
    submitLock.current = true;

    setSubmitting(true);
    setError(null);

    const validTables = tables.map((t) => ({
      name: t.name.trim(),
      capacity: Number(t.capacity),
    }));

    try {
      const { data, error: err } = await supabase.rpc('create_restaurant_onboarding', {
        p_organization_id: staff.organizationId,
        p_restaurant_name: restaurantName.trim(),
        p_restaurant_type: restaurantType.trim() || 'Restaurant',
        p_location_name: locationName.trim(),
        p_address: address.trim(),
        p_city: city.trim(),
        p_postal_code: postalCode.trim(),
        p_state_region: stateRegion.trim(),
        p_country_code: countryCode.trim().toUpperCase(),
        p_currency: currency.trim().toUpperCase(),
        p_timezone: timezone.trim(),
        p_latitude: latitude,
        p_longitude: longitude,
        p_place_id: placeId || null,
        p_area_name: areaName.trim(),
        p_tables: validTables,
      });

      setSubmitting(false);

      if (err || !data) {
        setError(
          err?.message ||
            'Failed to complete onboarding. No records were created if the transaction failed.',
        );
        return;
      }

      if (onboardingDraftKey) {
        try {
          localStorage.removeItem(onboardingDraftKey);
          if (legacyOnboardingDraftKey) localStorage.removeItem(legacyOnboardingDraftKey);
        } catch {
          /* ignore */
        }
      }
      setStep('done');
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Onboarding was not confirmed. Please retry.',
      );
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  };

  const updateTable = (idx: number, patch: Partial<DraftTable>) => {
    setTables((prev) => prev.map((t, i) => (i === idx ? { ...t, ...patch } : t)));
    setError(null);
  };

  const addTable = () => {
    setTables((prev) => [...prev, { name: `Table ${prev.length + 1}`, capacity: 2 }]);
    setError(null);
  };

  const removeTable = (idx: number) => {
    setTables((prev) => prev.filter((_, i) => i !== idx));
    setError(null);
  };

  const finish = () => retry();

  const steps: { key: Step; label: string; icon: React.ReactNode }[] = [
    { key: 'restaurant', label: 'Restaurant', icon: <Building2 className="w-4 h-4" /> },
    { key: 'location', label: 'Location', icon: <MapPin className="w-4 h-4" /> },
    { key: 'area', label: 'Area', icon: <LayoutGrid className="w-4 h-4" /> },
    { key: 'tables', label: 'Tables', icon: <TableIcon className="w-4 h-4" /> },
  ];
  const stepIndex = steps.findIndex((s) => s.key === step);

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-10 bg-[#f9f9f7]">
      <div className="w-full max-w-lg bg-white rounded-2xl border border-[#e5e3dd] shadow-sm p-6">
        <div className="mb-6">
          <h1 className="text-lg font-semibold text-[#242424]">Set up your restaurant</h1>
          <p className="text-sm text-[#6b6b6b] mt-1">
            A few quick steps to create real, working records in your database.
          </p>
        </div>

        {step !== 'done' && (
          <div className="flex items-center gap-1 mb-6">
            {steps.map((s, i) => (
              <React.Fragment key={s.key}>
                <div
                  className={`flex items-center gap-1.5 text-xs font-medium ${i <= stepIndex ? 'text-[#16342b]' : 'text-[#c4c2ba]'}`}
                >
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center ${i < stepIndex ? 'bg-[#16342b] text-white' : i === stepIndex ? 'bg-[#eef4f1] text-[#16342b] border border-[#16342b]' : 'bg-[#f0efe9]'}`}
                  >
                    {i < stepIndex ? <Check className="w-3.5 h-3.5" /> : s.icon}
                  </span>
                </div>
                {i < steps.length - 1 && (
                  <div
                    className={`flex-1 h-px ${i < stepIndex ? 'bg-[#16342b]' : 'bg-[#e5e3dd]'}`}
                  />
                )}
              </React.Fragment>
            ))}
          </div>
        )}

        {error && (
          <p
            role="alert"
            className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4"
          >
            {error}
          </p>
        )}

        {step === 'restaurant' && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-[#6b6b6b] mb-1">
                Restaurant name
              </label>
              <input
                required
                value={restaurantName}
                onChange={(e) => {
                  setRestaurantName(e.target.value);
                  setError(null);
                }}
                placeholder="e.g. Nordic Table"
                className={fieldClass}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#6b6b6b] mb-1">
                Cuisine / type (optional)
              </label>
              <input
                value={restaurantType}
                onChange={(e) => setRestaurantType(e.target.value)}
                placeholder="e.g. Italian Bistro"
                className={fieldClass}
              />
            </div>
            <button
              type="button"
              onClick={createRestaurant}
              disabled={submitting}
              className="w-full py-2.5 rounded-xl bg-[#16342b] text-white text-sm font-semibold hover:bg-[#1e4438] disabled:opacity-60 flex items-center justify-center gap-2"
            >
              Continue <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {step === 'location' && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-[#6b6b6b] mb-1">
                Location name <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  required
                  value={locationName}
                  onFocus={() => setActiveSearchField('locationName')}
                  onChange={(e) => {
                    setActiveSearchField('locationName');
                    setLocationName(e.target.value);
                    setPlaceId('');
                    setLatitude(null);
                    setLongitude(null);
                    setError(null);
                  }}
                  placeholder="e.g. Phoenix Palassio"
                  autoComplete="off"
                  className={fieldClass}
                  aria-autocomplete="list"
                  aria-expanded={
                    activeSearchField === 'locationName' && locationSuggestions.length > 0
                  }
                />
                {activeSearchField === 'locationName' && searchingLocation && (
                  <Loader2 className="w-4 h-4 animate-spin absolute right-3 top-3 text-[#7f7f7f]" />
                )}
                {activeSearchField === 'locationName' && locationSuggestions.length > 0 && (
                  <div
                    className="absolute z-40 left-0 right-0 mt-1 max-h-64 overflow-auto rounded-xl border border-[#e5e3dd] bg-white shadow-lg"
                    role="listbox"
                  >
                    {locationSuggestions.map((feature, idx) => {
                      const props = feature.properties || {};
                      return (
                        <button
                          key={props.place_id || `${props.formatted}-${idx}`}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => selectLocationSuggestion(feature)}
                          className="w-full text-left px-3 py-2.5 hover:bg-[#f5f4ef] border-b last:border-b-0 border-[#efeee9]"
                          role="option"
                        >
                          <div className="text-sm font-medium text-[#242424]">
                            {props.name || props.city || props.formatted || 'Location'}
                          </div>
                          <div className="text-xs text-[#6b6b6b] mt-0.5">
                            {props.formatted || ''}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            <div className="relative">
              <label className="block text-xs font-medium text-[#6b6b6b] mb-1">
                Search address <span className="text-[#9a9a9a]">(optional)</span>
              </label>
              <div className="relative">
                <input
                  value={address}
                  onFocus={() => setActiveSearchField('address')}
                  onChange={(e) => {
                    setActiveSearchField('address');
                    setAddress(e.target.value);
                    setPlaceId('');
                    setLatitude(null);
                    setLongitude(null);
                    setError(null);
                  }}
                  placeholder="Start typing a restaurant, street, or landmark"
                  autoComplete="off"
                  className={fieldClass}
                  aria-autocomplete="list"
                  aria-expanded={activeSearchField === 'address' && locationSuggestions.length > 0}
                />
                {searchingLocation && (
                  <Loader2 className="w-4 h-4 animate-spin absolute right-3 top-3 text-[#7f7f7f]" />
                )}
              </div>
              {locationSearchError && (
                <p className="text-[11px] text-amber-700 mt-1">
                  {locationSearchError} You can still enter the address manually.
                </p>
              )}
              {activeSearchField === 'address' && locationSuggestions.length > 0 && (
                <div
                  className="absolute z-40 left-0 right-0 mt-1 max-h-64 overflow-auto rounded-xl border border-[#e5e3dd] bg-white shadow-lg"
                  role="listbox"
                >
                  {locationSuggestions.map((feature, idx) => {
                    const props = feature.properties || {};
                    return (
                      <button
                        key={props.place_id || `${props.formatted}-${idx}`}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => selectLocationSuggestion(feature)}
                        className="w-full text-left px-3 py-2.5 hover:bg-[#f5f4ef] border-b last:border-b-0 border-[#efeee9]"
                        role="option"
                      >
                        <div className="text-sm font-medium text-[#242424]">
                          {props.name || props.city || props.formatted || 'Location'}
                        </div>
                        <div className="text-xs text-[#6b6b6b] mt-0.5">{props.formatted || ''}</div>
                      </button>
                    );
                  })}
                </div>
              )}
              <p className="text-[11px] text-[#9a9a9a] mt-1">
                Powered by Geoapify / OpenStreetMap. Select a result to fill the location
                automatically.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#6b6b6b] mb-1">
                  City <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  value={city}
                  onChange={(e) => {
                    setCity(e.target.value);
                    setError(null);
                  }}
                  className={fieldClass}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#6b6b6b] mb-1">
                  Currency <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  value={currency}
                  onChange={(e) => {
                    setCurrency(
                      e.target.value
                        .replace(/[^a-z]/gi, '')
                        .slice(0, 3)
                        .toUpperCase(),
                    );
                    setError(null);
                  }}
                  maxLength={3}
                  placeholder="INR"
                  className={fieldClass}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#6b6b6b] mb-1">
                  State / region
                </label>
                <input
                  value={stateRegion}
                  onChange={(e) => setStateRegion(e.target.value)}
                  placeholder="e.g. Uttar Pradesh"
                  className={fieldClass}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#6b6b6b] mb-1">Postcode</label>
                <input
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  placeholder="e.g. 226010"
                  className={fieldClass}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#6b6b6b] mb-1">
                  Country code <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  value={countryCode}
                  onChange={(e) => {
                    setCountryCode(
                      e.target.value
                        .replace(/[^a-z]/gi, '')
                        .slice(0, 2)
                        .toUpperCase(),
                    );
                    setError(null);
                  }}
                  maxLength={2}
                  placeholder="IN"
                  className={fieldClass}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#6b6b6b] mb-1">
                  Timezone <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  value={timezone}
                  onChange={(e) => {
                    setTimezone(e.target.value.trim());
                    setError(null);
                  }}
                  placeholder="Asia/Kolkata"
                  className={fieldClass}
                />
              </div>
            </div>
            {latitude !== null && longitude !== null && (
              <div className="rounded-lg bg-[#f5f7f5] border border-[#e5e9e5] px-3 py-2 text-[11px] text-[#59635e]">
                Location selected: {latitude.toFixed(6)}, {longitude.toFixed(6)}
                {placeId ? ' · place saved' : ''}
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => goToStep('restaurant')}
                disabled={submitting}
                className="w-1/3 py-2.5 rounded-xl border border-[#e5e3dd] text-[#4f4f4f] text-sm font-semibold hover:bg-[#f5f4ef] disabled:opacity-60 flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <button
                type="button"
                onClick={createLocation}
                disabled={submitting}
                className="flex-1 py-2.5 rounded-xl bg-[#16342b] text-white text-sm font-semibold hover:bg-[#1e4438] disabled:opacity-60 flex items-center justify-center gap-2"
              >
                Continue <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {step === 'area' && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-[#6b6b6b] mb-1">
                First seating area <span className="text-red-500">*</span>
              </label>
              <input
                required
                value={areaName}
                onChange={(e) => {
                  setAreaName(e.target.value);
                  setError(null);
                }}
                placeholder="e.g. Main Dining Room, Patio"
                className={fieldClass}
              />
              <p className="text-xs text-[#9a9a9a] mt-1">
                You can add more areas later from the Floor Plan tab.
              </p>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => goToStep('location')}
                disabled={submitting}
                className="w-1/3 py-2.5 rounded-xl border border-[#e5e3dd] text-[#4f4f4f] text-sm font-semibold hover:bg-[#f5f4ef] disabled:opacity-60 flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <button
                type="button"
                onClick={createArea}
                disabled={submitting}
                className="flex-1 py-2.5 rounded-xl bg-[#16342b] text-white text-sm font-semibold hover:bg-[#1e4438] disabled:opacity-60 flex items-center justify-center gap-2"
              >
                Continue <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {step === 'tables' && (
          <div className="space-y-3">
            {tables.map((t, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={t.name}
                  onChange={(e) => updateTable(i, { name: e.target.value })}
                  placeholder="Table name"
                  className="flex-1 px-3 py-2 rounded-xl border border-[#e5e3dd] text-sm focus:outline-none focus:ring-2 focus:ring-[#16342b]/20"
                />
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={t.capacity}
                  onChange={(e) => updateTable(i, { capacity: Number(e.target.value) })}
                  className="w-20 px-3 py-2 rounded-xl border border-[#e5e3dd] text-sm focus:outline-none focus:ring-2 focus:ring-[#16342b]/20"
                />
                <button
                  type="button"
                  onClick={() => removeTable(i)}
                  className="p-2 text-[#9a9a9a] hover:text-red-600"
                  aria-label={`Remove ${t.name || `table ${i + 1}`}`}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addTable}
              className="flex items-center gap-1.5 text-xs font-medium text-[#16342b] hover:underline"
            >
              <Plus className="w-3.5 h-3.5" /> Add another table
            </button>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => goToStep('area')}
                disabled={submitting}
                className="w-1/3 py-2.5 rounded-xl border border-[#e5e3dd] text-[#4f4f4f] text-sm font-semibold hover:bg-[#f5f4ef] disabled:opacity-60 flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <button
                type="button"
                onClick={finishOnboarding}
                disabled={submitting || tables.length === 0}
                className="flex-1 py-2.5 rounded-xl bg-[#16342b] text-white text-sm font-semibold hover:bg-[#1e4438] disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    Create tables & finish <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {step === 'done' && (
          <div className="text-center py-4">
            <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3">
              <Check className="w-6 h-6" />
            </div>
            <h2 className="font-semibold text-[#242424] mb-1">You're all set!</h2>
            <p className="text-sm text-[#6b6b6b] mb-5">
              Your restaurant, location, area, tables, and QR codes are live in Supabase.
            </p>
            <button
              type="button"
              onClick={finish}
              className="w-full py-2.5 rounded-xl bg-[#16342b] text-white text-sm font-semibold hover:bg-[#1e4438]"
            >
              Go to dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
