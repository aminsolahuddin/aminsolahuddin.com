import { getTranslations, setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { Tile } from "@/components/tile";
import { CodeArtifact } from "@/components/code-artifact";
import { ButtonLink } from "@/components/button";

export default async function HomePage(props: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations("home");

  /**
   * Phase 0 has no database yet, so this is the shape a real pack will take
   * rather than the packs themselves. It is deliberately a genuine snippet: the
   * point of ANTI_SLOP.md §1 is that the artefact has to be real, and a page that
   * demonstrates the layout with lorem ipsum would be demonstrating the wrong
   * thing.
   */
  const sample = `// The whole trick is that the slug never changes.
// Rename inserts a redirect row; the old URL keeps resolving forever.

export async function resolveSlug(slug: string) {
  const pack = await db.query.resourcePack.findFirst({
    where: eq(resourcePack.slug, slug),
  });
  if (pack) return pack;

  // Spoken aloud in a video two years ago? Still works.
  const moved = await db.query.slugRedirect.findFirst({
    where: eq(slugRedirect.oldSlug, slug),
  });
  return moved ? getPackById(moved.packId) : null;
}`;

  return (
    <>
      <Tile
        surface="parchment"
        headline={t("headline")}
        lead={t("lead")}
        actions={
          <ButtonLink href="/resources" variant="pill">
            {t("browseResources")}
          </ButtonLink>
        }
        artifact={
          <CodeArtifact
            code={sample}
            lang="typescript"
            filename="lib/resolve-slug.ts"
            tone="light"
          />
        }
      />

      <Tile
        surface="dark"
        eyebrow={t("latestHeading")}
        headline={t("reposHeading")}
        lead={t("reposLead")}
        actions={
          <ButtonLink href="/repos" variant="pill">
            {t("browseResources")}
          </ButtonLink>
        }
        artifact={
          <CodeArtifact
            code={`$ pnpm check:slop

  components/  no hardcoded hex, px, or font-family
  tokens.css   0 gradient declarations
  messages/    0 emoji in UI strings

  clean`}
            lang="bash"
            filename="terminal"
            tone="dark"
          />
        }
      />
    </>
  );
}
