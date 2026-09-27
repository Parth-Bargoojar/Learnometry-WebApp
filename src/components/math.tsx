import katex from "katex";

/**
 * Question text with `$inline$` and `$$display$$` math (D7). KaTeX renders HTML plus
 * MathML, so screen readers read the formula instead of the glyph soup. Pure, so it
 * runs on the server for pages and on the client inside the player.
 * `*emphasis*` is supported for solutions ("the component *into* the surface").
 */
const cache = new Map<string, string>();

function escape(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

export function renderMath(source: string): string {
  const hit = cache.get(source);
  if (hit) return hit;
  const html = source
    .split(/(\$\$[^$]+\$\$|\$[^$]+\$)/g)
    .map((part) => {
      if (part.startsWith("$$")) {
        return katex.renderToString(part.slice(2, -2), { displayMode: true, output: "htmlAndMathml", throwOnError: false });
      }
      if (part.startsWith("$") && part.endsWith("$") && part.length > 1) {
        return katex.renderToString(part.slice(1, -1), { output: "htmlAndMathml", throwOnError: false });
      }
      return escape(part);
    })
    .join("");
  cache.set(source, html);
  return html;
}

export function MathText({
  children,
  as: Tag = "span",
  className = "",
}: {
  children: string;
  as?: "span" | "p" | "div";
  className?: string;
}) {
  // Source strings are authored content from the question bank, and every non-math
  // segment is HTML-escaped above before insertion.
  return <Tag className={className} dangerouslySetInnerHTML={{ __html: renderMath(children) }} />;
}
