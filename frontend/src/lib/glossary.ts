import type { CollectionEntry } from 'astro:content';
import { parseTechniqueList, type TranslateTerm } from './techniques';

type Belt = CollectionEntry<'belts'>;

// Ручной глоссарий src/data/glossary.json (необязательный):
// { "sections": [{ "title": "...", "rows": [{ "romaji", "japanese", "ru", "ruCommon", "meaning", "note" }] }] }
// ru - транслитерация по Поливанову, ruCommon - привычное написание из методички федерации.
// Если файла нет, глоссарий строится только из автоизвлечённых терминов методички.
interface GlossaryFileRow {
  romaji: string;
  japanese?: string;
  ru: string;
  ruCommon?: string;
  meaning: string;
  note?: string;
}

interface GlossaryFile {
  sections: { title: string; rows: GlossaryFileRow[] }[];
}

export interface GlossaryTerm {
  name: string;
  detail: string;
  japanese?: string;
  common?: string;
  note?: string;
}

export interface GlossarySection {
  header: string;
  terms: GlossaryTerm[];
}

const glossaryModules = import.meta.glob<{ default: GlossaryFile }>('../data/glossary.json', { eager: true });
const glossaryFile = glossaryModules['../data/glossary.json']?.default;
const manualSections = glossaryFile?.sections ?? [];

// Ключ сравнения терминов: без регистра, ё=е и э=е, дефисы и слэши как пробелы
function dedupeKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/[ёэ]/g, 'е')
    .replace(/[\u{2013}\/-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function rowDetail(row: GlossaryFileRow): string {
  return [row.romaji, row.meaning].filter(Boolean).join(' — ');
}

// Перевод ищется и по Поливанову, и по написанию из методички
const translations = new Map<string, string>();
for (const section of manualSections) {
  for (const row of section.rows) {
    const detail = rowDetail(row);
    for (const spelling of [row.ru, row.ruCommon]) {
      if (spelling) {
        translations.set(dedupeKey(spelling), detail);
      }
    }
  }
}

// Перед поиском отбрасываются маркеры стороны «Л»/«П» в начале названия
export const translateTerm: TranslateTerm = (name) =>
  translations.get(dedupeKey(name.replace(/^(?:[ЛП]\s+)+/, ''))) ?? '';

// Токены японских терминов: базовый набор из методички плюс все токены ручного глоссария.
// По ним автоизвлечение отличает название техники от прозового требования.
const termTokens = new Set([
  'аго', 'агэ', 'барай', 'ганмэн', 'гэдан', 'гэри', 'гяку', 'дачи', 'дзедан', 'дзёдан',
  'дзуки', 'идо', 'какэ', 'кансэтсу', 'ката', 'керикоми', 'киай', 'кик', 'кинтэки', 'кихон',
  'кудзуши', 'кумитэ', 'кэри', 'кэрикоми', 'лоу', 'маваши', 'мае', 'маэ', 'нагэ', 'нихон',
  'ой', 'отоши', 'саю', 'сото', 'сунэ', 'сэйкэн', 'сюто', 'тоби', 'тохо', 'тэтсуи',
  'тэтцуи', 'укэ', 'уракэн', 'учи', 'уширо', 'хайто', 'хиджи', 'хиза', 'хизо', 'хики',
  'хиккакэ', 'цуки', 'чудан', 'шита', 'шотэй', 'шошин', 'шуто', 'ёко', 'энкэй',
]);

function tokenKey(token: string): string {
  return token.toLowerCase().replace(/[^а-яёa-z]/gi, '');
}

for (const key of translations.keys()) {
  for (const token of key.split(' ')) {
    const k = tokenKey(token);
    if (k) {
      termTokens.add(k);
    }
  }
}

// Канонические написания для вариантов транслитерации
const canonSpellings: Record<string, string> = {
  дзедан: 'Дзёдан',
  тэтцуи: 'Тэтсуи',
  мае: 'Маэ',
  керикоми: 'Кэрикоми',
  сюто: 'Шуто',
};

function titleCase(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

// Каноническая форма короткого термина; null - строка термином не является
function canonTerm(name: string): string | null {
  const n = name.replace(/^(?:[ЛП]\s+)+/, '').trim();
  if (/[\u{2013}\/-]/u.test(n)) {
    return null;
  }
  const tokens = n.split(/\s+/);
  if (tokens.length < 1 || tokens.length > 3) {
    return null;
  }
  for (const token of tokens) {
    const key = tokenKey(token);
    if (key === 'л' || key === 'п' || !termTokens.has(key)) {
      return null;
    }
  }
  return tokens.map((token) => canonSpellings[tokenKey(token)] ?? titleCase(token)).join(' ');
}

// Глоссарий страницы: только выверенные тематические секции ручного глоссария.
// Автоизвлечение терминов методички осталось у translateTerm - оно питает тултипы
// на страницах поясов, но не попадает на страницу глоссария.
export function buildGlossary(_belts: Belt[]): GlossarySection[] {
  return manualSections.map((section) => ({
    header: section.title,
    terms: section.rows.map((row) => ({
      name: row.ru,
      detail: rowDetail(row),
      japanese: row.japanese || undefined,
      common: row.ruCommon && dedupeKey(row.ruCommon) !== dedupeKey(row.ru) ? row.ruCommon : undefined,
      note: row.note || undefined,
    })),
  }));
}
