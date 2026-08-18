// Общие помощники для строк событий (главная и страница «События»)

const BADGE_CLASSES: Record<string, string> = {
  competition: 'bg-badge-competition-bg text-badge-competition-fg',
  exam: 'bg-badge-exam-bg text-badge-exam-fg',
  news: 'bg-badge-news-bg text-badge-news-fg',
  event: 'bg-badge-event-bg text-badge-event-fg',
  other: 'bg-line-soft text-neutral-800',
};

export function badgeClasses(type: string): string {
  return BADGE_CLASSES[type] ?? BADGE_CLASSES.other;
}

const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

export interface EventDateParts {
  day: string;
  month: string;
  year: string;
}

// Дата события хранится как UTC-полночь (z.coerce.date из YYYY-MM-DD),
// поэтому части даты берём UTC-геттерами, чтобы не зависеть от таймзоны сборки
export function eventDateParts(date: Date): EventDateParts {
  return {
    day: String(date.getUTCDate()),
    month: MONTHS_SHORT[date.getUTCMonth()],
    year: String(date.getUTCFullYear()),
  };
}

export interface EventMeta {
  place: string;
  categories: string;
}

// В excerpt метаданные записаны хвостом вида «Категории: … . Место: … .» -
// вытаскиваем их для карточек «Место» и «Категории» на странице события
export function eventMetaFromExcerpt(excerpt: string): EventMeta {
  const placeMatch = excerpt.match(/Место:\s*([^]+?)\.?\s*$/);
  const catsMatch = excerpt.match(/Категории:\s*([^]+?)(?:\.\s*Место:|\.?\s*$)/);

  return {
    place: placeMatch ? placeMatch[1] : '',
    categories: catsMatch ? catsMatch[1] : '',
  };
}
