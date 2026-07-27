import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { and, eq, inArray } from "drizzle-orm";
import postgres from "postgres";

import * as schema from "./schema";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

/**
 * Sample rows for local development. BUILD_PLAN.md §0.
 *
 * Three things about this file are deliberate.
 *
 * It connects directly instead of importing getDb(). The application's pool is
 * tuned for serverless — one connection, short timeouts — which is the opposite
 * of what a script that writes a few hundred rows in one pass wants.
 *
 * It is idempotent, keyed on the natural keys that already exist in the schema:
 * category.key, resource_pack.slug, repo_entry (owner, name). Running it twice
 * updates rather than duplicates, and it never deletes a row it did not write.
 * A seed that has to be preceded by "drop the database first" is a seed nobody
 * runs on a database that has anything in it.
 *
 * It writes `en` only. BUILD_PLAN.md §0 asks for sample rows in all three
 * locales, but CLAUDE.md makes user-facing ms and zh-Hans copy a stop-and-ask,
 * and machine-translating it here would be exactly the thing that document
 * forbids. Leaving those rows absent is also the more useful choice for
 * development: it is the real state of the site until Phase 5, so the fallback
 * notice renders while working rather than surprising anyone at the end.
 */

/**
 * Packs, repos and posts are matched on the natural keys the schema already
 * enforces, so they need no list here. `tool` is the exception — it has no
 * unique column — and this is what scopes the one delete in this file to rows
 * the seed itself wrote.
 */
const SEED_TOOL_NAMES = ["Neon", "Cloudflare R2", "Resend"];

// ---------------------------------------------------------------------------
// content
// ---------------------------------------------------------------------------

const categories = [
  { key: "devops", sortOrder: 10, icon: "container", name: "DevOps" },
  { key: "databases", sortOrder: 20, icon: "database", name: "Databases" },
  { key: "terminal", sortOrder: 30, icon: "terminal", name: "Terminal" },
  { key: "web", sortOrder: 40, icon: "browser", name: "Web" },
] as const;

const packs = [
  {
    slug: "docker-fix",
    categoryKey: "devops",
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    repoUrl: null,
    title: "The Docker build that only fails in CI",
    summary:
      "A build that passes locally and fails on the runner is almost never a Docker bug. Here is the layer cache behaviour that explains it, and the two-line fix.",
    notesMd: [
      "The short version: your local daemon has a warm cache and the runner does not.",
      "",
      "Anything that depends on network state during `RUN` will be silently reused",
      "locally and freshly resolved in CI. That is where the versions diverge.",
    ].join("\n"),
    items: [
      {
        kind: "code" as const,
        lang: "dockerfile",
        label: "The fix",
        note: "Pin the lockfile copy before the source copy so a source change does not invalidate the dependency layer.",
        body: [
          "COPY package.json pnpm-lock.yaml ./",
          "RUN pnpm install --frozen-lockfile",
          "",
          "# Source comes after. Editing a component now costs one layer, not all of them.",
          "COPY . .",
          "RUN pnpm build",
        ].join("\n"),
      },
      {
        kind: "command" as const,
        lang: "bash",
        label: "Reproduce the CI cache locally",
        note: "This is the part most people skip. Without it you are debugging a machine you cannot see.",
        body: "docker build --no-cache --progress=plain .",
      },
      {
        kind: "link" as const,
        url: "https://docs.docker.com/build/cache/",
        label: "Docker build cache reference",
        note: null,
      },
    ],
  },
  {
    slug: "drizzle-migrations",
    categoryKey: "databases",
    videoUrl: "https://www.youtube.com/watch?v=oHg5SJYRHA0",
    repoUrl: "https://github.com/drizzle-team/drizzle-orm",
    title: "Drizzle migrations without losing a column",
    summary:
      "Generate, read the SQL, then apply. The step in the middle is the one that saves you, and it is the one the tutorials skip.",
    notesMd: [
      "`drizzle-kit generate` writes SQL. It does not run it.",
      "",
      "That gap is the feature. A rename and a drop-plus-add look identical in the",
      "schema file and completely different in the generated migration, and only one",
      "of them keeps your data.",
    ].join("\n"),
    items: [
      {
        kind: "command" as const,
        lang: "bash",
        label: "The three steps, in order",
        note: "Read the file the first command writes before running the second. Every time.",
        body: [
          "pnpm db:generate",
          "cat db/migrations/*.sql",
          "pnpm db:migrate",
        ].join("\n"),
      },
      {
        kind: "code" as const,
        lang: "sql",
        label: "What a rename looks like when it goes wrong",
        note: "Two statements, no data movement between them. The column is gone before the new one exists.",
        body: [
          'ALTER TABLE "post" DROP COLUMN "summary";',
          'ALTER TABLE "post" ADD COLUMN "excerpt" text;',
        ].join("\n"),
      },
    ],
  },
  {
    slug: "shell-history",
    categoryKey: "terminal",
    videoUrl: "https://www.tiktok.com/@amin/video/7000000000000000000",
    repoUrl: "https://github.com/atuinsh/atuin",
    title: "Shell history that survives a new laptop",
    summary:
      "Searchable, synced, and stored in SQLite instead of a flat file. The setup is ten minutes and you stop losing commands you wrote once.",
    notesMd: null,
    items: [
      {
        kind: "command" as const,
        lang: "bash",
        label: "Install",
        note: "The bootstrap script is readable. Read it before you pipe it anywhere.",
        body: "curl --proto '=https' --tlsv1.2 -sSf https://setup.atuin.sh | sh",
      },
      {
        kind: "link" as const,
        url: "https://github.com/atuinsh/atuin",
        label: "atuin on GitHub",
        note: null,
      },
    ],
  },
] as const;

/**
 * Ten entries, because BUILD_PLAN.md §12 wants the Phase 2 index to be judged
 * with a realistic number in it rather than one row.
 *
 * `stars` and `lastCommitAt` are deliberately null. The GitHub sync job fills
 * them, and inventing plausible-looking numbers here would mean the index looks
 * correct before the job that keeps it correct has been written — which is the
 * exact failure mode §8 exists to prevent. Null renders as "not synced yet",
 * which is true.
 */
const repos = [
  {
    owner: "atuinsh",
    name: "atuin",
    categoryKey: "terminal",
    status: "maintained" as const,
    licenseSpdx: "MIT",
    oneLiner: "Shell history in SQLite, searchable and optionally synced.",
    forWhom: "Anyone who works across more than one machine.",
    notForYouIf: "You never leave a single workstation and grep your histfile happily.",
    replaces: "Ctrl-R against a flat ~/.bash_history",
    theCatch:
      "Sync means your commands leave the machine. The server is self-hostable, and if you are not going to self-host it you should decide that consciously rather than by default.",
  },
  {
    owner: "drizzle-team",
    name: "drizzle-orm",
    categoryKey: "databases",
    status: "maintained" as const,
    licenseSpdx: "Apache-2.0",
    oneLiner: "SQL-shaped TypeScript ORM with generated migrations.",
    forWhom: "Teams who want types without losing sight of the query.",
    notForYouIf: "You want an ORM that hides SQL from you entirely.",
    replaces: "Prisma, in projects where the query engine binary is a problem.",
    theCatch:
      "The API surface still moves between minor versions. Pin it, and read the changelog before upgrading rather than after.",
  },
  {
    owner: "better-auth",
    name: "better-auth",
    categoryKey: "web",
    status: "maintained" as const,
    licenseSpdx: "MIT",
    oneLiner: "Framework-agnostic auth that owns its own tables.",
    forWhom: "Projects that want session handling without a hosted identity vendor.",
    notForYouIf: "You need SAML, SCIM, or an enterprise SSO checklist today.",
    replaces: "NextAuth, when you want the schema in your own migrations.",
    theCatch:
      "Young enough that the ecosystem around it is thin. You will read source instead of Stack Overflow answers.",
  },
  {
    owner: "shikijs",
    name: "shiki",
    categoryKey: "web",
    status: "maintained" as const,
    licenseSpdx: "MIT",
    oneLiner: "Syntax highlighting using real TextMate grammars, at build time.",
    forWhom: "Anyone shipping code blocks who does not want a runtime highlighter.",
    notForYouIf: "You need to highlight code the user types, live, in the browser.",
    replaces: "Prism and highlight.js in static contexts.",
    theCatch:
      "The grammar and theme payload is large. Import only the languages you use or it lands in your bundle.",
  },
  {
    owner: "colinhacks",
    name: "zod",
    categoryKey: "web",
    status: "maintained" as const,
    licenseSpdx: "MIT",
    oneLiner: "Runtime schema validation that infers static types.",
    forWhom: "Every route handler that accepts input from anywhere.",
    notForYouIf: "Your inputs are already validated at a boundary you control.",
    replaces: "Hand-written type guards that drift from their types.",
    theCatch:
      "Large schemas measurably slow down tsc. If your editor gets sluggish, that is usually why.",
  },
  {
    owner: "amannn",
    name: "next-intl",
    categoryKey: "web",
    status: "maintained" as const,
    licenseSpdx: "MIT",
    oneLiner: "Internationalisation for the Next.js App Router, server-first.",
    forWhom: "Multi-locale sites that want routing and formatting in one place.",
    notForYouIf: "You have one language and no plans for a second.",
    replaces: "react-i18next, in App Router projects.",
    theCatch:
      "Tied closely to Next.js internals, so a major Next release can mean waiting for a compatible version before you upgrade.",
  },
  {
    owner: "porsager",
    name: "postgres",
    categoryKey: "databases",
    status: "maintained" as const,
    licenseSpdx: "Unlicense",
    oneLiner: "Small, fast Postgres client for Node with tagged-template queries.",
    forWhom: "Serverless functions where connection count matters.",
    notForYouIf: "You need the wider plugin ecosystem built around node-postgres.",
    replaces: "pg, where pool size is the constraint.",
    theCatch:
      "Defaults are tuned for long-lived processes. In serverless you must set max explicitly or you will exhaust the connection limit.",
  },
  {
    owner: "neondatabase",
    name: "serverless",
    categoryKey: "databases",
    status: "maintained" as const,
    licenseSpdx: "MIT",
    oneLiner: "Postgres driver that speaks HTTP and WebSocket for edge runtimes.",
    forWhom: "Anyone querying Postgres from a runtime with no TCP sockets.",
    notForYouIf: "You run on plain Node and can open a normal connection.",
    replaces: "Nothing — it exists because TCP is unavailable, not because it is better.",
    theCatch:
      "HTTP mode does not support interactive transactions. Discover this before you write one, not during.",
  },
  {
    owner: "privatenumber",
    name: "tsx",
    categoryKey: "terminal",
    status: "maintained" as const,
    licenseSpdx: "MIT",
    oneLiner: "Run TypeScript files directly, without a build step.",
    forWhom: "Scripts, seeds, and one-off tooling.",
    notForYouIf: "You need type checking at run time — it strips types, it does not verify them.",
    replaces: "ts-node, with far less configuration.",
    theCatch:
      "Because it strips rather than checks, a script can run happily while tsc would reject it. Keep it out of your verification path.",
  },
  {
    owner: "facebook",
    name: "create-react-app",
    categoryKey: "web",
    status: "archived" as const,
    supersededByUrl: "https://vite.dev/",
    licenseSpdx: "MIT",
    oneLiner: "The former default way to scaffold a React application.",
    forWhom: "Nobody starting today.",
    notForYouIf: "You are starting a new project — this entry exists to say so.",
    replaces: null,
    theCatch:
      "Officially deprecated. It still appears in older tutorials, which is exactly why it is kept here and marked rather than deleted: a dead entry that says it is dead is more useful than a missing one.",
  },
] as const;

const posts = [
  {
    slug: "why-short-links-outlive-videos",
    title: "Why the short link outlives the video",
    excerpt:
      "A URL spoken aloud cannot be edited later. Everything about how this site stores resources follows from that one constraint.",
    bodyMd: [
      "A link in a description can be fixed. A link said out loud in a video cannot.",
      "",
      "Once it is in the audio, it is in every copy of that video forever, including",
      "the ones on someone's downloads folder and the ones re-uploaded without asking.",
      "",
      "So the rule here is that `/r/{slug}` is permanent. Renaming a pack does not",
      "replace its slug; it inserts a redirect row and both keep resolving. The cost",
      "is one table. The alternative is a dead link in a video that is still being",
      "watched three years from now.",
    ].join("\n"),
  },
] as const;

const tools = [
  {
    name: "Neon",
    vendor: "Neon Inc.",
    canonicalUrl: "https://neon.com",
    categoryKey: "databases",
    personallyUsed: true,
    sortOrder: 10,
    whyIUseIt:
      "Postgres that scales to zero, so a site with no traffic yet costs nothing to keep online.",
    caveat:
      "Cold starts are real. The first query after an idle period is noticeably slower than the rest.",
  },
  {
    name: "Cloudflare R2",
    vendor: "Cloudflare",
    canonicalUrl: "https://developers.cloudflare.com/r2/",
    categoryKey: "web",
    personallyUsed: true,
    sortOrder: 20,
    whyIUseIt: "S3-compatible object storage with no egress fee, which is the whole reason.",
    caveat:
      "S3-compatible is not S3-identical. Some SDK features work and some fail in ways the error message does not explain.",
  },
  {
    name: "Resend",
    vendor: "Resend",
    canonicalUrl: "https://resend.com",
    categoryKey: "web",
    personallyUsed: false,
    sortOrder: 30,
    whyIUseIt:
      "Chosen for the newsletter in Phase 3, not yet used in anger. Marked as such until it is.",
    caveat:
      "Deliverability is still your domain reputation, not the provider's. Nothing here changes that.",
  },
] as const;

// ---------------------------------------------------------------------------
// runner
// ---------------------------------------------------------------------------

/**
 * `returning()` is typed as an array because in general it can be empty, and
 * strict mode is right to insist on that. Here an empty result means the insert
 * silently did nothing, which would leave a child row pointing at no parent —
 * so this fails loudly rather than being waved through with a non-null
 * assertion at nine call sites.
 */
function one<T>(rows: T[], what: string): T {
  const [row] = rows;
  if (!row) {
    throw new Error(`Insert into ${what} returned no row. Seed aborted.`);
  }
  return row;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.",
    );
  }

  const sql = postgres(url, { max: 1 });
  const db = drizzle(sql, { schema });

  try {
    const now = new Date();

    // -- categories ---------------------------------------------------------
    const categoryIds = new Map<string, string>();

    for (const row of categories) {
      const inserted = one(
        await db
          .insert(schema.category)
          .values({ key: row.key, sortOrder: row.sortOrder, icon: row.icon })
          .onConflictDoUpdate({
            target: schema.category.key,
            set: { sortOrder: row.sortOrder, icon: row.icon },
          })
          .returning({ id: schema.category.id }),
        "category",
      );

      categoryIds.set(row.key, inserted.id);

      await db
        .insert(schema.categoryI18n)
        .values({ categoryId: inserted.id, locale: "en", name: row.name })
        .onConflictDoUpdate({
          target: [schema.categoryI18n.categoryId, schema.categoryI18n.locale],
          set: { name: row.name },
        });
    }

    // -- resource packs -----------------------------------------------------
    for (const pack of packs) {
      const inserted = one(
        await db
          .insert(schema.resourcePack)
          .values({
            slug: pack.slug,
            categoryId: categoryIds.get(pack.categoryKey) ?? null,
            videoUrl: pack.videoUrl,
            repoUrl: pack.repoUrl,
            status: "published",
            publishedAt: now,
            reviewedAt: now,
          })
          .onConflictDoUpdate({
            target: schema.resourcePack.slug,
            set: {
              categoryId: categoryIds.get(pack.categoryKey) ?? null,
              videoUrl: pack.videoUrl,
              repoUrl: pack.repoUrl,
              status: "published",
              reviewedAt: now,
              updatedAt: now,
            },
          })
          .returning({ id: schema.resourcePack.id }),
        `resource_pack (${pack.slug})`,
      );

      await db
        .insert(schema.resourcePackI18n)
        .values({
          packId: inserted.id,
          locale: "en",
          title: pack.title,
          summary: pack.summary,
          notesMd: pack.notesMd,
        })
        .onConflictDoUpdate({
          target: [schema.resourcePackI18n.packId, schema.resourcePackI18n.locale],
          set: { title: pack.title, summary: pack.summary, notesMd: pack.notesMd },
        });

      /**
       * Items have no natural key — two commands in one pack can legitimately be
       * identical text at different positions. So this is the one place the seed
       * deletes, and it is scoped to the pack it is about to rewrite.
       */
      await db
        .delete(schema.resourceItem)
        .where(eq(schema.resourceItem.packId, inserted.id));

      let sortOrder = 0;
      for (const item of pack.items) {
        const itemRow = one(
          await db
            .insert(schema.resourceItem)
            .values({
              packId: inserted.id,
              kind: item.kind,
              url: "url" in item ? item.url : null,
              body: "body" in item ? item.body : null,
              lang: "lang" in item ? item.lang : null,
              sortOrder: (sortOrder += 10),
            })
            .returning({ id: schema.resourceItem.id }),
          `resource_item (${pack.slug})`,
        );

        await db.insert(schema.resourceItemI18n).values({
          itemId: itemRow.id,
          locale: "en",
          label: item.label,
          note: item.note,
        });
      }
    }

    /**
     * One redirect, because the rule it demonstrates is the least intuitive one
     * in the project and it should be visible in development rather than only
     * described in a document. /r/docker-cache-fix still resolves.
     */
    const [dockerPack] = await db
      .select({ id: schema.resourcePack.id })
      .from(schema.resourcePack)
      .where(eq(schema.resourcePack.slug, "docker-fix"));

    if (dockerPack) {
      await db
        .insert(schema.slugRedirect)
        .values({ oldSlug: "docker-cache-fix", packId: dockerPack.id })
        .onConflictDoNothing({ target: schema.slugRedirect.oldSlug });
    }

    // -- repo entries -------------------------------------------------------
    for (const repo of repos) {
      const inserted = one(
        await db
          .insert(schema.repoEntry)
          .values({
            owner: repo.owner,
            name: repo.name,
            githubUrl: `https://github.com/${repo.owner}/${repo.name}`,
            categoryId: categoryIds.get(repo.categoryKey) ?? null,
            status: repo.status,
            supersededByUrl: "supersededByUrl" in repo ? repo.supersededByUrl : null,
            licenseSpdx: repo.licenseSpdx,
            contentStatus: "published",
            publishedAt: now,
            reviewedAt: now,
          })
          .onConflictDoUpdate({
            target: [schema.repoEntry.owner, schema.repoEntry.name],
            set: {
              status: repo.status,
              supersededByUrl: "supersededByUrl" in repo ? repo.supersededByUrl : null,
              licenseSpdx: repo.licenseSpdx,
              contentStatus: "published",
              reviewedAt: now,
              updatedAt: now,
            },
          })
          .returning({ id: schema.repoEntry.id }),
        `repo_entry (${repo.owner}/${repo.name})`,
      );

      await db
        .insert(schema.repoEntryI18n)
        .values({
          entryId: inserted.id,
          locale: "en",
          oneLiner: repo.oneLiner,
          forWhom: repo.forWhom,
          notForYouIf: repo.notForYouIf,
          replaces: repo.replaces,
          theCatch: repo.theCatch,
        })
        .onConflictDoUpdate({
          target: [schema.repoEntryI18n.entryId, schema.repoEntryI18n.locale],
          set: {
            oneLiner: repo.oneLiner,
            forWhom: repo.forWhom,
            notForYouIf: repo.notForYouIf,
            replaces: repo.replaces,
            theCatch: repo.theCatch,
          },
        });
    }

    // -- posts --------------------------------------------------------------
    for (const entry of posts) {
      const inserted = one(
        await db
          .insert(schema.post)
          .values({ slug: entry.slug, status: "published", publishedAt: now, reviewedAt: now })
          .onConflictDoUpdate({
            target: schema.post.slug,
            set: { status: "published", reviewedAt: now, updatedAt: now },
          })
          .returning({ id: schema.post.id }),
        `post (${entry.slug})`,
      );

      await db
        .insert(schema.postI18n)
        .values({
          postId: inserted.id,
          locale: "en",
          title: entry.title,
          excerpt: entry.excerpt,
          bodyMd: entry.bodyMd,
        })
        .onConflictDoUpdate({
          target: [schema.postI18n.postId, schema.postI18n.locale],
          set: { title: entry.title, excerpt: entry.excerpt, bodyMd: entry.bodyMd },
        });
    }

    // -- tools --------------------------------------------------------------
    /**
     * `tool` has no unique column to conflict on — two entries could share a
     * vendor and a name is not guaranteed unique by the schema. Rather than add
     * a constraint that only the seed needs, this removes the rows this file is
     * responsible for and rewrites them. Anything Amin added by hand is untouched.
     */
    const seededTools = await db
      .select({ id: schema.tool.id })
      .from(schema.tool)
      .where(inArray(schema.tool.name, [...SEED_TOOL_NAMES]));

    if (seededTools.length > 0) {
      await db.delete(schema.tool).where(
        inArray(
          schema.tool.id,
          seededTools.map((row) => row.id),
        ),
      );
    }

    for (const entry of tools) {
      const inserted = one(
        await db
          .insert(schema.tool)
          .values({
            name: entry.name,
            vendor: entry.vendor,
            canonicalUrl: entry.canonicalUrl,
            categoryId: categoryIds.get(entry.categoryKey) ?? null,
            personallyUsed: entry.personallyUsed,
            sortOrder: entry.sortOrder,
          })
          .returning({ id: schema.tool.id }),
        `tool (${entry.name})`,
      );

      await db.insert(schema.toolI18n).values({
        toolId: inserted.id,
        locale: "en",
        whyIUseIt: entry.whyIUseIt,
        caveat: entry.caveat,
      });
    }

    // -- link health --------------------------------------------------------
    /**
     * One deliberately failing row. The Phase 2 acceptance criterion is that a
     * dead link surfaces in the dashboard rather than silently misleading a
     * reader, and a dashboard that has only ever been seen empty has not been
     * tested against the case it exists for.
     */
    const [archived] = await db
      .select({ id: schema.repoEntry.id, url: schema.repoEntry.githubUrl })
      .from(schema.repoEntry)
      .where(
        and(
          eq(schema.repoEntry.owner, "facebook"),
          eq(schema.repoEntry.name, "create-react-app"),
        ),
      );

    if (archived) {
      const existing = await db
        .select({ id: schema.linkHealth.id })
        .from(schema.linkHealth)
        .where(eq(schema.linkHealth.targetId, archived.id));

      if (existing.length === 0) {
        await db.insert(schema.linkHealth).values({
          targetType: "repo_entry",
          targetId: archived.id,
          url: archived.url,
          lastCheckedAt: now,
          httpStatus: 404,
          consecutiveFailures: 3,
        });
      }
    }

    const counts = {
      categories: categories.length,
      packs: packs.length,
      packItems: packs.reduce((total, pack) => total + pack.items.length, 0),
      repos: repos.length,
      posts: posts.length,
      tools: tools.length,
    };

    console.log("seed complete");
    for (const [label, value] of Object.entries(counts)) {
      console.log(`  ${label.padEnd(12)} ${value}`);
    }
    console.log("");
    console.log("  en only. ms and zh-Hans fall back by design — see CLAUDE.md.");
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
