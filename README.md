# Bauchgefühl

Ernährungstagebuch zum Eingrenzen von Unverträglichkeiten. Es läuft als Web-App auf dem iPhone, offline und ohne KI-Dienste. Alle Einträge bleiben auf dem Gerät (IndexedDB).

## So funktioniert's
- **Erfassen → Gegessen:** Feld antippen, 🎤 auf der Tastatur, einfach erzählen. Das iPhone-Diktat läuft auf dem Gerät. Erkannte Zutaten erscheinen als Chips:
  - Chip antippen = durchstreichen (falsch erkannt).
  - „？ wort“ antippen = unbekanntes Wort zuordnen. Die App merkt es sich, auch für alte Einträge.
  - „ohne Zwiebeln“, „laktosefrei“, „vegan“, „zuckerfrei“, „alkoholfrei“, „entkoffeiniert“ werden berücksichtigt.
  - Foto ist optional.
- **Erfassen → Wie geht's?:** Grad 0–5. Wichtig: mindestens einmal am Tag melden, auch mit 0. Sonst weiß die App nicht, was du verträgst.
- **Auswertung:** Jede Mahlzeit bekommt den stärksten Beschwerdegrad im Zeitfenster danach (einstellbar, Standard 1–24 Std). Dann vergleicht die App „mit“ und „ohne“ je Gruppe (Laktose, Fruktose, Histamin, Weizen …) und je Lebensmittel. Eine Gegenprobe sortiert Mitläufer aus, also Dinge, die nur oft zusammen mit dem Hauptverdächtigen gegessen werden.
- **Mehr:** Sicherung als JSON-Datei speichern/laden, eigenes Wörterbuch verwalten.

## Dateien
- `js/foods.js`: Lebensmittel-Wörterbuch (erweiterbar, Format steht oben in der Datei)
- `js/parser.js`: Erkennung im Freitext
- `js/analysis.js`: Auswertung
- `js/app.js`: Oberfläche, `js/db.js`: Speicher, `sw.js`: Offline-Cache

## Lokal testen
```
node tools/serve.mjs
```
Danach http://localhost:5173 öffnen.

## Updates
Nach Änderungen in `sw.js` die `VERSION` hochzählen und die Dateien neu hochladen. Die Daten auf dem iPhone bleiben dabei erhalten.

## Icons neu erzeugen
```
node tools/make-icons.mjs
```
