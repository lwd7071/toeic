export function searchTitle(title: string) {
  return title.trim().normalize("NFC").toLocaleLowerCase("vi");
}

export function countChange(before: { archivedAt: string | null } | null, after: { archivedAt: string | null } | null) {
  return {
    totalCount: Number(Boolean(after)) - Number(Boolean(before)),
    activeCount: Number(Boolean(after && !after.archivedAt)) - Number(Boolean(before && !before.archivedAt)),
  };
}
