import { readFileSync, mkdirSync } from "node:fs";

import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";

/** Mit E2E_SCREENSHOTS=1 werden Screenshots, PDF und Sicherung je Gerät unter e2e/screenshots/ abgelegt. */
const SAVE_ARTIFACTS = Boolean(process.env.E2E_SCREENSHOTS);
const MIN_TAP = 44;

function artifactDir(info: TestInfo) {
  const dir = `e2e/screenshots/${info.project.name.replace(/\s+/g, "-")}`;
  mkdirSync(dir, { recursive: true });
  return dir;
}

async function shot(page: Page, info: TestInfo, name: string, fullPage = false) {
  if (SAVE_ARTIFACTS) await page.screenshot({ path: `${artifactDir(info)}/${name}.png`, fullPage });
}

/** Kein horizontales Scrollen, nichts Bedienbares außerhalb des Bildschirms, Tippflächen groß genug. */
async function expectTouchFriendly(page: Page, where: string) {
  const problems = await page.evaluate((minTap) => {
    const issues: string[] = [];
    // Gerätebreite (Layout-Viewport). innerWidth wächst bei Überlauf mit, weil Mobilbrowser dann herauszoomen.
    const vw = document.documentElement.clientWidth;
    if (document.documentElement.scrollWidth > vw + 1 || window.innerWidth > vw + 1) {
      issues.push(`horizontaler Überlauf: Inhalt ${document.documentElement.scrollWidth}px, Bildschirm ${vw}px`);
    }
    const describe = (el: Element) =>
      `${el.tagName.toLowerCase()} „${(el.getAttribute("aria-label") || el.textContent || (el as HTMLInputElement).placeholder || "").trim().slice(0, 40)}“`;
    const visible = (el: Element) => {
      const style = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return style.visibility !== "hidden" && style.display !== "none" && r.width > 2 && r.height > 2;
    };
    for (const el of document.querySelectorAll("button, a[href], input, textarea, select")) {
      if (!visible(el) || el.closest("[inert], dialog:not([open])")) continue;
      let target: Element = el;
      if (el instanceof HTMLInputElement && (el.type === "radio" || el.type === "checkbox")) target = el.closest("label") ?? el;
      const r = target.getBoundingClientRect();
      if (r.left < -1 || r.right > vw + 1) issues.push(`außerhalb des Bildschirms: ${describe(el)} (${Math.round(r.left)}–${Math.round(r.right)})`);
      if (r.height < minTap - 0.5) issues.push(`zu niedrig (${Math.round(r.height)}px): ${describe(el)}`);
      const isTextField = el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && !["radio", "checkbox", "button"].includes(el.type));
      if (!isTextField && r.width < minTap - 0.5) issues.push(`zu schmal (${Math.round(r.width)}px): ${describe(el)}`);
    }
    return issues;
  }, MIN_TAP);
  expect(problems, `${where}: ${problems.join("; ")}`).toEqual([]);
}

/** Sichtbare Variante eines Feldes (Handy: Karten, ab Tablet: Tabelle). */
const visibleByLabel = (page: Page, label: string) => page.getByLabel(label, { exact: true }).filter({ visible: true });

/** Unterschreibt wie mit dem Finger (echte Touch-Events, langsam) bzw. mit der Maus am Desktop. */
async function sign(page: Page, canvas: Locator, info: TestInfo, seed = 0) {
  // Feld in die Bildschirmmitte holen (nicht unter Kopf- oder Fußleiste) – wie ein Monteur es tun würde.
  await canvas.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await page.waitForTimeout(100);
  const box = (await canvas.boundingBox())!;
  const scrollBefore = await page.evaluate(() => window.scrollY);
  const points = Array.from({ length: 50 }, (_, i) => {
    const t = i / 49;
    return {
      x: Math.round(box.x + box.width * (0.12 + 0.76 * t)),
      y: Math.round(box.y + box.height * (0.55 - 0.22 * Math.sin(t * 8 + seed))),
    };
  });
  // Jeder Punkt muss wirklich auf dem Unterschriftenfeld liegen (nicht auf einer Leiste darüber).
  const allOnCanvas = await canvas.evaluate(
    (el, pts) => pts.every((p) => document.elementFromPoint(p.x, p.y) === el),
    points,
  );
  expect(allOnCanvas, "Unterschriftenfeld ist (teilweise) verdeckt").toBe(true);
  if (info.project.use.hasTouch) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [points[0]] });
    for (const p of points.slice(1)) {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [p] });
      await page.waitForTimeout(12); // langsame Unterschrift
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await cdp.detach();
  } else {
    await page.mouse.move(points[0].x, points[0].y);
    await page.mouse.down();
    for (const p of points.slice(1)) await page.mouse.move(p.x, p.y, { steps: 2 });
    await page.mouse.up();
  }
  expect(await page.evaluate(() => window.scrollY), "Seite darf beim Unterschreiben nicht scrollen").toBe(scrollBefore);
}

/** Anzahl dunkler Pixel im Canvas – prüft, dass eine Unterschrift sichtbar ist. */
const inkPixels = (canvas: Locator) =>
  canvas.evaluate((c: HTMLCanvasElement) => {
    const data = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 128) n++;
    return n;
  });

/** Antippen wie ein Mensch: erst in die Bildschirmmitte scrollen (nicht unter die feste Aktionsleiste). */
async function tap(locator: Locator) {
  await locator.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await locator.click();
}

const statusBadge = (page: Page) => page.locator("header").getByText(/^(Entwurf|Fertig|Unterschrieben)$/);
const LONG_TEXT = Array.from(
  { length: 12 },
  (_, i) => `${i + 1}. Heizkreis ${i + 1} entlüftet, Systemdruck geprüft, Thermostatventile auf Funktion kontrolliert und Rücklauftemperatur eingestellt.`,
).join("\n");

test("Arbeitsbericht: erstellen, unterschreiben, PDF, duplizieren, sichern, löschen, wiederherstellen", async ({ page }, info) => {
  // 1. neuer Bericht
  await page.goto("/");
  await expect(page.getByText("Noch keine Arbeitsberichte")).toBeVisible();
  await expectTouchFriendly(page, "Übersicht leer");
  await page.getByRole("link", { name: "Neuer Arbeitsbericht" }).click();
  await page.waitForURL(/\/bericht/);

  // 2. Bauvorhaben
  await page.getByLabel("Bauvorhaben").fill("Familie Müller – Heizungstausch");
  await page.getByLabel("Objekt / KSt.-Nr.").fill("Lindenstraße 12 / 2026-118");
  await page.getByLabel("Art der Arbeiten").fill("Heizungsreparatur");

  // 3. Zeitraum (KW und „bis“ werden automatisch gesetzt)
  await page.locator("#dateFrom").fill("2026-10-07");
  await expect(page.locator("#kw")).toHaveValue("41");
  await expect(page.locator("#dateTo")).toHaveValue("2026-10-10");

  // 4. zwei Monteure (+ einen dritten hinzufügen und wieder entfernen)
  await visibleByLabel(page, "Name Monteur 1").fill("Ali Issat");
  await page.getByRole("button", { name: "Monteur hinzufügen" }).click();
  await visibleByLabel(page, "Name Monteur 2").fill("Dragan Petrović");
  await page.getByRole("button", { name: "Monteur hinzufügen" }).click();
  await expect(visibleByLabel(page, "Name Monteur 3")).toBeVisible();
  await page.getByRole("button", { name: "Monteur 3 entfernen" }).filter({ visible: true }).click();
  await expect(visibleByLabel(page, "Name Monteur 3")).toHaveCount(0);

  // 5. Stunden (Punkt wird zu Komma)
  await visibleByLabel(page, "Montag Stunden Monteur 1").fill("8");
  await visibleByLabel(page, "Dienstag Stunden Monteur 1").fill("7.5");
  await expect(visibleByLabel(page, "Dienstag Stunden Monteur 1")).toHaveValue("7,5");
  for (const day of ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag"]) {
    await visibleByLabel(page, `${day} Stunden Monteur 2`).fill("8");
  }
  await expect(page.getByTestId("total-hours")).toHaveText("55,5 Std.");
  await expectTouchFriendly(page, "Editor Monteure");
  await shot(page, info, "02-monteure");

  // 6. lange Tätigkeitsbeschreibung
  await page.locator("#description").fill(LONG_TEXT);

  // 7. + 8. weitere Arbeiten mit Hinweis
  await tap(page.locator("label").filter({ hasText: "Weitere Arbeiten erforderlich" }));
  await expect(page.getByRole("radio", { name: "Weitere Arbeiten erforderlich" })).toBeChecked();
  await page.locator("#followUpNotes").fill("Thermostatventil im Bad ist bestellt, Einbau in KW 42.");

  // 9. beide Unterschriften (inkl. Löschen und erneut unterschreiben)
  await page.locator("#ort").fill("Herford");
  await page.locator("#monteurName").click();
  await expect(page.locator("#monteurName")).toHaveValue("Ali Issat");
  await page.locator("#kundeName").fill("Jörg Müller");
  const monteurPad = page.getByRole("img", { name: /Unterschrift Monteur/ });
  const kundePad = page.getByRole("img", { name: /Unterschrift Kunde/ });
  await sign(page, monteurPad, info);
  await sign(page, kundePad, info, 1.5);
  await expect(statusBadge(page)).toHaveText("Unterschrieben");
  await tap(page.getByRole("button", { name: "Unterschrift löschen" }).nth(1));
  await expect(statusBadge(page)).toHaveText("Fertig");
  expect(await inkPixels(kundePad)).toBe(0);
  await sign(page, kundePad, info, 3);
  await expect(statusBadge(page)).toHaveText("Unterschrieben");
  expect(await inkPixels(monteurPad)).toBeGreaterThan(200);
  await expectTouchFriendly(page, "Editor Unterschriften");
  await shot(page, info, "03-unterschriften");

  // 10. speichern (automatisch) – Nummer wird vergeben
  await expect(page.getByTestId("saved")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId("editor-number")).toHaveText(/^Nr\. AB-\d{4}-0001$/);
  const number1 = (await page.getByTestId("editor-number").innerText()).replace("Nr. ", "");

  // 11. + 12. neu laden, alles noch da
  await page.reload();
  await expect(page.getByLabel("Bauvorhaben")).toHaveValue("Familie Müller – Heizungstausch");
  await expect(page.locator("#kw")).toHaveValue("41");
  await expect(visibleByLabel(page, "Name Monteur 2")).toHaveValue("Dragan Petrović");
  await expect(page.getByTestId("total-hours")).toHaveText("55,5 Std.");
  await expect(page.locator("#description")).toHaveValue(LONG_TEXT);
  await expect(page.locator("#followUpNotes")).toHaveValue(/Thermostatventil/);
  await expect(page.getByTestId("editor-number")).toHaveText(`Nr. ${number1}`);
  await expect(statusBadge(page)).toHaveText("Unterschrieben");
  await kundePad.scrollIntoViewIfNeeded();
  await expect.poll(() => inkPixels(kundePad)).toBeGreaterThan(200);

  // Rotation/Größenwechsel: Unterschrift bleibt erhalten
  const size = page.viewportSize()!;
  await page.setViewportSize({ width: size.height, height: size.width });
  await expect.poll(() => inkPixels(kundePad)).toBeGreaterThan(200);
  await page.setViewportSize(size);

  // 13. PDF
  const [pdf] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /PDF erstellen/ }).click()]);
  expect(pdf.suggestedFilename()).toMatch(/^Arbeitsbericht_\d{4}-\d{2}-\d{2}_Joerg_Mueller\.pdf$/);
  const pdfPath = await pdf.path();
  const pdfBytes = readFileSync(pdfPath!);
  expect(pdfBytes.subarray(0, 5).toString()).toBe("%PDF-");
  expect(pdfBytes.length).toBeGreaterThan(30_000); // Logo + eingebettete Schrift
  if (SAVE_ARTIFACTS) await pdf.saveAs(`${artifactDir(info)}/arbeitsbericht.pdf`);

  // 14. + 15. duplizieren → neue Nummer
  await page.getByRole("button", { name: "Zur Übersicht" }).click();
  await expect(page.getByTestId("report-card")).toHaveCount(1);
  await expect(page.getByTestId("card-number")).toHaveText(number1);
  await expectTouchFriendly(page, "Übersicht");
  await shot(page, info, "01-uebersicht");
  await page.getByRole("button", { name: "Duplizieren" }).click();
  await page.waitForURL(/\/bericht\?id=/);
  await expect(page.getByLabel("Bauvorhaben")).toHaveValue("Familie Müller – Heizungstausch");
  const number2 = (await page.getByTestId("editor-number").innerText()).replace("Nr. ", "");
  expect(number2).toMatch(/^AB-\d{4}-0002$/);
  expect(number2).not.toBe(number1);
  await expect(statusBadge(page)).toHaveText("Fertig"); // Unterschriften werden nicht kopiert
  await page.getByRole("button", { name: "Zur Übersicht" }).click();
  await expect(page.getByTestId("report-card")).toHaveCount(2);

  // Ansicht öffnen
  await page.getByTestId("report-card").filter({ hasText: number1 }).getByRole("link", { name: "Öffnen" }).click();
  await expect(page.getByTestId("view-number")).toHaveText(`Nr. ${number1}`);
  await expect(page.getByTestId("view-total")).toHaveText("55,5 Std.");
  await expectTouchFriendly(page, "Ansicht");
  await shot(page, info, "04-ansicht", true);
  await page.getByRole("link", { name: "Zur Übersicht" }).click();

  // 16. Sicherung exportieren
  const [backupDownload] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Daten sichern" }).click()]);
  expect(backupDownload.suggestedFilename()).toMatch(/^Arbeitsberichte_Sicherung_\d{4}-\d{2}-\d{2}\.json$/);
  const backupPath = (await backupDownload.path())!;
  const backup = JSON.parse(readFileSync(backupPath, "utf8"));
  expect(backup.count).toBe(2);
  await expect(page.getByText(/Letzte Sicherung:/)).toBeVisible();

  // 17. Bericht löschen (mit Sicherheitsabfrage)
  const original = page.getByTestId("report-card").filter({ hasText: number1 });
  await original.getByRole("button", { name: "Löschen" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Abbrechen" }).click();
  await expect(page.getByTestId("report-card")).toHaveCount(2);
  await original.getByRole("button", { name: "Löschen" }).click();
  await page.getByRole("button", { name: "Endgültig löschen" }).click();
  await expect(page.getByTestId("report-card")).toHaveCount(1);
  await expect(page.getByTestId("card-number")).toHaveText(number2);

  // 18. Sicherung importieren
  await page.getByTestId("backup-file-input").setInputFiles(backupPath);
  const summary = page.getByTestId("import-summary");
  await expect(summary).toContainText("1 neuer Bericht");
  await expect(summary).toContainText("1 bereits identisch vorhanden");
  await expectTouchFriendly(page, "Import-Dialog");
  await shot(page, info, "05-import");
  await page.getByRole("button", { name: "1 Bericht importieren" }).click();
  await expect(page.getByTestId("report-card")).toHaveCount(2);
  await expect(page.getByTestId("card-number").filter({ hasText: number1 })).toHaveCount(1);

  // wiederhergestellter Bericht ist vollständig
  await page.getByTestId("report-card").filter({ hasText: number1 }).getByRole("link", { name: "Bearbeiten" }).click();
  await expect(page.getByLabel("Bauvorhaben")).toHaveValue("Familie Müller – Heizungstausch");
  await expect(statusBadge(page)).toHaveText("Unterschrieben");
  await expect(page.getByTestId("total-hours")).toHaveText("55,5 Std.");
});

test("ungültige Sicherung wird abgelehnt, nichts wird verändert", async ({ page }, info) => {
  test.skip(info.project.name !== "Desktop", "einmal genügt");
  await page.goto("/");
  await page.getByTestId("backup-file-input").setInputFiles({
    name: "falsch.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ irgendwas: true })),
  });
  await expect(page.getByText(/Import abgelehnt: Das ist keine Sicherung/)).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("Eingaben überstehen sofortiges Neuladen (Autospeichern)", async ({ page }, info) => {
  test.skip(info.project.name !== "iPhone 15", "einmal genügt");
  await page.goto("/bericht");
  await page.getByLabel("Bauvorhaben").fill("Sofort-Test");
  // Sofort neu laden – noch bevor das entprellte Speichern gelaufen ist.
  await page.reload();
  await expect(page.getByLabel("Bauvorhaben")).toHaveValue("Sofort-Test");
  // Auch direkt zur Übersicht: Bericht ist dort vorhanden.
  await page.getByLabel("Bauvorhaben").fill("Sofort-Test 2");
  await page.goto("/");
  await expect(page.getByTestId("report-card").filter({ hasText: "Sofort-Test 2" })).toHaveCount(1);
});
