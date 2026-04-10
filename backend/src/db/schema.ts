import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const spools = sqliteTable("spools", {
  id: text().primaryKey().$defaultFn(() => crypto.randomUUID()),
  tagId: text("tag_id").notNull().unique(),
  variantId: text("variant_id"),
  material: text(),
  product: text(),
  colorHex: text("color_hex"),
  weight: real(),
  remain: integer(),
  source: text().notNull().default("ams"),
  firstSeen: text("first_seen")
    .notNull()
    .default(sql`(datetime('now'))`),
  lastSeen: text("last_seen")
    .notNull()
    .default(sql`(datetime('now'))`),
});
