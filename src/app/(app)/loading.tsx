import { DashboardSkeleton } from "@/components/PageSkeleton";

// Fallback for every page under the app shell that has no closer loading.tsx
// of its own (primarily the dashboard). Its presence is also what lets
// Next.js prefetch dynamic routes up to this boundary, so a click paints this
// skeleton instantly instead of waiting on the server.
export default function Loading() {
  return <DashboardSkeleton />;
}
