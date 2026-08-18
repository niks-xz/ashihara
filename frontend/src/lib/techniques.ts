// Разбор строк техники из методички: одна исходная строка может развернуться
// в несколько позиций списка (цепочка-комбо или отдельные строки-техники).

export interface ComboStep {
  text: string;
  detail: string;
}

export interface TechniqueCombo {
  kind: 'combo';
  label: string;
  steps: ComboStep[];
}

export interface TechniqueText {
  kind: 'text';
  text: string;
  detail: string;
}

export type TechniqueItem = TechniqueCombo | TechniqueText;

// Перевод термина; пустая строка - перевод неизвестен
export type TranslateTerm = (name: string) => string;

const noTranslate: TranslateTerm = () => '';

// Выносит содержимое скобок в отдельную подсказку, очищая название
export function stripParen(s: string): { name: string; detail: string } {
  const details: string[] = [];
  const name = s
    .replace(/\(([^)]*)\)/g, (_match, group: string) => {
      if (group.trim()) {
        details.push(group.trim());
      }
      return ' ';
    })
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.:;])/g, '$1')
    .replace(/\s*\/\s*/g, ' / ')
    .trim();
  return { name, detail: details.join('; ') };
}

// Делит только по запятым верхнего уровня: пропускает запятые внутри скобок и десятичные (1,5)
export function splitTop(text: string): string[] {
  const parts: string[] = [];
  let buf = '';
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') {
      depth++;
    } else if (ch === ')') {
      depth = Math.max(0, depth - 1);
    }
    if (ch === ',' && depth === 0 && !(/\d/.test(text[i - 1] ?? '') && /\d/.test(text[i + 1] ?? ''))) {
      parts.push(buf.trim());
      buf = '';
    } else {
      buf += ch;
    }
  }
  if (buf.trim()) {
    parts.push(buf.trim());
  }
  return parts.filter(Boolean);
}

// Короткая фраза из известных терминов, а не прозовое требование
function looksLikeTerm(name: string, translate: TranslateTerm): boolean {
  if (!name || /^\d/.test(name)) {
    return false;
  }
  if (name.split(/\s+/).length > 5) {
    return false;
  }
  return Boolean(translate(name));
}

function gloss(name: string, paren: string, translate: TranslateTerm): string {
  if (paren) {
    return paren;
  }
  if (!looksLikeTerm(name, translate)) {
    return '';
  }
  return translate(name);
}

function makeCombo(label: string, raw: string[], translate: TranslateTerm): TechniqueCombo {
  const steps = raw.map((part) => {
    const p = stripParen(part);
    return { text: p.name, detail: gloss(p.name, p.detail, translate) };
  });
  return { kind: 'combo', label, steps };
}

function makeText(s: string, translate: TranslateTerm): TechniqueText {
  const p = stripParen(s);
  return { kind: 'text', text: p.name, detail: gloss(p.name, p.detail, translate) };
}

export function parseTechniqueList(text: string, translate: TranslateTerm = noTranslate): TechniqueItem[] {
  const colon = text.indexOf(':');
  if (colon > -1 && colon < 40) {
    const label = text.slice(0, colon).trim();
    const raw = splitTop(text.slice(colon + 1).trim());
    if (raw.length >= 2) {
      return [makeCombo(label, raw, translate)];
    }
    return [makeText(text, translate)];
  }
  const raw = splitTop(text);
  if (raw.length >= 2) {
    // Связка перемещений (есть шаги/развороты) - цепочка чипов; иначе отдельные техники - отдельные строки
    if (/шаг|развор|начиная|то же|вперед|назад/i.test(text)) {
      return [makeCombo('', raw, translate)];
    }
    return raw.map((part) => makeText(part, translate));
  }
  return [makeText(text, translate)];
}
