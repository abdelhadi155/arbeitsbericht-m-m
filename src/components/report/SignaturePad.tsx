"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { fitContain, hasStrokes, roundStroke } from "@/lib/report/signature";
import type { Signature, SignatureStroke } from "@/lib/report/types";

import { Button } from "../ui/Button";
import { TrashIcon } from "../ui/icons";

interface SignaturePadProps {
  label: string;
  value: Signature | null;
  onChange: (value: Signature | null) => void;
  error?: string;
}

const INK = "#111111";
/** Strichstärke im Koordinatensystem der Unterschrift (CSS-Pixel bei Originalgröße). */
const LINE_WIDTH = 2.6;
/** Punkte, die näher als dieser Abstand liegen, werden zusammengefasst (weniger Daten, ruhigere Linie). */
const MIN_DISTANCE = 0.8;
/** Vorschaubild in doppelter Auflösung – Vektor-Striche sind für das PDF maßgeblich. */
const PREVIEW_SCALE = 2;

type Space = { width: number; height: number };
type View = { scale: number; offsetX: number; offsetY: number };

/** Zeichnet Striche mit weichen Kurven (Quadratic-Curve durch die Mittelpunkte). */
function drawStrokes(ctx: CanvasRenderingContext2D, strokes: SignatureStroke[], view: View) {
  ctx.strokeStyle = INK;
  ctx.fillStyle = INK;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(1.4, LINE_WIDTH * view.scale);
  const X = (v: number) => view.offsetX + v * view.scale;
  const Y = (v: number) => view.offsetY + v * view.scale;
  for (const s of strokes) {
    if (s.length < 4) {
      ctx.beginPath();
      ctx.arc(X(s[0]), Y(s[1]), ctx.lineWidth / 2, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    ctx.beginPath();
    ctx.moveTo(X(s[0]), Y(s[1]));
    for (let i = 2; i + 3 < s.length; i += 2) {
      const mx = (s[i] + s[i + 2]) / 2;
      const my = (s[i + 1] + s[i + 3]) / 2;
      ctx.quadraticCurveTo(X(s[i]), Y(s[i + 1]), X(mx), Y(my));
    }
    ctx.lineTo(X(s[s.length - 2]), Y(s[s.length - 1]));
    ctx.stroke();
  }
}

/**
 * Unterschriftenfeld für Finger, Stift und Maus (Pointer Events).
 *
 * Die Unterschrift wird als Vektor-Striche in einem festen Koordinatensystem gespeichert
 * (Größe des Feldes beim ersten Strich). Dadurch bleibt sie bei Drehung/Größenänderung des
 * Displays vollständig erhalten, ist auf HiDPI-Displays scharf und wird im PDF als Vektor gezeichnet.
 */
export function SignaturePad({ label, value, onChange, error }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<SignatureStroke[]>([]);
  const space = useRef<Space | null>(null);
  const view = useRef<View>({ scale: 1, offsetX: 0, offsetY: 0 });
  const current = useRef<number[] | null>(null);
  const activePointer = useRef<number | null>(null);
  const lastEmitted = useRef<Signature | null>(null);
  /** Unterschrift aus Version 1 (nur als Bild gespeichert). */
  const legacyImage = useRef<HTMLImageElement | null>(null);
  const [hasInk, setHasInk] = useState(Boolean(value));

  /** Canvas an Anzeigegröße und Pixeldichte anpassen und alles neu zeichnen. */
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const { width, height } = canvas.getBoundingClientRect();
    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const s = space.current ?? { width, height };
    const fit = fitContain(s, { x: 0, y: 0, width, height });
    view.current = { scale: fit.scale, offsetX: fit.offsetX, offsetY: fit.offsetY };
    if (legacyImage.current?.complete) {
      ctx.drawImage(legacyImage.current, fit.offsetX, fit.offsetY, s.width * fit.scale, s.height * fit.scale);
    }
    drawStrokes(ctx, strokes.current, view.current);
  }, []);

  // Unterschrift von außen übernehmen (Laden, Löschen, anderer Bericht) – nicht das eigene Ergebnis.
  useEffect(() => {
    if (value === lastEmitted.current) return;
    lastEmitted.current = value;
    legacyImage.current = null;
    if (value) {
      space.current = { width: value.width, height: value.height };
      strokes.current = hasStrokes(value) ? value.strokes.map((s) => [...s]) : [];
      if (!hasStrokes(value) && value.dataUrl) {
        const img = new Image();
        img.onload = render;
        img.src = value.dataUrl;
        legacyImage.current = img;
      }
    } else {
      space.current = null;
      strokes.current = [];
    }
    setHasInk(Boolean(value));
    render();
  }, [value, render]);

  // Größenänderung (Drehen, Fenster) → aus den Vektoren neu zeichnen, nichts geht verloren.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(() => render());
    observer.observe(canvas);
    // Ältere iOS-Versionen ignorieren touch-action teilweise: Scrollen beim Unterschreiben hart unterbinden.
    const stop = (e: TouchEvent) => e.preventDefault();
    canvas.addEventListener("touchstart", stop, { passive: false });
    canvas.addEventListener("touchmove", stop, { passive: false });
    return () => {
      observer.disconnect();
      canvas.removeEventListener("touchstart", stop);
      canvas.removeEventListener("touchmove", stop);
    };
  }, [render]);

  const toLogical = (canvas: HTMLCanvasElement, clientX: number, clientY: number) => {
    const rect = canvas.getBoundingClientRect();
    const v = view.current;
    return [(clientX - rect.left - v.offsetX) / v.scale, (clientY - rect.top - v.offsetY) / v.scale] as const;
  };

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (activePointer.current !== null) return; // zweiter Finger / Handballen ignorieren
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    const canvas = event.currentTarget;
    canvas.setPointerCapture(event.pointerId);
    activePointer.current = event.pointerId;
    if (!space.current) {
      const { width, height } = canvas.getBoundingClientRect();
      space.current = { width: Math.round(width), height: Math.round(height) };
      render();
    }
    const [x, y] = toLogical(canvas, event.clientX, event.clientY);
    current.current = [x, y];
    const ctx = canvas.getContext("2d");
    if (ctx) drawStrokes(ctx, [[x, y]], view.current);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.pointerId !== activePointer.current || !current.current) return;
    event.preventDefault();
    const canvas = event.currentTarget;
    const ctx = canvas.getContext("2d");
    const points = current.current;
    const events = event.nativeEvent.getCoalescedEvents?.() ?? [];
    for (const e of events.length ? events : [event.nativeEvent]) {
      const [x, y] = toLogical(canvas, e.clientX, e.clientY);
      const px = points[points.length - 2];
      const py = points[points.length - 1];
      if (Math.hypot(x - px, y - py) < MIN_DISTANCE) continue;
      points.push(x, y);
      // Nur das neue Teilstück zeichnen – flüssig auch bei langsamen Unterschriften.
      if (ctx) drawStrokes(ctx, [points.slice(-6)], view.current);
    }
  };

  const emit = () => {
    const s = space.current;
    if (!s) return;
    const out = document.createElement("canvas");
    out.width = Math.round(s.width * PREVIEW_SCALE);
    out.height = Math.round(s.height * PREVIEW_SCALE);
    const ctx = out.getContext("2d");
    if (ctx) drawStrokes(ctx, strokes.current, { scale: PREVIEW_SCALE, offsetX: 0, offsetY: 0 });
    const sig: Signature = {
      dataUrl: out.toDataURL("image/png"),
      width: s.width,
      height: s.height,
      strokes: strokes.current.map((st) => [...st]),
      signedAt: new Date().toISOString(),
    };
    lastEmitted.current = sig;
    setHasInk(true);
    onChange(sig);
  };

  const onPointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.pointerId !== activePointer.current) return;
    activePointer.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const points = current.current;
    current.current = null;
    if (!points) return;
    if (legacyImage.current) {
      // Alte Bild-Unterschrift lässt sich nicht mit Vektoren mischen → neue Unterschrift beginnen.
      legacyImage.current = null;
      strokes.current = [];
    }
    strokes.current.push(roundStroke(points));
    render();
    emit();
  };

  const clear = () => {
    strokes.current = [];
    space.current = null;
    legacyImage.current = null;
    current.current = null;
    lastEmitted.current = null;
    setHasInk(false);
    render();
    onChange(null);
  };

  return (
    <div>
      <p className="mb-1.5 text-[15px] font-semibold text-ink">{label}</p>
      <div
        className={`relative overflow-hidden rounded-xl border-2 border-dashed bg-white overscroll-contain ${
          error ? "border-danger" : hasInk ? "border-line" : "border-gold/60"
        }`}
      >
        <canvas
          ref={canvasRef}
          aria-label={`${label} – mit Finger oder Stift unterschreiben`}
          role="img"
          className="block h-44 w-full cursor-crosshair touch-none select-none sm:h-48"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onContextMenu={(e) => e.preventDefault()}
        />
        <div className="pointer-events-none absolute inset-x-5 bottom-9 flex items-end gap-2 text-muted/70">
          <span className="text-xl leading-none">×</span>
          <span className="mb-1 h-px flex-1 bg-line" />
        </div>
        {!hasInk && (
          <p className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-[15px] text-muted">
            Hier mit dem Finger unterschreiben
          </p>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="min-w-0 text-sm text-muted">{hasInk ? "Erfasst" : "Finger oder Stift"}</p>
        <Button
          variant="secondary"
          onClick={clear}
          disabled={!hasInk}
          icon={<TrashIcon />}
          className="shrink-0 whitespace-nowrap text-danger"
        >
          Unterschrift löschen
        </Button>
      </div>
      {error && <p className="mt-1.5 text-sm font-medium text-danger">{error}</p>}
    </div>
  );
}
