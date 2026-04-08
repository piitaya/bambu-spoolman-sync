# Bambu Spoolman Sync

View your Bambu Lab AMS slots and match them against a community-maintained
Spoolman mapping — with deterministic RFID variant matching, not fuzzy string
transforms.

> **Status — Step 2.** Multi-printer viewer with deterministic variant
> matching **and Spoolman write-back**: matched slots can be pushed to
> your Spoolman instance on demand or automatically on every AMS update.

## Why

Matching Bambu spools by transforming material names and comparing hex
colors is fragile: it silently breaks on product renames and on any
wrong-hex entry in SpoolmanDB. This project matches **only** on
`tray_id_name` — the unique RFID variant id stamped on every genuine
Bambu spool — against a curated mapping in
[`piitaya/bambu-spoolman-db`](https://github.com/piitaya/bambu-spoolman-db).
Either a slot is a deterministic match, or the UI tells you exactly why
it isn't.

## What it does today

- Connects to one or more Bambu Lab printers over local MQTT and shows
  every AMS slot side by side, labeled with whether the loaded spool
  can be matched to a Spoolman equivalent.
- Syncs matched slots to your Spoolman instance: finds or creates the
  filament (auto-importing from SpoolmanDB when missing), finds or
  creates the spool identified by the physical RFID UID stored in
  `extra.tag`, and updates its `used_weight` from the AMS `remain %`.
- Triggers can be manual (**Sync all** button on the dashboard, or a
  per-slot sync icon) or automatic on every AMS update, toggled in
  **Settings → Spoolman**.

## What it does NOT do yet

- Sync unmapped / unknown / third-party slots (only `matched` for now).
- Track filament usage over time beyond the latest weight snapshot.
- Contribute unmapped variants back to the community mapping.

## Running it

Requirements: **Node.js 20+**.

```bash
npm install      # install dependencies
npm run dev      # dev mode with hot reload
npm test         # run tests

# production build + run (single process on :4000)
npm run build
npm start
```

### Environment variables

| Var        | Default   | Purpose                                       |
| ---------- | --------- | --------------------------------------------- |
| `PORT`     | `4000`    | HTTP port                                     |
| `HOST`     | `0.0.0.0` | Bind address                                  |
| `DATA_DIR` | `./data`  | Where `config.json` and `filaments.json` live |

## Configuration

Everything is UI-driven. Add your first printer from the **Printers** page
(name, host / IP, serial, access code):

- Find the **serial** and **access code** on the printer's touchscreen
  under **Settings → Device → Device Info** and
  **Settings → Network → LAN-only mode**.
- Tweak the mapping **refresh interval** under
  **Settings → Filament mapping**.
- Point the app at your Spoolman instance under **Settings → Spoolman**
  (URL, plus an optional **auto-sync** switch). Use **Test connection**
  to verify the URL before saving.

Everything is persisted to `config.json` under `DATA_DIR`; the cached
filament mapping lives next to it as `filaments.json`.

## Slot statuses

| Status          | Meaning                                                            |
| --------------- | ------------------------------------------------------------------ |
| **mapped**      | Known Bambu variant with a Spoolman equivalent — ready to sync     |
| **unmapped**    | Known Bambu variant, but no Spoolman equivalent yet                |
| **unknown**     | Bambu variant not in the mapping — probably a new SKU              |
| **third party** | Non-Bambu spool, or a spool without an RFID tag                    |
| **empty**       | Slot has no filament loaded                                        |

## Privacy

- Outbound connections: **your printers** (over the local network) and
  **GitHub** (to refresh the filament mapping). Nothing else phones home.
- No analytics, no telemetry, no accounts.
- Access codes live only in your local `config.json`.

## Roadmap

- **Step 3** — Opt-in unmapped variant reporting back to `bambu-spoolman-db`.
- **Step 4** — Dockerfile + compose example.

## License

MIT — see [LICENSE](LICENSE).
