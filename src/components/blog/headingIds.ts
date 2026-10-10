/**
 * Ids for the headings of an article, so that a markdown link such as
 * `[spis](#jak-zalozyc-konto)` has somewhere to go (the renderer already
 * leaves room for the sticky header with `scroll-mt-20`).
 *
 * Pure, no dependencies: a slug function that understands Polish letters, a
 * per-article uniqueness registry and a small rehype plugin that puts the id
 * on every h1-h6 that has none. Doing it in the syntax tree (not while
 * rendering) keeps the result deterministic: the same markdown always yields
 * the same ids, in document order.
 */

/**
 * Ids that the page around the article body, or the footnote block, already
 * uses. A heading whose text slugifies to one of them ("Czytaj dalej", "Treść")
 * would otherwise duplicate the id in the DOM, so the registry never hands them
 * out. The article page should import these constants for its own `id`s
 * instead of repeating the strings.
 */
export const ARTICLE_PAGE_IDS = {
  /** Skip-link target: the article body. */
  content: "tresc",
  /** The "Przypisy" heading that remark-gfm adds before the footnotes. */
  footnotes: "footnote-label",
  /** Section "Powiązana promocja" under the article. */
  relatedPromotion: "powiazana-promocja",
  /** Section "Czytaj dalej" under the article. */
  readMore: "czytaj-dalej"
} as const;

const RESERVED_IDS: readonly string[] = Object.values(ARTICLE_PAGE_IDS);

const FALLBACK_SLUG = "sekcja";
const MAX_SLUG_LENGTH = 80;

/**
 * "Jak założyć konto w 2026?" -> "jak-zalozyc-konto-w-2026". Polish letters
 * lose their diacritics (ł has no decomposition, so it is mapped by hand), any
 * other run of non-alphanumeric characters becomes one hyphen. A heading with
 * no usable character gives "sekcja".
 */
export function slugifyHeading(text: string): string {
  const slug = text
    .toLowerCase()
    .replace(/ł/g, "l")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, "");
  return slug || FALLBACK_SLUG;
}

/** Hands out unique ids within one article: "sekcja", "sekcja-2", "sekcja-3" ... */
export function createIdRegistry(reserved: readonly string[] = RESERVED_IDS) {
  const used = new Set<string>(reserved);
  return {
    /** Registers an id that already exists in the tree. */
    reserve(id: string): void {
      used.add(id);
    },
    /** A unique id for a heading with this text. */
    unique(text: string): string {
      const base = slugifyHeading(text);
      let id = base;
      for (let n = 2; used.has(id); n += 1) id = `${base}-${n}`;
      used.add(id);
      return id;
    }
  };
}

// A minimal structural view of the hast tree; the real `Root` is assignable to it.
interface HastNode {
  type: string;
  value?: string;
  tagName?: string;
  properties?: Record<string, unknown> | null;
  children?: HastNode[];
}

const HEADING = /^h[1-6]$/;

function textOf(node: HastNode): string {
  if (node.type === "text") return node.value ?? "";
  // Inline code and emphasis carry their words in children / value; images count by their alt text.
  if (node.type === "element" && node.tagName === "img") {
    const alt = node.properties?.alt;
    return typeof alt === "string" ? alt : "";
  }
  if (typeof node.value === "string" && !node.children) return node.value;
  return (node.children ?? []).map(textOf).join("");
}

function collectExistingIds(node: HastNode, registry: ReturnType<typeof createIdRegistry>): void {
  const id = node.properties?.id;
  if (typeof id === "string" && id) registry.reserve(id);
  for (const child of node.children ?? []) collectExistingIds(child, registry);
}

function assignIds(node: HastNode, registry: ReturnType<typeof createIdRegistry>): void {
  if (node.type === "element" && node.tagName && HEADING.test(node.tagName)) {
    const existing = node.properties?.id;
    if (typeof existing !== "string" || existing === "") {
      node.properties = { ...(node.properties ?? {}), id: registry.unique(textOf(node)) };
    }
  }
  for (const child of node.children ?? []) assignIds(child, registry);
}

/** rehype plugin: gives every heading without an id a unique, readable one. */
export function rehypeHeadingIds() {
  return (tree: HastNode): void => {
    const registry = createIdRegistry();
    collectExistingIds(tree, registry);
    assignIds(tree, registry);
  };
}
