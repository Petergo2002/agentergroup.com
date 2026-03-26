interface AdminStatusDotProps {
  status: "active" | "inactive";
}

export function AdminStatusDot({ status }: AdminStatusDotProps) {
  return (
    <span
      aria-hidden
      className={`inline-flex h-2.5 w-2.5 rounded-full ${
        status === "active" ? "bg-emerald-400" : "bg-neutral-600"
      }`}
    />
  );
}
