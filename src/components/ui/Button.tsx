import { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger";
}

export function Button({ variant = "primary", className = "", ...rest }: ButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-1.5 rounded px-3.5 py-2 text-sm font-medium transition-all duration-150 ease-out active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100";
  const variants: Record<string, string> = {
    primary: "bg-accent text-on-accent hover:bg-accent-hover shadow-sm hover:shadow",
    secondary: "border border-line bg-surface text-ink hover:bg-page-bg hover:border-graphite/40",
    danger: "border border-danger text-danger hover:bg-danger hover:text-on-accent",
  };
  return <button className={`${base} ${variants[variant]} ${className}`} {...rest} />;
}
