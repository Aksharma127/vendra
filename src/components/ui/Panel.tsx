import { HTMLAttributes } from "react";

export function Panel({ className = "", children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`bg-surface border border-line rounded shadow-card panel-interactive animate-fade-in-up ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

export function PanelHeader({ className = "", children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`px-5 py-4 border-b border-line flex items-center justify-between ${className}`} {...rest}>
      {children}
    </div>
  );
}
