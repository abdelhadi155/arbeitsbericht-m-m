import { ReportList } from "@/components/report/ReportList";
import { ToastProvider } from "@/components/ui/Toast";

export default function HomePage() {
  return (
    <ToastProvider>
      <ReportList />
    </ToastProvider>
  );
}
