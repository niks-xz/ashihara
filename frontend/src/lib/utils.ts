export function withBase(path: string | undefined): string {
  if (!path) {
    return '';
  }

  if (/^(https?:)?\/\//.test(path) || path.startsWith('mailto:') || path.startsWith('tel:') || path.startsWith('#')) {
    return path;
  }

  const base = import.meta.env.BASE_URL.endsWith('/')
    ? import.meta.env.BASE_URL.slice(0, -1)
    : import.meta.env.BASE_URL;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  if (!base) {
    return normalizedPath;
  }

  if (normalizedPath === base || normalizedPath.startsWith(`${base}/`)) {
    return normalizedPath;
  }

  return `${base}${normalizedPath}`;
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  news: 'Новость',
  competition: 'Соревнование',
  event: 'Мероприятие',
  exam: 'Экзамен',
  other: 'Другое',
};

export function eventTypeLabel(type: string): string {
  return EVENT_TYPE_LABELS[type] ?? type;
}
