// Общие помощники для строк событий (главная и страница «События»)
import type { CollectionEntry } from 'astro:content';

type EventEntry = CollectionEntry<'events'>;

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

const MONTHS_GENITIVE = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

// «5-6 сентября 2026», «30 октября - 1 ноября 2026», без endDate - «5 сентября 2026»
export function eventDateRange(start: Date, end?: Date): string {
  const startDay = start.getUTCDate();
  const startMonth = MONTHS_GENITIVE[start.getUTCMonth()];
  const year = start.getUTCFullYear();
  if (!end || end.valueOf() <= start.valueOf()) {
    return `${startDay} ${startMonth} ${year}`;
  }
  const endDay = end.getUTCDate();
  const endMonth = MONTHS_GENITIVE[end.getUTCMonth()];
  if (startMonth === endMonth) {
    return `${startDay}-${endDay} ${startMonth} ${year}`;
  }
  return `${startDay} ${startMonth} - ${endDay} ${endMonth} ${year}`;
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

const WEEKDAYS_SHORT = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

export function weekdayShort(date: Date): string {
  return WEEKDAYS_SHORT[date.getUTCDay()];
}

// Площадка и категории: явные поля, иначе хвост excerpt
export function eventPlace(event: EventEntry): string {
  return event.data.place ?? eventMetaFromExcerpt(event.data.excerpt).place;
}

export function eventCategories(event: EventEntry): string[] {
  if (event.data.categories) {
    return event.data.categories;
  }
  return eventMetaFromExcerpt(event.data.excerpt).categories.split(/,\s*/).filter(Boolean);
}

export interface MapLinks {
  open: string;
  widget: string;
}

// Ссылки на Яндекс Карты по площадке и адресу: открыть в картах и встроить виджет
export function mapLinks(place: string, address: string): MapLinks {
  const city = /Краснодар/i.test(address) ? '' : 'Краснодар';
  const text = encodeURIComponent([place, address, city].filter(Boolean).join(', '));
  return {
    open: `https://yandex.ru/maps/?text=${text}`,
    widget: `https://yandex.ru/map-widget/v1/?mode=search&text=${text}&z=16`,
  };
}
