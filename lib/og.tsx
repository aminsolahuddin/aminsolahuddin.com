import type { ReactElement } from "react";

/**
 * The shared look for every generated share card. BUILD_PLAN.md §9.
 *
 * This is the one place in the codebase that holds raw hex and raw px, and it is
 * a deliberate exception to CLAUDE.md rule 1 rather than a lapse. Satori — what
 * next/og renders with — resolves no stylesheet and knows nothing about Tailwind
 * or CSS custom properties, so a token here would render as nothing at all.
 *
 * Every value below is copied from DESIGN.md and must be changed there first.
 * The comment on each one names the token it mirrors, so a future change to the
 * palette has somewhere obvious to look.
 */

/** The size every scraper expects. Anything else gets cropped unpredictably. */
export const OG_SIZE = { width: 1200, height: 630 } as const;

const INK = "#1d1d1f"; // colors.ink
const CANVAS = "#ffffff"; // colors.canvas
const PARCHMENT = "#f5f5f7"; // colors.canvas-parchment
const MUTED = "#333333"; // colors.ink-muted-48 is too light at this size
const PRIMARY = "#0066cc"; // colors.primary

/**
 * The display face from DESIGN.md, with the same system fallbacks.
 *
 * No font file is loaded and fetched. Satori falls back to what the renderer has,
 * and a card that renders in a near-enough grotesque beats one that fails to
 * render because a font request timed out on a cold serverless invocation.
 */
const DISPLAY = "SF Pro Display, system-ui, -apple-system, sans-serif";

export function ogCard({
  title,
  kicker,
  meta,
}: {
  title: string;
  kicker: string;
  meta?: string;
}): ReactElement {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: CANVAS,
        // A single flat accent band. DESIGN.md's argument is that there is
        // exactly one accent colour, so the card does not get a gradient.
        borderTop: `16px solid ${PRIMARY}`,
        padding: "72px 80px",
        fontFamily: DISPLAY,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div
          style={{
            fontSize: 28,
            color: MUTED,
            letterSpacing: 0.2,
            marginBottom: 28,
          }}
        >
          {kicker}
        </div>

        <div
          style={{
            fontSize: 64,
            fontWeight: 600,
            color: INK,
            lineHeight: 1.1,
            letterSpacing: -0.5,
            /**
             * Clamped rather than left to overflow. Satori does not scroll and
             * does not shrink text to fit, so a long title without this simply
             * runs off the bottom of the image and the card ships truncated in a
             * way nobody sees until it is already on someone's timeline.
             */
            display: "flex",
            maxHeight: 300,
            overflow: "hidden",
          }}
        >
          {title}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: 24,
          color: MUTED,
        }}
      >
        {/* Never translated, in any locale. CLAUDE.md. */}
        <div style={{ display: "flex" }}>aminsolahuddin.com</div>
        {meta ? (
          <div
            style={{
              display: "flex",
              background: PARCHMENT,
              borderRadius: 999,
              padding: "8px 20px",
              fontSize: 20,
            }}
          >
            {meta}
          </div>
        ) : null}
      </div>
    </div>
  );
}
