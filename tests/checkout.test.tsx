import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { CheckoutDrawer } from '../src/components/customer/CheckoutDrawer';
const mock = vi.hoisted(() => ({
  createOrder: vi.fn(),
  cart: [
    {
      id: 'cart',
      menuItem: { id: 'item', name: 'Soup' },
      quantity: 1,
      selectedModifiers: [],
      totalPrice: 100,
    },
  ],
}));
vi.mock('../src/context/RestaurantContext', () => ({
  useRestaurant: () => ({
    restaurant: {
      id: 'rest',
      name: 'Restaurant',
      currencySymbol: '₹',
      taxRatePercent: 8,
      serviceChargePercent: 5,
    },
    activeTable: { id: 'table', tableNumber: '1' },
    cart: mock.cart,
    cartTotalAmount: 100,
    customerProfile: { id: '', name: 'Guest', phone: '' },
    createOrder: mock.createOrder,
    updateCartQuantity: vi.fn(),
    removeFromCart: vi.fn(),
  }),
}));
vi.mock('canvas-confetti', () => ({ default: vi.fn() }));
beforeEach(() => {
  mock.createOrder.mockReset();
});
function fill() {
  fireEvent.change(screen.getByLabelText('Full name (required)'), {
    target: { value: 'Test Diner' },
  });
  fireEvent.change(screen.getByLabelText('Mobile number (required)'), {
    target: { value: '+919000000001' },
  });
}
test('guest details are required without an account, email, password or OTP', async () => {
  render(<CheckoutDrawer isOpen onClose={vi.fn()} onOrderPlaced={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: /Place Order/ }));
  expect(await screen.findByRole('alert')).toHaveTextContent('full name');
  expect(mock.createOrder).not.toHaveBeenCalled();
  expect(screen.queryByLabelText(/password|email|otp/i)).toBeNull();
});
test('order failure is visible and the drawer retains customer details and cart', async () => {
  mock.createOrder.mockRejectedValue(new Error('Menu item is unavailable'));
  const close = vi.fn();
  render(<CheckoutDrawer isOpen onClose={close} onOrderPlaced={vi.fn()} />);
  fill();
  fireEvent.click(screen.getByRole('button', { name: /Place Order/ }));
  expect(await screen.findByRole('alert')).toHaveTextContent('unavailable');
  expect(close).not.toHaveBeenCalled();
  expect(screen.getByText('Soup')).toBeVisible();
  expect(screen.getByLabelText('Full name (required)')).toHaveValue('Test Diner');
  expect(screen.getByRole('button', { name: /Retry order/ })).toBeEnabled();
});
test('repeated clicks make one submission and success waits for server confirmation', async () => {
  let resolve: any;
  mock.createOrder.mockReturnValue(
    new Promise((r) => {
      resolve = r;
    }),
  );
  const placed = vi.fn();
  render(<CheckoutDrawer isOpen onClose={vi.fn()} onOrderPlaced={placed} />);
  fill();
  const button = screen.getByRole('button', { name: /Place Order/ });
  fireEvent.click(button);
  fireEvent.click(button);
  expect(mock.createOrder).toHaveBeenCalledTimes(1);
  expect(placed).not.toHaveBeenCalled();
  resolve({ id: 'confirmed' });
  await waitFor(() => expect(placed).toHaveBeenCalledWith('confirmed'));
  expect(mock.createOrder.mock.calls[0][0].tipAmount).toBe(0);
});
test('checkout contains its own scroll region and restores page scrolling on close or unmount', () => {
  document.body.style.overflow = 'auto';
  const view = render(<CheckoutDrawer isOpen onClose={vi.fn()} onOrderPlaced={vi.fn()} />);
  expect(document.body.style.overflow).toBe('hidden');
  expect(screen.getByRole('dialog', { name: 'Checkout & Order' })).toBeVisible();
  expect(screen.getByRole('region', { name: 'Checkout details' })).toHaveClass(
    'min-h-0',
    'overflow-y-auto',
  );
  view.rerender(<CheckoutDrawer isOpen={false} onClose={vi.fn()} onOrderPlaced={vi.fn()} />);
  expect(document.body.style.overflow).toBe('auto');
  view.rerender(<CheckoutDrawer isOpen onClose={vi.fn()} onOrderPlaced={vi.fn()} />);
  view.unmount();
  expect(document.body.style.overflow).toBe('auto');
  document.body.style.overflow = '';
});
