import type { CollectionEntry } from 'astro:content';
import { buildGlossary, spellingVariants, termAnchor, termDetails, type TermPart } from './glossary';
import { QUIZ_LEVELS, termsForSet, type QuizTerm } from './quiz-shared';

type Belt = CollectionEntry<'belts'>;

export interface QuizSet {
  id: string;
  title: string;
  note: string;
  count: number;
  belt?: Belt;
}

// Разделы, из которых слово годится как кирпичик команды
const COMMAND_PARTS = new Set(['Уровни и направления', 'Части тела и ударные поверхности']);
const COMMAND_ACTIONS = new Set(['Удары руками', 'Удары ногами', 'Удары локтями', 'Блоки']);

// Разбор команды по словам («сэйкэн тюдан цуки» -> сэйкэн + тюдан + цуки) берётся
// из логики попапа термина: последнее слово - действие, предыдущие - уточнения.
//
// Показываем разбор только там, где он заведомо верен: последнее слово - удар или блок,
// а каждое предыдущее - уровень, направление или ударная поверхность. Иначе разбор врёт:
// в «сёмэн ни рэй» частица «ни» подменяется числом «два» из раздела счёта, а скобочные
// синонимы вроде «си (ён)» вообще не команды. Слова без своей статьи в глоссарии
// отсекаются здесь же - они просто не находятся.
function partsOf(name: string, sectionsOfWord: Map<string, Set<string>>): TermPart[] {
  if (name.includes('(')) {
    return [];
  }
  const parts = termDetails(name)?.parts ?? [];
  if (parts.length < 2 || !parts.every((p) => p.meaning)) {
    return [];
  }
  // У слова бывает несколько статей: «ути» - и «внутренний» из направлений,
  // и «секущий удар» из ударов руками. Проверяем все разделы слова, а не первый попавшийся.
  const fits = (i: number, allowed: Set<string>): boolean => {
    const sections = sectionsOfWord.get(parts[i].word.toLowerCase());
    return sections ? [...sections].some((section) => allowed.has(section)) : false;
  };
  const lastIsAction = fits(parts.length - 1, COMMAND_ACTIONS);
  const restAreParts = parts.slice(0, -1).every((_, i) => fits(i, COMMAND_PARTS));
  return lastIsAction && restAreParts ? parts : [];
}

export function buildQuizTerms(belts: Belt[]): QuizTerm[] {
  const sections = buildGlossary(belts);

  // разделы, в которых слово встречается отдельной статьёй;
  // скобочный вариант статьи («гэри (кэри)») даёт ключи гэри и кэри
  const sectionsOfWord = new Map<string, Set<string>>();
  for (const section of sections) {
    for (const term of section.terms) {
      for (const variant of spellingVariants(term.name)) {
        if (variant.includes(' ')) {
          continue;
        }
        const key = variant.toLowerCase();
        const known = sectionsOfWord.get(key);
        if (known) {
          known.add(section.header);
        } else {
          sectionsOfWord.set(key, new Set([section.header]));
        }
      }
    }
  }

  // Служебные слова (частицы «ни» и «но», счётный суффикс «хон») в тренажёр не идут
  // ни вопросом, ни вариантом ответа: на карточке частица «ни» неотличима от числа «ни»
  return sections.flatMap((section) =>
    section.terms
      .filter((term) => !term.service)
      .map((term) => ({
        ru: term.name,
        romaji: term.romaji,
        japanese: term.japanese ?? '',
        meaning: term.meaning,
        audio: term.audio ?? '',
        section: section.header,
        level: term.level ?? '',
        anchor: termAnchor(section.header, term.name),
        parts: partsOf(term.name, sectionsOfWord),
      })),
  );
}

export function buildQuizSets(terms: QuizTerm[], belts: Belt[]): QuizSet[] {
  const beltById = new Map(belts.map((b) => [b.id, b]));
  const sets: QuizSet[] = [
    {
      id: 'base',
      title: 'База',
      note: 'Счёт, поклоны и команды в додзё - нужны с первого дня',
      count: termsForSet(terms, 'base').length,
    },
  ];
  for (const level of QUIZ_LEVELS) {
    const belt = beltById.get(level);
    if (!belt) {
      continue;
    }
    sets.push({
      id: level,
      title: belt.data.name,
      note: '',
      count: termsForSet(terms, level).length,
      belt,
    });
  }
  return sets;
}
