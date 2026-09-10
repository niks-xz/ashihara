// Тренажёр терминов: вся логика на клиенте, состояние - только в localStorage.
// Ни форм, ни отправки данных: страница ничего о посетителе не сообщает наружу.

import { QUESTIONS_PER_SESSION, QUIZ_LEVELS, STORE_KEY, termsForSet, type QuizTerm as Term } from '../lib/quiz-shared';
import { plural } from '../lib/utils';

type Mode = 'meanings' | 'audio';

interface Option {
  text: string;
  correct: boolean;
  term: Term;
}

interface Question {
  term: Term;
  options: Option[];
}

interface Progress {
  setId: string;
  mode: Mode;
  best: Record<string, number>;
  streak: { days: number; last: string };
}

const MODE_TITLES: Record<Mode, string> = { meanings: 'Значения', audio: 'На слух' };
const OPTIONS_PER_QUESTION = 4;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
// Высоты полосок волны в карточке «На слух», px
const WAVE_BARS = [6, 12, 20, 14, 24, 10, 18, 8, 16, 22, 12, 6];

const GREEN = 'var(--color-badge-event-fg)';
const GREEN_BG = 'var(--color-badge-event-bg)';

function el<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

function shuffle<T>(list: T[]): T[] {
  const copy = list.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Данные глоссария вставляются в разметку шаблонными строками, поэтому экранируются:
// символ разметки в статье иначе молча сломал бы карточку
function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Значение в глоссарии начинается с заглавной, внутри фразы нужна строчная. Опускается
// только первая буква и не у аббревиатур: целиком в нижний регистр ушли бы имена собственные
function lowerFirst(text: string): string {
  return text.replace(/^([^А-ЯЁа-яёA-Za-z]*)([А-ЯЁA-Z])(?![А-ЯЁA-Z])/, (_, lead: string, ch: string) => lead + ch.toLowerCase());
}

// Календарная дата по местному времени: серия дней считается по суткам пользователя, а не по UTC
function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / MS_PER_DAY);
}

export function initQuiz(): void {
  const root = el<HTMLDivElement>('quiz');
  const dataEl = document.getElementById('quiz-terms');
  if (!root || !dataEl?.textContent) {
    return;
  }
  const terms: Term[] = JSON.parse(dataEl.textContent).terms;
  const audioBase = root.dataset.audioBase ?? '/audio/glossary/';
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const scrollBehavior: ScrollBehavior = reducedMotion ? 'instant' : 'smooth';

  // Название набора берётся из карточки, где его отрисовал сервер
  const setTitleOf = (id: string): string =>
    root.querySelector<HTMLElement>(`[data-set="${id}"]`)?.dataset.title ?? id;

  // --- Хранилище ---

  const defaults: Progress = {
    setId: 'base', mode: 'meanings', best: {}, streak: { days: 0, last: '' },
  };

  // В хранилище могли остаться значения старой версии тренажёра (режим «Разбор команды»)
  // или мусор, поэтому каждое поле проверяется отдельно, негодное берётся из defaults
  function load(): Progress {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) {
        return { ...defaults };
      }
      const saved = JSON.parse(raw);
      const mode: Mode = Object.hasOwn(MODE_TITLES, saved.mode) ? saved.mode : defaults.mode;
      const setId: string = saved.setId === 'base' || QUIZ_LEVELS.includes(saved.setId) ? saved.setId : defaults.setId;
      const best: Record<string, number> = saved.best && typeof saved.best === 'object' ? saved.best : {};
      const streak = {
        days: Number(saved.streak?.days) || 0,
        last: typeof saved.streak?.last === 'string' ? saved.streak.last : '',
      };
      return { setId, mode, best, streak };
    } catch {
      return { ...defaults };
    }
  }

  function save(): void {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(progress));
    } catch {
      // приватный режим - тренажёр работает, просто без сохранения
    }
  }

  const progress = load();

  // Серия жива, пока последняя тренировка была сегодня или вчера; дальше она обнулилась,
  // хотя в хранилище число лежит до следующей завершённой сессии
  function liveStreak(): number {
    const last = progress.streak.last;
    if (!last) {
      return 0;
    }
    const gap = daysBetween(last, today());
    return gap === 0 || gap === 1 ? progress.streak.days : 0;
  }

  // --- Наборы ---

  function poolFor(setId: string, mode: Mode): Term[] {
    const pool = termsForSet(terms, setId);
    if (mode === 'audio') {
      return pool.filter((t) => t.audio);
    }
    return pool;
  }

  // Два значения неразличимы, если одно целиком входит в другое: «кимоно для занятий»
  // и «кимоно для занятий каратэ» в одном вопросе выглядят как ошибка, хотя это доги и каратэги.
  // Сравнение идёт по целым словам, иначе «семь» нашлась бы внутри «восемь», а «три» - внутри «изнутри»
  function tooClose(a: string, b: string): boolean {
    const words = (s: string): string => ` ${s.toLowerCase().replace(/[^а-яёa-z]+/gi, ' ').trim()} `;
    const x = words(a);
    const y = words(b);
    return x.includes(y) || y.includes(x);
  }

  // Дистракторы берутся сначала из того же раздела глоссария - так вариантами
  // оказываются похожие вещи, а не «поклон» против «удара ногой в прыжке».
  function distractors(term: Term, count: number, mode: Mode): Term[] {
    const all = mode === 'audio' ? terms.filter((t) => t.audio) : terms;
    const same = shuffle(all.filter((t) => t.section === term.section && t.ru !== term.ru));
    const rest = shuffle(all.filter((t) => t.section !== term.section && t.ru !== term.ru));
    const picked: Term[] = [];
    for (const candidate of [...same, ...rest]) {
      if (picked.length >= count) {
        break;
      }
      const clash = [term, ...picked].some((t) => tooClose(t.meaning, candidate.meaning));
      if (!clash) {
        picked.push(candidate);
      }
    }
    return picked;
  }

  function buildSession(setId: string, mode: Mode, only?: Term[]): Question[] {
    const pool = only?.length ? only : poolFor(setId, mode);
    // Омонимы («ути» - «внутренний» и «секущий удар») пишутся и звучат одинаково,
    // поэтому в одну сессию попадает только один из них
    const seen = new Set<string>();
    const picked = shuffle(pool)
      .filter((t) => {
        if (seen.has(t.ru)) {
          return false;
        }
        seen.add(t.ru);
        return true;
      })
      .slice(0, QUESTIONS_PER_SESSION);
    const optionText = (t: Term): string => (mode === 'audio' ? `${t.ru} - ${lowerFirst(t.meaning)}` : t.meaning);
    return picked.map((term) => {
      const wrong = distractors(term, OPTIONS_PER_QUESTION - 1, mode).map((t): Option => ({ text: optionText(t), correct: false, term: t }));
      const right: Option = { text: optionText(term), correct: true, term };
      return { term, options: shuffle([right, ...wrong]) };
    });
  }

  // --- Состояние сессии ---

  let session: Question[] = [];
  let idx = 0;
  let correctCount = 0;
  let sessionMistakes: Term[] = [];
  let answered = false;
  // Повтор ошибок короче полной сессии, поэтому лучший результат по нему не обновляется
  let review = false;

  // --- Аудио ---

  let player: HTMLAudioElement | null = null;
  let waveFrame = 0;

  // Волна в карточке «На слух» закрашивается по мере проигрывания
  function fillWave(wave: HTMLElement, filled: number): void {
    Array.from(wave.children).forEach((bar, i) => {
      bar.classList.toggle('bg-primary', i < filled);
      bar.classList.toggle('bg-line', i >= filled);
    });
  }

  function tickWave(): void {
    const wave = document.getElementById('q-wave');
    if (!wave || !player) {
      return;
    }
    // пока метаданные не подгрузились, duration равен NaN - такой кадр пропускаем
    if (player.duration > 0) {
      fillWave(wave, Math.ceil((player.currentTime / player.duration) * WAVE_BARS.length));
    }
    waveFrame = requestAnimationFrame(tickWave);
  }

  function playTerm(term: Term): void {
    if (!term.audio) {
      return;
    }
    if (!player) {
      player = new Audio();
      player.preload = 'auto';
      // Плеер один на весь тренажёр (пилюля «Послушать», шторка, список ошибок), поэтому
      // слушатели вешаются один раз, а без #q-wave на экране каждый обработчик просто выходит
      player.addEventListener('play', () => {
        const wave = document.getElementById('q-wave');
        if (!wave) {
          return;
        }
        cancelAnimationFrame(waveFrame);
        if (reducedMotion) {
          fillWave(wave, WAVE_BARS.length);
          return;
        }
        fillWave(wave, 0);
        waveFrame = requestAnimationFrame(tickWave);
      });
      player.addEventListener('pause', () => cancelAnimationFrame(waveFrame));
      player.addEventListener('ended', () => {
        const wave = document.getElementById('q-wave');
        if (wave) {
          fillWave(wave, reducedMotion ? 0 : WAVE_BARS.length);
        }
      });
    }
    player.src = `${audioBase}${term.audio}.mp3`;
    player.load();
    void player.play().catch(() => undefined);
  }

  // --- Экраны ---

  const startScreen = el('q-start');
  const playScreen = el('q-play');
  const resultScreen = el('q-result');
  const sheet = el('q-sheet');
  const live = el('q-live');

  // Шторка фиксирована поверх экрана, поэтому под ней резервируется место:
  // иначе нижние варианты остаются закрыты и до них не докрутить
  function setSheet(visible: boolean): void {
    sheet.hidden = !visible;
    playScreen.style.paddingBottom = visible ? `${sheet.offsetHeight + 16}px` : '';
  }

  function show(screen: HTMLElement): void {
    // звук с прошлого экрана не должен доигрывать поверх нового
    player?.pause();
    for (const s of [startScreen, playScreen, resultScreen]) {
      s.hidden = s !== screen;
    }
    setSheet(false);
    document.body.classList.toggle('quiz-playing', screen !== startScreen);
    if (screen === startScreen) {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }

  // --- Старт ---

  function paintChoice(): void {
    root.querySelectorAll<HTMLElement>('[data-set]').forEach((b) => {
      const on = b.dataset.set === progress.setId;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', String(on));
    });
    root.querySelectorAll<HTMLElement>('[data-mode]').forEach((b) => {
      const on = b.dataset.mode === progress.mode;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', String(on));
    });
    const enough = poolFor(progress.setId, progress.mode).length >= OPTIONS_PER_QUESTION;
    const begin = el<HTMLButtonElement>('q-begin');
    begin.textContent = `Начать · ${setTitleOf(progress.setId)}, ${MODE_TITLES[progress.mode].toLowerCase()}`;
    begin.disabled = !enough;
    begin.classList.toggle('opacity-50', !enough);

    const best = progress.best[`${progress.setId}|${progress.mode}`];
    const days = liveStreak();
    const stats = el('q-stats');
    const hasStats = best !== undefined || days > 0;
    stats.hidden = !hasStats;
    if (hasStats) {
      el('q-best').textContent = best === undefined ? '' : String(best);
      el('q-best-of').textContent = best === undefined ? '' : `из ${QUESTIONS_PER_SESSION} · ${setTitleOf(progress.setId)}`;
      el('q-streak').textContent = `${days} ${plural(days, 'день', 'дня', 'дней')}`;
    }
  }

  root.querySelectorAll<HTMLElement>('[data-set]').forEach((btn) => {
    btn.addEventListener('click', () => {
      progress.setId = btn.dataset.set ?? 'base';
      save();
      paintChoice();
    });
  });

  root.querySelectorAll<HTMLElement>('[data-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      progress.mode = (btn.dataset.mode as Mode) ?? 'meanings';
      save();
      paintChoice();
    });
  });

  // --- Вопрос ---

  function optionButton(text: string, i: number): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.option = String(i);
    btn.className =
      'flex w-full min-h-[56px] cursor-pointer items-center gap-3 rounded-[16px] border border-line bg-white px-4 py-[15px] text-left transition-colors hover:border-primary focus-visible:border-primary lg:min-h-[60px]';
    const num = document.createElement('span');
    num.className =
      'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line bg-cream text-[12.5px] font-extrabold text-neutral-600';
    num.textContent = String(i + 1);
    const label = document.createElement('span');
    label.className = 'text-[15.5px] font-semibold';
    label.textContent = text;
    btn.append(num, label);
    return btn;
  }

  function renderQuestion(): void {
    answered = false;
    setSheet(false);
    const q = session[idx];
    const card = el('q-card');
    const answers = el('q-answers');
    card.innerHTML = '';
    answers.innerHTML = '';

    el('q-label').textContent = `${setTitleOf(progress.setId)} · ${MODE_TITLES[progress.mode]}`;
    el('q-counter').textContent = `${idx + 1} из ${session.length}`;
    el('q-progress').style.width = `${((idx + 1) / session.length) * 100}%`;

    if (progress.mode === 'audio') {
      card.innerHTML = `
        <div class="text-[13px] text-neutral-600">Послушай и узнай</div>
        <button type="button" id="q-play-big" aria-label="Послушать" class="mx-auto mt-4 flex h-[104px] w-[104px] cursor-pointer items-center justify-center rounded-full bg-primary text-white shadow-[0_14px_34px_rgba(185,33,54,0.35),0_0_0_14px_var(--color-primary-tint)]">
          <span class="ml-1 text-[40px] leading-none">▶</span>
        </button>
        <div id="q-wave" aria-hidden="true" class="mt-[22px] flex h-6 items-center justify-center gap-1">${WAVE_BARS.map((h) => `<span class="w-[3px] rounded-[2px] bg-line" style="height:${h}px"></span>`).join('')}</div>
        <div class="mt-[10px] text-[13px] text-neutral-600">Можно переслушать сколько угодно</div>
        <div class="mt-3 inline-block rounded-full border border-dashed border-[#D9D7CE] bg-cream px-3 py-[6px] text-[12.5px] text-neutral-800">Термин покажем после ответа</div>`;
      card.querySelector('#q-play-big')?.addEventListener('click', () => playTerm(q.term));
      playTerm(q.term);
    } else {
      card.innerHTML = `
        <div class="text-[13px] text-neutral-600">Что это значит?</div>
        <div class="mt-2 text-[34px] font-black leading-[1.15] tracking-[-0.02em] first-letter:uppercase lg:text-[44px]">${esc(q.term.ru)}</div>
        ${q.term.japanese ? `<div lang="ja" class="mt-1 text-[22px] text-neutral-600 lg:text-[26px]">${esc(q.term.japanese)}</div>` : ''}
        ${q.term.audio ? `<button type="button" id="q-play-pill" class="relative mt-4 inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary-tint px-[14px] py-2 text-[13px] font-bold text-primary before:absolute before:-inset-[3px]"><span class="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-primary text-[10px] text-white">▶</span>Послушать</button>` : ''}`;
      card.querySelector('#q-play-pill')?.addEventListener('click', () => playTerm(q.term));
    }

    q.options.forEach((opt, i) => {
      const btn = optionButton(opt.text, i);
      btn.addEventListener('click', () => answer(i));
      answers.append(btn);
    });
    el('q-hint').innerHTML =
      '<span class="hidden lg:inline">Клавиши 1-4 выбирают ответ · </span>Не знаешь - жми любой, покажем разбор.';

    // После «Дальше» кнопка уходит вместе со шторкой, и фокус упал бы на страницу:
    // переводим его на новый вопрос, чтобы клавиатура и скринридер не теряли место
    card.focus({ preventScroll: true });
  }

  // --- Ответ ---

  function answer(chosen: number): void {
    if (answered) {
      return;
    }
    answered = true;
    const q = session[idx];
    const answers = el('q-answers');
    const buttons = Array.from(answers.querySelectorAll<HTMLButtonElement>('[data-option]'));
    const chosenOpt = q.options[chosen];
    const ok = chosenOpt.correct;

    buttons.forEach((btn, i) => {
      const opt = q.options[i];
      const num = btn.firstElementChild as HTMLElement;
      btn.disabled = true;
      btn.classList.remove('hover:border-primary', 'focus-visible:border-primary', 'cursor-pointer');
      if (opt.correct) {
        btn.classList.replace('border-line', 'border-2');
        btn.style.cssText = `background:${GREEN_BG};border-color:${GREEN};color:${GREEN}`;
        num.style.cssText = `background:${GREEN};color:#fff;border-color:transparent`;
        num.textContent = '✓';
      } else if (i === chosen) {
        btn.classList.replace('border-line', 'border-2');
        btn.style.cssText = 'background:var(--color-primary-tint);border-color:var(--color-primary);color:var(--color-primary)';
        num.style.cssText = 'background:var(--color-primary);color:#fff;border-color:transparent';
        num.textContent = '×';
      } else {
        btn.style.cssText = 'color:var(--color-neutral-500)';
        num.style.color = 'var(--color-neutral-500)';
      }
    });

    if (progress.mode === 'audio') {
      el('q-card').innerHTML = `
        <div class="text-[13px] text-neutral-600">Это было</div>
        <div class="mt-2 text-[30px] font-black leading-[1.15] first-letter:uppercase">${esc(q.term.ru)}</div>
        ${q.term.japanese ? `<div lang="ja" class="mt-1 text-[20px] text-neutral-600">${esc(q.term.japanese)}</div>` : ''}`;
    }

    const wrongText = ok ? '' : `${esc(chosenOpt.term.meaning)} - это <b>${esc(chosenOpt.term.ru)}</b>`;
    finishAnswer(ok, q, wrongText);
  }

  function finishAnswer(ok: boolean, q: Question, wrongText: string): void {
    if (ok) {
      correctCount++;
    } else {
      sessionMistakes.push(q.term);
    }

    el('q-sheet-mark').textContent = ok ? '✓' : '×';
    el('q-sheet-mark').style.background = ok ? GREEN : 'var(--color-primary)';
    el('q-sheet-title').textContent = ok ? 'Верно!' : 'Не то. Запомним вместе';
    el('q-sheet-title').style.color = ok ? GREEN : 'var(--color-primary)';

    // При ошибке кнопка произношения заливается цветом, чтобы притянуть внимание к звуку
    const playBtn = el<HTMLButtonElement>('q-sheet-play');
    playBtn.classList.toggle('bg-primary-tint', ok);
    playBtn.classList.toggle('text-primary', ok);
    playBtn.classList.toggle('bg-primary', !ok);
    playBtn.classList.toggle('text-white', !ok);
    playBtn.hidden = !q.term.audio;
    playBtn.onclick = () => playTerm(q.term);

    el('q-sheet-term').innerHTML = `<b class="text-dark">${esc(q.term.romaji)}</b> - ${esc(lowerFirst(q.term.meaning))}`;

    const parts = el('q-sheet-parts');
    if (q.term.parts.length >= 2) {
      parts.innerHTML =
        '<div class="mb-1 text-[11.5px] font-extrabold uppercase tracking-[0.05em] text-primary">По частям</div>' +
        q.term.parts
          .map((p) => `<div class="text-[13.5px] leading-[1.5] text-neutral-800"><b>${esc(p.word)}</b> - ${esc(lowerFirst(p.meaning))}</div>`)
          .join('');
    } else {
      parts.innerHTML = '';
    }
    el('q-sheet-wrong').innerHTML = wrongText;

    const link = el<HTMLAnchorElement>('q-to-glossary');
    link.hidden = ok;
    link.href = `${link.dataset.href}#${q.term.anchor}`;
    el('q-next').textContent = idx + 1 >= session.length ? 'Итоги →' : 'Дальше →';
    setSheet(true);

    // Результат озвучивается скринридером, а фокус встаёт на «Дальше»: с клавиатуры
    // шторку иначе не найти, варианты под ней уже заблокированы
    live.textContent = `${ok ? 'Верно' : 'Не то'}: ${q.term.ru} - ${lowerFirst(q.term.meaning)}`;
    el('q-next').focus({ preventScroll: true });
  }

  // --- Итог ---

  function finish(): void {
    const total = session.length;
    const share = total ? correctCount / total : 0;
    el('q-result-set').textContent = `${setTitleOf(progress.setId)} · ${MODE_TITLES[progress.mode]}`;
    el('q-score').textContent = String(correctCount);
    el('q-score-of').textContent = `из ${total} верно`;
    // длина окружности берётся из разметки кольца, чтобы число жило в одном месте
    const ring = el('q-ring');
    const circumference = Number(ring.getAttribute('stroke-dasharray'));
    ring.setAttribute('stroke-dashoffset', String(circumference - circumference * share));
    el('q-verdict').textContent = share >= 0.75 ? 'Отлично идёшь!' : share >= 0.5 ? 'Хорошее начало' : 'Ещё разок - и запомнится';

    const key = `${progress.setId}|${progress.mode}`;
    const prevBest = progress.best[key];
    if (!review && (prevBest === undefined || correctCount > prevBest)) {
      progress.best[key] = correctCount;
    }
    const last = progress.streak.last;
    const now = today();
    if (last !== now) {
      progress.streak.days = last && daysBetween(last, now) === 1 ? progress.streak.days + 1 : 1;
      progress.streak.last = now;
    }
    save();

    const days = progress.streak.days;
    el('q-result-note').innerHTML =
      `Лучший результат - ${progress.best[key]}. Серия <b class="text-primary">${days} ${plural(days, 'день', 'дня', 'дней')}</b>, не сбавляй.`;

    const list = el('q-review');
    list.innerHTML = '';
    for (const term of sessionMistakes) {
      const row = document.createElement('div');
      row.className = 'flex items-start gap-3 border-b border-line px-4 py-3 last:border-b-0';
      row.innerHTML = `
        ${term.audio ? `<button type="button" aria-label="Произношение: ${esc(term.ru)}" class="relative mt-[2px] flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full bg-primary-tint text-[11px] text-primary before:absolute before:-inset-[6px]">▶</button>` : '<span class="h-8 w-8 shrink-0"></span>'}
        <div class="min-w-0 flex-1">
          <div class="flex items-baseline justify-between gap-2">
            <span class="text-[15px] font-bold first-letter:uppercase">${esc(term.ru)}</span>
            ${term.japanese ? `<span lang="ja" class="shrink-0 text-[13px] text-neutral-600">${esc(term.japanese)}</span>` : ''}
          </div>
          <div class="mt-[2px] text-[13px] leading-[1.45] text-neutral-800">${esc(term.meaning)}</div>
        </div>`;
      row.querySelector('button')?.addEventListener('click', () => playTerm(term));
      list.append(row);
    }
    el('q-review-wrap').hidden = sessionMistakes.length === 0;
    el('q-clean').hidden = sessionMistakes.length > 0;

    const redo = el<HTMLButtonElement>('q-redo');
    redo.hidden = sessionMistakes.length === 0;
    redo.textContent = `Разобрать ошибки · ${sessionMistakes.length}`;

    show(resultScreen);
    resultScreen.scrollIntoView({ block: 'start', behavior: scrollBehavior });
    el('q-verdict').focus({ preventScroll: true });
  }

  // --- Запуск ---

  function start(only?: Term[]): void {
    session = buildSession(progress.setId, progress.mode, only);
    if (session.length < 1) {
      return;
    }
    review = Boolean(only?.length);
    idx = 0;
    correctCount = 0;
    sessionMistakes = [];
    show(playScreen);
    renderQuestion();
    playScreen.scrollIntoView({ block: 'start', behavior: scrollBehavior });
  }

  function backToStart(): void {
    show(startScreen);
    paintChoice();
    el('q-start-title').focus({ preventScroll: true });
  }

  el('q-begin').addEventListener('click', () => start());
  el('q-next').addEventListener('click', () => {
    idx++;
    if (idx >= session.length) {
      finish();
    } else {
      renderQuestion();
    }
  });
  el('q-close').addEventListener('click', backToStart);
  el('q-result-close').addEventListener('click', backToStart);
  el('q-other').addEventListener('click', backToStart);
  el('q-again').addEventListener('click', () => start());
  el('q-redo').addEventListener('click', () => start(sessionMistakes.slice()));

  // Клавиши 1-4 выбирают ответ, Enter или пробел при открытой шторке листает дальше.
  // Сфокусированная ссылка или кнопка получает клавишу сама - иначе Enter на «В глоссарий»
  // листал бы вопрос; кнопки вариантов после ответа заблокированы и в расчёт не идут
  document.addEventListener('keydown', (e) => {
    if (playScreen.hidden || e.altKey || e.ctrlKey || e.metaKey) {
      return;
    }
    const control = e.target instanceof Element ? e.target.closest('a, button') : null;
    if (control && !control.hasAttribute('data-option')) {
      return;
    }
    if (!sheet.hidden && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      el('q-next').click();
      return;
    }
    const n = Number(e.key);
    if (!answered && n >= 1 && n <= OPTIONS_PER_QUESTION) {
      el('q-answers').querySelector<HTMLButtonElement>(`[data-option="${n - 1}"]`)?.click();
    }
  });

  paintChoice();
}
