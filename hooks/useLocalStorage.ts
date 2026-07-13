import { useState, useEffect, useCallback } from 'react';

/**
 * Hook for persisting state to localStorage.
 * Handles client-side only operations gracefully.
 */
export function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(initialValue);
  const [isClient, setIsClient] = useState(false);

  // Only run on client
  useEffect(() => {
    setIsClient(true);
    try {
      const item = window.localStorage.getItem(key);
      if (item) {
        setStoredValue(JSON.parse(item));
      }
    } catch (error) {
      console.error(`[v0] localStorage read error for key ${key}:`, error);
    }
  }, [key]);

  const setValue = useCallback(
    (value: T | ((val: T) => T)) => {
      try {
        const valueToStore = value instanceof Function ? value(storedValue) : value;
        setStoredValue(valueToStore);
        if (isClient) {
          window.localStorage.setItem(key, JSON.stringify(valueToStore));
        }
      } catch (error) {
        console.error(`[v0] localStorage write error for key ${key}:`, error);
      }
    },
    [key, storedValue, isClient]
  );

  return [storedValue, setValue] as const;
}
