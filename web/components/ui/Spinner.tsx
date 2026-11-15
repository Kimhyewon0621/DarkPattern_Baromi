export function Spinner({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg className="spin" width={size} height={size} viewBox="0 0 18 18" aria-hidden="true">
      <circle cx="9" cy="9" r="7" fill="none" stroke={color} strokeOpacity="0.3" strokeWidth="2" />
      <path d="M9 2 A7 7 0 0 1 16 9" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
