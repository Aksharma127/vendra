import { HTMLAttributes } from "react";

export function Panel({ className = "", children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`bg-surface border border-line rounded shadow-[0_1px_2px_rgba(21,24,33,0.04),0_1px_8px_-2px_rgba(21,24,33,0.06)] panel-interactive animate-fade-in-up ${className}`}
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
