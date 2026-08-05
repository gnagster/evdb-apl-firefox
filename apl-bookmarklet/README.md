# APL Preise Bookmarklet (ohne Extension)

Ersetzt auf ev-database.org die DE-Listenpreise durch die aktuellen APL.de
Privatkunden-Preise (nur für "Bestellbar"-Fahrzeuge), ohne eine Extension zu
installieren.

## Installation

1. Lesezeichen anlegen (z. B. Strg+D) und danach im Lesezeichen-Manager den
   Speicherort/URL bearbeiten.
2. Den gesamten Inhalt von `bookmarklet.js` (inkl. `javascript:`-Präfix) in das
   URL-Feld einfügen und speichern.
3. Auf `https://ev-database.org` das Lesezeichen anklicken — nach ~1 s erscheint
   ein Toast mit der Anzahl aktualisierter Preise.

## Datenquelle

Die Preise stammen aus `apl-prices.json` im Repo-Wurzelverzeichnis, das ein
täglicher GitHub-Action-Lauf (`apl-prices`, 05:10 UTC, auch manuell unter
Actions → apl-prices → Run workflow auslösbar) über `tools/scrape-prices.mjs`
erzeugt. Das Bookmarklet lädt die Datei von jsdelivr (CORS-fähig, Fallback: raw
GitHub) und cached sie 24 h im `localStorage`.

## Bekannte Grenzen

- Nur die Übersichtsseite wird verändert, nicht die Detailseiten; nur die
  DE/EUR-Spalte.
- Es gilt der Basisvarianten-APL-Preis ("ab"-Preis), passend zu den
  evdb-Startpreisen.
- Modelle ohne APL-Listenlinie (Smart, XPENG, Polestar, …) behalten den
  evdb-Preis.
