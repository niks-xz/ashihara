import { defineCollection, reference } from 'astro:content';
import { glob, file } from 'astro/loaders';
import { z } from 'astro/zod';

const requirementRow = z.object({
  technique: z.string(),
  repetitions: z.string(),
  notes: z.string().default(''),
});

const coaches = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/coaches' }),
  schema: z.object({
    fullName: z.string(),
    rank: z.string(),
    title: z.string(),
    achievements: z.string(),
    sortOrder: z.number(),
  }),
});

const gyms = defineCollection({
  loader: glob({ pattern: '**/*.yaml', base: './src/content/gyms' }),
  schema: z.object({
    name: z.string(),
    address: z.string(),
    phone: z.string().optional(),
    description: z.string(),
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
    strengthTests: z.array(requirementRow).default([]),
    kihon: z.array(requirementRow).default([]),
    idoKihon: z.array(requirementRow).default([]),
    kata: z.array(requirementRow).default([]),
    kumite: z.array(requirementRow).default([]),
    sabaki: z.array(requirementRow).default([]),
    tameshiWari: z.array(requirementRow).default([]),
  }),
});

// Каждому видео нужен уникальный id: - { id: kata-1, title: ..., vkVideoUrl: ..., belt: 10-kyu }
const kataVideos = defineCollection({
  loader: file('./src/content/kata-videos.yaml'),
  schema: z.object({
    title: z.string(),
    vkVideoUrl: z.string().url(),
    description: z.string().default(''),
    sortOrder: z.number().default(0),
    belt: reference('belts').optional(),
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
