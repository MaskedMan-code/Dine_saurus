import React, { useState, useEffect, useCallback } from 'react';
import { useRestaurant } from '../../context/RestaurantContext';
import { pilotRpc } from '../../lib/pilot';
import { formatMoney } from '../billing/PrintDocument';
export function FinancialOverview() {
  const { restaurant, activeLocationId } = useRestaurant();
  const timezone = restaurant?.locations.find((l) => l.id === activeLocationId)?.timezone || 'UTC';
  const [day, setDay] = useState(() =>
      new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date()),
    ),
    [data, setData] = useState<any>(null),
    [error, setError] = useState(''),
    [tick, setTick] = useState(0);
  const load = useCallback(
    async () => pilotRpc('pilot_daily_metrics', { p_location: activeLocationId, p_date: day }),
    [activeLocationId, day],
  );
  useEffect(() => {
    let alive = true;
    setError('');
    setData(null);
    void load()
      .then((d) => {
        if (alive) setData(d);
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [load, tick]);
  const money = (n: number) => formatMoney(n, data.currency);
  return (
    <section className="p-5 bg-white border rounded-xl space-y-4">
      <h2 className="text-xl font-semibold">Daily operations & recorded collections</h2>
      <p className="text-sm">
        Server totals for this location in {timezone}. Order value, issued bills and payment records
        use their own event dates; they are separate measures. Outstanding balances and operational
        queues are current across all dates.
      </p>
      <label>
        Business date
        <input
          type="date"
          className="p-2 border rounded-lg ml-2"
          value={day}
          onChange={(e) => setDay(e.target.value)}
        />
      </label>
      <button className="underline p-2" onClick={() => setTick((t) => t + 1)}>
        Refresh operational metrics
      </button>
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      {data ? (
        <>
          <dl className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              ['Order count', data.orders.count],
              ['Ordered amount', money(data.orders.ordered_total)],
              [
                'Average order value',
                data.orders.average_order_value === null
                  ? 'No orders'
                  : money(data.orders.average_order_value),
              ],
              ['Billed total', money(data.billing.billed_total)],
              ['Bill discounts', money(data.billing.discounts)],
              ['Billed taxes', money(data.billing.taxes)],
              ['Billed service charge', money(data.billing.service_charges)],
              ['Payments recorded', money(data.collections.received)],
              ['Refunds / reversals', money(data.collections.returned)],
              ['Net recorded collections', money(data.collections.net)],
              ['Current outstanding', money(data.current.outstanding)],
              ['Current unpaid orders', data.current.unpaid_orders],
              ['Occupied tables', data.current.occupied_tables],
              ['Open service requests', data.current.service_requests],
              ['Kitchen backlog', data.current.kitchen_backlog],
              ['Completed orders', data.orders.completed],
              ['Sessions closed', data.closed_sessions],
            ].map(([label, value]) => (
              <div key={label} className="p-3 bg-[#f4f4f2] rounded-lg">
                <dt className="text-xs">{label}</dt>
                <dd className="font-bold">{value}</dd>
              </div>
            ))}
          </dl>
          <p>
            Average preparation:{' '}
            {data.timing.preparation_minutes === null
              ? 'Not yet measurable'
              : `${Number(data.timing.preparation_minutes).toFixed(1)} min`}{' '}
            · Average acceptance-to-completion:{' '}
            {data.timing.completion_minutes === null
              ? 'Not yet measurable'
              : `${Number(data.timing.completion_minutes).toFixed(1)} min`}
          </p>
          <div className="grid md:grid-cols-3 gap-4">
            <section>
              <h3 className="font-semibold">Items by quantity</h3>
              {data.items.length ? (
                data.items.map((i: any) => (
                  <p key={i.name}>
                    {i.name}: {i.quantity} · {money(i.line_value)}
                  </p>
                ))
              ) : (
                <p>No item history for this date.</p>
              )}
            </section>
            <section>
              <h3 className="font-semibold">Category line value</h3>
              {data.categories.length ? (
                data.categories.map((c: any) => (
                  <p key={c.name}>
                    {c.name}: {money(c.line_value)}
                  </p>
                ))
              ) : (
                <p>No category history for this date.</p>
              )}
            </section>
            <section>
              <h3 className="font-semibold">Ordering periods</h3>
              {data.hours.length ? (
                data.hours.map((h: any) => (
                  <p key={h.hour}>
                    {String(h.hour).padStart(2, '0')}:00 — {h.count} orders
                  </p>
                ))
              ) : (
                <p>No ordering history for this date.</p>
              )}
            </section>
          </div>
          <p className="text-xs">
            Item/category amounts are ordered line values before bill-level adjustments and
            collections. Category names use the current catalog; archived items may be
            uncategorized. Closed-session reporting starts from recorded closure events.
          </p>
        </>
      ) : (
        !error && <p role="status">Loading server metrics…</p>
      )}
    </section>
  );
}
