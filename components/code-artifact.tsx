import { highlight, type Tone } from "@/lib/highlight";

/**
 * The artefact that a tile is built around.
 *
 * ANTI_SLOP.md §1: Apple's system is a frame for product photography, and this
 * site has no products. Strip the photography out and what is left is a centred
 * headline over two rounded buttons — slop pattern #9, exactly. So the code takes
 * the product's place: it sits on the surface, it carries the one shadow the
 * system allows, and it is given the same room a phone would get.
 *
 * That shadow is load-bearing. DESIGN.md permits exactly one drop-shadow in the
 * whole system and reserves it for an object resting on a surface. This is that
 * object. Nothing else on the site may use it.
 */

type Props = {
  code: string;
  lang: string;
  /** Shown in the frame's title strip. A real filename or the command's context. */
  filename?: string;
  /** Which tile surface this sits on. Picks the matching low-chroma theme. */
  tone?: Tone;
};

export async function CodeArtifact({
  code,
  lang,
  filename,
  tone = "light",
}: Props) {
  const html = await highlight(code, lang, tone);

  const surface =
    tone === "light"
      ? "bg-canvas border-hairline"
      : "bg-surface-tile-3 border-surface-tile-2";
  const strip =
    tone === "light"
      ? "border-hairline text-ink-muted-80"
      : "border-surface-tile-2 text-body-muted";

  return (
    <figure
      className={`shadow-artifact overflow-hidden rounded-lg border ${surface}`}
    >
      {filename ? (
        <figcaption
          className={`text-caption border-b px-lg py-sm font-mono ${strip}`}
        >
          {filename}
        </figcaption>
      ) : null}
      <div
        className="text-caption overflow-x-auto px-lg py-lg [&_pre]:!bg-transparent [&_pre]:font-mono [&_code]:font-mono"
        // Shiki output. The input is authored by the single admin user, not by
        // the public, and Shiki escapes the source before tokenising it.
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </figure>
  );
}
