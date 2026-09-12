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
    return DOMPurify.sanitize(html, { ADD_ATTR: ["target"] });
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

  window.MD = { renderMarkdown, escapeHtml, stripMarkdown };
})();
