import React, { StrictMode } from 'react';
import { renderHook, act, fireEvent } from '@testing-library/react';
import { beforeEach, afterEach, expect, test, vi } from 'vitest';
import { useCatalogRefresh } from '../src/lib/useCatalogRefresh';
const mock = vi.hoisted(() => ({ channels: [] as any[], active: new Set<any>(), remove: vi.fn() }));
vi.mock('../src/lib/supabase', () => ({
  supabase: {
    channel: (name: string) => {
      const channel: any = {
        name,
        handlers: [] as any[],
        on: (_type: string, filter: any, callback: any) => {
          channel.handlers.push({ filter, callback });
          return channel;
        },
        subscribe: (callback: any) => {
          mock.active.add(channel);
          callback('SUBSCRIBED');
          return channel;
        },
      };
      mock.channels.push(channel);
      return channel;
    },
    removeChannel: (channel: any) => {
      mock.remove(channel);
      mock.active.delete(channel);
    },
  },
}));
beforeEach(() => {
  vi.useFakeTimers();
  mock.channels = [];
  mock.active.clear();
  mock.remove.mockClear();
});
afterEach(() => {
  vi.useRealTimers();
});
test('catalog and stock events are scoped and coalesced while polling covers missing events', () => {
  const refresh = vi.fn();
  const view = renderHook(() => useCatalogRefresh('restaurant-A', 'location-A', true, refresh));
  const channel = mock.channels[0];
  expect(channel.handlers.find((h: any) => h.filter.table === 'menu_items').filter.filter).toBe(
    'restaurant_id=eq.restaurant-A',
  );
  expect(
    channel.handlers.find((h: any) => h.filter.table === 'menu_item_location_settings').filter
      .filter,
  ).toBe('location_id=eq.location-A');
  act(() => {
    channel.handlers.forEach((h: any) => h.callback());
    vi.advanceTimersByTime(150);
  });
  expect(refresh).toHaveBeenCalledTimes(1);
  act(() => {
    vi.advanceTimersByTime(15000);
  });
  expect(refresh).toHaveBeenCalledTimes(2);
  view.unmount();
  expect(mock.active.size).toBe(0);
  act(() => {
    channel.handlers[0].callback();
    vi.advanceTimersByTime(30000);
  });
  expect(refresh).toHaveBeenCalledTimes(2);
});
test('hidden pages pause refresh and returning to the tab refreshes without reinstalling the channel', () => {
  const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
  const refresh = vi.fn();
  const view = renderHook(() => useCatalogRefresh('A', 'L', true, refresh));
  act(() => vi.advanceTimersByTime(15000));
  expect(refresh).not.toHaveBeenCalled();
  hidden.mockReturnValue(false);
  act(() => {
    fireEvent(document, new Event('visibilitychange'));
    vi.advanceTimersByTime(150);
  });
  expect(refresh).toHaveBeenCalledTimes(1);
  expect(mock.channels).toHaveLength(1);
  view.unmount();
});
test('StrictMode and tenant changes retain only the current catalog subscription', () => {
  const refresh = vi.fn();
  const view = renderHook(({ restaurant }) => useCatalogRefresh(restaurant, 'L', true, refresh), {
    initialProps: { restaurant: 'A' },
    wrapper: StrictMode,
  });
  expect(mock.active.size).toBe(1);
  view.rerender({ restaurant: 'B' });
  expect(mock.active.size).toBe(1);
  expect([...mock.active][0].name).toBe('catalog-B-L');
  view.unmount();
  expect(mock.active.size).toBe(0);
});
