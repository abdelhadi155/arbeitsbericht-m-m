"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { ReportView } from "@/components/report/ReportView";
import { ToastProvider } from "@/components/ui/Toast";

function ViewWithParams() {
  const id = useSearchParams().get("id");
  return <ReportView key={id ?? ""} id={id} />;
}

export default function ViewPage() {
  return (
    <ToastProvider>
      <Suspense fallback={<p className="p-8 text-center text-muted">Wird geladen …</p>}>
        <ViewWithParams />
      </Suspense>
    </ToastProvider>
  );
}
