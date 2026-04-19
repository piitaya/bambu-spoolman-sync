-- Architecture-review changes, combined into one migration:
--   1. Drop unused `last_*` cache columns from `spools`. They only served as a
--      shortcut for stamping scan/adjust history rows with a printer/slot; the
--      frontend never rendered that location, so the columns are dead data.
--   2. Add performance indexes on the two non-PK queries that run hottest:
--      - `spools.last_updated` for the default-sorted list.
--      - `spool_sync_state.last_sync_error` for "show errors" queries.
--   3. Add FK on `spool_history.tag_id → spools.tag_id ON DELETE CASCADE`
--      so deleting a spool cascades to its history.
--   4. Collapse `(source, kind)` on `spool_history` into a single `event_type`
--      column. Old tuple → new value:
--      (ams, slot_enter) -> ams_load
--      (ams, slot_exit)  -> ams_unload
--      (ams, update)     -> ams_update
--      (scan, *)         -> scan
--      (manual, *)       -> adjust

ALTER TABLE `spools` DROP COLUMN `last_printer_serial`;
--> statement-breakpoint
ALTER TABLE `spools` DROP COLUMN `last_ams_id`;
--> statement-breakpoint
ALTER TABLE `spools` DROP COLUMN `last_slot_id`;
--> statement-breakpoint

CREATE INDEX `spool_last_updated_idx` ON `spools` (`last_updated`);
--> statement-breakpoint
CREATE INDEX `spool_sync_state_error_idx` ON `spool_sync_state` (`last_sync_error`);
--> statement-breakpoint

-- `spool_history` recreation: add FK + collapse (source, kind) → event_type.
-- Cleanup any orphan rows first so the FK doesn't reject them.
DELETE FROM `spool_history` WHERE `tag_id` NOT IN (SELECT `tag_id` FROM `spools`);
--> statement-breakpoint
CREATE TABLE `__new_spool_history` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `tag_id` text NOT NULL,
  `event_type` text NOT NULL,
  `printer_serial` text,
  `ams_id` integer,
  `slot_id` integer,
  `remain` integer,
  `weight` real,
  `created_at` text DEFAULT (datetime('now')) NOT NULL,
  FOREIGN KEY (`tag_id`) REFERENCES `spools`(`tag_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_spool_history`
  (`id`, `tag_id`, `event_type`, `printer_serial`, `ams_id`, `slot_id`, `remain`, `weight`, `created_at`)
SELECT
  `id`,
  `tag_id`,
  CASE
    WHEN `source` = 'ams' AND `kind` = 'slot_enter' THEN 'ams_load'
    WHEN `source` = 'ams' AND `kind` = 'slot_exit'  THEN 'ams_unload'
    WHEN `source` = 'ams' AND `kind` = 'update'     THEN 'ams_update'
    WHEN `source` = 'scan'                          THEN 'scan'
    WHEN `source` = 'manual'                        THEN 'adjust'
    ELSE 'adjust'
  END AS `event_type`,
  `printer_serial`,
  `ams_id`,
  `slot_id`,
  `remain`,
  `weight`,
  `created_at`
FROM `spool_history`;
--> statement-breakpoint
DROP TABLE `spool_history`;
--> statement-breakpoint
ALTER TABLE `__new_spool_history` RENAME TO `spool_history`;
--> statement-breakpoint
CREATE INDEX `spool_history_tag_created_idx` ON `spool_history` (`tag_id`,`created_at`);
