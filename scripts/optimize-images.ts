import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

/**
 * Static images: EXIF stripped, resized, and written as WebP and AVIF.
 *
 * BUILD_PLAN.md §6 describes this pipeline for uploaded media, which is deferred
 * until R2 exists. This is the same three requirements applied to the handful of
 * files that are not uploaded at all — a portrait, a certificate — and belong in
 * the repository rather than in object storage.
 *
 * Three things it does, in the order they matter:
 *
 * 1. Strips metadata. A phone photo carries GPS. §6 calls this out specifically
 *    ("removes GPS from phone screenshots") and it is the one step that cannot
 *    be added afterwards: once the original is published, it is published.
 * 2. Resizes. A 4000px file displayed 400px wide wastes nine tenths of its bytes
 *    no matter how well it is compressed. This is where the savings actually are.
 * 3. Re-encodes to WebP and AVIF, which next/image serves in preference order.
 *
 * Certificates are treated differently from photographs, and the reason is text.
 * Lossy compression spends its error budget on fine high-contrast detail, which
 * is precisely what letterforms are — a photo at quality 80 looks identical to
 * the original, a page of text at quality 80 shows fringing around the strokes.
 * So documents get a higher quality and a larger long edge, because someone will
 * want to read them.
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = join(ROOT, "assets", "originals");
const OUTPUT = join(ROOT, "public", "images");

const READABLE = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif", ".tif", ".tiff"]);

interface Profile {
  /** Longest edge in pixels. Nothing is ever enlarged. */
  maxEdge: number;
  webpQuality: number;
  avifQuality: number;
}

/**
 * Photographs. 1600px covers a portrait rendered at up to 800 CSS pixels on a
 * 2x display, which is larger than this layout ever shows one.
 */
const PHOTO: Profile = { maxEdge: 1600, webpQuality: 82, avifQuality: 62 };

/** Documents. Bigger and cleaner, because the point of one is to be read. */
const DOCUMENT: Profile = { maxEdge: 2400, webpQuality: 92, avifQuality: 80 };

function walk(dir: string): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }

  return entries.flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return READABLE.has(extname(entry).toLowerCase()) ? [full] : [];
  });
}

function kb(bytes: number): string {
  return `${Math.round(bytes / 1024).toLocaleString("en")} KB`;
}

async function main() {
  const files = walk(SOURCE);

  if (files.length === 0) {
    console.log(`Nothing in ${relative(ROOT, SOURCE)}. Drop originals there and run again.`);
    return;
  }

  let readTotal = 0;
  let wroteTotal = 0;

  for (const file of files) {
    const rel = relative(SOURCE, file).split(sep).join("/");
    /**
     * Certificates are recognised by their folder, not by a flag to remember.
     * The rule that decides how a file is compressed should be visible in where
     * the file sits.
     */
    const profile = rel.startsWith("certificates/") ? DOCUMENT : PHOTO;

    const input = readFileSync(file);
    const source = sharp(input, { failOn: "error" });
    const meta = await source.metadata();

    /**
     * Sharp reports the EXIF block, not its contents — GPS tags live inside that
     * buffer and reading them would mean parsing it. Not worth it: the output is
     * stripped either way, and "this file had EXIF" is the fact worth printing.
     */
    const hadExif = Boolean(meta.exif ?? meta.xmp);
    const longEdge = Math.max(meta.width ?? 0, meta.height ?? 0);

    const base = rel.replace(/\.[^.]+$/, "");
    const outDir = join(OUTPUT, dirname(base));
    mkdirSync(outDir, { recursive: true });

    /**
     * `rotate()` with no argument applies the EXIF orientation before the
     * metadata is dropped. Without it, stripping EXIF turns a portrait shot on a
     * phone sideways — the pixels were never rotated, only tagged.
     */
    const pipeline = source
      .rotate()
      .resize({
        width: profile.maxEdge,
        height: profile.maxEdge,
        fit: "inside",
        withoutEnlargement: true,
      });

    const [webp, avif] = await Promise.all([
      pipeline.clone().webp({ quality: profile.webpQuality, effort: 6 }).toBuffer(),
      pipeline.clone().avif({ quality: profile.avifQuality, effort: 6 }).toBuffer(),
    ]);

    writeFileSync(join(OUTPUT, `${base}.webp`), webp);
    writeFileSync(join(OUTPUT, `${base}.avif`), avif);

    const written = await sharp(webp).metadata();

    readTotal += input.length;
    wroteTotal += webp.length + avif.length;

    console.log(
      [
        rel,
        `${longEdge}px ${kb(input.length)}`,
        "→",
        `${Math.max(written.width ?? 0, written.height ?? 0)}px`,
        `webp ${kb(webp.length)} · avif ${kb(avif.length)}`,
        hadExif ? "· metadata stripped" : "· no metadata found",
      ].join(" "),
    );

    if (hadExif) {
      console.log("   EXIF is where GPS lives. Whatever was in it is not in the output.");
    }
  }

  console.log(
    `\n${files.length} file${files.length === 1 ? "" : "s"}: ${kb(readTotal)} in, ${kb(wroteTotal)} out across both formats.`,
  );
  console.log(`Written to ${relative(ROOT, OUTPUT).split(sep).join("/")}/`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
