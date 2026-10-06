# M&M Heizung & Sanitär – Digitale Arbeitsberichte

Web-App / PWA, die den Papier-Arbeitsbericht (Vorlage: `docs/vorlage-scan.pdf`) ersetzt.
Für Monteure auf Smartphone und Tablet: Bericht ausfüllen, Stunden erfassen, vor Ort unterschreiben lassen, PDF erzeugen.

Stack: Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · jsPDF · IndexedDB

## Starten

Voraussetzung: Node.js ≥ 20.9 (empfohlen 22, siehe `.nvmrc`).

```bash
npm install
npm run dev          # Entwicklung: http://localhost:3000
```

Produktiv (inkl. Service Worker / Offline / „Zum Startbildschirm hinzufügen“):

```bash
npm run build
npm run start        # http://localhost:3000
```

Die PWA lässt sich nur über **HTTPS** (oder `localhost`) installieren – z. B. nach einem Deployment auf Vercel.
Auf dem iPhone: Safari → Teilen → „Zum Home-Bildschirm“. Auf Android: Chrome → „App installieren“.

| Befehl | Zweck |
|---|---|
| `npm run typecheck` | TypeScript-Prüfung |
| `npm run lint` | ESLint |
| `npm run test` | Unit-Tests (Vitest): Stunden, KW, Datumsformate, Validierung, Status, Berichtsnummer, Datensicherung, PDF-Layout |
| `npm run test:e2e` | Browser-Tests (Playwright) auf iPhone SE, iPhone 15, großem Android, Tablet und Desktop – baut und startet die App selbst |
| `npm run pdf:beispiele` | erzeugt `docs/beispiele/beispiel-{kurz,normal,lang}.pdf` |
| `npm run build` | Production Build |
| `npm run check` | Typecheck + Lint + Unit-Tests + Build |

Für `npm run test:e2e` wird einmalig ein Chromium gebraucht: `npx playwright install chromium`
(oder vorhandenes Chromium über `PW_CHROMIUM_PATH=/pfad/zu/chrome`). Mit `E2E_SCREENSHOTS=1` werden Screenshots,
PDF und Sicherung je Gerät unter `e2e/screenshots/` abgelegt.

## Funktionen

- **Übersicht** (`/`): alle Berichte mit Berichtsnummer, Datum/KW, Bauvorhaben, Kunde, Objekt, Status, Monteuren und
  Gesamtstunden. Aktionen: Öffnen, Bearbeiten, PDF, Duplizieren, Löschen (mit Sicherheitsabfrage). Suche ab 5 Berichten.
- **Formular** (`/bericht`, `/bericht?id=…`): Bauvorhaben, Zeitraum (KW wird aus „von“ berechnet, „bis“ wird auf den
  Samstag gesetzt), Objekt/KSt.-Nr., Art der Arbeiten, Monteure mit Stunden Mo–Sa (Karten auf dem Handy, Tabelle ab
  Tablet), Summen pro Monteur/Tag/gesamt, Beschreibung, Status, Hinweise, Ort/Datum, Unterschriften Monteur und Kunde.
- **Ansicht** (`/ansicht?id=…`): Lesefassung im Stil des Papierformulars.
- **Berichtsnummer** `AB-2026-0001`: wird beim ersten Speichern vergeben, bleibt danach unverändert, steht im PDF-Kopf.
  Duplikate bekommen eine neue Nummer; Nummern gelöschter Berichte werden nicht erneut vergeben.
- **PDF**: DIN A4 hochformat mit Logo, allen Angaben, Unterschriften (als Vektorgrafik – gestochen scharf) und
  Firmendaten im Fuß. Normale Berichte passen auf eine Seite; lange Texte laufen sauber auf Folgeseiten, Ort/Datum und
  beide Unterschriften bleiben immer zusammen. Seitenzahl in eigener Zeile unter den Firmendaten. Eingebettete
  Unicode-Schrift, damit Namen wie *Petrović, Şahin, Łukasz* korrekt erscheinen.
  Dateiname: `Arbeitsbericht_2026-10-06_Kundenname.pdf` (Umlaute → ae/oe/ue/ss, Sonderzeichen → `_`).
- **Unterschriften**: Finger, Stift oder Maus. Gespeichert als Vektor-Striche – bleibt bei Drehen/Größenwechsel
  erhalten, ist auf Retina-Displays scharf. Während des Unterschreibens scrollt die Seite nicht; ein zweiter Finger
  oder Handballen wird ignoriert.
- **Automatisch speichern**: nach kurzer Tipp-Pause (keine Schreibvorgänge bei jedem Tastendruck), Anzeige
  „Speichert …“ / „Gespeichert“. Beim Schließen, Neuladen oder App-Wechsel wird sofort gesichert; Entwürfe, die es
  nicht mehr in die Datenbank geschafft haben, werden beim nächsten Start der Übersicht automatisch übernommen.
- **Status automatisch**: *Entwurf* (Pflichtangaben fehlen) → *Fertig* (Pflichtangaben vollständig) →
  *Unterschrieben* (zusätzlich Name + Unterschrift von Monteur und Kunde).
- **Prüfen**: markiert fehlende Pflichtangaben (Bauvorhaben, Datum, mind. ein Monteur, Beschreibung, Status).
  PDF kann trotzdem erzeugt werden (mit Rückfrage), der Bericht bleibt als Entwurf gespeichert.
- **Datensicherung** (Übersicht unten): „Daten sichern“ lädt alle Berichte als JSON-Datei herunter,
  „Sicherung importieren“ liest sie wieder ein. Die Datei wird vollständig geprüft (ungültige oder fremde Dateien werden
  abgelehnt), vor dem Import zeigt eine Sicherheitsabfrage, was passiert. Vorhandene Berichte werden nie stillschweigend
  überschrieben – bei abweichendem Inhalt muss „Vorhandene ersetzen“ ausdrücklich gewählt werden. Es wird nichts gelöscht.
- **Text verbessern**: formuliert Monteur-Notizen professionell um (Claude API). Funktioniert, sobald
  `ANTHROPIC_API_KEY` in `.env.local` gesetzt ist (siehe `.env.example`); ohne Schlüssel meldet der Button das freundlich.
  Der Vorschlag muss bestätigt werden („Übernehmen“) – der Originaltext wird nie ungefragt überschrieben.
- **Offline**: nach dem ersten Aufruf funktionieren Übersicht, Formular, Unterschrift und PDF ohne Netz.

## Firmendaten, Logo, Farben

- **Firmendaten**: `src/config/company-config.ts` – Name, Inhaber, Adresse, Telefon/Mobil, E-Mail, Website,
  Steuernummer, Bankdaten, Logo-Pfad. Nirgends sonst hart codiert.
- **Markenfarben**: `src/config/brand.ts` (Schwarz/Anthrazit, Gold, Weiß + wenige Grautöne). `src/app/globals.css`
  spiegelt dieselben Werte für Tailwind; ein Unit-Test stellt sicher, dass beide übereinstimmen.
- **Logo**: `public/brand/mm-logo.png` ist das echte Logo, aus dem Scan des Papierformulars freigestellt
  (`scripts/extract-logo.sh` – erzeugt auch die App-Icons). Liegt das Logo als Original-Vektordatei vor, einfach diese
  PNG-Datei (quadratisch, transparenter Rand, ≥ 768 px) ersetzen – das wird noch schärfer.
- **PDF-Schrift**: `public/fonts/MMBerichtSans-*.ttf` – Ausschnitt aus Liberation Sans (SIL Open Font License,
  `public/fonts/LICENSE-OFL.txt`), erzeugt mit `scripts/build-pdf-font.py`.

## Projektstruktur

```
src/
  app/                    Seiten (/, /bericht, /ansicht), Manifest, API-Route /api/text-verbessern
  components/
    report/               Formularabschnitte, Unterschriftenfeld, Liste, Ansicht, Datensicherung
    ui/                   Buttons, Felder, Dialog, Toast, Icons
  config/                 company-config.ts (Firmendaten), brand.ts (Farben)
  hooks/                  useReportEditor (Laden + Autospeichern), useReports
  lib/
    report/               Datenmodell, Stunden, Validierung, Status, Berichtsnummer, Unterschrift, Dateiname
    storage/              ReportRepository-Interface, IndexedDB- und Memory-Implementierung, Notfallsicherung, Datensicherung
    pdf/                  PDF-Erzeugung (jsPDF, im Browser)
    ai/                   „Text verbessern“ (Client + Prompt)
    util/                 Datum/KW, IDs
e2e/                      Playwright-Browsertests
docs/                     Vorlage (Foto, Scan) und Beispiel-PDFs
scripts/                  Logo- und Schrift-Erzeugung
public/sw.js              Service Worker
```

## Erweiterungen – wo sie andocken

| Vorhaben | Ansatzpunkt |
|---|---|
| Zentrale Datenbank (Supabase/PostgreSQL) | neue Klasse, die `ReportRepository` implementiert; in `lib/storage/index.ts` auswählen. Das `WorkReport`-Objekt ist reines JSON (z. B. eine `jsonb`-Spalte oder normalisierte Tabellen). |
| Berichtsnummer serverseitig | `save()` des Repositorys vergibt heute lokal (`lib/report/report-number.ts`); serverseitig z. B. per Sequenz – die App übernimmt die zurückgegebene Nummer bereits automatisch. |
| Offline-Modus mit Synchronisierung | IndexedDB bleibt lokaler Speicher, ein Sync-Repository gleicht über `updatedAt`/`syncedAt` ab. |
| Login für Monteure | Supabase Auth o. ä.; `WorkerEntry.userId` ist vorbereitet. |
| Kunden-/Baustellenverwaltung, Kundendaten laden | Felder `customerId`, `siteId`; Formularfelder könnten daraus vorbelegt werden. |
| Suche/Filter nach Zeitraum, Monteur | `ReportQuery` in `lib/storage/repository.ts`; einfache Textsuche existiert bereits in der Übersicht. |
| Fotos, Materialverbrauch | Felder `photos`, `materials` im Datenmodell; im PDF als weitere Abschnitte ergänzen. |
| E-Mail-Versand / Ablage / Google Drive / OneDrive | `generateReportPdf()` liefert das jsPDF-Dokument (`doc.output("blob")`) – an eine API-Route übergeben. |
| KI-Modell/Anbieter wechseln | nur `src/app/api/text-verbessern/route.ts` und `lib/ai/prompt.ts`. |

## Hinweise

- Daten liegen bis zur Datenbank-Anbindung **nur auf dem jeweiligen Gerät/Browser**. Browserdaten löschen = Berichte weg –
  deshalb regelmäßig „Daten sichern“ verwenden.
- Datumsfelder zeigen das Format des Geräts (auf deutschen Geräten TT.MM.JJJJ).
- Bei Änderungen an `public/sw.js` die `CACHE_VERSION` erhöhen.
