import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vendra",
  description: "Procurement & Vendor Operations Console",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-page-bg text-ink">{children}</body>
    </html>
  );
}
