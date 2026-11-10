import React, { useEffect, useState } from 'react';
import { useRestaurant } from '../../context/RestaurantContext';
import { supabase } from '../../lib/supabase';
import { pilotRpc } from '../../lib/pilot';
export function InvoiceSettings() {
  const { activeLocationId } = useRestaurant();
  const [name, setName] = useState(''),
    [gstin, setGstin] = useState(''),
    [footer, setFooter] = useState(''),
    [paper, setPaper] = useState('80'),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    void supabase
      .from('pilot_invoice_settings')
      .select('*')
      .eq('location_id', activeLocationId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!live) return;
        if (error) setError(error.message);
        else {
          setName(data?.legal_name || '');
          setGstin(data?.gstin || '');
          setFooter(data?.footer || '');
          setPaper(data?.paper_width || '80');
        }
      });
    return () => {
      live = false;
    };
  }, [activeLocationId]);
  return (
    <form
      className="p-5 my-5 border rounded-xl bg-white space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        setBusy(true);
        setError('');
        setNotice('');
        try {
          await pilotRpc('pilot_save_invoice_settings', {
            p_location: activeLocationId,
            p_legal_name: name,
            p_gstin: gstin,
            p_footer: footer,
            p_paper: paper,
          });
          setNotice('Receipt settings saved. Existing issued receipts keep their snapshots.');
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Settings not saved.');
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2 className="text-lg font-semibold">Receipt settings for this location</h2>
      <p className="text-sm">
        Receipts use configured order taxes. GSTIN syntax is checked; tax registration, rates,
        service-charge treatment and tax-invoice compliance require your accountant's review.
      </p>
      <label className="block">
        Legal / receipt name
        <input
          value={name}
          maxLength={160}
          onChange={(e) => setName(e.target.value)}
          className="block w-full p-2 border rounded-lg"
        />
      </label>
      <label className="block">
        GSTIN (optional)
        <input
          value={gstin}
          maxLength={15}
          onChange={(e) => setGstin(e.target.value.toUpperCase())}
          className="block w-full p-2 border rounded-lg"
        />
      </label>
      <label className="block">
        Receipt footer
        <textarea
          value={footer}
          maxLength={500}
          onChange={(e) => setFooter(e.target.value)}
          className="block w-full p-2 border rounded-lg"
        />
      </label>
      <label>
        Default paper
        <select
          value={paper}
          onChange={(e) => setPaper(e.target.value)}
          className="p-2 border ml-2"
        >
          <option value="58">58 mm</option>
          <option value="80">80 mm</option>
          <option value="A4">A4</option>
        </select>
      </label>
      <button disabled={busy} className="p-2 border rounded-lg ml-2">
        Save receipt settings
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
