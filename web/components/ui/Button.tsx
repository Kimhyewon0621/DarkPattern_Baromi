import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { Icon, type IconName } from "./Icon";
import { Spinner } from "./Spinner";

type Variant = "primary" | "secondary" | "tertiary" | "danger" | "brand" | "inverse";
type Size = "sm" | "md" | "lg";

function classes(variant: Variant, size: Size, block?: boolean, extra?: string) {
  return ["btn", `btn--${variant}`, `btn--${size}`, block ? "btn--block" : "", extra ?? ""].filter(Boolean).join(" ");
}

type Common = { variant?: Variant; size?: Size; icon?: IconName; block?: boolean; children: ReactNode };

export function Button({
  variant = "primary", size = "md", icon, block, loading, loadingText, children, className, ...rest
}: Common & Omit<ComponentProps<"button">, "children"> & { loading?: boolean; loadingText?: string }) {
  return (
    <button
      type="button"
      {...rest}
      className={classes(variant, size, block, className)}
      disabled={rest.disabled || loading}
      aria-busy={loading || undefined}
      style={loading ? { background: variant === "primary" ? "var(--ink)" : undefined, color: variant === "primary" ? "#fff" : undefined, opacity: 0.85, ...rest.style } : rest.style}
    >
      {loading ? <Spinner /> : icon ? <Icon name={icon} size={16} /> : null}
      {loading && loadingText ? loadingText : children}
    </button>
  );
}

export function ButtonLink({
  href, variant = "primary", size = "md", icon, block, children, className, download, external,
}: Common & { href: string; className?: string; download?: string | boolean; external?: boolean }) {
  const cls = classes(variant, size, block, className);
  const inner = <>{icon ? <Icon name={icon} size={16} /> : null}{children}</>;
  if (download || external) {
    return <a href={href} className={cls} download={download === true ? "" : download || undefined}>{inner}</a>;
  }
  return <Link href={href} className={cls}>{inner}</Link>;
}
