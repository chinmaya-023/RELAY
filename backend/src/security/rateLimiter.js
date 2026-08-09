import { AppError } from '../lib/errors.js';

export class MemoryRateLimiter {
  #windows = new Map();
  #maxEntries;

  constructor(maxEntries = 10_000) { this.#maxEntries = maxEntries; }

  #prune(now, windowMs) {
    if (this.#windows.size < this.#maxEntries) return;
    for (const [key, bucket] of this.#windows) {
      if (now - bucket.startedAt >= windowMs) this.#windows.delete(key);
    }
    if (this.#windows.size >= this.#maxEntries) this.#windows.delete(this.#windows.keys().next().value);
  }

  take(key, { windowSeconds, maxRequests }) {
    const now = Date.now();
    const windowMs = windowSeconds * 1000;
    this.#prune(now, windowMs);
    const existing = this.#windows.get(key) ?? { startedAt: now, count: 0 };
    const bucket = now - existing.startedAt >= windowMs ? { startedAt: now, count: 0 } : existing;
    bucket.count += 1;
    this.#windows.set(key, bucket);
    if (bucket.count > maxRequests) {
      const retryAfter = Math.max(1, Math.ceil((bucket.startedAt + windowMs - now) / 1000));
      throw new AppError(429, 'RATE_LIMITED', 'Too many requests. Please try again later.', { retryAfter });
    }
    return { remaining: Math.max(0, maxRequests - bucket.count), resetAt: bucket.startedAt + windowMs };
  }
}
