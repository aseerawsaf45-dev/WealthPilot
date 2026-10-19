/**
 * WealthPilot — cache for PUBLIC third-party data (bank lists, news, market history).
 * memo → shared in-flight promise → DB row within TTL → fetch → stale row → null. Never throws.
 * Same shape as repos/fx.ts, generalised by key.
 */

import type { Prisma } from '@prisma/client';
import { prisma } from '../db';

const memo = new Map<string, { at: number; data: unknown }>();
const inflight = new Map<string, Promise<unknown>>();
const lastFailure = new Map<string, number>();

export async function cached<T>(key: string, ttlMs: number, fetcher: () => Promise<T | null>, backoffMs = 10 * 60_000): Promise<T | null> {
  const m = memo.get(key);
  if (m && Date.now() - m.at < ttlMs) return m.data as T;
  let p = inflight.get(key) as Promise<T | null> | undefined;
  if (!p) {
    p = (async () => {
      const row = await prisma.externalCache.findUnique({ where: { key } }).catch(() => null);
      if (row && Date.now() - row.fetchedAt.getTime() < ttlMs) {
        memo.set(key, { at: row.fetchedAt.getTime(), data: row.data });
        return row.data as T;
      }
      if (Date.now() - (lastFailure.get(key) ?? 0) > backoffMs) {
        try {
          const fresh = await fetcher();
          if (fresh !== null) {
            const json = fresh as unknown as Prisma.InputJsonValue;
            await prisma.externalCache.upsert({ where: { key }, create: { key, data: json }, update: { data: json, fetchedAt: new Date() } }).catch(() => null);
            memo.set(key, { at: Date.now(), data: fresh });
            return fresh;
          }
        } catch {
          /* source down: fall back to the stored row */
        }
        lastFailure.set(key, Date.now());
      }
      return row ? (row.data as T) : null;
    })()
      .catch(() => null)
      .finally(() => inflight.delete(key));
    inflight.set(key, p);
  }
  return p;
}

/** When the cached value was fetched (for "as of" labels). */
export async function cachedAt(key: string): Promise<string | null> {
  const m = memo.get(key);
  if (m) return new Date(m.at).toISOString();
  const row = await prisma.externalCache.findUnique({ where: { key }, select: { fetchedAt: true } }).catch(() => null);
  return row?.fetchedAt.toISOString() ?? null;
}
