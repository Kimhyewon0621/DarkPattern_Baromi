/** Symbol source: public/brand/baromi-symbol.png (584 x 612). */
const SYMBOL_RATIO = 584 / 612;

/**
 * Baromi logo as on the approved brand board: the gradient "B" symbol next to a
 * live, heavy navy "바로미" wordmark, both centered on one line. Live text stays
 * sharp at any size and has no empty band under it like a flattened PNG lockup.
 * `size` is the symbol height in px; the wordmark scales with it.
 */
export function Logo({ size = 30, className }: { size?: number; className?: string }) {
  const symbolWidth = Math.round(size * SYMBOL_RATIO);
  return (
    <span
      className={className ? `logo ${className}` : "logo"}
      style={{ gap: Math.round(size * 0.28) }}
    >
      <img
        src="/brand/baromi-symbol.png"
        alt=""
        aria-hidden="true"
        width={symbolWidth}
        height={size}
        style={{ width: symbolWidth, height: size }}
      />
      <span className="logo__word" style={{ fontSize: Math.round(size * 0.86) }}>바로미</span>
    </span>
  );
}
