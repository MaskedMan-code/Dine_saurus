import React from 'react';
import type { Bill, Kot, PaperWidth, OrderSnapshot } from '../../types/pilot';
export const formatMoney = (value: number, currency: string) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(Number(value));
const when = (time: string, timezone: string) =>
  new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: timezone,
  }).format(new Date(time));
function Items({ orders, currency }: { orders: OrderSnapshot[]; currency?: string }) {
  return (
    <>
      {orders.map((o) => (
        <section key={o.id}>
          <h3>
            {o.number} · {o.table || o.mode}
          </h3>
          <table>
            <thead>
              <tr>
                <th>Item / modifiers</th>
                <th>Qty</th>
                {currency && <th>Amount</th>}
              </tr>
            </thead>
            <tbody>
              {o.items.map((i, n) => (
                <tr key={n}>
                  <td>
                    {i.name}
                    {currency && <small>Unit: {formatMoney(i.unit_price, currency)}</small>}
                    {i.modifiers?.map((m, k) => (
                      <small key={k}>
                        {m.name}
                        {currency ? ` (included ${formatMoney(m.amount, currency)})` : ''}
                      </small>
                    ))}
                    {i.instructions && <small>Note: {i.instructions}</small>}
                  </td>
                  <td>{i.quantity}</td>
                  {currency && <td>{formatMoney(i.total, currency)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
          {o.note && <p>Order note: {o.note}</p>}
        </section>
      ))}
    </>
  );
}
export function ReceiptDocument({ bill: b }: { bill: Bill }) {
  const brand = b.snapshot.brand;
  return (
    <article>
      {brand.logo?.startsWith('https://') && (
        <img
          src={brand.logo}
          referrerPolicy="no-referrer"
          className="brand-logo"
          alt={`${brand.name} logo`}
        />
      )}
      <h1>{brand.name}</h1>
      <p>{[brand.address, brand.city, brand.postal_code].filter(Boolean).join(', ')}</p>
      {brand.phone && <p>Contact: {brand.phone}</p>}
      {brand.gstin && <p>GSTIN: {brand.gstin}</p>}
      <h2>Receipt {b.receipt_number}</h2>
      <p>{when(b.created_at, brand.timezone)}</p>
      <p className="status">
        {b.state === 'void' ? 'VOID' : b.payment_status.replaceAll('_', ' ').toUpperCase()}
      </p>
      <Items orders={b.snapshot.orders} currency={b.currency} />
      <dl>
        {[
          ['Subtotal', b.subtotal],
          ['Discount', -b.discount],
          ['Tax (configured)', b.tax],
          ['Service charge', b.service_charge],
          ['Tip', b.tip],
          ['Grand total', b.total],
          ['Net recorded payments', b.paid],
          ['Outstanding balance', b.balance],
        ].map(([label, value]) => (
          <div key={label as string}>
            <dt>{label}</dt>
            <dd>{formatMoney(value as number, b.currency)}</dd>
          </div>
        ))}
      </dl>
      {b.discount_reason && <p>Discount: {b.discount_reason}</p>}
      <h3>Recorded payments</h3>
      {b.payments.length ? (
        b.payments.map((p) => (
          <p key={p.id}>
            {p.kind} · {p.method} · {formatMoney(p.amount, b.currency)}
            {p.reference ? ` · ${p.reference}` : ''}
          </p>
        ))
      ) : (
        <p>No payment recorded.</p>
      )}
      <p>Staff payment record; external transfers are not verified by this application.</p>
      <p>Receipt — not a verified tax invoice.</p>
      {brand.footer && <p>{brand.footer}</p>}
    </article>
  );
}
export function KotDocument({ kot: k }: { kot: Kot }) {
  return (
    <article>
      <h1>{k.restaurant}</h1>
      <h2>Kitchen Order Ticket</h2>
      <p>{k.ticket_number}</p>
      <p>{when(k.created_at, k.timezone)}</p>
      <p className="status">{k.status.toUpperCase()}</p>
      <Items orders={[k.snapshot]} />
      <p>Reprints retain the same ticket number. Check status before preparing.</p>
    </article>
  );
}
export function printStyles(width: PaperWidth, heightMm = 297) {
  const page = width === 'A4' ? 'A4' : `${width}mm ${heightMm}mm`;
  const body = width === 'A4' ? '190mm' : `${Number(width) - 8}mm`;
  return `@page{size:${page};margin:4mm}*{box-sizing:border-box}body{font:12px system-ui,sans-serif;color:#000;background:#fff;margin:0 auto;width:${body};max-width:100%}h1{font-size:18px}h2{font-size:15px}h3{font-size:12px}h1,h2,h3,p,td{overflow-wrap:anywhere}.brand-logo{max-height:50px;max-width:100%}table{width:100%;border-collapse:collapse}th,td{text-align:left;vertical-align:top;border-bottom:1px dashed #777;padding:6px 2px}td:last-child,th:last-child{text-align:right}small{display:block}dl>div{display:flex;justify-content:space-between;gap:8px}dd{margin:0}section{break-inside:avoid}.status{font-weight:bold;border:1px solid;padding:6px}@media print{button{display:none}}`;
}
export async function printDocument(popup: Window, content: React.ReactNode, width: PaperWidth) {
  const { renderToStaticMarkup } = await import('react-dom/server');
  popup.opener = null;
  popup.document.open();
  popup.document.write(
    '<!doctype html>' +
      renderToStaticMarkup(
        <html>
          <head>
            <meta charSet="utf-8" />
            <meta name="referrer" content="no-referrer" />
            <title>Dine_saurus print document</title>
            <style id="print-layout">{printStyles(width)}</style>
          </head>
          <body>
            {content}
            <button onClick={undefined} id="print-document">
              Print / save PDF
            </button>
          </body>
        </html>,
      ),
  );
  popup.document.close();
  const print = () => {
    if (popup.closed) return;
    const style = popup.document.getElementById('print-layout');
    if (style && width !== 'A4')
      style.textContent = printStyles(
        width,
        Math.max(50, Math.min(2000, Math.ceil((popup.document.body.scrollHeight * 25.4) / 96) + 8)),
      );
    popup.focus();
    popup.print();
  };
  popup.document.getElementById('print-document')?.addEventListener('click', print);
  const images = Array.from(popup.document.images);
  const loaded = images.map((img) =>
    img.complete
      ? Promise.resolve()
      : new Promise<void>((resolve) => {
          img.addEventListener('load', () => resolve(), { once: true });
          img.addEventListener('error', () => resolve(), { once: true });
        }),
  );
  void Promise.race([
    Promise.all(loaded),
    new Promise((resolve) => popup.setTimeout(resolve, 4000)),
  ]).then(() => popup.setTimeout(print, 150));
}
