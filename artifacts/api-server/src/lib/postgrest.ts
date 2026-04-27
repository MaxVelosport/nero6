/**
 * PostgREST helpers for safely composing filter expressions.
 *
 * PostgREST `or()` / `and()` filters use a mini-DSL where commas separate
 * conditions and parentheses delimit groups. If user-supplied input contains
 * any of `,()"\` it must be wrapped in double quotes with `"` and `\` escaped,
 * otherwise the query parser sees garbage (and in the worst case the user
 * could inject extra conditions).
 *
 * `%` is the SQL LIKE wildcard. We treat user input as literal text, so any
 * `%` or `_` in the input is escaped to a literal match.
 */

const POSTGREST_RESERVED = /[,()"\\:.*]/;

/** Escape % and _ so they match literally inside ilike. */
export function escapeLikeLiteral(input: string): string {
  return input.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

/**
 * Wrap a value for use inside a PostgREST or()/and() filter. Adds quotes and
 * escapes embedded quotes/backslashes when the value contains reserved chars.
 */
export function quotePostgrestValue(value: string): string {
  if (!POSTGREST_RESERVED.test(value)) return value;
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/**
 * Build a safe `column.ilike.%term%` fragment for PostgREST.
 * Caller is responsible for joining fragments with commas via `.or()`.
 */
export function ilikeContainsExpr(column: string, rawTerm: string): string {
  const term = escapeLikeLiteral(rawTerm);
  return `${column}.ilike.${quotePostgrestValue(`%${term}%`)}`;
}

/**
 * Build a full `or()` argument that searches `term` across multiple columns
 * with case-insensitive substring matching.
 *
 * Example: `orIlikeContains(["title","subject"], "Программирование, C++")`
 */
export function orIlikeContains(columns: string[], rawTerm: string): string {
  return columns.map((c) => ilikeContainsExpr(c, rawTerm)).join(",");
}
