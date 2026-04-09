export function amsLabel(id: number): string {
  if (id >= 128) return `AMS HT-${String.fromCharCode(65 + (id - 128))}`;
  return `AMS-${String.fromCharCode(65 + id)}`;
}
