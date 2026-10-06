"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { ReportEditor } from "@/components/report/ReportEditor";
import { ToastProvider } from "@/components/ui/Toast";

function EditorWithParams() {
  const params = useSearchParams();
  // ID nur einmal lesen: Neue Berichte setzen nach dem ersten Speichern ?id=…,
  // ohne dass der Editor dadurch neu lädt.
  const [id] = useState(() => params.get("id"));
  return <ReportEditor id={id} />;
}

export default function EditorPage() {
  return (
    <ToastProvider>
      <Suspense fallback={<p className="p-8 text-center text-muted">Wird geladen …</p>}>
        <EditorWithParams />
      </Suspense>
    </ToastProvider>
  );
}
