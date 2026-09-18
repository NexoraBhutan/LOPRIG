export function safeSetItem(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (e) {
    console.warn(`localStorage.setItem failed for key "${key}":`, e);
    return false;
  }
}

export function safeGetItem(key) {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    console.warn(`localStorage.getItem failed for key "${key}":`, e);
    return null;
  }
}

export function safeRemoveItem(key) {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (e) {
    console.warn(`localStorage.removeItem failed for key "${key}":`, e);
    return false;
  }
}

export function safeParseJSON(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    console.warn(`JSON.parse failed for key "${key}":`, e);
    return fallback;
  }
}
