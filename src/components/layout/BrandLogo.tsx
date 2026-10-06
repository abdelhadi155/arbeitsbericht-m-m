/* eslint-disable @next/next/no-img-element -- kleines statisches Logo, kein Bildoptimierer nötig (auch offline) */
import { companyConfig } from "@/config/company-config";

export function BrandLogo({ size = 44, className = "" }: { size?: number; className?: string }) {
  return (
    <img
      src={companyConfig.logo.src}
      alt={companyConfig.logo.alt}
      width={size}
      height={size}
      className={`shrink-0 rounded-full ${className}`}
    />
  );
}
