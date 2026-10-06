# M&M Heizung & Sanitär – Digitale Arbeitsberichte

Web-App / PWA, die den Papier-Arbeitsbericht (Vorlage: `docs/vorlage-scan.pdf`) ersetzt.
Für Monteure auf Smartphone und Tablet: Bericht ausfüllen, Stunden erfassen, vor Ort unterschreiben lassen, PDF erzeugen.

Stack: Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · jsPDF · IndexedDB

## Starten

Voraussetzung: Node.js ≥ 20.9 (empfohlen 22).

```bash
cd mm-arbeitsbericht
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
| `npm run test` | Unit-Tests (Stunden, KW, Validierung, Status, Dateiname) |
| `npm run build` | Production Build |
| `npm run check` | alles zusammen |

## Funktionen

- **Übersicht** (`/`): alle Berichte mit Datum/KW, Bauvorhaben, Kunde, Objekt, Status, Monteuren und Gesamtstunden.
  Aktionen: Öffnen, Bearbeiten, PDF, Duplizieren, Löschen (mit Sicherheitsabfrage). Suche ab 5 Berichten.
- **Formular** (`/bericht`, `/bericht?id=…`): Bauvorhaben, Zeitraum (KW wird aus „von“ berechnet, „bis“ wird auf den
  Samstag gesetzt), Objekt/KSt.-Nr., Art der Arbeiten, Monteure mit Stunden Mo–Sa (Karten auf dem Handy, Tabelle ab
  Tablet), Summen pro Monteur/Tag/gesamt, Beschreibung, Status, Hinweise, Ort/Datum, Unterschriften Monteur und Kunde.
- **Ansicht** (`/ansicht?id=…`): Lesefassung im Stil des Papierformulars.
- **PDF**: DIN A4 hochformat mit Logo, allen Angaben, Unterschriften und Firmendaten im Fuß; mehrseitig bei langen
  Texten. Dateiname: `Arbeitsbericht_2026-10-06_Kundenname.pdf` (Umlaute → ae/oe/ue/ss, Sonderzeichen → `_`).
- **Automatisch speichern**: jede Änderung sofort in `localStorage` (Notfallsicherung) und kurz danach in IndexedDB;
  beim Schließen/Wechseln der App wird sofort gespeichert.
- **Status automatisch**: *Entwurf* (Pflichtangaben fehlen) → *Fertig* (Pflichtangaben vollständig) →
  *Unterschrieben* (zusätzlich Name + Unterschrift von Monteur und Kunde).
- **Prüfen**: markiert fehlende Pflichtangaben (Bauvorhaben, Datum, mind. ein Monteur, Beschreibung, Status).
  PDF kann trotzdem erzeugt werden (mit Rückfrage), der Bericht bleibt als Entwurf gespeichert.
- **Text verbessern**: formuliert Monteur-Notizen professionell um (Claude API). Funktioniert, sobald
  `ANTHROPIC_API_KEY` in `.env.local` gesetzt ist (siehe `.env.example`); ohne Schlüssel meldet der Button das freundlich.
  Der Vorschlag muss bestätigt werden („Übernehmen“) – der Originaltext wird nie ungefragt überschrieben.
- **Offline**: nach dem ersten Aufruf funktionieren Übersicht, Formular, Unterschrift und PDF ohne Netz.

## Firmendaten ändern

Alles in **`src/config/company-config.ts`**: Name, Inhaber, Adresse, Telefon/Mobil, E-Mail, Website,
Steuernummer, Bankdaten, Logo-Pfad und Markenfarben. Das Logo liegt unter `public/brand/mm-logo.png`
(aus dem Scan der Vorlage freigestellt) – für eine bessere Originaldatei einfach diese Datei ersetzen.
App-Icons: `public/icons/`.

## Projektstruktur

```
src/
  app/                    Seiten (/, /bericht, /ansicht), Manifest, API-Route /api/text-verbessern
  components/
    report/               Formularabschnitte, Unterschriftenfeld, Liste, Ansicht
    ui/                   Buttons, Felder, Dialog, Toast, Icons
  config/company-config.ts  Firmendaten
  hooks/                  useReportEditor (Laden + Autospeichern), useReports
  lib/
    report/               Datenmodell, Stunden, Validierung, Status, Dateiname (+ Tests)
    storage/              ReportRepository-Interface + IndexedDB-Implementierung
    pdf/                  PDF-Erzeugung (jsPDF, im Browser)
    ai/                   „Text verbessern“ (Client + Prompt)
public/sw.js              Service Worker
```

## Erweiterungen – wo sie andocken

| Vorhaben | Ansatzpunkt |
|---|---|
| Zentrale Datenbank (Supabase/PostgreSQL) | neue Klasse, die `ReportRepository` implementiert; in `lib/storage/index.ts` auswählen. Das `WorkReport`-Objekt ist reines JSON (z. B. eine `jsonb`-Spalte oder normalisierte Tabellen). |
| Offline-Modus mit Synchronisierung | IndexedDB bleibt lokaler Speicher, ein Sync-Repository gleicht über `updatedAt`/`syncedAt` ab. |
| Login für Monteure | Supabase Auth o. ä.; `WorkerEntry.userId` ist vorbereitet. |
| Laufende Berichtsnummer | Feld `number` existiert und wird im PDF gedruckt; Vergabe serverseitig (Sequenz). |
| Kunden-/Baustellenverwaltung, Kundendaten laden | Felder `customerId`, `siteId`; Formularfelder könnten daraus vorbelegt werden. |
| Suche/Filter nach Zeitraum, Monteur | `ReportQuery` in `lib/storage/repository.ts`; einfache Textsuche existiert bereits in der Übersicht. |
| Fotos, Materialverbrauch | Felder `photos`, `materials` im Datenmodell; im PDF als weitere Abschnitte ergänzen. |
| E-Mail-Versand / Ablage / Google Drive / OneDrive | `generateReportPdf()` liefert das jsPDF-Dokument (`doc.output("blob")`) – an eine API-Route übergeben. |
| KI-Modell/Anbieter wechseln | nur `src/app/api/text-verbessern/route.ts` und `lib/ai/prompt.ts`. |

## Hinweise

- Daten liegen bis zur Datenbank-Anbindung **nur auf dem jeweiligen Gerät/Browser**. Browserdaten löschen = Berichte weg.
- Bei Änderungen an `public/sw.js` die `CACHE_VERSION` erhöhen.
