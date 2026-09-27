export function EmptyState({ message, action }: { message: string; action?: React.ReactNode }) {
  return (
    <div className="py-16 text-center">
      <p className="text-sm text-graphite">{message}</p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
