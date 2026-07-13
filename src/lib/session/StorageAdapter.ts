/**
 * StorageAdapter — the Session Runtime's ONLY dependency on storage.
 *
 * A generic key → string-blob store. The Session Runtime never references
 * `localStorage` (or any concrete backend) directly — only this interface. Swapping
 * in IndexedDB / Cloud / Filesystem / Native requires zero Session Runtime changes.
 */

export interface StorageAdapter {
  load(key: string): Promise<string | null>;
  save(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  /** All stored keys (used by history listing). */
  keys(): Promise<string[]>;
}

/**
 * In-memory adapter — the default for tests and SSR. Contains no browser APIs, so
 * it is safe to use anywhere under Node.
 */
export class InMemoryStorageAdapter implements StorageAdapter {
  private readonly map = new Map<string, string>();
  /** Number of successful saves (useful for asserting write frequency in tests). */
  saveCount = 0;

  async load(key: string): Promise<string | null> {
    return this.map.has(key) ? (this.map.get(key) as string) : null;
  }

  async save(key: string, value: string): Promise<void> {
    this.map.set(key, value);
    this.saveCount += 1;
  }

  async delete(key: string): Promise<void> {
    this.map.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    return this.map.has(key);
  }

  async keys(): Promise<string[]> {
    return [...this.map.keys()];
  }
}
