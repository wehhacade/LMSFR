import type { DisarmamentRecord } from "@/types/hubkadhigis";
import { resolveMediaUrl } from "@/lib/media-url";

export function weaponImageUrl(
  record: Pick<DisarmamentRecord, "weapon_image_url" | "cover_image_url">,
) {
  return resolveMediaUrl(record.weapon_image_url ?? record.cover_image_url ?? null);
}

export function personImageUrl(record: Pick<DisarmamentRecord, "person_image_url">) {
  return resolveMediaUrl(record.person_image_url ?? null);
}

/** Primary gallery face: person photo, else weapon/cover. */
export function primaryGalleryImageUrl(
  record: Pick<DisarmamentRecord, "weapon_image_url" | "cover_image_url" | "person_image_url">,
) {
  return personImageUrl(record) ?? weaponImageUrl(record);
}

export function recordHasDisplayPhoto(
  record: Pick<DisarmamentRecord, "weapon_image_url" | "cover_image_url" | "person_image_url">,
) {
  return !!(personImageUrl(record) || weaponImageUrl(record));
}

export function formatRecordDate(iso: string | null | undefined) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString("so-SO", { day: "numeric", month: "short", year: "numeric" });
}

export type RecordStatusKind = "handed_over" | "registered";

export function recordStatus(
  record: Pick<DisarmamentRecord, "surrender_date">,
): RecordStatusKind {
  return record.surrender_date ? "handed_over" : "registered";
}
