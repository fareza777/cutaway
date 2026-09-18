type SearchableObject = {
  title: string;
  subtitle: string;
  summary: string;
  category: string;
};

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/** Matches every word, preserving the curated order and the current category. */
export function filterLibrary<T extends SearchableObject>(items: T[], query: string, category: string | null): T[] {
  const words = normalize(query).trim().split(/\s+/).filter(Boolean);
  return items.filter((item) => {
    if (category && item.category !== category) return false;
    const text = normalize(`${item.title} ${item.subtitle} ${item.summary} ${item.category}`);
    return words.every((word) => text.includes(word));
  });
}
