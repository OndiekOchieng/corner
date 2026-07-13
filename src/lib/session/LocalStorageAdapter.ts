/**
 * LocalStorageAdapter — the ONLY module in the app that references `localStorage`.
 *
 * It is one implementation of `StorageAdapter`; everything above it is storage-
 * agnostic. Access is lazy + guarded so importing this module under Node/SSR is
 * safe (methods no-op / return empty when localStorage is unavailable).
 */

import type { StorageAdapter } from './StorageAdapter';

function getStore(): Storage | null {
  if (typeof globalThis !== 'undefined') {
    const ls = (globalThis as { localStorage?: Storage }).localStorage;
    if (ls) return ls;
  }
  return null;
}

export class LocalStorageAdapter implements StorageAdapter {
  async load(key: string): Promise<string | null> {
    return getStore()?.getItem(key) ?? null;
  }

  async save(key: string, value: string): Promise<void> {
    const store = getStore();
    if (!store) throw new Error('localStorage is unavailable');
    store.setItem(key, value);
  }

  async delete(key: string): Promise<void> {
    getStore()?.removeItem(key);
  }

  async exists(key: string): Promise<boolean> {
    return getStore()?.getItem(key) != null;
  }

  async keys(): Promise<string[]> {
    const store = getStore();
    if (!store) return [];
    const out: string[] = [];
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i);
      if (key !== null) out.push(key);
    }
    return out;
  }
}
