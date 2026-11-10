import React, { useState } from 'react';
import { useRestaurant } from '../../context/RestaurantContext';
import { pilotRpc } from '../../lib/pilot';
import type { OpeningHours } from '../../lib/hours';
export function BrandingSettings() {
  const { restaurant, activeLocationId, retryLoad } = useRestaurant();
  const loc = restaurant?.locations.find((l) => l.id === activeLocationId);
  const [description, setDescription] = useState(restaurant?.description || ''),
    [logo, setLogo] = useState(restaurant?.logoUrl || ''),
    [cover, setCover] = useState(restaurant?.coverImageUrl || ''),
    [color, setColor] = useState(restaurant?.primaryColor || '#16342b');
  const [timezone, setTimezone] = useState(loc?.timezone || 'UTC'),
    [currency, setCurrency] = useState(loc?.currency || ''),
    [enabled, setEnabled] = useState(!!loc?.openingSchedule),
    [hours, setHours] = useState<OpeningHours>(
      loc?.openingSchedule ||
        Object.fromEntries(
          Array.from({ length: 7 }, (_, i) => [
            String(i),
            { closed: true, open: '09:00', close: '21:00' },
          ]),
        ),
    ),
    [holidays, setHolidays] = useState((loc?.holidayClosures || []).join('\n'));
  const [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false);
  if (!restaurant || !loc) return null;
  return (
    <form
      className="p-5 border rounded-xl bg-white space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        setBusy(true);
        setError('');
        setNotice('');
        try {
          await pilotRpc('pilot_save_branding', {
            p_restaurant: restaurant.id,
            p_location: loc.id,
            p_description: description,
            p_logo: logo,
            p_cover: cover,
            p_color: color,
            p_timezone: timezone,
            p_currency: currency,
            p_hours: enabled ? hours : null,
            p_holidays: holidays.split(/\s+/).filter(Boolean),
          });
          setNotice('Branding and location schedule saved.');
          retryLoad();
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Settings not confirmed.');
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2 className="text-lg font-semibold">Branding & location schedule</h2>
      <p className="text-sm">
        Branding applies to the restaurant. Schedule, holidays, currency and timezone apply to this
        location. Currency changes with an existing menu or order history need a reviewed migration.
      </p>
      <label className="block">
        Restaurant description
        <textarea
          maxLength={2000}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="block w-full p-2 border rounded-lg"
        />
      </label>
      <label className="block">
        Logo URL (HTTPS)
        <input
          type="url"
          value={logo}
          onChange={(e) => setLogo(e.target.value)}
          className="block w-full p-2 border rounded-lg"
        />
      </label>
      <label className="block">
        Cover image URL (HTTPS)
        <input
          type="url"
          value={cover}
          onChange={(e) => setCover(e.target.value)}
          className="block w-full p-2 border rounded-lg"
        />
      </label>
      <label className="block">
        Brand accent
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="ml-2"
        />
      </label>
      <label className="block">
        Location timezone
        <input
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          className="p-2 border rounded-lg ml-2"
        />
      </label>
      <label className="block">
        Location currency
        <input
          maxLength={3}
          value={currency}
          onChange={(e) => setCurrency(e.target.value.toUpperCase())}
          className="p-2 border rounded-lg ml-2 w-24"
        />
      </label>
      <label className="block">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />{' '}
        Enforce configured ordering hours
      </label>
      {enabled && (
        <fieldset className="space-y-2">
          <legend>Same-day hours (overnight service needs a separate workflow)</legend>
          {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(
            (day, i) => (
              <div key={day} className="flex flex-wrap items-center gap-2">
                <span className="w-24">{day}</span>
                <label>
                  <input
                    type="checkbox"
                    checked={hours[i].closed}
                    onChange={(e) =>
                      setHours((prev) => ({
                        ...prev,
                        [i]: { ...prev[i], closed: e.target.checked },
                      }))
                    }
                  />{' '}
                  Closed
                </label>
                {!hours[i].closed && (
                  <>
                    <input
                      aria-label={`${day} opens`}
                      type="time"
                      required
                      value={hours[i].open || ''}
                      onChange={(e) =>
                        setHours((prev) => ({ ...prev, [i]: { ...prev[i], open: e.target.value } }))
                      }
                    />
                    <span>to</span>
                    <input
                      aria-label={`${day} closes`}
                      type="time"
                      required
                      value={hours[i].close || ''}
                      onChange={(e) =>
                        setHours((prev) => ({
                          ...prev,
                          [i]: { ...prev[i], close: e.target.value },
                        }))
                      }
                    />
                  </>
                )}
              </div>
            ),
          )}
        </fieldset>
      )}
      <label className="block">
        Holiday closures (YYYY-MM-DD, one per line)
        <textarea
          value={holidays}
          onChange={(e) => setHolidays(e.target.value)}
          className="block w-full p-2 border rounded-lg"
        />
      </label>
      <button disabled={busy} className="p-3 bg-[#16342b] text-white rounded-lg">
        Save branding and schedule
      </button>
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
    </form>
  );
}
