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
  audio?: string;
}

// Слово составного термина с переводом: «Уракэн Гаммэн Ути» -> уракэн + гаммэн + ути
export interface TermPart {
  word: string;
  meaning: string;
}

// Данные попапа термина на страницах поясов
export interface TermDetails {
  name: string;
  japanese: string;
  romajiMeaning: string;
  audio: string;
  parts: TermPart[];
}

// Имя аудиофайла произношения: тот же slug, что у генератора озвучки -
// из ПОЛНОГО ромадзи, включая вариант в скобках: «shi (yon)» -> shi-yon.mp3
function audioSlug(romaji: string): string | undefined {
  if (/^[A-Z]{2,}$/.test(romaji.split('(')[0].trim())) {
    return undefined;
  }
  const slug = romaji
    .toLowerCase()
    .replace(/[()]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || undefined;
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

// Строки глоссария по написанию - для попапа термина. Одно написание может
// иметь омонимы («ути» - и «внутренний» 内, и «секущий удар» 打ち), поэтому
// хранится список с пометкой раздела, а нужный выбирается по роли слова.
interface SpelledRow {
  row: GlossaryFileRow;
  isAction: boolean;
}
const rowsBySpelling = new Map<string, SpelledRow[]>();
const ACTION_SECTIONS = /удары|блоки|броски|перемещения|стойки/i;

// Написание со скобкой даёт три ключа: «гэри (кэри)» -> «гэри (кэри)», «гэри», «кэри»
function spellingVariants(spelling: string): string[] {
  const variants = [spelling];
  const match = spelling.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if (match) {
    variants.push(match[1].trim(), match[2].trim());
  }
  return variants.filter(Boolean);
}

for (const section of manualSections) {
  const isAction = ACTION_SECTIONS.test(section.title);
  for (const row of section.rows) {
    const detail = rowDetail(row);
    for (const spelling of [row.ru, row.ruCommon]) {
      if (!spelling) {
        continue;
      }
      for (const variant of spellingVariants(spelling)) {
        const key = dedupeKey(variant);
        if (!translations.has(key)) {
          translations.set(key, detail);
        }
        const bucket = rowsBySpelling.get(key);
        if (bucket) {
          bucket.push({ row, isAction });
        } else {
          rowsBySpelling.set(key, [{ row, isAction }]);
        }
      }
    }
  }
}

// Из омонимов выбирается подходящий: последнее слово термина - действие
// («Уракэн Гаммэн Ути» - удар), предыдущие - уточнения («Ути Укэ» - изнутри).
function pickRow(spelling: string, preferAction: boolean): GlossaryFileRow | undefined {
  const bucket = rowsBySpelling.get(dedupeKey(spelling));
  if (!bucket || bucket.length === 0) {
    return undefined;
  }
  if (bucket.length === 1) {
    return bucket[0].row;
  }
  return (bucket.find((r) => r.isAction === preferAction) ?? bucket[0]).row;
}

// Перед поиском отбрасываются маркеры стороны «Л»/«П» в начале названия
export const translateTerm: TranslateTerm = (name) =>
  translations.get(dedupeKey(name.replace(/^(?:[ЛП]\s+)+/, ''))) ?? '';

// --- Канонизация отображения: написания методички приводятся к канону глоссария ---

// Фразы: ключ ru и ruCommon -> каноническое ru («санчин дачи» -> «сантин-дати»)
const phraseCanon = new Map<string, string>();
// Отдельные слова: токен методички -> канонический токен («маваши» -> «маваси»)
const tokenCanon = new Map<string, string>();

for (const section of manualSections) {
  for (const row of section.rows) {
    phraseCanon.set(dedupeKey(row.ru), row.ru);
    if (row.ruCommon) {
      phraseCanon.set(dedupeKey(row.ruCommon), row.ru);
    }
    const ruWords = row.ru.split(/[\s-]+/).filter(Boolean);
    for (const word of ruWords) {
      const key = tokenKey(word);
      if (key && !tokenCanon.has(key)) {
        tokenCanon.set(key, word.toLowerCase());
      }
    }
    if (row.ruCommon) {
      const commonWords = row.ruCommon.split(/[\s-]+/).filter(Boolean);
      if (commonWords.length === ruWords.length) {
        commonWords.forEach((word, i) => {
          const key = tokenKey(word);
          if (key && !tokenCanon.has(key)) {
            tokenCanon.set(key, ruWords[i].toLowerCase());
          }
        });
      }
    }
  }
}

function matchCase(sample: string, canon: string): string {
  if (/^[А-ЯЁA-Z]/.test(sample)) {
    return canon
      .split(' ')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }
  return canon;
}

// Приводит отображаемый текст к канону глоссария: сперва самая длинная фразовая
// замена (до 4 слов), затем пословная; неизвестные слова остаются как есть.
export function canonizeDisplay(text: string): string {
  const parts = text.split(/(\s+|[(),/])/);
  const wordIdx: number[] = [];
  parts.forEach((p, i) => {
    if (p && !/^(\s+|[(),/])$/.test(p)) {
      wordIdx.push(i);
    }
  });
  let w = 0;
  while (w < wordIdx.length) {
    let replaced = false;
    for (let len = Math.min(4, wordIdx.length - w); len >= 2; len--) {
      const segment = wordIdx.slice(w, w + len).map((i) => parts[i]).join(' ');
      const canon = phraseCanon.get(dedupeKey(segment));
      if (canon) {
        parts[wordIdx[w]] = matchCase(segment, canon);
        for (let k = 1; k < len; k++) {
          parts[wordIdx[w + k]] = '';
        }
        // затираем пробелы между словами заменённого сегмента
        for (let i = wordIdx[w] + 1; i < wordIdx[w + len - 1]; i++) {
          if (/^\s+$/.test(parts[i])) {
            parts[i] = '';
          }
        }
        w += len;
        replaced = true;
        break;
      }
    }
    if (!replaced) {
      const i = wordIdx[w];
      const canonToken = tokenCanon.get(tokenKey(parts[i]));
      if (canonToken) {
        parts[i] = matchCase(parts[i], canonToken);
      }
      w++;
    }
  }
  return parts.join('').replace(/\s{2,}/g, ' ').trim();
}

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

// --- Подробности термина для попапа на страницах поясов ---

// Служебные слова русских пояснений («с разворотом на 180») - не термины
const RUS_STOP = /^(с|на|из|в|и|или|до|по|за|к|ко|от|у|же|то|под|при|для|через|градусов)$/i;

// Разбор составного термина: каждое слово с собственным значением.
// Возвращается пустым, если слов меньше двух или ни одно не удалось перевести.
function termParts(name: string): TermPart[] {
  const words = name
    .replace(/^(?:[ЛП]\s+)+/, '')
    .split(/[\s-]+/)
    .filter((w) => w && !RUS_STOP.test(w) && !/^\d+$/.test(w) && /[а-яёa-z]/i.test(w));
  if (words.length < 2) {
    return [];
  }
  const parts = words.map((word, i) => {
    const row = pickRow(word, i === words.length - 1);
    return { word, meaning: row?.meaning ?? '' };
  });
  return parts.some((p) => p.meaning) ? parts : [];
}

// Всё, что показывает попап термина; null - термина нет в глоссарии
export function termDetails(name: string): TermDetails | null {
  const clean = name.replace(/^(?:[ЛП]\s+)+/, '').trim();
  const row = pickRow(clean, true);
  const parts = termParts(clean);
  if (!row && parts.length === 0) {
    return null;
  }
  return {
    name: clean,
    japanese: row?.japanese ?? '',
    romajiMeaning: row ? rowDetail(row) : '',
    audio: row ? (audioSlug(row.romaji) ?? '') : '',
    parts,
  };
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
      audio: audioSlug(row.romaji),
    })),
  }));
}
