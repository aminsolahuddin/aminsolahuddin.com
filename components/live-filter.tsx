"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

/**
 * Search that filters as you type, without asking the server anything.
 *
 * The database is deliberately not involved. A query per keystroke would mean
 * "postgres" costs eight round trips and eight queries per person, and ten people
 * typing at once is eighty — against a Neon pool that CLAUDE.md pins at one
 * connection per instance. Debouncing only reduces that; it does not change the
 * shape of it.
 *
 * So every row is already in the page, and typing hides the ones that do not
 * match. Zero queries, zero requests, instant, and it cannot fall over under load
 * because there is no load to fall over under.
 *
 * What that costs: the whole list sits in the DOM. Fine for the tens-to-low-
 * hundreds of entries a hand-curated library will ever hold. If it ever passes
 * roughly a thousand, this stops being the right trade and the search has to go
 * back to the server — paginated, debounced, and indexed.
 *
 * Three things are preserved from the plain form it replaces:
 *
 *   - Server-rendered. Every row is in the HTML, so the list is crawlable and
 *     the first paint is complete. Hiding happens during render, not after, so
 *     a shared ?q= link never flashes the full list before narrowing.
 *   - Shareable. Typing rewrites ?q= with replaceState — no navigation, and the
 *     URL still describes what is on screen.
 *   - Works without JavaScript. The <form method="get"> underneath still submits
 *     to the server, which filters the same way.
 */

interface FilterState {
  query: string;
  setQuery: (value: string) => void;
  matches: (haystack: string) => boolean;
}

const FilterContext = createContext<FilterState | null>(null);

function useFilter(): FilterState {
  const state = useContext(FilterContext);
  if (!state) {
    throw new Error("FilterInput and FilterItem must be inside a LiveFilter.");
  }
  return state;
}

export function LiveFilter({
  initialQuery,
  children,
}: {
  /**
   * From ?q= on the URL. Seeding state with it is what makes the server and the
   * first client render agree — without it, hydration would decide every row is
   * visible and briefly contradict the HTML it just replaced.
   */
  initialQuery: string;
  children: ReactNode;
}) {
  const [query, setQuery] = useState(initialQuery);
  const needle = query.trim().toLowerCase();

  useEffect(() => {
    /**
     * replaceState, not a router navigation. The point is to keep the URL
     * describing the screen; pushing would bury the previous page under one
     * history entry per keystroke, so Back would walk the typing backwards
     * instead of leaving the page.
     */
    const url = new URL(window.location.href);
    if (needle) url.searchParams.set("q", query.trim());
    else url.searchParams.delete("q");
    window.history.replaceState(null, "", url);
  }, [needle, query]);

  return (
    <FilterContext.Provider
      value={{
        query,
        setQuery,
        matches: (haystack) => !needle || haystack.includes(needle),
      }}
    >
      {children}
    </FilterContext.Provider>
  );
}

export function FilterInput({
  id,
  name,
  label,
  placeholder,
  className,
}: {
  id: string;
  name: string;
  label: string;
  placeholder: string;
  className: string;
}) {
  const { query, setQuery } = useFilter();

  return (
    <>
      <label className="sr-only" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        type="search"
        name={name}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={placeholder}
        className={className}
        // Filtering is already done by the time a suggestion could arrive, and
        // the browser's own history dropdown covers the same ground.
        autoComplete="off"
      />
    </>
  );
}

/**
 * One row. Rendered on the server; this only decides whether it is shown.
 *
 * `hidden` rather than unmounting: the row's markup came from the server and
 * dropping it would mean the client had to be able to rebuild it, which is the
 * whole cost this component exists to avoid.
 */
export function FilterItem({
  haystack,
  className,
  children,
}: {
  haystack: string;
  className?: string | undefined;
  children: ReactNode;
}) {
  const { matches } = useFilter();
  return (
    <li hidden={!matches(haystack)} className={className}>
      {children}
    </li>
  );
}

/**
 * Shown when the query matches nothing.
 *
 * It takes the haystacks rather than counting what the items decided, because a
 * parent cannot ask its children what they rendered — and a child reporting up
 * through an effect would update this one render too late, flashing the wrong
 * answer on the way.
 */
export function FilterEmpty({
  haystacks,
  children,
  className,
}: {
  haystacks: string[];
  children: ReactNode;
  className?: string | undefined;
}) {
  const { matches } = useFilter();
  if (haystacks.some(matches)) return null;
  return <p className={className}>{children}</p>;
}

/**
 * Stops Enter from reloading the page when JavaScript is running.
 *
 * The <form method="get"> has to stay for the no-JS case, and with JS a submit
 * would fetch a page that is already on screen. Preventing it here rather than
 * dropping the form keeps both paths honest.
 */
export function FilterForm({
  className,
  children,
}: {
  className: string;
  children: ReactNode;
}) {
  return (
    <form
      method="get"
      onSubmit={(event) => event.preventDefault()}
      className={className}
    >
      {children}
    </form>
  );
}
