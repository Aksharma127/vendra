import { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger";
}

export function Button({ variant = "primary", className = "", ...rest }: ButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-1.5 rounded px-3.5 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
  const variants: Record<string, string> = {
    primary: "bg-accent text-white hover:bg-accent-hover",
    secondary: "border border-line bg-surface text-ink hover:bg-page-bg",
    danger: "border border-danger text-danger hover:bg-danger hover:text-white",
  };
  return <button className={`${base} ${variants[variant]} ${className}`} {...rest} />;
}
