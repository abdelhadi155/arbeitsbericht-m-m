"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { Signature } from "@/lib/report/types";

import { Button } from "../ui/Button";
import { TrashIcon } from "../ui/icons";

interface SignaturePadProps {
  label: string;
  value: Signature | null;
  onChange: (value: Signature | null) => void;
  error?: string;
}

const STROKE = "#111111";
const EXPORT_MAX_WIDTH = 900;

/** Unterschriftenfeld für Finger, Stift und Maus (Pointer Events). */
export function SignaturePad({ label, value, onChange, error }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const points = useRef<{ x: number; y: number }[]>([]);
  const lastExported = useRef<string | null>(null);
  const [hasInk, setHasInk] = useState(Boolean(value));
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const context = () => canvasRef.current?.getContext("2d") ?? null;

  /** Canvas an Anzeigegröße und Pixeldichte anpassen und vorhandene Unterschrift zeichnen. */
  const setup = useCallback((sig: Signature | null) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const { width, height } = canvas.getBoundingClientRect();
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    if (sig) {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(width / sig.width, height / sig.height);
        const w = sig.width * scale;
        const h = sig.height * scale;
        ctx.drawImage(img, (width - w) / 2, (height - h) / 2, w, h);
      };
      img.src = sig.dataUrl;
    }
  }, []);

  // Neu zeichnen, wenn die Unterschrift von außen kommt (Laden, Löschen) – nicht nach eigenem Export.
  useEffect(() => {
    if (value?.dataUrl === lastExported.current && value) return;
    lastExported.current = value?.dataUrl ?? null;
    setHasInk(Boolean(value));
    setup(value);
  }, [value, setup]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let lastWidth = canvas.getBoundingClientRect().width;
    const observer = new ResizeObserver(() => {
      const width = canvas.getBoundingClientRect().width;
      if (Math.abs(width - lastWidth) < 1) return;
      lastWidth = width;
      setup(valueRef.current);
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [setup]);

  const position = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drawing.current = true;
    const p = position(event);
    points.current = [p];
    const ctx = context();
    if (!ctx) return;
    ctx.fillStyle = STROKE;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 1.3, 0, Math.PI * 2);
    ctx.fill();
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    event.preventDefault();
    const ctx = context();
    if (!ctx) return;
    const events = event.nativeEvent.getCoalescedEvents?.() ?? [event.nativeEvent];
    const rect = event.currentTarget.getBoundingClientRect();
    for (const e of events) {
      const p = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      const prev = points.current[points.current.length - 1];
      const pressure = e.pointerType === "pen" && e.pressure > 0 ? e.pressure : 0.5;
      ctx.strokeStyle = STROKE;
      ctx.lineWidth = 1.6 + pressure * 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      const mid = { x: (prev.x + p.x) / 2, y: (prev.y + p.y) / 2 };
      ctx.quadraticCurveTo(prev.x, prev.y, mid.x, mid.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      points.current.push(p);
    }
  };

  const exportSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const scale = Math.min(1, EXPORT_MAX_WIDTH / canvas.width);
    const out = document.createElement("canvas");
    out.width = Math.round(canvas.width * scale);
    out.height = Math.round(canvas.height * scale);
    out.getContext("2d")?.drawImage(canvas, 0, 0, out.width, out.height);
    const dataUrl = out.toDataURL("image/png");
    lastExported.current = dataUrl;
    setHasInk(true);
    onChange({ dataUrl, width: out.width, height: out.height, signedAt: new Date().toISOString() });
  };

  const onPointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    drawing.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    exportSignature();
  };

  const clear = () => {
    lastExported.current = null;
    setHasInk(false);
    setup(null);
    onChange(null);
  };

  return (
    <div>
      <p className="mb-1.5 text-[15px] font-semibold text-ink">{label}</p>
      <div
        className={`relative overflow-hidden rounded-xl border-2 border-dashed bg-white ${
          error ? "border-danger" : hasInk ? "border-line" : "border-gold/60"
        }`}
      >
        <canvas
          ref={canvasRef}
          aria-label={`${label} – mit Finger oder Stift unterschreiben`}
          role="img"
          className="block h-44 w-full cursor-crosshair touch-none sm:h-48"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
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
        <Button variant="secondary" onClick={clear} disabled={!hasInk} icon={<TrashIcon />} className="shrink-0 whitespace-nowrap text-danger">
          Unterschrift löschen
        </Button>
      </div>
      {error && <p className="mt-1.5 text-sm font-medium text-danger">{error}</p>}
    </div>
  );
}
