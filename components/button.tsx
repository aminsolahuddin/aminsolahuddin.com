import type { ComponentProps } from "react";
import { Link } from "@/i18n/navigation";

/**
 * The two button grammars from DESIGN.md. There are only two, and adding a third
 * is how a design system starts to blur.
 *
 *   pill     Action Blue capsule. Every "click me" on the site. The full-pill
 *            radius IS the action signal.
 *   ghost    Same capsule, transparent, blue hairline. Only ever the second CTA
 *            sitting next to a pill.
 *   utility  Compact dark rectangle at radius 8. Nav actions only.
 *
 * No hover state, deliberately. DESIGN.md's iteration guide is explicit: default
 * and active/pressed only. The press is `scale(0.95)`, which is the single
 * system-wide micro-interaction.
 */

type Variant = "pill" | "ghost" | "utility";

const VARIANTS: Record<Variant, string> = {
  pill: "bg-primary text-on-primary text-body rounded-pill px-button-primary-x py-button-primary-y",
  ghost:
    "bg-transparent text-primary text-body rounded-pill border border-primary px-button-primary-x py-button-primary-y",
  utility:
    "bg-ink text-on-dark text-button-utility rounded-sm px-button-dark-utility-x py-button-dark-utility-y",
};

const BASE =
  "inline-flex items-center justify-center transition-transform duration-150 active:scale-95 motion-reduce:active:scale-100";

type ButtonProps = { variant?: Variant } & ComponentProps<"button">;

export function Button({ variant = "pill", className = "", ...rest }: ButtonProps) {
  return <button className={`${BASE} ${VARIANTS[variant]} ${className}`} {...rest} />;
}

type ButtonLinkProps = { variant?: Variant } & ComponentProps<typeof Link>;

/** Locale-aware. Always use this over a raw <a> for internal links. */
export function ButtonLink({
  variant = "pill",
  className = "",
  ...rest
}: ButtonLinkProps) {
  return <Link className={`${BASE} ${VARIANTS[variant]} ${className}`} {...rest} />;
}

type ExternalButtonLinkProps = {
  variant?: Variant;
  /** BUILD_PLAN.md §9: affiliate links carry rel="sponsored", automatically. */
  isAffiliate?: boolean;
} & Omit<ComponentProps<"a">, "rel">;

export function ExternalButtonLink({
  variant = "pill",
  isAffiliate = false,
  className = "",
  ...rest
}: ExternalButtonLinkProps) {
  return (
    <a
      className={`${BASE} ${VARIANTS[variant]} ${className}`}
      target="_blank"
      rel={isAffiliate ? "sponsored noopener noreferrer" : "noopener noreferrer"}
      {...rest}
    />
  );
}
