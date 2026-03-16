type WidgetMarkProps = {
  className?: string;
  iconClassName?: string;
};

export function WidgetMark({
  className = "",
  iconClassName = "w-4 h-4",
}: WidgetMarkProps) {
  return (
    <div
      className={`rounded-full flex items-center justify-center overflow-hidden ${className}`}
      style={{
        backgroundColor: "var(--widget-primary)",
        color: "var(--widget-primary-fg)",
      }}
      aria-hidden="true"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={iconClassName}
      >
        <path d="M5.636 5.636a9 9 0 1 0 12.728 12.728a9 9 0 0 0 -12.728 -12.728" />
        <path d="M16.243 7.757a6 6 0 0 0 -8.486 0" />
      </svg>
    </div>
  );
}
