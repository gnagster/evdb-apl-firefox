# APL Preise Bookmarklet (ohne Extension)

Ersetzt auf ev-database.org die DE-Listenpreise durch die aktuellen APL.de
Privatkunden-Preise (nur für "Bestellbar"-Fahrzeuge), ohne eine Extension zu
installieren.

## Installation

1. `bookmarklet.min.js` öffnen (eine einzige Zeile) und die komplette Zeile
   kopieren: https://raw.githubusercontent.com/gnagster/evdb-apl-firefox/main/apl-bookmarklet/bookmarklet.min.js
2. Lesezeichen anlegen (Strg+D) und im Lesezeichen-Manager die URL durch den
   kopierten Inhalt ersetzen. Die URL muss mit `javascript:` beginnen.
3. Auf `https://ev-database.org` das Lesezeichen anklicken — nach ~1 s erscheint
   ein Toast („APL: N Preise aktualisiert von M").

Tipps bei „es passiert nichts":

- Nach dem Klick F12 → Konsole öffnen: erscheint eine rote Fehlermeldung? Falls
  ja, bitte melden (z. B. „SyntaxError" heißt: die URL wurde abgeschnitten).
- Das Lesezeichen **lokal in Edge anlegen** — Edge-Sync übernimmt
  `javascript:`-Lesezeichen aus anderen Browsern NICHT (URL wird geleert).
- Klick kurz abwarten (bis zu 6 s): Wird beim Klick noch zur Liste
  umgeleitet, wartet das Bookmarklet automatisch.

## Datenquelle

Die Preise stammen aus `apl-prices.json` im Repo-Wurzelverzeichnis, das ein
täglicher GitHub-Action-Lauf (`apl-prices`, 05:10 UTC, auch manuell unter
Actions → apl-prices → Run workflow auslösbar) über `tools/scrape-prices.mjs`
erzeugt. Das Bookmarklet lädt die Datei von raw GitHub (frisch, CORS-fähig;
jsdelivr cached `@main` 24 h und dient nur als Fallback) und cached sie 24 h im
`localStorage`.

## Bekannte Grenzen

- Nur die Übersichtsseite wird verändert, nicht die Detailseiten; nur die
  DE/EUR-Spalte.
- Es gilt der Basisvarianten-APL-Preis ("ab"-Preis), passend zu den
  evdb-Startpreisen.
- Modelle ohne APL-Listenlinie (Smart, XPENG, Polestar, …) behalten den
  evdb-Preis.
