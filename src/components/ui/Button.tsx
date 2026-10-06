import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "gold";
type Size = "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors select-none disabled:opacity-50 disabled:pointer-events-none [&>svg]:shrink-0";

const variants: Record<Variant, string> = {
  primary: "bg-ink text-white hover:bg-ink-soft active:bg-black",
  secondary: "bg-white text-ink border border-line hover:border-ink-soft active:bg-paper",
  ghost: "text-ink hover:bg-black/5 active:bg-black/10",
  danger: "bg-danger text-white hover:bg-red-800",
  gold: "bg-gold text-ink hover:bg-gold/90 active:bg-gold-dark active:text-white",
};

const sizes: Record<Size, string> = {
  md: "min-h-11 px-4 text-[15px]",
  lg: "min-h-14 px-6 text-base",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", extra = "") {
  return `${base} ${variants[variant]} ${sizes[size]} ${extra}`;
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
}

export function Button({ variant = "primary", size = "md", icon, className = "", children, ...props }: ButtonProps) {
  return (
    <button type="button" className={buttonClass(variant, size, className)} {...props}>
      {icon}
      {children}
    </button>
  );
}

interface LinkButtonProps extends ComponentProps<typeof Link> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
}

export function LinkButton({ variant = "primary", size = "md", icon, className = "", children, ...props }: LinkButtonProps) {
  return (
    <Link className={buttonClass(variant, size, className)} {...props}>
      {icon}
      {children}
    </Link>
  );
}
