const ALLOWED_TAGS = new Set([
  "P", "BR", "STRONG", "B", "EM", "I", "U",
  "H3", "H4", "H5", "UL", "OL", "LI", "A", "BLOCKQUOTE", "DIV", "SPAN",
]);

export function isHtmlContent(content: string) {
  return /<\/?[a-z][\s\S]*>/i.test(content.trim());
}

export function sanitizeRichHtml(dirty: string): string {
  if (!dirty || typeof window === "undefined") return dirty;
  const doc = new DOMParser().parseFromString(dirty, "text/html");

  function clean(node: Node) {
    const children = [...node.childNodes];
    for (const child of children) {
      if (child.nodeType !== Node.ELEMENT_NODE) continue;
      const el = child as HTMLElement;

      if (!ALLOWED_TAGS.has(el.tagName)) {
        const parent = el.parentNode;
        if (parent) {
          while (el.firstChild) parent.insertBefore(el.firstChild, el);
          parent.removeChild(el);
        }
        continue;
      }

      for (const attr of [...el.attributes]) {
        if (el.tagName === "A" && (attr.name === "href" || attr.name === "target" || attr.name === "rel")) continue;
        el.removeAttribute(attr.name);
      }

      if (el.tagName === "A") {
        const href = el.getAttribute("href") ?? "";
        if (!/^https?:\/\//i.test(href) && !/^mailto:/i.test(href)) {
          el.removeAttribute("href");
        } else {
          el.setAttribute("target", "_blank");
          el.setAttribute("rel", "noopener noreferrer");
        }
      }

      clean(el);
    }
  }

  clean(doc.body);
  return doc.body.innerHTML;
}

export function normalizeEditorHtml(html: string) {
  const trimmed = html.replace(/\s+/g, " ").trim();
  if (!trimmed || trimmed === "<br>" || trimmed === "<div><br></div>") return "";
  return sanitizeRichHtml(html);
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function plainToHtml(text: string) {
  return text
    .split(/\n{2,}/)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

export function valueToEditorHtml(value: string) {
  if (!value.trim()) return "";
  return isHtmlContent(value) ? sanitizeRichHtml(value) : plainToHtml(value);
}

/** @deprecated use sanitizeRichHtml */
export const sanitizeSurveyHtml = sanitizeRichHtml;
