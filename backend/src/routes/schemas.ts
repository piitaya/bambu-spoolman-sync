import { Type } from "@sinclair/typebox";

export const ErrorResponse = Type.Object({
  error: Type.String(),
});

export const OkResponse = Type.Object({
  ok: Type.Boolean(),
});

const NullableString = Type.Union([Type.String(), Type.Null()]);
const NullableNumber = Type.Union([Type.Number(), Type.Null()]);

export const SpoolResponse = Type.Object({
  uid: NullableString,
  variant_id: NullableString,
  material: NullableString,
  product: NullableString,
  color_hex: NullableString,
  color_hexes: Type.Union([Type.Array(Type.String()), Type.Null()]),
  weight: NullableNumber,
  temp_min: NullableNumber,
  temp_max: NullableNumber,
  remain: NullableNumber,
});

export const MatchTypeEnum = Type.Union([
  Type.Literal("matched"),
  Type.Literal("known_unmapped"),
  Type.Literal("unknown_variant"),
  Type.Literal("third_party"),
  Type.Literal("unknown_spool"),
  Type.Literal("empty"),
]);

const SlotIdentifier = Type.Object({
  printer_serial: Type.String(),
  ams_id: Type.Number(),
  slot_id: Type.Number(),
});

export const SyncOutcomeResponse = Type.Intersect([
  SlotIdentifier,
  Type.Object({
    spool_id: Type.Number(),
    used_weight: NullableNumber,
    created_filament: Type.Boolean(),
    created_spool: Type.Boolean(),
  }),
]);

export const LocalSpoolResponse = Type.Object({
  id: Type.String(),
  tag_id: Type.String(),
  variant_id: NullableString,
  material: NullableString,
  product: NullableString,
  color_hex: NullableString,
  color_name: NullableString,
  weight: NullableNumber,
  remain: Type.Union([Type.Integer(), Type.Null()]),
  source: Type.String(),
  first_seen: Type.String(),
  last_seen: Type.String(),
});

export const SyncAllResultResponse = Type.Object({
  synced: Type.Array(SyncOutcomeResponse),
  skipped: Type.Array(
    Type.Intersect([SlotIdentifier, Type.Object({ reason: Type.String() })]),
  ),
  errors: Type.Array(
    Type.Intersect([SlotIdentifier, Type.Object({ error: Type.String() })]),
  ),
});

