import type { MetadataRoute } from "next";

import { companyConfig } from "@/config/company-config";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `Arbeitsberichte – ${companyConfig.name}`,
    short_name: "Arbeitsbericht",
    description: `Digitale Arbeitsberichte für ${companyConfig.name}`,
    lang: "de",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#f6f5f2",
    theme_color: companyConfig.brand.primary,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
