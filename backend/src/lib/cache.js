export class MemoryCache {
  #entries = new Map();

  get(key) {
    const entry = this.#entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.#entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key, value, ttlMs = 30_000) {
    this.#entries.set(key, { value, expiresAt: Date.now() + ttlMs });
    return value;
  }

  delete(key) { this.#entries.delete(key); }

  deletePrefix(prefix) {
    for (const key of this.#entries.keys()) if (key.startsWith(prefix)) this.#entries.delete(key);
  }
}
