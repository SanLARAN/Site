/* ============================================================
 *  Markdown → безопасный HTML (marked + DOMPurify)
 * ============================================================ */
(function () {
  "use strict";

  const md = window.marked;
  const DOMPurify = window.DOMPurify;

  md.setOptions({
    gfm: true,
    breaks: false,
    headerIds: false,
    mangle: false
  });

  // Открываем ссылки в новой вкладке
  DOMPurify.addHook("afterSanitizeAttributes", function (node) {
    if (node.tagName === "A") {
      node.setAttribute("target", "_blank");
      node.setAttribute("rel", "noopener noreferrer nofollow");
    }
  });

  function renderMarkdown(text) {
    if (!text) return "";
    let html;
    try {
      html = md.parse(text || "");
    } catch (e) {
      html = escapeHtml(text || "");
    }
    const clean = DOMPurify.sanitize(html, { ADD_ATTR: ["target"] });
    return linkifyMentions(clean);
  }

  // превращает @login в ссылку на профиль (кроме кода и ссылок)
  function linkifyMentions(html) {
    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    const walker = document.createTreeWalker(tmp, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const p = node.parentNode;
        if (!p) return NodeFilter.FILTER_REJECT;
        const tag = (p.nodeName || "").toLowerCase();
        if (tag === "code" || tag === "pre" || tag === "a") return NodeFilter.FILTER_REJECT;
        return /@[a-zA-Z0-9]/.test(node.nodeValue || "") ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => {
      const parent = node.parentNode;
      // не трогаем упоминания, вплотную прилегающие к букве/цифре (например, в email)
      const parts = String(node.nodeValue).split(/(?<![a-zA-Z0-9])(@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,38})?)/);
      if (parts.length < 2) return;
      const frag = document.createDocumentFragment();
      parts.forEach((part) => {
        if (/^@[a-zA-Z0-9]/.test(part)) {
          const login = part.slice(1);
          const a = document.createElement("a");
          a.href = "#/user/" + encodeURIComponent(login);
          a.className = "mention";
          a.textContent = part;
          frag.appendChild(a);
        } else if (part) {
          frag.appendChild(document.createTextNode(part));
        }
      });
      parent.replaceChild(frag, node);
    });
    return tmp.innerHTML;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function stripMarkdown(text) {
    if (!text) return "";
    const html = renderMarkdown(text);
    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    return (tmp.textContent || "").replace(/\s+/g, " ").trim();
  }

  window.MD = { renderMarkdown, escapeHtml, stripMarkdown, linkifyMentions };
})();
