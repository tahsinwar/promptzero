import DOMPurify from "dompurify";

const ALLOWED_TAGS = [
  "b", "strong", "i", "em", "u", "s", "mark",
  "br", "p", "span", "font", "small", "sub", "sup",
  "ul", "ol", "li", "a", "code", "pre", "blockquote",
  "h1", "h2", "h3", "h4", "h5", "h6", "hr",
];
const ALLOWED_ATTR = ["href", "target", "rel", "style", "color", "class"];

export function sanitizeBasicHtml(input: string): string {
  if (!input) return "";
  if (typeof window === "undefined") {
    // SSR fallback — strip tags entirely to stay safe
    return input.replace(/<[^>]*>/g, "");
  }
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
  });
}