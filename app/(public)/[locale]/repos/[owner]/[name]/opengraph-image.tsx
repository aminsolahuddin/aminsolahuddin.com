import { ImageResponse } from "next/og";
import { hasLocale } from "next-intl";

import { routing } from "@/i18n/routing";
import { getRepo } from "@/lib/queries/repo-entry";
import { OG_SIZE, ogCard } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Amin Solahuddin";

const STATUS_LABEL = {
  maintained: "Maintained",
  slowing: "Slowing down",
  archived: "Archived",
  superseded: "Superseded",
} as const;

export default async function Image({
  params,
}: {
  params: { locale: string; owner: string; name: string };
}) {
  const locale = hasLocale(routing.locales, params.locale)
    ? params.locale
    : routing.defaultLocale;

  const repo = await getRepo(params.owner, params.name, locale);

  return new ImageResponse(
    ogCard({
      // The repo's own name, never translated — it is not on the i18n table.
      title: repo ? `${repo.owner}/${repo.name}` : "Amin Solahuddin",
      kicker: repo?.oneLiner ?? "Repos",
      /**
       * The status rides on the card itself, so a link to an archived repo says
       * so in the preview rather than only after the click. That is rule 4
       * applied to the one surface where a reader decides whether to click at
       * all — a share card is often the whole thing anyone reads.
       */
      ...(repo && repo.status !== "maintained"
        ? { meta: STATUS_LABEL[repo.status] }
        : {}),
    }),
    size,
  );
}
