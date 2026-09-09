import { getEntry, type CollectionEntry } from 'astro:content';

export type CoachEntry = CollectionEntry<'coaches'>;

export interface ScheduleRow {
  day: string;
  start: string;
  end: string;
  group: string;
  coach: CoachEntry;
}

const DAY_ORDER = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];

export const SHORT_DAY: Record<string, string> = {
  'Понедельник': 'Пн',
  'Вторник': 'Вт',
  'Среда': 'Ср',
  'Четверг': 'Чт',
  'Пятница': 'Пт',
  'Суббота': 'Сб',
  'Воскресенье': 'Вс',
};

const DAY_CODES: Record<string, string> = {
  'Пн': 'Mo', 'Вт': 'Tu', 'Ср': 'We', 'Чт': 'Th', 'Пт': 'Fr', 'Сб': 'Sa', 'Вс': 'Su',
};

export interface GymHours {
  days: string;
  time: string;
}

// Часы работы в формате schema.org: перечисление и диапазон дней, интервалы через «и» разбиваются
export function toOpeningHours(hours: GymHours[]): string[] {
  return hours.flatMap(({ days, time }) => {
    const codes = days.includes('-')
      ? days.split('-').map((d) => DAY_CODES[d.trim()]).filter(Boolean).join('-')
      : days.split(',').map((d) => DAY_CODES[d.trim()]).filter(Boolean).join(',');
    if (!codes) {
      return [];
    }
    return time.split(/\s+и\s+/).map((interval) => `${codes} ${interval.trim()}`);
  });
}

export async function getGymSchedule(gymId: string): Promise<ScheduleRow[]> {
  const schedule = await getEntry('schedule', gymId);

  if (!schedule) {
    return [];
  }

  const rows = await Promise.all(schedule.data.entries.map(async (entry) => {
    const coach = await getEntry(entry.coach);

    if (!coach) {
      throw new Error(`Тренер "${entry.coach.id}" из расписания "${gymId}" не найден в коллекции coaches`);
    }

    return {
      day: entry.day,
      start: entry.start,
      end: entry.end,
      group: entry.group,
      coach,
    };
  }));

  return rows.sort((a, b) => {
    const dayDiff = DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day);

    if (dayDiff !== 0) {
      return dayDiff;
    }

    return a.start.localeCompare(b.start);
  });
}

export function groupByDay(rows: ScheduleRow[]): Map<string, ScheduleRow[]> {
  const grouped = new Map<string, ScheduleRow[]>();

  for (const row of rows) {
    const dayRows = grouped.get(row.day) ?? [];
    dayRows.push(row);
    grouped.set(row.day, dayRows);
  }

  return grouped;
}

export function isYouthRow(row: ScheduleRow): boolean {
  const group = row.group.toLowerCase();

  return group.includes('млад') || group.includes('сред');
}

export function uniqueCoaches(rows: ScheduleRow[]): CoachEntry[] {
  const coaches = new Map<string, CoachEntry>();

  for (const row of rows) {
    coaches.set(row.coach.id, row.coach);
  }

  return [...coaches.values()];
}
