import type { Metadata, Viewport } from "next";

import { ServiceWorkerRegister } from "@/components/pwa/ServiceWorkerRegister";
import { companyConfig } from "@/config/company-config";

import "./globals.css";

export const metadata: Metadata = {
  title: { default: `Arbeitsberichte – ${companyConfig.name}`, template: `%s – ${companyConfig.shortName}` },
  description: `Digitale Arbeitsberichte für ${companyConfig.name}`,
  applicationName: companyConfig.shortName,
  appleWebApp: { capable: true, title: "Arbeitsbericht", statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: companyConfig.brand.primary,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className="min-h-dvh antialiased">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
