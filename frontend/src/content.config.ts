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
    sortOrder: z.number(),
  }),
});

const gyms = defineCollection({
  loader: glob({ pattern: '**/*.yaml', base: './src/content/gyms' }),
  schema: z.object({
    name: z.string(),
    district: z.string(),
    address: z.string(),
    phone: z.string().optional(),
    phoneNote: z.string().optional(),
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
  schema: z.object({
    title: z.string(),
    eventDate: z.coerce.date(),
    eventType: z.enum(['news', 'competition', 'event', 'exam', 'other']),
    excerpt: z.string(),
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
