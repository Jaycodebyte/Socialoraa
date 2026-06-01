import { useEffect, useMemo, useRef, useState } from "react";

const memory = new Map();

const canStore = (value) => {
  try {
    JSON.stringify(value);
    return true;
  } catch {
    return false;
  }
};

const readStoredValue = (key, fallback) => {
  if (memory.has(key)) return memory.get(key);
  if (typeof window === "undefined") return fallback;

  try {
    const stored = window.sessionStorage.getItem(key);
    if (stored === null) return fallback;
    const parsed = JSON.parse(stored);
    memory.set(key, parsed);
    return parsed;
  } catch {
    return fallback;
  }
};

export default function usePersistentState(key, fallback) {
  const fallbackRef = useRef(fallback);
  const [value, setValue] = useState(() => readStoredValue(key, fallback));

  useEffect(() => {
    fallbackRef.current = fallback;
  }, [fallback]);

  useEffect(() => {
    const storedValue = readStoredValue(key, fallbackRef.current);
    setValue((currentValue) => (
      Object.is(currentValue, storedValue) ? currentValue : storedValue
    ));
  }, [key]);

  useEffect(() => {
    memory.set(key, value);

    if (typeof window === "undefined" || !canStore(value)) return;

    try {
      window.sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Files and large generated blobs stay in memory for this tab session.
    }
  }, [key, value]);

  return [value, setValue];
}

export function useUserPersistentState(userId, key, fallback) {
  const scopedKey = useMemo(
    () => `${key}:user:${userId || "guest"}`,
    [key, userId],
  );

  return usePersistentState(scopedKey, fallback);
}
