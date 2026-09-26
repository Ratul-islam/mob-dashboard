"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const PREFIX = "anura-dash:";

const read = <T,>(key: string, fallback: T): T => {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
};

/**
 * useState that remembers its value in localStorage (per browser). Starts from the fallback
 * so server and first client render agree, then loads the stored value after mount.
 */
export function useStoredState<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(fallback);
  const [loaded, setLoaded] = useState(false);
  const fallbackRef = useRef(fallback);

  useEffect(() => {
    setValue(read(key, fallbackRef.current));
    setLoaded(true);
  }, [key]);

  useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch {
      /* storage unavailable: keep working in memory */
    }
  }, [key, value, loaded]);

  const reset = useCallback(() => setValue(fallbackRef.current), []);
  return [value, setValue, { loaded, reset }] as const;
}
