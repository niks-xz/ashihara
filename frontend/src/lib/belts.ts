import type { CollectionEntry } from 'astro:content';

type Belt = CollectionEntry<'belts'>;

export interface BeltVisual {
  base: string;
  stripe?: string;
  stripeCount: number;
  border?: string;
}

const beltVisuals: Record<string, BeltVisual> = {
  '10-kyu': { base: '#FFFFFF', stripe: '#2563EB', stripeCount: 1, border: '#D1D5DB' },
  '9-kyu': { base: '#FFFFFF', stripe: '#2563EB', stripeCount: 2, border: '#D1D5DB' },
  '8-kyu': { base: '#2563EB', stripeCount: 0 },
  '7-kyu': { base: '#2563EB', stripe: '#EAB308', stripeCount: 1 },
  '6-kyu': { base: '#EAB308', stripeCount: 0 },
  '5-kyu': { base: '#EAB308', stripe: '#16A34A', stripeCount: 1 },
  '4-kyu': { base: '#16A34A', stripeCount: 0 },
  '3-kyu': { base: '#16A34A', stripe: '#92400E', stripeCount: 1 },
  '2-kyu': { base: '#92400E', stripeCount: 0 },
  '1-kyu': { base: '#92400E', stripe: '#1A1A2E', stripeCount: 1 },
  '1-dan': { base: '#1A1A2E', stripe: '#D4A843', stripeCount: 1 },
  '2-dan': { base: '#1A1A2E', stripe: '#D4A843', stripeCount: 2 },
  '3-dan': { base: '#1A1A2E', stripe: '#D4A843', stripeCount: 3 },
};

const stripeColorNames: Record<string, [string, string]> = {
  '#2563EB': ['синяя', 'синие'],
  '#EAB308': ['жёлтая', 'жёлтые'],
  '#16A34A': ['зелёная', 'зелёные'],
  '#92400E': ['коричневая', 'коричневые'],
  '#1A1A2E': ['чёрная', 'чёрные'],
  '#D4A843': ['золотая', 'золотые'],
};

const baseColorNames: Record<string, string> = {
  '#FFFFFF': 'Белый',
  '#2563EB': 'Синий',
  '#EAB308': 'Жёлтый',
  '#16A34A': 'Зелёный',
  '#92400E': 'Коричневый',
  '#1A1A2E': 'Чёрный',
};

export function getBeltVisual(belt: Belt): BeltVisual {
  return beltVisuals[belt.id] ?? { base: belt.data.colorHex, stripeCount: 0 };
}

export interface BeltGroup {
  label: string;
  swatch: string;
  range: string;
  belts: Belt[];
}

const beltGroupDefs: { key: string; label: string }[] = [
  { key: '#FFFFFF', label: 'Белый пояс' },
  { key: '#2563EB', label: 'Синий пояс' },
  { key: '#EAB308', label: 'Жёлтый пояс' },
  { key: '#16A34A', label: 'Зелёный пояс' },
  { key: '#92400E', label: 'Коричневый пояс' },
  { key: '#1A1A2E', label: 'Чёрный пояс — даны' },
];

// Группы списка поясов: по базовому цвету пояса; belts передавать отсортированными по sortOrder
export function getBeltGroups(belts: Belt[]): BeltGroup[] {
  return beltGroupDefs
    .map(({ key, label }) => {
      const groupBelts = belts.filter((belt) => getBeltVisual(belt).base === key);
      const names = groupBelts.map((belt) => belt.data.name);
      const range = names.length > 1 ? `${names[0]} — ${names[names.length - 1]}` : (names[0] ?? '');
      return { label, swatch: key, range, belts: groupBelts };
    })
    .filter((group) => group.belts.length > 0);
}

export function getBeltDescription(belt: Belt): string {
  const visual = getBeltVisual(belt);
  const baseName = baseColorNames[visual.base] ?? belt.data.beltColor;

  if (!visual.stripe || visual.stripeCount === 0) {
    return `${baseName} пояс`;
  }

  const [singular, plural] = stripeColorNames[visual.stripe] ?? ['', ''];
  const stripeName = visual.stripeCount === 1 ? singular : plural;
  const stripeWord = visual.stripeCount === 1
    ? 'полоска'
    : visual.stripeCount < 5
      ? 'полоски'
      : 'полосок';

  return `${baseName} пояс, ${visual.stripeCount} ${stripeName} ${stripeWord}`;
}
