/* Apart from ui.tsx so client code can use it without the protection catalogue that ui.tsx imports. */

/** A placeholder while something loads; announced to screen readers once. */
export function Loading({ height, label = "Loading", radius, style }: { height: number; label?: string; radius?: number; style?: React.CSSProperties }) {
  return <div className="skeleton" role="status" aria-label={label} style={{ height, borderRadius: radius, ...style }} />;
}
