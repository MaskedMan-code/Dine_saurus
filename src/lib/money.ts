/** Rates apply independently to the subtotal, rounded to the schema's two-decimal currency amounts. */
export function orderTotals(amount: number, taxRate: number, serviceRate: number, tip = 0) {
  const subtotalCents = Math.round(amount * 100);
  const taxCents = Math.round((subtotalCents * taxRate) / 100);
  const serviceCents = Math.round((subtotalCents * serviceRate) / 100);
  const tipCents = Math.round(tip * 100);
  return {
    subtotal: subtotalCents / 100,
    taxAmount: taxCents / 100,
    serviceCharge: serviceCents / 100,
    tipAmount: tipCents / 100,
    grandTotal: (subtotalCents + taxCents + serviceCents + tipCents) / 100,
  };
}
