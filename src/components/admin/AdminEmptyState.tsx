interface AdminEmptyStateProps {
  title: string;
  description: string;
}

export function AdminEmptyState({
  title,
  description,
}: AdminEmptyStateProps) {
  return (
    <div className="flex min-h-60 flex-col items-center justify-center px-6 py-12 text-center">
      <p className="text-sm font-medium text-neutral-100">{title}</p>
      <p className="mt-2 max-w-md text-sm leading-6 text-neutral-500">
        {description}
      </p>
    </div>
  );
}
