import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useRestaurant } from '../../context/RestaurantContext';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { pilotRpc, submitPilotWrite } from '../../lib/pilot';
import type { Bill, PaperWidth } from '../../types/pilot';
import { ReceiptDocument, formatMoney, printDocument } from './PrintDocument';

export function BillingView() {
  const { orders, activeLocationId } = useRestaurant();
  const { staff } = useAuth();
  const [selected, setSelected] = useState<string[]>([]),
    [discount, setDiscount] = useState('0'),
    [reason, setReason] = useState('');
  const [bill, setBill] = useState<Bill | null>(null),
    [recent, setRecent] = useState<any[]>([]),
    [amount, setAmount] = useState(''),
    [method, setMethod] = useState('cash'),
    [kind, setKind] = useState('payment'),
    [original, setOriginal] = useState(''),
    [reference, setReference] = useState(''),
    [paymentReason, setPaymentReason] = useState('');
  const [paper, setPaper] = useState<PaperWidth>('80'),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    [summary, setSummary] = useState<any>(null),
    [date, setDate] = useState(''),
    [counted, setCounted] = useState(''),
    [closeNote, setCloseNote] = useState('');
  const lock = useRef(false);
  const canAdjust = staff && ['owner', 'admin', 'manager'].includes(staff.role);
  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('pilot_bills')
      .select('id,receipt_number,total,currency,state')
      .eq('location_id', activeLocationId)
      .order('created_at', { ascending: false })
      .limit(30);
    if (error) throw new Error(error.message);
    setRecent(data || []);
  }, [activeLocationId]);
  useEffect(() => {
    let active = true;
    void load().catch((e) => {
      if (active) setError(e.message);
    });
    return () => {
      active = false;
    };
  }, [load]);
  const accept = (b: Bill) => {
    setBill(b);
    setAmount(String(b.balance));
    setKind('payment');
    setOriginal('');
    setPaper(b.snapshot.brand.paper_width || '80');
  };
  const run = async (work: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The operation was not confirmed.');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const issue = () =>
    run(async () => {
      accept(
        await submitPilotWrite<Bill>(
          `${staff?.userId}:${activeLocationId}:bill`,
          'pilot_issue_bill',
          {
            p_order_ids: [...selected].sort(),
            p_discount: Number(discount),
            p_reason: reason.trim() || null,
          },
        ),
      );
      await load();
    });
  const record = () =>
    run(async () => {
      if (!bill) return;
      const source = bill.payments.find((p) => p.id === original);
      const result = await submitPilotWrite<Bill>(
        `${staff?.userId}:${bill.id}:payment`,
        'pilot_record_payment',
        {
          p_bill_id: bill.id,
          p_amount: Number(amount),
          p_method: kind === 'payment' ? method : source?.method,
          p_kind: kind,
          p_original_payment_id: kind === 'payment' ? null : original,
          p_reference: reference.trim() || null,
          p_reason: paymentReason.trim() || null,
        },
      );
      accept(result);
      setReference('');
      setPaymentReason('');
    });
  const print = () => {
    const popup = window.open('', '_blank', 'width=750,height=900');
    if (!popup) {
      setError('Allow popups to print this receipt.');
      return;
    }
    popup.opener = null;
    void run(async () => {
      try {
        if (!bill) throw new Error('Open a bill first.');
        const fresh = await pilotRpc<Bill>('pilot_get_bill', { p_bill_id: bill.id });
        setBill(fresh);
        await printDocument(popup, <ReceiptDocument bill={fresh} />, paper);
      } catch (e) {
        popup.close();
        throw e;
      }
    });
  };
  const active = orders.filter((o) => !['cancelled', 'rejected'].includes(o.status));
  return (
    <section className="max-w-6xl mx-auto p-4 sm:p-6 space-y-5">
      <h1 className="text-xl font-bold text-[#16342b]">Bills, receipts & recorded payments</h1>
      <p className="text-sm">
        Totals and permissions are checked by the server. Cash, merchant UPI and card-terminal
        entries record what staff report receiving. This application does not collect or verify
        external payments.
      </p>
      {error && (
        <p role="alert" className="p-3 bg-red-50 text-red-700">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="p-3 bg-green-50">
          {notice}
        </p>
      )}
      <fieldset disabled={busy} className="min-w-0 grid lg:grid-cols-2 gap-5">
        <section className="bg-white border rounded-xl p-4 space-y-3">
          <h2 className="font-semibold">Generate a bill</h2>
          <p className="text-sm">
            Select one order or combine orders from an active table session. All selected orders
            must use the same location and currency.
          </p>
          <div className="max-h-64 overflow-y-auto">
            {active.length ? (
              active.map((o) => (
                <label className="block p-2 border-b" key={o.id}>
                  <input
                    type="checkbox"
                    checked={selected.includes(o.id)}
                    onChange={(e) =>
                      setSelected((prev) =>
                        e.target.checked ? [...prev, o.id] : prev.filter((id) => id !== o.id),
                      )
                    }
                  />{' '}
                  {o.orderNumber} · {o.customerName || 'Walk-in / guest'} ·{' '}
                  {o.tableNumber ? `Table ${o.tableNumber}` : o.orderMode} ·{' '}
                  {formatMoney(o.totalAmount, o.currency)} · {o.paymentStatus}
                </label>
              ))
            ) : (
              <p>No orders available at this location.</p>
            )}
          </div>
          {canAdjust && (
            <>
              <label className="block">
                Discount amount
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="p-2 border rounded-lg ml-2 w-28"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                />
              </label>
              <label className="block">
                Discount reason
                <input
                  value={reason}
                  maxLength={250}
                  onChange={(e) => setReason(e.target.value)}
                  className="block w-full p-2 border rounded-lg"
                />
              </label>
            </>
          )}
          <button
            type="button"
            disabled={!selected.length}
            onClick={() => void issue()}
            className="p-3 bg-[#16342b] text-white rounded-lg disabled:opacity-50"
          >
            Generate / open bill
          </button>
          <h2 className="font-semibold pt-3">Recent bills</h2>
          <button type="button" className="underline" onClick={() => void run(load)}>
            Refresh bills
          </button>
          <div className="max-h-48 overflow-y-auto">
            {recent.map((b) => (
              <button
                type="button"
                key={b.id}
                className="block text-left p-2 w-full border-b"
                onClick={() =>
                  void run(async () =>
                    accept(await pilotRpc<Bill>('pilot_get_bill', { p_bill_id: b.id })),
                  )
                }
              >
                {b.receipt_number} · {formatMoney(b.total, b.currency)} · {b.state}
              </button>
            ))}
          </div>
        </section>
        <section className="bg-white border rounded-xl p-4 space-y-3">
          {bill ? (
            <>
              <h2 className="font-semibold">{bill.receipt_number}</h2>
              {bill.snapshot.orders.map((o) => (
                <section key={o.id} className="text-sm p-3 border rounded-lg">
                  <h3 className="font-semibold">
                    {o.number} · {o.table || o.mode}
                  </h3>
                  {o.items.map((i, n) => (
                    <div key={n} className="py-1">
                      <p>
                        {i.quantity} × {i.name} · {formatMoney(i.total, bill.currency)}
                      </p>
                      {i.modifiers?.length > 0 && (
                        <p className="text-xs">{i.modifiers.map((m) => m.name).join(', ')}</p>
                      )}
                      {i.instructions && <p className="text-xs">{i.instructions}</p>}
                    </div>
                  ))}
                </section>
              ))}
              <p>
                State: {bill.state} · Payment: {bill.payment_status.replaceAll('_', ' ')}
              </p>
              <dl className="space-y-1">
                {[
                  ['Subtotal', bill.subtotal],
                  ['Discount', bill.discount],
                  ['Tax', bill.tax],
                  ['Service charge', bill.service_charge],
                  ['Total', bill.total],
                  ['Net recorded payments', bill.paid],
                  ['Outstanding', bill.balance],
                ].map(([name, value]) => (
                  <div className="flex justify-between gap-2" key={name as string}>
                    <dt>{name}</dt>
                    <dd>{formatMoney(value as number, bill.currency)}</dd>
                  </div>
                ))}
              </dl>
              <label className="block">
                Print format
                <select
                  aria-label="Print format"
                  value={paper}
                  onChange={(e) => setPaper(e.target.value as PaperWidth)}
                  className="p-2 border rounded-lg ml-2"
                >
                  <option value="58">58 mm</option>
                  <option value="80">80 mm</option>
                  <option value="A4">A4</option>
                </select>
              </label>
              <button type="button" className="p-2 border rounded-lg" onClick={print}>
                Print receipt / save PDF
              </button>
              <h3 className="font-semibold pt-3">Record offline payment</h3>
              <label className="block">
                Entry type
                <select
                  className="p-2 border ml-2"
                  value={kind}
                  onChange={(e) => setKind(e.target.value)}
                >
                  <option value="payment">Payment received</option>
                  {canAdjust && (
                    <>
                      <option value="refund">Refund recorded</option>
                      <option value="reversal">Reversal recorded</option>
                    </>
                  )}
                </select>
              </label>
              {kind === 'payment' ? (
                <label className="block">
                  Payment method
                  <select
                    aria-label="Payment method"
                    value={method}
                    onChange={(e) => setMethod(e.target.value)}
                    className="p-2 border ml-2"
                  >
                    <option value="cash">Cash</option>
                    <option value="upi">Merchant UPI</option>
                    <option value="card_terminal">Card terminal</option>
                    <option value="other">Other offline</option>
                  </select>
                </label>
              ) : (
                <label className="block">
                  Original payment
                  <select
                    value={original}
                    onChange={(e) => setOriginal(e.target.value)}
                    className="p-2 border ml-2"
                  >
                    <option value="">Choose a payment</option>
                    {bill.payments
                      .filter((p) => p.kind === 'payment')
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.method} · {formatMoney(p.amount, bill.currency)}
                        </option>
                      ))}
                  </select>
                </label>
              )}
              <label className="block">
                Amount
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="p-2 border rounded-lg ml-2 w-32"
                />
              </label>
              <label className="block">
                External reference
                <input
                  value={reference}
                  maxLength={200}
                  onChange={(e) => setReference(e.target.value)}
                  className="block w-full p-2 border rounded-lg"
                />
              </label>
              <label className="block">
                Payment / refund reason
                <input
                  value={paymentReason}
                  maxLength={250}
                  onChange={(e) => setPaymentReason(e.target.value)}
                  className="block w-full p-2 border rounded-lg"
                />
              </label>
              <button
                type="button"
                disabled={bill.state !== 'issued' || !(Number(amount) > 0)}
                className="p-3 bg-[#16342b] text-white rounded-lg disabled:opacity-50"
                onClick={() => void record()}
              >
                Confirm recorded entry
              </button>
              <button
                type="button"
                className="p-2 border rounded-lg ml-2"
                disabled={bill.state !== 'issued' || Number(bill.balance) !== 0}
                onClick={() =>
                  void run(async () => {
                    await pilotRpc('pilot_complete_bill', { p_bill_id: bill.id });
                    setNotice('All bill orders completed after recorded settlement.');
                  })
                }
              >
                Complete served, paid orders
              </button>
              {canAdjust && bill.state === 'issued' && !bill.payments.length && (
                <button
                  type="button"
                  className="p-2 text-red-700 underline"
                  onClick={() =>
                    void run(async () => {
                      await pilotRpc('pilot_void_bill', {
                        p_bill_id: bill.id,
                        p_reason: paymentReason,
                      });
                      accept(await pilotRpc<Bill>('pilot_get_bill', { p_bill_id: bill.id }));
                      await load();
                    })
                  }
                >
                  Void unpaid bill (reason required)
                </button>
              )}
              <h3 className="font-semibold">Ledger</h3>
              {bill.payments.length ? (
                bill.payments.map((p) => (
                  <p key={p.id} className="text-sm border-b p-2">
                    {p.kind} · {p.method} · {formatMoney(p.amount, bill.currency)} ·{' '}
                    {p.reference || p.reason || 'Cash record'}
                  </p>
                ))
              ) : (
                <p>No payment recorded.</p>
              )}
            </>
          ) : (
            <p>Open or generate a bill to review the server total before recording payment.</p>
          )}
        </section>
      </fieldset>
      <section className="bg-white border rounded-xl p-4 space-y-3">
        <h2 className="font-semibold">My cashier reconciliation</h2>
        <label>
          Business date
          <input
            type="date"
            className="p-2 border ml-2"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <button
          disabled={busy || !date}
          className="p-2 border rounded-lg ml-2"
          onClick={() =>
            void run(async () =>
              setSummary(
                await pilotRpc('pilot_cashier_summary', {
                  p_location: activeLocationId,
                  p_date: date,
                }),
              ),
            )
          }
        >
          Review recorded totals
        </button>
        {summary && (
          <>
            <p>Location timezone: {summary.timezone}</p>
            {summary.methods.map((m: any) => (
              <p key={m.method}>
                {m.method}: net {Number(m.net).toFixed(2)} · {m.entries} entries
              </p>
            ))}
            {!summary.methods.length && <p>No entries recorded by you for this date.</p>}
            {summary.closing && (
              <p>
                Closed: counted {summary.closing.counted_cash}; expected{' '}
                {summary.closing.expected_cash}.
              </p>
            )}
          </>
        )}
        <p className="text-sm">
          Closing applies to today in the location timezone and prevents further entries by this
          cashier today. Check the count before confirming.
        </p>
        <label className="block">
          Counted cash today
          <input
            type="number"
            min="0"
            step="0.01"
            className="p-2 border rounded-lg ml-2 w-32"
            value={counted}
            onChange={(e) => setCounted(e.target.value)}
          />
        </label>
        <label className="block">
          Closing note
          <input
            value={closeNote}
            onChange={(e) => setCloseNote(e.target.value)}
            className="block p-2 border rounded-lg w-full"
          />
        </label>
        <button
          disabled={busy || counted === ''}
          className="p-2 border rounded-lg"
          onClick={() =>
            void run(async () => {
              const closing = await pilotRpc('pilot_close_cashier', {
                p_location: activeLocationId,
                p_counted_cash: Number(counted),
                p_note: closeNote,
              });
              setDate(closing.business_date);
              setSummary(
                await pilotRpc('pilot_cashier_summary', {
                  p_location: activeLocationId,
                  p_date: closing.business_date,
                }),
              );
            })
          }
        >
          Confirm today's cashier closing
        </button>
      </section>
    </section>
  );
}
