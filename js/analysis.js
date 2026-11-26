// Auswertung: Welche Lebensmittel / Kategorien gehen mit Beschwerden einher?
//
// Idee: Jede Mahlzeit bekommt ein "Ergebnis" = stärkster Beschwerdegrad (0–5),
// der im Zeitfenster [Mahlzeit + minH, Mahlzeit + maxH] gemeldet wurde.
// Gab es in dem Fenster keine Meldung, aber später schon (man hat also weiter
// protokolliert), zählt das als 0 = "keine Beschwerden". Ist das Fenster noch
// offen oder wurde danach gar nichts mehr gemeldet, bleibt die Mahlzeit außen vor.
//
// Für jedes Merkmal (Kategorie oder einzelnes Lebensmittel) wird dann verglichen:
// Ø Ergebnis der Mahlzeiten MIT diesem Merkmal vs. OHNE. Kleine Stichproben werden
// zum Gesamtdurchschnitt hin gezogen, damit 1–2 Zufallstreffer nicht dominieren.
import { mealItems } from './parser.js';

const H = 3600 * 1000;

export function mealOutcomes(meals, symptoms, { minH = 1, maxH = 24, now = Date.now() } = {}, custom = []) {
  const syms = [...symptoms].sort((a, b) => a.time - b.time);
  const lastSym = syms.length ? syms[syms.length - 1].time : -Infinity;
  const itemsOf = new Map(meals.map((m) => [m.id, mealItems(m, custom)]));
  const out = [];
  for (const m of meals) {
    const from = m.time + minH * H;
    const to = m.time + maxH * H;
    let max = null;
    let worst = [];
    for (const s of syms) {
      if (s.time < from) continue;
      if (s.time > to) break;
      if (max === null || s.severity > max) { max = s.severity; worst = [s]; }
      else if (s.severity === max) worst.push(s);
    }
    if (max === null) {
      if (to < now && lastSym > to) max = 0;
      else continue; // noch keine Aussage möglich
    }
    const items = itemsOf.get(m.id);
    // Kontext: alles, was als Auslöser der maßgeblichen Beschwerde in Frage kommt
    // (für die Gegenprobe gegen Störfaktoren).
    const ctx = { foods: new Set(items.map((i) => i.name)), cats: new Set(items.flatMap((i) => i.cats)) };
    if (max > 0) {
      for (const s of worst) {
        for (const o of meals) {
          const dt = s.time - o.time;
          if (dt < minH * H || dt > maxH * H) continue;
          for (const i of itemsOf.get(o.id)) { ctx.foods.add(i.name); i.cats.forEach((c) => ctx.cats.add(c)); }
        }
      }
    }
    out.push({
      meal: m,
      items,
      outcome: max,
      foods: new Set(items.map((i) => i.name)),
      cats: new Set(items.flatMap((i) => i.cats)),
      ctx,
    });
  }
  return out;
}

function featureStats(outcomes, key) {
  const n = outcomes.length;
  if (!n) return [];
  const total = outcomes.reduce((s, o) => s + o.outcome, 0);
  const globalMean = total / n;
  const K = 2; // Glättung
  const feats = new Map();
  for (const o of outcomes) {
    for (const f of o[key]) {
      if (!feats.has(f)) feats.set(f, { id: f, n: 0, sum: 0, bad: 0 });
      const st = feats.get(f);
      st.n++; st.sum += o.outcome; if (o.outcome >= 3) st.bad++;
    }
  }
  const badTotal = outcomes.filter((o) => o.outcome >= 3).length;
  const res = [];
  for (const st of feats.values()) {
    const nWithout = n - st.n;
    const meanWith = st.sum / st.n;
    const meanWithout = nWithout ? (total - st.sum) / nWithout : globalMean;
    const smoothedWith = (st.sum + K * globalMean) / (st.n + K);
    const diff = smoothedWith - meanWithout;
    res.push({
      id: st.id,
      n: st.n,
      meanWith,
      meanWithout,
      diff,
      badRate: st.bad / st.n,
      badRateWithout: nWithout ? (badTotal - st.bad) / nWithout : 0,
    });
  }
  return res;
}

const isSuspicious = (s) => s.diff >= 0.5 && s.meanWith >= 1.5;

// priorCats: bei der Lebensmittel-Auswertung die bereits verdächtigen Gruppen.
// Ein Lebensmittel, das so eine Gruppe enthält, bleibt verdächtig ("via"), alle
// anderen müssen den Verdacht auch ohne diese Gruppe halten.
export function classify(stats, { minN = 3 } = {}, outcomes = [], key = 'cats', priorCats = []) {
  const foodCats = new Map();
  if (priorCats.length) {
    for (const o of outcomes) for (const i of o.items) {
      if (!foodCats.has(i.name)) foodCats.set(i.name, new Set());
      i.cats.forEach((c) => foodCats.get(i.name).add(c));
    }
  }
  const viaOf = (id) => priorCats.filter((pc) => foodCats.get(id)?.has(pc));
  const cleanOf = (susp) => outcomes.filter((o) =>
    !susp.some((s) => !s.via && o.ctx[key].has(s.id)) && !priorCats.some((pc) => o.ctx.cats.has(pc)));
  const candidates = [];
  const okay = [];
  const unclear = [];
  for (const s of stats) {
    if (s.n < minN) { unclear.push(s); continue; }
    if (isSuspicious(s)) candidates.push(s);
    else if (s.diff <= 0.15 && s.badRate <= 0.25 && s.n >= minN + 1) okay.push(s);
    else unclear.push(s);
  }
  candidates.sort((a, b) => b.diff - a.diff);
  // Gegenprobe: Bleibt der Verdacht, wenn man alle Mahlzeiten herausnimmt, bei denen
  // ein stärkerer Verdächtiger als Auslöser in Frage kam? Sonst ist es nur ein "Mitläufer".
  const suspicious = [];
  const explained = [];
  for (const c of candidates) {
    const via = viaOf(c.id);
    if (via.length) { suspicious.push({ ...c, via }); continue; }
    if (!suspicious.length && !priorCats.length) { suspicious.push(c); continue; }
    const re = featureStats(cleanOf(suspicious), key).find((x) => x.id === c.id);
    if (re && re.n >= minN && isSuspicious(re)) suspicious.push({ ...c, checked: re });
    else explained.push({ ...c, by: [...priorCats, ...suspicious.filter((s) => !s.via).map((s) => s.id)], checked: re || null });
  }
  // Verträglichkeit ebenfalls auf bereinigten Daten prüfen: Beschwerden, die eher
  // vom Hauptverdächtigen kommen, sollen andere Lebensmittel nicht "belasten".
  if (suspicious.length || priorCats.length) {
    const clean = cleanOf(suspicious);
    const cleanStats = new Map(featureStats(clean, key).map((x) => [x.id, x]));
    const promote = (list) => list.filter((s) => {
      const c = cleanStats.get(s.id);
      if (c && c.n >= minN + 1 && c.diff <= 0.15 && c.badRate <= 0.25) { okay.push({ ...s, checked: c }); return false; }
      return true;
    });
    unclear.splice(0, unclear.length, ...promote(unclear));
    explained.splice(0, explained.length, ...promote(explained));
  }
  okay.sort((a, b) => b.n - a.n);
  unclear.sort((a, b) => b.n - a.n);
  return { suspicious, okay, unclear, explained };
}

export function analyze(meals, symptoms, opts = {}, custom = []) {
  const outcomes = mealOutcomes(meals, symptoms, opts, custom);
  const cats = classify(featureStats(outcomes, 'cats'), opts, outcomes, 'cats');
  return {
    outcomes,
    evaluated: outcomes.length,
    pending: meals.length - outcomes.length,
    globalMean: outcomes.length ? outcomes.reduce((s, o) => s + o.outcome, 0) / outcomes.length : 0,
    cats,
    foods: classify(featureStats(outcomes, 'foods'), opts, outcomes, 'foods', cats.suspicious.map((s) => s.id)),
  };
}

/** Mahlzeiten, die als Auslöser einer bestimmten Beschwerde-Meldung in Frage kommen. */
export function candidatesFor(symptom, meals, { minH = 1, maxH = 24 } = {}) {
  return meals
    .filter((m) => symptom.time - m.time >= minH * H && symptom.time - m.time <= maxH * H)
    .sort((a, b) => b.time - a.time);
}
