import { eq, sql } from "drizzle-orm";
import { spools } from "./schema.js";
import type { AppDatabase } from "./database.js";
import type { Spool } from "../domain/spool.js";

export type SpoolRow = typeof spools.$inferSelect;

export interface SpoolUpsert {
  tagId: string;
  variantId?: string | null;
  material?: string | null;
  product?: string | null;
  colorHex?: string | null;
  source?: "ams" | "scan";
  weight?: number | null;
  remain?: number | null;
}

export function toSpoolUpsert(
  spool: Spool & { uid: string },
  source?: "ams" | "scan",
): SpoolUpsert {
  return {
    tagId: spool.uid,
    variantId: spool.variant_id,
    material: spool.material,
    product: spool.product,
    colorHex: spool.color_hex,
    weight: spool.weight,
    remain: spool.remain,
    ...(source ? { source } : {}),
  };
}

export interface SpoolRepository {
  upsert(data: SpoolUpsert): void;
  findByTagId(tagId: string): SpoolRow | undefined;
  findById(id: string): SpoolRow | undefined;
  list(): SpoolRow[];
}

export function createSpoolRepository(db: AppDatabase): SpoolRepository {
  return {
    upsert(data) {
      db.insert(spools)
        .values({
          tagId: data.tagId,
          variantId: data.variantId ?? null,
          material: data.material ?? null,
          product: data.product ?? null,
          colorHex: data.colorHex ?? null,
          source: data.source ?? "ams",
          weight: data.weight ?? null,
          remain: data.remain ?? null,
        })
        .onConflictDoUpdate({
          target: spools.tagId,
          set: {
            variantId: sql`COALESCE(excluded.variant_id, ${spools.variantId})`,
            material: sql`COALESCE(excluded.material, ${spools.material})`,
            product: sql`COALESCE(excluded.product, ${spools.product})`,
            colorHex: sql`COALESCE(excluded.color_hex, ${spools.colorHex})`,
            weight: sql`COALESCE(excluded.weight, ${spools.weight})`,
            remain: sql`excluded.remain`,
            lastSeen: sql`datetime('now')`,
          },
        })
        .run();
    },

    findByTagId(tagId) {
      return db.select().from(spools).where(eq(spools.tagId, tagId)).get();
    },

    findById(id) {
      return db.select().from(spools).where(eq(spools.id, id)).get();
    },

    list() {
      return db.select().from(spools).orderBy(sql`${spools.lastSeen} DESC`).all();
    },
  };
}
