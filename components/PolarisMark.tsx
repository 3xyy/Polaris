// The Polaris mark: a four-point north star with a soft glow. Used in the nav and hero.
export function PolarisMark({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="pm-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#f7c95a" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#f7c95a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="24" cy="24" r="22" fill="url(#pm-glow)" opacity="0.55" />
      <path
        d="M24 2 L27.5 20.5 L46 24 L27.5 27.5 L24 46 L20.5 27.5 L2 24 L20.5 20.5 Z"
        fill="#f7c95a"
      />
      <circle cx="24" cy="24" r="2.6" fill="#fff7e6" />
    </svg>
  );
}
