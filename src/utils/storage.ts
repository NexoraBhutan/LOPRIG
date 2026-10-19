export function safeSetItem(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (e) {
    console.warn(`localStorage.setItem failed for key "${key}":`, e);
    return false;
  }
}

export function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    console.warn(`localStorage.getItem failed for key "${key}":`, e);
    return null;
  }
}

export function safeRemoveItem(key: string): boolean {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (e) {
    console.warn(`localStorage.removeItem failed for key "${key}":`, e);
    return false;
  }
}

/**
 * Reads and parses JSON from localStorage, falling back to `fallback` when the
 * key is missing or the stored value is not valid JSON. Always call with an
 * explicit fallback so the return type stays honest.
 */
export function safeParseJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch (e) {
    console.warn(`JSON.parse failed for key "${key}":`, e);
    return fallback;
  }
}