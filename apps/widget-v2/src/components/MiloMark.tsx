type MiloMarkProps = {
  className?: string;
};

export function MiloMark({ className = "" }: MiloMarkProps) {
  return (
    <span
      aria-hidden="true"
      className={`block shrink-0 overflow-hidden rounded-full ${className}`}
      style={{
        color: "var(--widget-milo-color, var(--widget-primary))",
        background: "color-mix(in srgb, var(--widget-bg) 94%, transparent)",
        boxShadow: "inset 0 0 0 1px var(--widget-border)",
      }}
    >
      <svg viewBox="0 0 160 160" className="block h-full w-full" fill="none">
        <defs>
          <clipPath id="milo-widget-orbit-clip">
            <circle cx="80" cy="80" r="68" />
          </clipPath>
        </defs>
        <circle cx="80" cy="80" r="68" fill="currentColor" opacity="0.08" />
        <g
          clipPath="url(#milo-widget-orbit-clip)"
          stroke="currentColor"
          strokeWidth="9"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path opacity="0.26" d="M8 29 C39 16 57 30 77 44 C98 59 120 45 152 24" />
          <path opacity="0.32" d="M5 38 C36 23 56 36 76 50 C98 65 121 51 155 30" />
          <path opacity="0.38" d="M3 48 C34 30 55 41 75 56 C98 73 123 59 157 36" />
          <path opacity="0.46" d="M1 58 C31 39 53 47 74 62 C98 80 125 68 159 43" />
          <path opacity="0.56" d="M0 68 C29 49 51 53 73 68 C98 86 127 77 160 51" />
          <path opacity="0.72" d="M-1 78 C26 61 49 60 72 74 C98 91 129 87 161 61" />
          <path opacity="0.92" d="M-2 88 C23 74 47 68 72 80 C99 94 132 98 162 73" />
          <path opacity="0.82" d="M-1 98 C22 89 46 78 72 86 C101 96 134 109 161 86" />
          <path opacity="0.66" d="M0 108 C23 103 47 89 73 92 C102 96 135 119 160 100" />
          <path opacity="0.54" d="M2 118 C26 117 49 101 75 98 C104 95 134 128 158 114" />
          <path opacity="0.44" d="M5 128 C31 132 53 113 77 105 C105 96 132 136 155 128" />
          <path opacity="0.34" d="M10 138 C37 146 58 124 79 113 C104 100 128 142 150 140" />
        </g>
        <circle
          cx="80"
          cy="80"
          r="68"
          stroke="currentColor"
          strokeWidth="5"
          opacity="0.2"
        />
      </svg>
    </span>
  );
}
