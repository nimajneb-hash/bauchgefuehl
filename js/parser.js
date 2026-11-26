// Erkennt Lebensmittel in frei diktiertem Text – komplett lokal, ohne KI.
import { BUILTIN, MODIFIERS } from './foods.js';

export function normalize(text, keepPunct = false) {
  let t = (text || '').toLowerCase();
  // Satzzeichen bleiben als "," erhalten: sie begrenzen, worauf sich "ohne" bezieht.
  if (keepPunct) return normalize(t.replace(/[,.;:!?\n]+/g, ' qqpunctqq ')).replace(/qqpunctqq/g, ',');
  return t
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function keyToRegex(key) {
  let mode = 'sub';
  if (key[0] === '=') { mode = 'word'; key = key.slice(1); }
  else if (key[0] === '<') { mode = 'start'; key = key.slice(1); }
  else if (key[0] === '>') { mode = 'end'; key = key.slice(1); }
  const k = esc(normalize(key)).replace(/ /g, ' ');
  const pre = mode === 'word' || mode === 'start' ? '(?<![a-z])' : '';
  const post = mode === 'word' || mode === 'end' ? '(?![a-z])' : '';
  return { re: new RegExp(pre + k + post, 'g'), len: normalize(key).length };
}

let compiledCache = null;
let compiledFor = null;

function compile(custom) {
  if (compiledCache && compiledFor === custom) return compiledCache;
  // Eigene Einträge zuerst: bei gleicher Länge gewinnen sie.
  const all = [
    ...custom.map((c) => ({ key: c.key, name: c.name, cats: c.cats, custom: true })),
    ...BUILTIN,
  ];
  compiledCache = all.map((e, i) => ({ ...e, ...keyToRegex(e.key), order: i }));
  compiledFor = custom;
  return compiledCache;
}

const STOP = new Set(`ich hab habe hatte hatten gegessen getrunken trinke trink esse essen gerade eben heute gestern morgen mittag abend abends mittags morgens fruehstueck mittagessen abendessen snack zwischendurch nachtisch dessert einen eine einem einer eines ein etwas bisschen bissl paar zwei drei vier fuenf sechs glas glaeser tasse tassen teller schuessel portion portionen stueck stuecke scheibe scheiben dazu danach vorher noch auch sehr viel viele wenig gross grosse grossen grosser kleine kleinen kleiner klein dann und oder mit ohne aus von vom zum zur beim bei war waren gab gibt gibts nur dem den der die das des ist sind wurde wurden hier dort selbst gemacht selbstgemacht frisch frische frischen warm warme kalt kalte lecker gekocht gekochte gebraten gebratene gegrillt gegrillte gebacken roh dose becher flasche flaschen liter halbe halben halbes halb ganz ganze ganzen einige mehrere restaurant kantine imbiss zuhause unterwegs also naja okay jeweils ungefaehr circa etwa mal nochmal weiter weitere weiteren anderen andere anderes sowie plus wieder schon jetzt grade irgendwie sowas sone sowie paar wasser leitungswasser stilles mineral normal normale normalen bisschen kein keine keinen nicht hatte uhr minuten stunde stunden davon drauf darauf drin darin dabei dazwischen nachher spaeter vorhin mein meine meinen meinem unser unsere sauce sosse belag beilage`.split(/\s+/));

function unknownWords(norm, taken) {
  const out = [];
  const re = /[a-z0-9]+/g;
  let m;
  while ((m = re.exec(norm))) {
    const w = m[0];
    if (w.length < 4 || /\d/.test(w) || STOP.has(w)) continue;
    let anyTaken = false;
    for (let i = m.index; i < m.index + w.length; i++) if (taken[i]) { anyTaken = true; break; }
    if (!anyTaken && !out.includes(w)) out.push(w);
  }
  return out;
}

const NEGATORS = new Set(['ohne', 'kein', 'keine', 'keinen', 'keiner', 'nicht', 'weg']);
const BREAKERS = new Set([',', 'mit', 'dazu', 'dann', 'danach', 'aber', 'plus', 'sowie', 'ein', 'eine', 'einen', 'einem', 'einer', 'eines']);

function isNegated(norm, start) {
  const before = norm.slice(0, start).trim().split(' ').slice(-4);
  for (let i = before.length - 1; i >= 0; i--) {
    const w = before[i];
    if (BREAKERS.has(w)) return false;
    if (NEGATORS.has(w)) return true;
  }
  return false;
}

/**
 * @param {string} text  diktierter Text
 * @param {Array} custom eigene Wörterbuch-Einträge [{key,name,cats}]
 * @returns {{items: Array<{name,cats,custom?}>, modifiers: string[]}}
 */
export function parseMeal(text, custom = []) {
  const norm = normalize(text, true);
  if (!norm.replace(/,/g, '').trim()) return { items: [], modifiers: [], unknown: [] };
  const entries = compile(custom);
  const hits = [];
  for (const e of entries) {
    e.re.lastIndex = 0;
    let m;
    while ((m = e.re.exec(norm))) {
      hits.push({ start: m.index, end: m.index + m[0].length, e });
      if (m[0].length === 0) e.re.lastIndex++;
    }
  }
  hits.sort((a, b) => (b.end - b.start) - (a.end - a.start) || a.e.order - b.e.order || a.start - b.start);
  const taken = new Array(norm.length).fill(false);
  const accepted = [];
  for (const h of hits) {
    let free = true;
    for (let i = h.start; i < h.end; i++) if (taken[i]) { free = false; break; }
    if (!free) continue;
    for (let i = h.start; i < h.end; i++) taken[i] = true;
    accepted.push(h);
  }
  accepted.sort((a, b) => a.start - b.start);

  const mods = MODIFIERS.filter((m) => norm.includes(m.key));
  const removeCats = new Set(mods.flatMap((m) => m.remove));

  const byName = new Map();
  let lastItem = null;
  for (const h of accepted) {
    if (h.e.name.startsWith('_')) continue;
    if (isNegated(norm, h.start)) {
      // "Döner ohne Zwiebeln" → Zwiebel-Kategorie aus dem Gericht davor nehmen
      if (lastItem) lastItem.cats = lastItem.cats.filter((c) => !h.e.cats.includes(c));
      continue;
    }
    const cats = h.e.cats.filter((c) => !removeCats.has(c));
    const prev = byName.get(h.e.name);
    if (prev) { prev.cats = [...new Set([...prev.cats, ...cats])]; lastItem = prev; continue; }
    lastItem = { name: h.e.name, cats, ...(h.e.custom ? { custom: true } : {}) };
    byName.set(h.e.name, lastItem);
  }
  return { items: [...byName.values()], modifiers: mods.map((m) => m.key), unknown: unknownWords(norm, taken) };
}

/** Endgültige Zutatenliste einer Mahlzeit: erkannt + manuell ergänzt − manuell entfernt. */
export function mealItems(meal, custom = []) {
  const parsed = parseMeal(meal.text, custom).items;
  const removed = new Set(meal.removed || []);
  const out = parsed.filter((i) => !removed.has(i.name));
  for (const a of meal.added || []) {
    if (!out.some((i) => i.name === a.name)) out.push({ ...a, manual: true });
  }
  return out;
}
