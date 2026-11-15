/** Source: public/brand/baromi-lockup.png (1704 x 628). */
const RATIO = 1704 / 628;

/**
 * Baromi lockup at a fixed height. Width is derived from the file's ratio and the
 * image never stretches, even inside a flex column that would otherwise fill it.
 */
export function Logo({ height = 30, className }: { height?: number; className?: string }) {
  const width = Math.round(height * RATIO);
  return (
    <img
      src="/brand/baromi-lockup.png"
      alt="바로미"
      width={width}
      height={height}
      className={className}
      style={{ width, height, maxWidth: "none", flex: "none", alignSelf: "flex-start", objectFit: "contain" }}
    />
  );
}
