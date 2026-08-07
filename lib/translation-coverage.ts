/**
 * BUILD_PLAN.md §4: "UI chrome is fully translated. Navigation, buttons, form
 * labels, empty states, error messages."
 *
 * How much of it actually is, counted against English rather than against the
 * locale file's own contents. A file holding three keys is not 100% translated
 * because all three of its keys are filled in — it is three keys out of however
 * many the interface has, and counting it the other way is how a backlog
 * disappears without anyone deciding it should.
 *
 * No imports, so this can be unit tested without dragging next-intl or the JSON
 * loader into Node's test runner. The caller passes the message objects in.
 */

export type Messages = { [key: string]: unknown };

export interface Coverage {
  /** Leaf keys English defines. The denominator, always. */
  total: number;
  translated: number;
  /** Dotted paths English has that this locale does not, in English's order. */
  missing: string[];
  /**
   * Top-level namespaces with nothing in them at all. A page-sized gap reads
   * differently from a scattered one — "nobody has started `tools`" is a task,
   * "eleven keys here and there" is a chore.
   */
  untouchedNamespaces: string[];
}

function isPlainObject(value: unknown): value is Messages {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Every leaf path in English, in the order the file declares them. */
function leaves(messages: Messages, prefix = ""): string[] {
  return Object.entries(messages).flatMap(([key, value]) =>
    isPlainObject(value)
      ? leaves(value, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  );
}

function lookup(messages: Messages, path: string): unknown {
  return path.split(".").reduce<unknown>((node, part) => {
    if (!isPlainObject(node)) return undefined;
    return node[part];
  }, messages);
}

/**
 * What `override` covers of `base`.
 *
 * A key counts as translated when it holds a non-empty string. Empty strings are
 * deliberately not counted: i18n/request.ts merges English underneath and treats
 * `""` as absent, so a key filled with nothing renders English — and a dashboard
 * that called that done would be reporting the opposite of what a reader sees.
 *
 * Keys the locale file has and English does not are ignored rather than counted
 * against it. `ms.json` carries a `_note` explaining why it is empty; that note
 * is not a translation and must not read as one.
 */
export function coverage(base: Messages, override: Messages): Coverage {
  const paths = leaves(base);

  const missing = paths.filter((path) => {
    const value = lookup(override, path);
    return typeof value !== "string" || value.trim() === "";
  });

  const untouchedNamespaces = Object.keys(base).filter((namespace) => {
    const inBase = leaves(base[namespace] as Messages, `${namespace}.`);
    const namespacePaths = isPlainObject(base[namespace])
      ? inBase
      : [namespace];
    return namespacePaths.every((path) => missing.includes(path));
  });

  return {
    total: paths.length,
    translated: paths.length - missing.length,
    missing,
    untouchedNamespaces,
  };
}
