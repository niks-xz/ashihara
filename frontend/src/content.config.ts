import { defineCollection, reference } from 'astro:content';
import { glob, file } from 'astro/loaders';
import { z } from 'astro/zod';

// Раздел требований: техники сгруппированы по стойкам, как в методичке федерации.
// Отметка «Х» в исходной таблице означает «техника входит в программу уровня»,
// поэтому у большинства позиций нет числа повторений - только само название.
const requirementSection = z.object({
  title: z.string(),
  note: z.string().default(''),
  groups: z.array(z.object({
    title: z.string().default(''),
    items: z.array(z.string()).nonempty(),
  })).nonempty(),
});

const coaches = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/coaches' }),
  schema: ({ image }) => z.object({
    fullName: z.string(),
    rank: z.string(),
    title: z.string(),
    achievements: z.string().default(''),
    photo: image().optional(),
    // Пол нужен только для рисованной заглушки, пока нет фото
    gender: z.enum(['male', 'female']).default('male'),
    sortOrder: z.number(),
  }),
});

const gyms = defineCollection({
  loader: glob({ pattern: '**/*.yaml', base: './src/content/gyms' }),
  schema: ({ image }) => z.object({
    name: z.string(),
    photo: image().optional(),
    photoAlt: z.string().optional(),
    district: z.string(),
    // Район в предложном падеже для заголовков: «Каратэ в Черемушках»
    areaLocative: z.string(),
    address: z.string(),
    phone: z.string().optional(),
    phoneNote: z.string().optional(),
    // Часы работы зала: время занятий, а не расписание конкретных групп
    hours: z.array(z.object({
      days: z.string(),
      time: z.string(),
    })).optional(),
    description: z.string().optional(),
    coaches: z.array(reference('coaches')).default([]),
    sortOrder: z.number(),
  }),
});

// Файл расписания на зал: id файла = slug зала
const schedule = defineCollection({
  loader: glob({ pattern: '**/*.yaml', base: './src/content/schedule' }),
  schema: z.object({
    entries: z.array(
      z.object({
        day: z.enum(['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье']),
        start: z.string().regex(/^\d{2}:\d{2}$/),
        end: z.string().regex(/^\d{2}:\d{2}$/),
        group: z.string(),
        coach: reference('coaches'),
      }),
    ),
  }),
});

const events = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/events' }),
  schema: ({ image }) => z.object({
    title: z.string(),
    eventDate: z.coerce.date(),
    // Последний день многодневного события
    endDate: z.coerce.date().optional(),
    eventType: z.enum(['news', 'competition', 'event', 'exam', 'other']),
    excerpt: z.string(),
    // Анонс предстоящего события: время, площадка, категории, программа по дням, афиша.
    // Без place и categories значения берутся из хвоста excerpt («Категории: ... Место: ...»)
    startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    registration: z.string().optional(),
    place: z.string().optional(),
    address: z.string().optional(),
    categories: z.array(z.string()).optional(),
    days: z.array(z.object({
      date: z.coerce.date(),
      discipline: z.string(),
      categories: z.array(z.string()).default([]),
    })).optional(),
    organizers: z.string().optional(),
    poster: image().optional(),
    // Видеорепортаж: пути от корня сайта, файлы лежат в public/videos/
    video: z.string().optional(),
    videoPoster: z.string().optional(),
  }),
});

const belts = defineCollection({
  loader: glob({ pattern: '**/*.yaml', base: './src/content/belts' }),
  schema: z.object({
    name: z.string(),
    sortOrder: z.number(),
    beltColor: z.string(),
    colorHex: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    description: z.string(),
    strengthTest: z.array(z.object({
      exercise: z.string(),
      count: z.coerce.string(),
    })).default([]),
    sections: z.array(requirementSection).default([]),
  }),
});

// Каждому видео нужен уникальный id (см. комментарий в самом файле)
const kataVideos = defineCollection({
  loader: file('./src/content/kata-videos.yaml'),
  schema: z.object({
    title: z.string(),
    latinTitle: z.string(),
    duration: z.string().regex(/^\d+:\d{2}$/),
    videoUrl: z.string().url(),
    belt: reference('belts').optional(),
    sortOrder: z.number().default(0),
  }),
});

export const collections = {
  coaches,
  gyms,
  schedule,
  events,
  belts,
  'kata-videos': kataVideos,
};
