import type { TermLevel, TermPart } from './glossary';

// Общее для сборки страницы тренажёра и его браузерного скрипта. Значения из glossary.ts
// сюда не импортируются: тот модуль тянет весь glossary.json, в бандле клиента он лишний.

// Ступени, по которым собираются наборы. Даны не берём: их программа состоит
// из нормативов («выдержать 20 боёв»), а не из терминов, поэтому level у них не проставлен.
export const QUIZ_LEVELS: TermLevel[] = [
  '10-kyu', '9-kyu', '8-kyu', '7-kyu', '6-kyu', '5-kyu', '4-kyu', '3-kyu', '2-kyu', '1-kyu',
];

export const QUESTIONS_PER_SESSION = 12;

// Ключ localStorage: тренажёр хранит там прогресс, затравка в глоссарии читает лучший результат
export const STORE_KEY = 'ashihara.quiz';

// Термин в том виде, в каком его получает браузер
export interface QuizTerm {
  ru: string;
  romaji: string;
  japanese: string;
  meaning: string;
  audio: string;
  section: string;
  level: TermLevel | '';
  anchor: string;
  parts: TermPart[];
}

// «База» по макету - счёт, поклоны и команды, устройство додзё: то, что звучит на первом
// занятии. Звания и понятия тоже размечены base, но в набор не входят - подпись набора
// обещает именно счёт, поклоны и команды.
const BASE_SECTIONS = new Set(['Этикет и команды', 'Счёт', 'Додзё и экипировка']);

// Набор ступени накопительный: своя ступень и все младшие. На отдельных ступенях
// впервые появляется по три-четыре термина, из них сессию не собрать, да и на
// аттестации спрашивают всё пройденное.
export function termsForSet(terms: QuizTerm[], setId: string): QuizTerm[] {
  if (setId === 'base') {
    return terms.filter((t) => t.level === 'base' && BASE_SECTIONS.has(t.section));
  }
  const upto = QUIZ_LEVELS.indexOf(setId as TermLevel);
  if (upto < 0) {
    return [];
  }
  const included = new Set<string>(QUIZ_LEVELS.slice(0, upto + 1));
  return terms.filter((t) => t.level && included.has(t.level));
}
