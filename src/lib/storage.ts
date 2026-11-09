export function readStorage(key: string, storage: 'local' | 'session' = 'local'): string | null {
  try {
    return (storage === 'local' ? localStorage : sessionStorage).getItem(key);
  } catch {
    return null;
  }
}
export function writeStorage(
  key: string,
  value: string | null,
  storage: 'local' | 'session' = 'local',
) {
  try {
    const target = storage === 'local' ? localStorage : sessionStorage;
    if (value === null) target.removeItem(key);
    else target.setItem(key, value);
  } catch {
    /* Storage must not break ordering. */
  }
}
export function readJson<T>(key: string, fallback: T, storage: 'local' | 'session' = 'session'): T {
  try {
    const raw = readStorage(key, storage);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
