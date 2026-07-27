import type { ReactNode } from "react";

/**
 * A full-bleed section. DESIGN.md stacks these edge to edge with no gap and no
 * border — the change in surface colour IS the divider. That is why `rounded` is
 * `none` here and why there is no border prop: adding either would put chrome
 * back into a system whose whole argument is that chrome should disappear.
 *
 * ANTI_SLOP.md §3 adds one rule DESIGN.md does not: a tile ships only if it has a
 * real artefact in it. A headline and two buttons alone is not a section, it is
 * the thing every generated landing page already looks like. The `artifact` slot
 * is required rather than optional to make that structural.
 */

type Surface = "canvas" | "parchment" | "dark";

const SURFACES: Record<Surface, string> = {
  canvas: "bg-canvas text-ink",
  parchment: "bg-canvas-parchment text-ink",
  dark: "bg-surface-tile-1 text-on-dark",
};

type Props = {
  surface?: Surface;
  eyebrow?: string;
  headline: string;
  lead?: string;
  actions?: ReactNode;
  /** Required by ANTI_SLOP.md §3. There is no empty-hero variant on purpose. */
  artifact: ReactNode;
};

export function Tile({
  surface = "canvas",
  eyebrow,
  headline,
  lead,
  actions,
  artifact,
}: Props) {
  const muted = surface === "dark" ? "text-body-muted" : "text-ink-muted-80";

  return (
    <section className={`px-lg py-section ${SURFACES[surface]}`}>
      <div className="mx-auto flex max-w-5xl flex-col items-center text-center">
        {eyebrow ? (
          <p className={`text-caption-strong mb-xs ${muted}`}>{eyebrow}</p>
        ) : null}

        <h2 className="text-display-lg font-display max-w-3xl text-balance">
          {headline}
        </h2>

        {lead ? (
          <p className={`text-lead mt-md max-w-2xl text-pretty ${muted}`}>{lead}</p>
        ) : null}

        {actions ? (
          <div className="mt-lg flex flex-wrap items-center justify-center gap-sm">
            {actions}
          </div>
        ) : null}

        <div className="mt-xxl w-full text-left">{artifact}</div>
      </div>
    </section>
  );
}
