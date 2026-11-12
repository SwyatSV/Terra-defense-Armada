import "./style.css";
import "./art.css";
import { branding, challenges, rules } from "./data.ts";
import {
  abilities,
  alive,
  botDecision,
  botView,
  canUseAbility,
  cells,
  createMatch,
  declineContinuation,
  execute,
  fleetLengths,
  freshDatabase,
  inventory,
  legal,
  placementError,
  randomFleet,
  ready,
  reward,
  scanCells,
  sunk,
  surrender,
} from "./engine.ts";
import type {
  Ability,
  Command,
  Database,
  Match,
  Mode,
  Ship,
} from "./engine.ts";
import { commit, load, testMode } from "./storage.ts";
import { Platform } from "./platform.ts";
import { sprite } from "./art.ts";
import { Audio } from "./audio.ts";
const root = document.querySelector<HTMLDivElement>("#app")!;
let db: Database;
let loadError = false;
try {
  db = load();
} catch {
  db = freshDatabase();
  loadError = true;
}
let page: "menu" | "modes" | "challenges" | "load" | "settings" | "game" =
  "menu";
let mode: Mode = "classic";
let paused = false;
let targets: number[] = [];
let action: Command["type"] = "shot";
let draft: Ship | null = null;
let message = "";
let timer: ReturnType<typeof setTimeout> | undefined;
let botHighlight: ReturnType<typeof setTimeout> | undefined;
let highlight = false;
const platform = new Platform();
const audio = new Audio();
const ru = () => db.profile.settings.lang === "ru";
const t = (r: string, e: string) => (ru() ? r : e);
const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const label = (m: Mode) =>
  ({
    classic: t("Классический бой", "Classic battle"),
    tactical: t("Тактический бой", "Tactical battle"),
    challenge: t("Испытания", "Challenges"),
  })[m];
const abilityName = (a: Ability) =>
  ({
    pulse: t("Импульс", "Pulse"),
    guidance: t("Наведение", "Guidance"),
    double_shot: t("Двойной залп", "Double shot"),
    repair: t("Ремонт", "Repair"),
  })[a];
const abilityShort = (a: Ability) =>
  ({
    pulse: t("Имп.", "Pulse"),
    guidance: t("Нав.", "Guide"),
    double_shot: t("Залп", "Dual"),
    repair: t("Рем.", "Fix"),
  })[a];
const icon = (a: Ability) =>
  ({ pulse: "ϟ", guidance: "◎", double_shot: "↗↗", repair: "⚒" })[a];
const coord = (c: number) =>
  (ru() ? rules.board.ru_columns : rules.board.en_columns)[c % 10] +
  (Math.floor(c / 10) + 1);
const current = () => db.slots[mode]!;
const blocked = () =>
  paused || platform.paused || platform.ad || document.hidden;
function save(next: Database = db) {
  if (loadError) return false;
  try {
    commit(next);
    db = next;
    return true;
  } catch {
    message = t(
      "Не удалось сохранить. Проверьте свободное место и разрешения браузера.",
      "Save failed. Check browser storage permissions and free space.",
    );
    return false;
  }
}
function mutate(fn: (next: Database) => void) {
  const next = structuredClone(db);
  fn(next);
  if (page === "game" && next.slots[mode])
    next.slots[mode]!.updated = Date.now();
  return save(next);
}
function btn(id: string, text: string, disabled = false, cls = "") {
  return `<button data-do="${id}" ${disabled ? "disabled" : ""} class="${cls}">${text}</button>`;
}
function header() {
  return `<header><a href="#" data-do="menu" class="brand"><span class="brand-mark">◈</span><span>${esc(branding.language_title_map[db.profile.settings.lang])}<small>${t("ОРБИТАЛЬНОЕ КОМАНДОВАНИЕ", "ORBITAL COMMAND")}</small></span></a><div class="header-right"><span class="status-light"></span>${t("ЛОКАЛЬНАЯ СВЯЗЬ", "LOCAL LINK")}${btn("language", ru() ? "EN" : "RU")}</div></header>`;
}
function openGame(m: Mode) {
  mode = m;
  page = "game";
  paused = false;
  draft = null;
  targets = [];
  action = "shot";
  message = "";
  render();
}
function newGame(m: Mode, scenario = 0, sameBot = false) {
  const old = db.slots[m];
  if (
    old &&
    old.stage !== "finished" &&
    !confirm(t("Заменить сохранённую партию?", "Replace saved match?"))
  )
    return;
  const faction =
    (document.querySelector<HTMLSelectElement>("#faction")?.value ??
      String(old?.faction ?? 0)) === "1"
      ? 1
      : 0;
  if (
    mutate((next) => {
      createMatch(
        next,
        m,
        scenario,
        faction,
        crypto.getRandomValues(new Uint32Array(1))[0],
        sameBot ? old?.bot : undefined,
      );
    })
  )
    openGame(m);
}
function menu() {
  const unfinished = Object.values(db.slots)
    .filter((m) => m.stage !== "finished")
    .sort((a, b) => b.updated - a.updated);
  return `<main class="menu"><div class="eyebrow">${esc(ru() ? branding.series_ru : branding.series_en).toUpperCase()} / ${t("СЕКТОР 07", "SECTOR 07")}</div><h1>${esc(ru() ? branding.series_ru : branding.series_en).toUpperCase()}<span>${esc(ru() ? branding.subtitle_ru : branding.subtitle_en).toUpperCase()}</span></h1><p class="intro">${t("Две армады. Один сектор. Каждый выстрел решает.", "Two armadas. One sector. Every shot matters.")}</p><div class="menu-actions">${btn("continue", t("Продолжить", "Continue"), !unfinished.length, "primary")}${btn("modes", t("Новая игра", "New game"))}${btn("load", t("Загрузить игру", "Load game"))}${btn("settings", t("Настройки", "Settings"))}</div><div class="menu-ship" aria-hidden="true"><img src="/assets/sprites/hero_monolith.png" alt=""></div><footer>10 × 10 <span>•</span> ${t("ПОШАГОВЫЕ СРАЖЕНИЯ", "TURN-BASED COMBAT")} <span>•</span> v0.1.0${testMode ? "<p>TEST PROFILE / DEV ADS</p>" : ""}</footer></main>`;
}
function modes() {
  return `<main class="panel chooser"><div class="eyebrow">${t("БОЕВАЯ ДИРЕКТИВА", "COMBAT DIRECTIVE")}</div><h1>${t("Выберите операцию", "Choose operation")}</h1><label>${t("Ваш флот", "Your fleet")} <select id="faction"><option value="0">${t("Флот героя", "Hero fleet")}</option><option value="1">${t("Флот противника", "Rival fleet")}</option></select></label><div class="cards">${(["classic", "tactical", "challenge"] as Mode[]).map((m, i) => `<button data-do="new:${m}"><small>0${i + 1} / ${t("ОПЕРАЦИЯ", "OPERATION")}</small><h2>${label(m)}</h2><p>${[t("Чистая стратегия. Стандартный флот, без способностей.", "Pure strategy. Standard fleet, no abilities."), t("Разведка, двойной залп и ремонт. Постоянный запас зарядов.", "Recon, double shots and repair. Persistent charge inventory."), t("Пять сценариев. Особые цели и ограниченные ресурсы.", "Five scenarios. Special objectives and limited resources.")][i]}</p><span>→</span></button>`).join("")}</div>${btn("menu", t("Назад", "Back"))}</main>`;
}
const challengeEN = [
  "Last Stand",
  "Flagship Hunt",
  "Ammunition Shortage",
  "No Room for Error",
  "Intellectual Superiority",
];
function challengeName(i: number) {
  return ru() ? challenges.scenarios[i].name_ru : challengeEN[i];
}
function challengeList() {
  return `<main class="panel chooser"><h1>${t("Испытания", "Challenges")}</h1><label>${t("Ваш флот", "Your fleet")} <select id="faction"><option value="0">${t("Флот героя", "Hero fleet")}</option><option value="1">${t("Флот противника", "Rival fleet")}</option></select></label><div class="challenge-list">${challenges.scenarios.map((s, i) => `<button data-do="challenge:${i}"><b>0${i + 1} / ${challengeName(i)}</b><span>${[t("Ваш флот: 3, 2, 1", "Your fleet: 3, 2, 1"), t("Потопите флагман за 35 действий", "Sink the flagship in 35 actions"), t("45 боеприпасов", "45 ammunition"), t("Менее 35 промахов", "Fewer than 35 misses"), t("Эксперт. Выберите шесть зарядов.", "Expert. Choose six charges.")][i]}</span><small>${["—", t("Пройдено", "Completed"), t("Мастерство", "Mastery")][db.profile.results[s.id] ?? 0]}</small></button>`).join("")}</div>${btn("modes", t("Назад", "Back"))}</main>`;
}
function loadMenu() {
  return `<main class="panel chooser"><h1>${t("Загрузить игру", "Load game")}</h1><div class="challenge-list">${(
    ["classic", "tactical", "challenge"] as Mode[]
  )
    .map((m) => {
      const slot = db.slots[m];
      return `<button data-do="slot:${m}" ${slot ? "" : "disabled"}><b>${label(m)}</b><span>${slot ? `${slot.bot.nickname} · ${slot.stage === "setup" ? t("Расстановка", "Placement") : slot.stage === "finished" ? t("Завершено", "Finished") : t("Бой", "Battle")} · ${new Date(slot.updated).toLocaleString(ru() ? "ru-RU" : "en-GB")}` : t("Пустой слот", "Empty slot")}</span></button>`;
    })
    .join("")}</div>${btn("menu", t("Назад", "Back"))}</main>`;
}
function settings() {
  const s = db.profile.settings;
  return `<main class="panel settings"><h1>${t("Настройки", "Settings")}</h1><label>${t("Язык", "Language")}<select data-setting="lang"><option value="ru" ${s.lang === "ru" ? "selected" : ""}>Русский</option><option value="en" ${s.lang === "en" ? "selected" : ""}>English</option></select></label><label>${t("Музыка", "Music")}<input data-setting="music" type="range" min="0" max="1" step="0.05" value="${s.music}"></label><label>${t("Эффекты", "Effects")}<input data-setting="effects" type="range" min="0" max="1" step="0.05" value="${s.effects}"></label><label>${t("Сокращённые анимации", "Reduced animations")}<input data-setting="reduced" type="checkbox" ${s.reduced ? "checked" : ""}></label>${btn("menu", t("В главное меню", "Main menu"))}</main>`;
}
const shipNames = [
  ["Прототип", "Близнец", "Бастион", "Монолит"],
  ["Обычный", "Скорпион", "Каскад", "Молот"],
];
const shipNamesEN = [
  ["Prototype", "Twin", "Bastion", "Monolith"],
  ["Standard", "Scorpion", "Cascade", "Hammer"],
];
function shipName(l: number, f: number) {
  return (ru() ? shipNames : shipNamesEN)[f][l - 1];
}
function board(m: Match, own: boolean) {
  const side = m.sides[own ? 0 : 1];
  const marks = m.sides[own ? 1 : 0].knowledge;
  const setup = m.stage === "setup";
  const preview = own && draft ? cells(draft) : [];
  const scan =
    !own && action === "pulse" && targets.length ? scanCells(targets[0]) : [];
  const fleet = own ? side.fleet : side.fleet.filter((s) => sunk(s));
  const shownFleet =
    own && draft ? [...fleet, { ...draft, id: "preview" }] : fleet;
  const title = own
    ? t("Ваш флот", "Your fleet")
    : t("Противник", "Opponent") + " · " + esc(m.bot.nickname);
  const disabled =
    !setup && (blocked() || m.actor !== 0 || m.stage !== "active");
  return `<section class="board-panel ${own ? "own" : "enemy"}"><div class="board-heading"><h2>${title}</h2><span>${setup && !own ? "—" : `${alive(side)} / ${side.fleet.length}`} ${t("кораблей", "ships")}</span></div><div class="board-frame"><div class="col-labels">${(ru() ? rules.board.ru_columns : rules.board.en_columns).map((c) => `<span>${c}</span>`).join("")}</div><div class="row-labels">${Array.from({ length: 10 }, (_, i) => `<span>${i + 1}</span>`).join("")}</div><div class="board" role="group" aria-label="${own ? "own" : "enemy"}"><div class="ships">${shownFleet.map((s) => `<div class="ship ${s.id === "preview" ? "placement-preview" : ""} ${s.heading ? "vertical" : ""} ${sunk(s) ? "destroyed" : ""} faction-${own ? m.faction : 1 - m.faction}" style="--x:${Math.min(...cells(s)) % 10};--y:${Math.floor(Math.min(...cells(s)) / 10)};--length:${s.length}" title="${shipName(s.length, own ? m.faction : 1 - m.faction)}"><img src="${sprite(own ? m.faction : 1 - m.faction, s.length)}" alt=""></div>`).join("")}</div>${Array.from(
    { length: 100 },
    (_, c) => {
      const mark = setup ? "unknown" : marks[c];
      const p = preview.includes(c);
      const selected =
        (!own && targets.includes(c)) ||
        (own && action === "repair" && targets.includes(c));
      const dis = setup
        ? !own
        : disabled || (own ? action !== "repair" : action === "repair");
      return `<button class="cell ${mark} ${selected ? "selected" : ""} ${scan.includes(c) ? "scan" : ""} ${p ? (placementError(side.fleet, draft!) ? "invalid" : "preview") : ""} ${own && highlight && m.lastShot.includes(c) ? "last-shot" : ""}" data-cell="${c}" data-own="${own}" aria-label="${coord(c)}${mark === "unknown" ? "" : " " + mark}" ${dis ? "disabled" : ""}>${mark === "hit" || mark === "sunk" ? "×" : mark === "miss" || mark === "empty" ? "•" : mark === "revealed" ? "◇" : ""}</button>`;
    },
  ).join("")}</div></div></section>`;
}
function setupControls(m: Match) {
  const lengths = fleetLengths(mode, m.scenario),
    fleet = m.sides[0].fleet;
  const error = draft ? placementError(fleet, draft) : "";
  const remaining = [4, 3, 2, 1]
    .map((l) => ({
      l,
      n:
        lengths.filter((n) => n === l).length -
        fleet.filter((s) => s.length === l).length,
    }))
    .filter((x) => lengths.includes(x.l));
  const select =
    mode === "challenge" &&
    challenges.scenarios[m.scenario].starting_charges.selection;
  return `<div class="setup panel"><div><h3>${t("Расстановка флота", "Fleet deployment")}</h3><p>${t("Выберите корабль → клетку носа → подтвердите. Нос направлен вправо или вниз.", "Select a ship → nose cell → confirm. Nose points right or down.")}</p></div><div class="toolbar">${remaining.map(({ l, n }) => btn(`length:${l}`, `${shipName(l, m.faction)} <b>${l} × ${n}</b>`, n <= 0)).join("")}</div><div class="toolbar">${btn("rotate", t("Повернуть", "Rotate"), !draft)}${btn("place", t("Подтвердить", "Confirm"), !draft || !!error)}${btn("remove", t("Убрать", "Remove"), !draft || !fleet.some((s) => s.id === draft!.id))}${btn("cancel", t("Отмена", "Cancel"), !draft)}<span>${draft ? ({ bounds: t("За границей поля", "Outside board"), occupied: t("Клетки заняты", "Cells occupied"), touching: t("Слишком близко", "Too close") }[error] ?? t("Позиция допустима", "Valid position")) : ""}</span></div><div class="toolbar">${btn("random", t("Случайно", "Randomize"))}${btn("clear", t("Очистить", "Clear"))}${btn("ready", t("Готов к бою", "Ready for battle"), fleet.length !== lengths.length, "primary")}</div>${select ? `<h3>${t("Выберите 6 зарядов, максимум 3 одного типа", "Choose 6 charges, at most 3 of each")}</h3><div class="toolbar">${abilities.map((a) => `<label>${abilityName(a)} <input type="number" min="0" max="3" value="${m.sides[0].inventory[a]}" data-charge="${a}"></label>`).join("")}</div>` : ""}</div>`;
}
function combatControls(m: Match) {
  const inv = inventory(db, m, 0);
  const disabled = blocked() || m.actor !== 0 || m.stage !== "active";
  return `<div class="combat-controls">${mode === "classic" ? "" : `<div class="abilities">${abilities.map((a) => btn(`ability:${a}`, `<i>${icon(a)}</i><span class="ability-full">${abilityName(a)}</span><span class="ability-short">${abilityShort(a)}</span> <b>${inv[a]}</b>`, disabled || !canUseAbility(db, m, 0, a), action === a ? "active" : "")).join("")}${btn("refill", t("▷ Пополнить", "▷ Refill"), disabled || (mode === "challenge" && (m.refilled || !!challenges.scenarios[m.scenario].limit)), "refill")}</div>`}<div class="fire-control"><span>${action === "shot" ? t("Цель", "Target") : abilityName(action)}: <b>${targets.map(coord).join(" + ") || "—"}</b>${action === "guidance" || action === "repair" ? ` · ${t("завершает очередь", "ends turn")}` : ""}</span>${btn("fire", action === "pulse" ? t("Сканировать", "Scan") : action === "repair" ? t("Восстановить", "Restore") : action === "guidance" ? t("Раскрыть секцию", "Reveal section") : t("Огонь", "Fire"), disabled || targets.length !== (action === "guidance" ? 0 : action === "double_shot" ? 2 : 1), "primary")}${btn("cancel-action", t("Отмена", "Cancel"), disabled)}</div><div class="scan-history">${m.sides[0].scans
    .slice(-3)
    .map(
      (s) =>
        `${t("Импульс", "Pulse")} ${coord(s.cells[0])}–${coord(s.cells[8])}: <b>${s.count}</b> <small>#${s.action + 1}</small>`,
    )
    .join(" · ")}</div></div>`;
}
function result(m: Match) {
  const s = m.sides[0].stats;
  return `<div class="result panel"><div class="eyebrow">${t("ОПЕРАЦИЯ ЗАВЕРШЕНА", "OPERATION COMPLETE")}</div><h1>${m.winner === 0 ? t("Победа", "Victory") : t("Поражение", "Defeat")}</h1><p>${m.reason === "surrender" ? t("Вы сдались.", "You surrendered.") : m.reason === "limit" ? t("Ресурсы исчерпаны.", "Resources exhausted.") : t("Цель боя достигнута.", "Battle objective reached.")}</p><div class="stats"><span>${t("Выстрелы", "Shots")} <b>${s.shots}</b></span><span>${t("Попадания", "Hits")} <b>${s.hits}</b></span><span>${t("Промахи", "Misses")} <b>${s.misses}</b></span><span>${t("Точность", "Accuracy")} <b>${s.shots ? Math.round((s.hits / s.shots) * 100) : 0}%</b></span></div><p>${abilities.map((a) => `${abilityName(a)}: ${s.abilities[a]}`).join(" · ")}</p>${mode === "challenge" ? `<p>${m.winner === 0 ? (m.refilled ? t("Пройдено с пополнением", "Completed with refill") : t("Мастерство без пополнения", "Mastery without refill")) : ""}</p>${btn("retry", t("Повторить испытание", "Retry challenge"))}${btn("challenges", t("Другие испытания", "Other challenges"))}` : `${btn("rematch", t("Реванш", "Rematch"))}${btn("new-opponent", t("Новый противник", "New opponent"))}`}${btn("menu", t("В главное меню", "Main menu"))}</div>`;
}
function game() {
  const m = current();
  if (!m) return menu();
  const latest = m.events.at(-1);
  const eventText = latest
    ? `${latest.actor === 0 ? t("Вы", "You") : esc(m.bot.nickname)}: ${abilities.includes(latest.kind as Ability) ? abilityName(latest.kind as Ability) : ({ hit: t("попадание", "hit"), miss: t("промах", "miss"), sunk: t("корабль уничтожен", "ship destroyed"), restored: t("секция восстановлена", "section restored") }[latest.kind] ?? "")}${latest.cells ? " · " + latest.cells.map(coord).join(", ") : ""}`
    : t("Ожидание приказа", "Awaiting orders");
  const scenario = challenges.scenarios[m.scenario];
  const used =
    scenario.limit?.kind === "player_actions"
      ? m.actions
      : scenario.limit?.kind === "player_ammunition"
        ? m.ammo
        : m.sides[0].stats.misses;
  return `<main class="game"><div class="battle-bar"><span>${mode === "challenge" ? challengeName(m.scenario) : label(mode)}</span><span class="event">${eventText}</span><strong>${m.stage === "setup" ? t("РАССТАНОВКА", "DEPLOYMENT") : m.stage === "finished" ? t("ИТОГ", "RESULT") : m.actor === 0 ? t("ВАШ ХОД", "YOUR TURN") : t("ХОД СОПЕРНИКА", "ENEMY TURN")}</strong>${btn("pause", "Ⅱ")}</div>${mode === "challenge" && scenario.limit ? `<div class="limit">${t("Лимит", "Limit")}: ${used} / ${m.limit} · ${Math.max(0, m.limit - used)} ${t("осталось", "remaining")}</div>` : ""}${m.stage === "finished" ? result(m) : ""}<div class="boards">${board(m, true)}${board(m, false)}</div>${m.stage === "setup" ? setupControls(m) : m.stage === "active" ? combatControls(m) : m.stage === "continuation" ? `<div class="panel continuation"><h2>${t("Ресурс исчерпан", "Resource exhausted")}</h2><p>${t("Доступно одно продолжение за просмотр рекламы.", "One continuation is available for watching an ad.")}</p>${btn("refill", t("▷ Продолжить", "▷ Continue"))}${btn("decline", t("Завершить попытку", "End attempt"))}</div>` : ""}${paused ? `<div class="modal-backdrop"><div class="panel pause"><h1>${t("Пауза", "Paused")}</h1>${btn("resume", t("Продолжить", "Resume"), false, "primary")}${m.started && m.stage !== "finished" && mode !== "classic" ? btn("refill", t("▷ Пополнить", "▷ Refill"), mode === "challenge" && (m.refilled || (scenario.limit ? m.stage !== "continuation" : m.actor !== 0))) : ""}${btn("save", t("Сохранить игру", "Save game"))}${btn("surrender", t("Сдаться", "Surrender"), !m.started || m.stage === "finished")}${btn("menu", t("В главное меню", "Main menu"))}</div></div>` : ""}${platform.paused || platform.ad ? `<div class="modal-backdrop"><div class="panel">${t("Ожидание платформы…", "Waiting for platform…")}</div></div>` : ""}</main>`;
}
function scheduleBot() {
  clearTimeout(timer);
  if (page !== "game" || blocked()) return;
  const m = current();
  if (m?.stage !== "active" || m.actor !== 1) return;
  const id = m.id,
    number = m.action;
  timer = setTimeout(
    () => {
      const live = current();
      if (
        blocked() ||
        page !== "game" ||
        live.id !== id ||
        live.action !== number ||
        live.actor !== 1
      )
        return;
      const decision = botDecision(botView(live));
      const input = structuredClone(db);
      input.slots[mode]!.sides[1].rng = decision.rng;
      let next = execute(input, mode, 1, decision.command);
      if (!next && decision.command.type === "guidance")
        next = execute(db, mode, 1, {
          type: "shot",
          targets: [live.sides[1].knowledge.findIndex(legal)],
        });
      if (next) {
        if (save(next)) {
          audio.effect(
            db.profile.settings.effects,
            live.sides[1].stats.hits < current().sides[1].stats.hits,
          );
          if (live.sides[1].stats.shots < current().sides[1].stats.shots) {
            highlight = true;
            clearTimeout(botHighlight);
            botHighlight = setTimeout(() => {
              highlight = false;
              if (page === "game") render();
            }, 1000);
          }
        }
      }
      render();
    },
    db.profile.settings.reduced ? 120 : 650,
  );
}
function render() {
  document.documentElement.lang = db.profile.settings.lang;
  document.title = branding.language_title_map[db.profile.settings.lang];
  document.body.classList.toggle("reduced", db.profile.settings.reduced);
  root.innerHTML =
    header() +
    { menu, modes, challenges: challengeList, load: loadMenu, settings, game }[
      page
    ]() +
    `<div role="status" class="message">${esc(loadError ? t("Сохранение не прочитано. Существующие данные не перезаписаны.", "Save could not be read. Existing data has not been overwritten.") : message)}</div>`;
  audio.sync(db.profile.settings.music, blocked());
  platform.gameplay(
    page === "game" && current()?.stage === "active" && !blocked(),
  );
  scheduleBot();
}
root.addEventListener("click", async (e) => {
  audio.unlock();
  audio.sync(db.profile.settings.music, blocked());
  const target = e.target as HTMLElement;
  const cell = target.closest<HTMLButtonElement>("[data-cell]");
  if (cell && !cell.disabled) {
    const c = Number(cell.dataset.cell),
      own = cell.dataset.own === "true",
      m = current();
    if (m.stage === "setup" && own) {
      if (!draft) {
        const ship = m.sides[0].fleet.find((s) => cells(s).includes(c));
        if (ship) draft = structuredClone(ship);
      } else draft.nose = c;
    } else if (!blocked() && m.actor === 0 && m.stage === "active") {
      if (action === "repair" && own) {
        if (m.sides[0].fleet.some((s) => !sunk(s) && s.hits.includes(c)))
          targets = [c];
      } else if (!own && action !== "repair" && action !== "guidance") {
        if (action === "pulse") targets = [c];
        else if (legal(m.sides[0].knowledge[c]))
          targets =
            action === "double_shot"
              ? targets.includes(c)
                ? targets.filter((n) => n !== c)
                : [...targets, c].slice(-2)
              : [c];
      }
    }
    render();
    return;
  }
  const button = target.closest<HTMLElement>("[data-do]");
  if (!button || button.hasAttribute("disabled")) return;
  e.preventDefault();
  const [cmd, arg] = button.dataset.do!.split(":");
  message = "";
  if (["menu", "modes", "challenges", "load", "settings"].includes(cmd)) {
    page = cmd as typeof page;
    paused = false;
    draft = null;
  } else if (cmd === "language") {
    mutate((next) => {
      next.profile.settings.lang = ru() ? "en" : "ru";
    });
  } else if (cmd === "continue") {
    const m = Object.values(db.slots)
      .filter((m) => m.stage !== "finished")
      .sort((a, b) => b.updated - a.updated)[0];
    if (m) openGame(m.mode);
  } else if (cmd === "slot") openGame(arg as Mode);
  else if (cmd === "new") {
    if (arg === "challenge") page = "challenges";
    else newGame(arg as Mode);
  } else if (cmd === "challenge") newGame("challenge", Number(arg));
  else if (cmd === "length")
    draft = {
      id: crypto.randomUUID(),
      length: Number(arg),
      nose: 0,
      heading: 0,
      hits: [],
    };
  else if (cmd === "rotate" && draft) draft.heading = draft.heading ? 0 : 1;
  else if (cmd === "cancel") draft = null;
  else if (
    cmd === "place" &&
    draft &&
    !placementError(current().sides[0].fleet, draft)
  ) {
    const ship = structuredClone(draft);
    if (
      mutate((next) => {
        const m = next.slots[mode]!;
        m.sides[0].fleet = m.sides[0].fleet.filter((s) => s.id !== ship.id);
        m.sides[0].fleet.push(ship);
        m.updated = Date.now();
      })
    )
      draft = null;
  } else if (cmd === "remove" && draft) {
    const id = draft.id;
    if (
      mutate((next) => {
        next.slots[mode]!.sides[0].fleet = next.slots[
          mode
        ]!.sides[0].fleet.filter((s) => s.id !== id);
      })
    )
      draft = null;
  } else if (cmd === "random" || cmd === "clear") {
    if (
      !current().sides[0].fleet.length ||
      confirm(t("Заменить текущую расстановку?", "Replace current deployment?"))
    ) {
      mutate((next) => {
        next.slots[mode]!.sides[0].fleet =
          cmd === "clear"
            ? []
            : randomFleet(
                fleetLengths(mode, current().scenario),
                crypto.getRandomValues(new Uint32Array(1))[0],
              );
        next.slots[mode]!.updated = Date.now();
      });
      draft = null;
    }
  } else if (cmd === "ready") {
    const next = structuredClone(db);
    if (ready(next, mode, crypto.getRandomValues(new Uint32Array(1))[0])) {
      save(next);
      draft = null;
    } else
      message = t(
        "Разместите весь флот и проверьте набор зарядов.",
        "Deploy the full fleet and check charge selection.",
      );
  } else if (cmd === "ability" && !blocked() && current().actor === 0) {
    action = arg as Ability;
    targets = [];
  } else if (cmd === "cancel-action") {
    action = "shot";
    targets = [];
  } else if (cmd === "fire" && !blocked()) {
    const next = execute(db, mode, 0, { type: action, targets });
    if (next) {
      if (save(next)) {
        audio.effect(db.profile.settings.effects, true);
        targets = [];
        action = "shot";
      }
    } else
      message = t(
        "Действие недоступно. Проверьте цели, заряды и лимит.",
        "Action unavailable. Check targets, charges and limit.",
      );
  } else if (cmd === "pause") paused = true;
  else if (cmd === "resume") paused = false;
  else if (cmd === "save") {
    if (save()) message = t("Игра сохранена", "Game saved");
  } else if (cmd === "surrender") {
    if (confirm(t("Подтвердить сдачу?", "Confirm surrender?"))) {
      mutate((next) => surrender(next, mode));
      paused = false;
    }
  } else if (cmd === "rematch" || cmd === "new-opponent" || cmd === "retry")
    newGame(mode, current().scenario, cmd === "rematch");
  else if (cmd === "decline") mutate((next) => declineContinuation(next, mode));
  else if (cmd === "refill") {
    const limited =
      mode === "challenge" && !!challenges.scenarios[current().scenario].limit;
    if (
      limited &&
      !confirm(
        t(
          "Запросить рекламу для продолжения попытки?",
          "Request an ad to continue the attempt?",
        ),
      )
    )
      return;
    const chosen = limited
      ? "1"
      : prompt(
          t(
            "Награда за рекламу: 1 — импульс +2; 2 — наведение +1; 3 — залп +1; 4 — ремонт +1",
            "Ad reward: 1 — pulse +2; 2 — guidance +1; 3 — double shot +1; 4 — repair +1",
          ),
          "1",
        );
    if (chosen === null) return;
    const a = abilities[Number(chosen) - 1];
    if (!a) return;
    const simulation = testMode
      ? (prompt("DEV: success / cancel / error / unavailable", "success") ??
        "cancel")
      : "unavailable";
    const operation = crypto.randomUUID(),
      matchId = current().id,
      requestedMode = mode;
    const status = await platform.rewarded(() => {
      if (db.slots[requestedMode]?.id === matchId)
        mutate((next) => {
          reward(next, requestedMode, a, operation);
        });
    }, simulation);
    message =
      status === "success"
        ? t("Награда получена", "Reward received")
        : status === "cancel"
          ? t("Просмотр отменён", "Ad cancelled")
          : status === "error"
            ? t("Ошибка показа рекламы", "Ad error")
            : t("Реклама недоступна", "Ads unavailable");
  }
  render();
});
root.addEventListener("change", (e) => {
  const input = e.target as HTMLInputElement;
  if (input.dataset.setting) {
    const setting = input.dataset.setting;
    mutate((next) => {
      const s = next.profile.settings;
      if (setting === "lang") s.lang = input.value as "ru" | "en";
      if (setting === "music" || setting === "effects")
        s[setting] = Number(input.value);
      if (setting === "reduced") s.reduced = input.checked;
    });
    render();
  }
  if (input.dataset.charge) {
    const a = input.dataset.charge as Ability;
    mutate((next) => {
      next.slots[mode]!.sides[0].inventory[a] = Math.max(
        0,
        Math.min(3, Math.floor(Number(input.value) || 0)),
      );
    });
    render();
  }
});
platform.onChange = () => render();
document.addEventListener("visibilitychange", () => render());
render();
void platform.init();
