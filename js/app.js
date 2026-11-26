import { db, uid } from './db.js';
import { CATEGORIES } from './foods.js';
import { parseMeal, mealItems, normalize } from './parser.js';
import { analyze, candidatesFor } from './analysis.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const H = 3600 * 1000;

const SEVERITY = ['Alles gut', 'Kaum', 'Leicht', 'Deutlich', 'Stark', 'Heftig'];
const SYM_TYPES = ['Blähungen', 'Bauchschmerzen', 'Durchfall', 'Verstopfung', 'Übelkeit', 'Sodbrennen', 'Haut', 'Kopfschmerzen', 'Müdigkeit', 'Sonstiges'];
const TIME_OPTS = {
  meal: [['Jetzt', 0], ['vor 30 Min', 0.5], ['vor 1 Std', 1], ['vor 2 Std', 2], ['Andere…', null]],
  sym: [['Jetzt', 0], ['vor 1 Std', 1], ['vor 2 Std', 2], ['vor 4 Std', 4], ['Andere…', null]],
};

const state = {
  meals: [], symptoms: [], dict: [],
  settings: { minH: 1, maxH: 24 },
  statsMode: 'cats',
  draft: { removed: new Set(), added: [], photo: null, timeOffset: 0 },
  sym: { severity: null, types: new Set(), timeOffset: 0 },
};

// ---------- Hilfen ----------
const catIcons = (cats) => cats.map((c) => CATEGORIES[c]?.icon || '').join('');
const catName = (c) => CATEGORIES[c] ? `${CATEGORIES[c].icon} ${CATEGORIES[c].name}` : c;
const fmtTime = (t) => new Date(t).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
function fmtDay(t) {
  const d = new Date(t); const today = new Date();
  const y = new Date(); y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Heute';
  if (d.toDateString() === y.toDateString()) return 'Gestern';
  return d.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
}
function toLocalInput(t) {
  const d = new Date(t); d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}
const fromLocalInput = (v) => new Date(v).getTime();
function ago(ms) {
  const h = ms / H;
  if (h < 1) return `${Math.round(h * 60)} Min`;
  return `${Math.round(h * 10) / 10} Std`.replace('.', ',');
}
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2200);
}
function capitalize(w) { return w.charAt(0).toUpperCase() + w.slice(1); }

// Fotos verkleinern, damit der Speicher nicht vollläuft.
function shrinkImage(file, max = 1280) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.72));
    };
    img.onerror = reject;
    img.src = url;
  });
}

// ---------- Laden ----------
async function load() {
  [state.meals, state.symptoms, state.dict] = await Promise.all([db.all('meals'), db.all('symptoms'), db.all('dict')]);
  state.settings = await db.get('settings', state.settings);
}

// ---------- Navigation ----------
function show(view) {
  $$('.view').forEach((v) => v.classList.toggle('active', v.id === 'view-' + view));
  $$('.tab').forEach((t) => t.classList.toggle('active', t.dataset.view === view));
  if (view === 'log') renderLog();
  if (view === 'stats') renderStats();
  if (view === 'more') renderMore();
  if (view === 'add') renderReminder();
  window.scrollTo(0, 0);
}
$$('.tab').forEach((t) => t.addEventListener('click', () => show(t.dataset.view)));

$$('#view-add .seg-btn').forEach((b) => b.addEventListener('click', () => {
  $$('#view-add .seg-btn').forEach((x) => x.classList.toggle('active', x === b));
  $('#form-meal').classList.toggle('hidden', b.dataset.form !== 'meal');
  $('#form-sym').classList.toggle('hidden', b.dataset.form !== 'sym');
}));
function switchForm(which) { $(`#view-add .seg-btn[data-form="${which}"]`).click(); }

// ---------- Zeit-Chips ----------
function renderTimeChips(container, kind, current, onPick) {
  container.innerHTML = '';
  const input = $(kind === 'meal' ? '#meal-time' : '#sym-time');
  for (const [label, val] of TIME_OPTS[kind]) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'chip' + (current === val ? ' on' : ''); b.textContent = label;
    b.onclick = () => {
      $$('.chip', container).forEach((x) => x.classList.remove('on')); b.classList.add('on');
      if (val === null) { input.classList.remove('hidden'); if (!input.value) input.value = toLocalInput(Date.now()); input.focus(); }
      else input.classList.add('hidden');
      onPick(val);
    };
    container.appendChild(b);
  }
  input.classList.toggle('hidden', current !== null);
}
function pickedTime(offset, input) {
  if (offset === null) return input.value ? fromLocalInput(input.value) : Date.now();
  return Date.now() - offset * H;
}

// ---------- Mahlzeit erfassen ----------
const mealText = $('#meal-text');

function itemChip(item, { off = false, onClick } = {}) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'chip food' + (off ? ' off' : '');
  b.innerHTML = `${esc(item.name)} <span class="cats">${catIcons(item.cats)}</span>`;
  b.title = item.cats.map((c) => CATEGORIES[c]?.name).join(', ');
  if (onClick) b.onclick = onClick; else b.classList.add('static');
  return b;
}

function renderMealPreview() {
  const box = $('#meal-preview');
  box.innerHTML = '';
  const { items, unknown } = parseMeal(mealText.value, state.dict);
  const d = state.draft;
  for (const it of items) {
    const off = d.removed.has(it.name);
    box.appendChild(itemChip(it, { off, onClick: () => { off ? d.removed.delete(it.name) : d.removed.add(it.name); renderMealPreview(); } }));
  }
  for (const it of d.added) {
    box.appendChild(itemChip(it, { onClick: () => { d.added = d.added.filter((a) => a !== it); renderMealPreview(); } }));
  }
  for (const w of unknown) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'chip unknown'; b.textContent = '？ ' + w;
    b.onclick = () => assignDialog(w, (item) => { if (item) d.added.push(item); renderMealPreview(); });
    box.appendChild(b);
  }
}
let previewTimer;
mealText.addEventListener('input', () => { clearTimeout(previewTimer); previewTimer = setTimeout(renderMealPreview, 150); });
$('#meal-add-item').onclick = () => assignDialog('', (item) => { if (item) state.draft.added.push(item); renderMealPreview(); });

$('#meal-photo').addEventListener('change', async (e) => {
  const f = e.target.files[0]; if (!f) return;
  try { state.draft.photo = await shrinkImage(f); } catch { toast('Foto konnte nicht gelesen werden'); }
  e.target.value = '';
  renderPhotoPreview();
});
function renderPhotoPreview() {
  const box = $('#meal-photo-preview');
  box.innerHTML = '';
  if (!state.draft.photo) return;
  box.innerHTML = `<div class="thumb"><img src="${state.draft.photo}" alt=""><button type="button" aria-label="Foto entfernen">✕</button></div>`;
  $('button', box).onclick = () => { state.draft.photo = null; renderPhotoPreview(); };
}

function resetMealForm() {
  mealText.value = '';
  state.draft = { removed: new Set(), added: [], photo: null, timeOffset: 0 };
  $('#meal-time').value = '';
  renderTimeChips($('.time-chips[data-target="meal"]'), 'meal', 0, (v) => { state.draft.timeOffset = v; });
  renderMealPreview(); renderPhotoPreview();
}

$('#form-meal').addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = mealText.value.trim();
  const d = state.draft;
  if (!text && !d.added.length && !d.photo) { toast('Erzähl kurz, was du gegessen hast'); mealText.focus(); return; }
  const meal = {
    id: uid(),
    time: pickedTime(d.timeOffset, $('#meal-time')),
    text,
    added: d.added,
    removed: [...d.removed],
    photo: d.photo,
    created: Date.now(),
  };
  await db.put('meals', meal);
  state.meals.push(meal);
  const n = mealItems(meal, state.dict).length;
  toast(n ? `Gespeichert, ${n} ${n === 1 ? 'Zutat' : 'Zutaten'} erkannt` : 'Gespeichert');
  resetMealForm();
  mealText.blur();
});

// ---------- Zutat zuordnen / beibringen ----------
function assignDialog(word, done) {
  const body = $('#dlg-body');
  const sel = new Set();
  body.innerHTML = `
    <h2>${word ? `„${esc(word)}“ zuordnen` : 'Zutat ergänzen'}</h2>
    <input type="text" id="as-name" placeholder="Name, z. B. Preiselbeeren" value="${esc(word ? capitalize(word) : '')}">
    <div class="label">Enthält (falls bekannt)</div>
    <div class="cat-grid">${Object.entries(CATEGORIES).map(([k, c]) => `<button type="button" class="chip" data-c="${k}">${c.icon} ${esc(c.name)}</button>`).join('')}</div>
    <label class="check"><input type="checkbox" id="as-remember" checked> Für die Zukunft merken</label>
    <div class="dlg-actions">
      ${word ? '<button type="button" class="btn ghost" id="as-ignore">Kein Lebensmittel</button>' : ''}
      <div class="right"><button type="button" class="btn" id="as-cancel">Abbrechen</button>
      <button type="button" class="btn primary" id="as-ok">Übernehmen</button></div>
    </div>`;
  $$('.cat-grid .chip', body).forEach((b) => b.onclick = () => { b.classList.toggle('on'); b.classList.contains('on') ? sel.add(b.dataset.c) : sel.delete(b.dataset.c); });
  const dlg = $('#dlg');
  const close = () => dlg.close();
  $('#as-cancel').onclick = () => { close(); done(null); };
  if (word) $('#as-ignore').onclick = async () => {
    const entry = { id: uid(), key: normalize(word), name: '_', cats: [] };
    await db.put('dict', entry); state.dict = [...state.dict, entry];
    close(); done(null); toast(`„${word}“ wird künftig ignoriert`);
  };
  $('#as-ok').onclick = async () => {
    const name = $('#as-name').value.trim();
    if (!name) { $('#as-name').focus(); return; }
    const cats = [...sel];
    if ($('#as-remember').checked) {
      const key = normalize(word || name);
      const entry = { id: uid(), key, name, cats };
      state.dict = [...state.dict.filter((x) => x.key !== key), entry];
      for (const old of (await db.all('dict')).filter((x) => x.key === key)) await db.del('dict', old.id);
      await db.put('dict', entry);
      close(); done(word ? null : { name, cats }); // bei einem Wort im Text erkennt der Parser es jetzt selbst
      return;
    }
    close(); done({ name, cats });
  };
  dlg.showModal();
  if (!word) $('#as-name').focus();
}

// ---------- Beschwerden erfassen ----------
function renderSevGrid() {
  const g = $('#sev-grid');
  g.innerHTML = SEVERITY.map((l, i) => `<button type="button" class="sev${state.sym.severity === i ? ' on' : ''}" data-v="${i}"><b>${i}</b><span>${l}</span></button>`).join('');
  $$('.sev', g).forEach((b) => b.onclick = () => { state.sym.severity = +b.dataset.v; renderSevGrid(); });
}
function renderSymTypes() {
  const box = $('#sym-types');
  box.innerHTML = '';
  for (const t of SYM_TYPES) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'chip' + (state.sym.types.has(t) ? ' on' : ''); b.textContent = t;
    b.onclick = () => { state.sym.types.has(t) ? state.sym.types.delete(t) : state.sym.types.add(t); b.classList.toggle('on'); };
    box.appendChild(b);
  }
}
function resetSymForm() {
  state.sym = { severity: null, types: new Set(), timeOffset: 0 };
  $('#sym-note').value = ''; $('#sym-time').value = '';
  $('#form-sym details').open = false;
  renderSevGrid(); renderSymTypes();
  renderTimeChips($('.time-chips[data-target="sym"]'), 'sym', 0, (v) => { state.sym.timeOffset = v; });
}
$('#form-sym').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (state.sym.severity === null) { toast('Bitte einen Grad von 0 bis 5 antippen'); return; }
  const s = {
    id: uid(),
    time: pickedTime(state.sym.timeOffset, $('#sym-time')),
    severity: state.sym.severity,
    types: [...state.sym.types],
    note: $('#sym-note').value.trim(),
    created: Date.now(),
  };
  await db.put('symptoms', s);
  state.symptoms.push(s);
  toast(s.severity === 0 ? 'Schön! Gespeichert.' : 'Gespeichert. Gute Besserung!');
  resetSymForm(); renderReminder();
});

function renderReminder() {
  const el = $('#reminder');
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const todaySym = state.symptoms.some((s) => s.time >= start.getTime());
  const todayMeal = state.meals.some((m) => m.time >= start.getTime());
  const hour = new Date().getHours();
  if (!todaySym && (todayMeal || hour >= 17) && state.meals.length) {
    el.innerHTML = `Heute noch nicht gemeldet, wie es dir geht. Auch „alles gut“ zählt.<br><button class="btn" id="quick-ok">👍 Alles gut (0) eintragen</button>`;
    el.classList.remove('hidden');
    $('#quick-ok').onclick = async () => {
      const s = { id: uid(), time: Date.now(), severity: 0, types: [], note: '', created: Date.now() };
      await db.put('symptoms', s); state.symptoms.push(s); toast('Schön! Gespeichert.'); renderReminder();
    };
  } else el.classList.add('hidden');
}

// ---------- Verlauf ----------
function renderLog() {
  const box = $('#log');
  const entries = [
    ...state.meals.map((m) => ({ type: 'meal', t: m.time, m })),
    ...state.symptoms.map((s) => ({ type: 'sym', t: s.time, s })),
  ].sort((a, b) => b.t - a.t);
  if (!entries.length) { box.innerHTML = '<div class="empty">Noch keine Einträge.<br>Leg unter „Erfassen“ los.</div>'; return; }
  box.innerHTML = '';
  let curDay = null, card = null;
  for (const e of entries) {
    const day = new Date(e.t).toDateString();
    if (day !== curDay) {
      curDay = day;
      const wrap = document.createElement('div'); wrap.className = 'day';
      wrap.innerHTML = `<h3>${fmtDay(e.t)}</h3>`;
      card = document.createElement('div'); card.className = 'card';
      wrap.appendChild(card); box.appendChild(wrap);
    }
    const row = document.createElement('div');
    row.className = 'entry';
    row.style.padding = card.children.length ? '12px 0 0' : '0';
    if (card.children.length) row.style.borderTop = '1px solid var(--line)', row.style.marginTop = '12px';
    if (e.type === 'meal') {
      const items = mealItems(e.m, state.dict);
      row.innerHTML = `<div class="time">${fmtTime(e.t)}</div>
        <div class="body"><p class="text">🍽️ ${esc(e.m.text) || '<span class="muted">(ohne Text)</span>'}</p><div class="chips"></div></div>
        ${e.m.photo ? `<img class="mini" src="${e.m.photo}" alt="">` : ''}`;
      const chips = $('.chips', row);
      items.forEach((i) => chips.appendChild(itemChip(i)));
      row.onclick = () => editMeal(e.m);
    } else {
      const c = candidatesFor(e.s, state.meals, state.settings);
      const cand = e.s.severity > 0 && c.length
        ? `<div class="cands">Mögliche Auslöser: ${c.slice(0, 4).map((m) => `${esc(mealItems(m, state.dict).map((i) => i.name).join(', ') || m.text || 'Mahlzeit')} <span>(${ago(e.s.time - m.time)} vorher)</span>`).join(' · ')}</div>` : '';
      row.innerHTML = `<div class="time">${fmtTime(e.t)}</div>
        <div class="body"><p class="text"><span class="badge s${e.s.severity}">${e.s.severity}</span> ${SEVERITY[e.s.severity]}${e.s.types?.length ? ' · ' + esc(e.s.types.join(', ')) : ''}</p>
        ${e.s.note ? `<div class="muted small">${esc(e.s.note)}</div>` : ''}${cand}</div>`;
      row.onclick = () => editSym(e.s);
    }
    card.appendChild(row);
  }
}

function editMeal(meal) {
  const body = $('#dlg-body');
  const draft = { removed: new Set(meal.removed || []), added: [...(meal.added || [])], photo: meal.photo };
  body.innerHTML = `
    <h2>Mahlzeit bearbeiten</h2>
    <textarea id="em-text" rows="3">${esc(meal.text)}</textarea>
    <div class="chips" id="em-chips"></div>
    <button type="button" class="link" id="em-add">＋ Zutat ergänzen</button>
    <div class="label">Zeitpunkt</div>
    <input type="datetime-local" id="em-time" value="${toLocalInput(meal.time)}">
    <div id="em-photo"></div>
    <div class="dlg-actions">
      <button type="button" class="btn ghost" id="em-del" style="color:var(--danger)">Löschen</button>
      <div class="right"><button type="button" class="btn" id="em-cancel">Abbrechen</button>
      <button type="button" class="btn primary" id="em-save">Sichern</button></div>
    </div>`;
  const dlg = $('#dlg');
  const renderChips = () => {
    const box = $('#em-chips'); box.innerHTML = '';
    const { items, unknown } = parseMeal($('#em-text').value, state.dict);
    for (const it of items) {
      const off = draft.removed.has(it.name);
      box.appendChild(itemChip(it, { off, onClick: () => { off ? draft.removed.delete(it.name) : draft.removed.add(it.name); renderChips(); } }));
    }
    for (const it of draft.added) box.appendChild(itemChip(it, { onClick: () => { draft.added = draft.added.filter((a) => a !== it); renderChips(); } }));
    for (const w of unknown) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'chip unknown'; b.textContent = '？ ' + w;
      b.onclick = () => { dlg.close(); assignDialog(w, (item) => { if (item) draft.added.push(item); reopen(); }); };
      box.appendChild(b);
    }
  };
  const renderPhoto = () => {
    const box = $('#em-photo');
    box.innerHTML = draft.photo ? `<img class="full" src="${draft.photo}" alt=""><button type="button" class="link" id="em-rmphoto">Foto entfernen</button>` : '';
    if (draft.photo) $('#em-rmphoto').onclick = () => { draft.photo = null; renderPhoto(); };
  };
  // Nach dem Zuordnen-Dialog wieder zurück in die Bearbeitung, mit aktuellem Text.
  const reopen = () => {
    const keepText = textNow, keepTime = timeNow;
    editMeal({ ...meal, text: keepText, time: keepTime, removed: [...draft.removed], added: draft.added, photo: draft.photo });
  };
  let textNow = meal.text, timeNow = meal.time;
  $('#em-text').addEventListener('input', (e) => { textNow = e.target.value; renderChips(); });
  $('#em-time').addEventListener('change', (e) => { timeNow = fromLocalInput(e.target.value) || meal.time; });
  $('#em-add').onclick = () => { dlg.close(); assignDialog('', (item) => { if (item) draft.added.push(item); reopen(); }); };
  $('#em-cancel').onclick = () => dlg.close();
  $('#em-del').onclick = async () => {
    if (!confirm('Diese Mahlzeit löschen?')) return;
    await db.del('meals', meal.id);
    state.meals = state.meals.filter((m) => m.id !== meal.id);
    dlg.close(); renderLog(); toast('Gelöscht');
  };
  $('#em-save').onclick = async () => {
    const updated = { ...meal, text: $('#em-text').value.trim(), time: fromLocalInput($('#em-time').value) || meal.time,
      removed: [...draft.removed], added: draft.added, photo: draft.photo };
    await db.put('meals', updated);
    state.meals = state.meals.map((m) => (m.id === meal.id ? updated : m));
    dlg.close(); renderLog(); toast('Gesichert');
  };
  renderChips(); renderPhoto();
  if (!dlg.open) dlg.showModal();
}

function editSym(s) {
  const body = $('#dlg-body');
  let sev = s.severity;
  const types = new Set(s.types || []);
  body.innerHTML = `
    <h2>Beschwerde bearbeiten</h2>
    <div class="sev-grid" id="es-grid"></div>
    <div class="label">Zeitpunkt</div>
    <input type="datetime-local" id="es-time" value="${toLocalInput(s.time)}">
    <div class="chips" id="es-types"></div>
    <textarea id="es-note" rows="2" placeholder="Notiz">${esc(s.note)}</textarea>
    <div class="dlg-actions">
      <button type="button" class="btn ghost" id="es-del" style="color:var(--danger)">Löschen</button>
      <div class="right"><button type="button" class="btn" id="es-cancel">Abbrechen</button>
      <button type="button" class="btn primary" id="es-save">Sichern</button></div>
    </div>`;
  const grid = () => {
    $('#es-grid').innerHTML = SEVERITY.map((l, i) => `<button type="button" class="sev${sev === i ? ' on' : ''}" data-v="${i}"><b>${i}</b><span>${l}</span></button>`).join('');
    $$('#es-grid .sev').forEach((b) => b.onclick = () => { sev = +b.dataset.v; grid(); });
  };
  grid();
  $('#es-types').innerHTML = SYM_TYPES.map((t) => `<button type="button" class="chip${types.has(t) ? ' on' : ''}">${t}</button>`).join('');
  $$('#es-types .chip').forEach((b) => b.onclick = () => { const t = b.textContent; types.has(t) ? types.delete(t) : types.add(t); b.classList.toggle('on'); });
  const dlg = $('#dlg');
  $('#es-cancel').onclick = () => dlg.close();
  $('#es-del').onclick = async () => {
    if (!confirm('Diesen Eintrag löschen?')) return;
    await db.del('symptoms', s.id);
    state.symptoms = state.symptoms.filter((x) => x.id !== s.id);
    dlg.close(); renderLog(); toast('Gelöscht');
  };
  $('#es-save').onclick = async () => {
    const u = { ...s, severity: sev, time: fromLocalInput($('#es-time').value) || s.time, types: [...types], note: $('#es-note').value.trim() };
    await db.put('symptoms', u);
    state.symptoms = state.symptoms.map((x) => (x.id === s.id ? u : x));
    dlg.close(); renderLog(); toast('Gesichert');
  };
  dlg.showModal();
}

// ---------- Auswertung ----------
function statRow(s, mode, max = 5) {
  const label = mode === 'cats' ? catName(s.id) : esc(s.id);
  const w = (v) => `${Math.max(2, (v / max) * 100)}%`;
  const fmt = (v) => v.toFixed(1).replace('.', ',');
  return `<div class="stat">
    <div class="head"><span>${label}${s.via ? ` <span class="muted small">· enthält ${s.via.map(catName).join(', ')}</span>` : ''}</span><span class="muted">${s.n}×</span></div>
    <div class="meta">Danach im Schnitt Grad ${fmt(s.meanWith)}, sonst ${fmt(s.meanWithout)}. ${s.badRate > 0 ? `Starke Beschwerden (≥3) in ${Math.round(s.badRate * 100)} % der Fälle.` : ''}</div>
    <div class="bars">
      <span>mit</span><div class="bar"><i class="with" style="width:${w(s.meanWith)}"></i></div><span>${fmt(s.meanWith)}</span>
      <span>ohne</span><div class="bar"><i class="without" style="width:${w(s.meanWithout)}"></i></div><span>${fmt(s.meanWithout)}</span>
    </div></div>`;
}

function renderStats() {
  $('#win-min').value = String(state.settings.minH);
  $('#win-max').value = String(state.settings.maxH);
  const box = $('#stats');
  const r = analyze(state.meals, state.symptoms, state.settings, state.dict);
  const mode = state.statsMode;
  const res = r[mode];
  const label = (id) => (mode === 'cats' ? catName(id) : esc(id));
  let html = `<div class="card summary">
    <div><b>${state.meals.length}</b><span>Mahlzeiten</span></div>
    <div><b>${state.symptoms.length}</b><span>Meldungen</span></div>
    <div><b>${r.evaluated}</b><span>auswertbar</span></div></div>`;

  if (r.evaluated < 15) {
    html += `<div class="banner">Noch zu wenig Daten für verlässliche Aussagen (${r.evaluated} von ca. 15–20 auswertbaren Mahlzeiten). Nach ein bis zwei Wochen wird es aussagekräftig.${r.pending ? ` ${r.pending} Mahlzeiten warten noch auf eine spätere Meldung.` : ''}</div>`;
  }

  html += `<h3 class="sec-title">🔴 Verdächtig</h3><div class="card">`;
  html += res.suspicious.length ? res.suspicious.map((s) => statRow(s, mode)).join('') : '<div class="muted">Bisher nichts Auffälliges.</div>';
  html += `</div>`;

  if (res.explained.length) {
    html += `<h3 class="sec-title">🟡 Wohl nur Mitläufer</h3><div class="card"><p class="muted small" style="margin-top:0">Fiel zuerst auf, aber ohne den Hauptverdächtigen bleibt nichts übrig. Wahrscheinlich nur oft zusammen gegessen.</p>`;
    html += `<div class="okay-list">${res.explained.map((s) => `<span class="chip static">${label(s.id)}</span>`).join('')}</div>`;
    const by = [...new Set(res.explained.flatMap((s) => s.by))];
    if (by.length) html += `<p class="muted small" style="margin-bottom:0">Erklärbar durch: ${by.map((b) => (CATEGORIES[b] ? catName(b) : esc(b))).join(', ')}</p>`;
    html += `</div>`;
  }

  html += `<h3 class="sec-title">🟢 Scheint verträglich</h3><div class="card">`;
  html += res.okay.length ? `<div class="okay-list">${res.okay.map((s) => `<span class="chip static">${label(s.id)} <span class="muted small">${s.n}×</span></span>`).join('')}</div>` : '<div class="muted">Noch nichts mit genug Daten.</div>';
  html += `</div>`;

  if (res.unclear.length) {
    html += `<details class="card"><summary class="muted"><b>⚪ Noch unklar (${res.unclear.length})</b></summary><div style="margin-top:10px">${res.unclear.map((s) => statRow(s, mode)).join('')}</div></details>`;
  }

  if (res.suspicious.length && r.evaluated >= 15) {
    html += `<div class="card"><h2>Nächster Schritt: Weglass-Test</h2><p class="muted">Lass <b>${label(res.suspicious[0].id)}</b> etwa zwei Wochen konsequent weg und trag weiter ein. Werden die Beschwerden deutlich weniger, iss es danach gezielt wieder und beobachte, ob sie zurückkommen. Am besten mit ärztlicher oder ernährungsberaterischer Begleitung.</p></div>`;
  }
  html += `<p class="hint" style="padding:0 4px 20px">So wird gerechnet: Jede Mahlzeit bekommt den stärksten Beschwerdegrad, der im eingestellten Zeitfenster danach gemeldet wurde. Gab es in dem Fenster keine Meldung, später aber schon, zählt das als 0. Dinge, die du immer zusammen isst, kann die App nicht auseinanderhalten. Dafür ist der Weglass-Test da.</p>`;
  box.innerHTML = html;
}
$$('#stats-seg .seg-btn').forEach((b) => b.addEventListener('click', () => {
  $$('#stats-seg .seg-btn').forEach((x) => x.classList.toggle('active', x === b));
  state.statsMode = b.dataset.mode; renderStats();
}));
for (const id of ['#win-min', '#win-max']) {
  $(id).addEventListener('change', async () => {
    state.settings = { minH: +$('#win-min').value, maxH: +$('#win-max').value };
    await db.set('settings', state.settings); renderStats();
  });
}

// ---------- Mehr ----------
async function renderMore() {
  const list = $('#dict-list');
  const own = state.dict.slice().sort((a, b) => a.key.localeCompare(b.key));
  list.innerHTML = own.length ? own.map((d) => `<div class="dict-item"><span>${esc(d.key)} → ${d.name === '_' ? '<i class="muted">ignoriert</i>' : `<b>${esc(d.name)}</b> ${catIcons(d.cats)}`}</span><button data-id="${d.id}">Entfernen</button></div>`).join('')
    : '<div class="muted small">Noch keine eigenen Wörter. Tippe beim Erfassen auf ein „？“-Wort, um es zuzuordnen.</div>';
  $$('button', list).forEach((b) => b.onclick = async () => {
    await db.del('dict', b.dataset.id); state.dict = state.dict.filter((d) => d.id !== b.dataset.id); renderMore();
  });
  const last = await db.get('lastBackup', null);
  $('#backup-info').textContent = last ? `Letzte Sicherung: ${new Date(last).toLocaleString('de-DE')}` : 'Noch keine Sicherung gemacht.';
  let persisted = false;
  try { persisted = await navigator.storage?.persisted?.(); } catch {}
  $('#persist-info').textContent = persisted ? '✓ Dauerhafter Speicher ist aktiv.' : 'Tipp: Als Homescreen-App wird der Speicher nicht automatisch geleert.';
}

$('#export').onclick = async () => {
  const data = { app: 'bauchgefuehl', version: 1, exported: new Date().toISOString(),
    meals: state.meals, symptoms: state.symptoms, dict: state.dict, settings: state.settings };
  const name = `bauchgefuehl-${new Date().toISOString().slice(0, 10)}.json`;
  const file = new File([JSON.stringify(data)], name, { type: 'application/json' });
  try {
    if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: name });
    else {
      const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = name; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    }
    await db.set('lastBackup', Date.now()); renderMore();
  } catch (err) { if (err?.name !== 'AbortError') toast('Sicherung fehlgeschlagen'); }
};

$('#import').addEventListener('change', async (e) => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try {
    const data = JSON.parse(await f.text());
    if (data.app !== 'bauchgefuehl') throw new Error('falsche Datei');
    if (!confirm(`Sicherung vom ${new Date(data.exported).toLocaleString('de-DE')} laden? Einträge werden zusammengeführt, nichts wird gelöscht.`)) return;
    for (const m of data.meals || []) await db.put('meals', m);
    for (const s of data.symptoms || []) await db.put('symptoms', s);
    for (const d of data.dict || []) await db.put('dict', d);
    await load(); renderMore(); toast(`Geladen: ${data.meals?.length || 0} Mahlzeiten, ${data.symptoms?.length || 0} Meldungen`);
  } catch { toast('Das ist keine gültige Bauchgefühl-Sicherung'); }
});

$('#wipe').onclick = async () => {
  if (!confirm('Wirklich ALLE Einträge löschen? Das lässt sich nicht rückgängig machen.')) return;
  if (!confirm('Ganz sicher? Mach vorher am besten eine Sicherung.')) return;
  for (const s of ['meals', 'symptoms', 'dict']) await db.clear(s);
  await load(); renderMore(); toast('Alle Daten gelöscht');
};

// ---------- Start ----------
async function init() {
  await load();
  resetMealForm(); resetSymForm(); renderReminder();
  try { await navigator.storage?.persist?.(); } catch {}
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  if (location.hash === '#sym') switchForm('sym');
}
init();
