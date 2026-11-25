import {
  ANNOUNCEMENT_CATEGORY_META,
  type AnnouncementCategory,
  type SchoolAnnouncementItem,
} from "../../lib/validators/bulletin";

export interface BulletinSearchQuery {
  text: string;
  category: AnnouncementCategory | "all";
  onlyUnread: boolean;
}

export interface BulletinSearchAdapter {
  readonly engine: "local" | "algolia";
  search(
    items: SchoolAnnouncementItem[],
    query: BulletinSearchQuery
  ): SchoolAnnouncementItem[];
}

export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Motor local instantáneo tolerante a tildes y mayúsculas.
 * Expone la misma interfaz que el futuro conector de Algolia (`siga_cartelera`)
 * para cambiar o combinar el proveedor sin alterar los componentes de UI.
 */
export const localBulletinSearchAdapter: BulletinSearchAdapter = {
  engine: "local",
  search(items, query) {
    const cleanText = normalizeSearchText(query.text);
    const tokens = cleanText ? cleanText.split(/\s+/).filter(Boolean) : [];

    return items.filter((item) => {
      if (query.category !== "all" && item.category !== query.category) {
        return false;
      }

      if (query.onlyUnread && item.hasRead) {
        return false;
      }

      if (tokens.length === 0) {
        return true;
      }

      const categoryLabel =
        ANNOUNCEMENT_CATEGORY_META[item.category]?.label ?? "";
      const haystack = normalizeSearchText(
        [
          item.title,
          item.shortNote,
          item.body,
          item.locationLabel ?? "",
          item.targetMencionName ?? "",
          item.authorName,
          categoryLabel,
        ].join(" ")
      );

      return tokens.every((token) => haystack.includes(token));
    });
  },
};

export function searchBulletinAnnouncements(
  items: SchoolAnnouncementItem[],
  query: BulletinSearchQuery,
  adapter: BulletinSearchAdapter = localBulletinSearchAdapter
): SchoolAnnouncementItem[] {
  return adapter.search(items, query);
}
