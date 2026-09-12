/* ============================================================
 *  UI-помощники: иконки, тосты, модалки, форматирование
 * ============================================================ */
(function () {
  "use strict";

  /* ---------- иконки (stroke-стиль, кроме отмеченных fill) ---------- */
  const ICONS = {
    chat: '<path d="M21 12a8 8 0 0 1-8 8H5.5L3 22V12a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8Z"/>',
    question: '<circle cx="12" cy="12" r="9"/><path d="M9.2 9.2a2.8 2.8 0 0 1 5.4 1c0 1.8-2.6 2.2-2.6 3.8"/><path d="M12 17.6h.01"/>',
    idea: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 1 3.6 10.8c-.7.6-1.1 1.4-1.1 2.2h-5c0-.8-.4-1.6-1.1-2.2A6 6 0 0 1 12 3Z"/>',
    news: '<path d="M3 10.5v3a2 2 0 0 0 2 2h2l4 4V4.5l-4 4H5a2 2 0 0 0-2 2Z"/><path d="M15 9a4 4 0 0 1 0 6M18 6a8.5 8.5 0 0 1 0 12"/>',
    offtopic: '<path d="M4 9h13v5a3 3 0 0 1-3 3H9l-4 2v-2H4a1 1 0 0 1-1-1V10a1 1 0 0 1 1-1Z"/><path d="M18 8V6a2 2 0 0 0-2-2h-3M18 8h1a1 1 0 0 1 1 1v4"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/>',
    folderPlus: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/><path d="M12 10.5v5M9.5 13h5"/>',
    file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/><path d="M14 3v5h5"/>',
    image: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.5"/><path d="m21 16-4-4-9 7"/>',
    trash: '<path d="M4 7h16M10 4h4M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13M10 11v6M14 11v6"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    download: '<path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 21h16"/>',
    upload: '<path d="M12 15V3M7 8l5-5 5 5"/><path d="M4 21h16"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
    comment: '<path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.3 8.9 8.9 0 0 1-3.7-.8L3 21l1.9-5.4a8.3 8.3 0 0 1-.9-4A8.4 8.4 0 0 1 12.5 3 8.4 8.4 0 0 1 21 11.5Z"/>',
    heart: '<path d="M12 21s-7.5-4.6-9.5-9C1 8.5 3 5 6.5 5c2 0 3.3 1 4 2 .7-1 2-2 4-2 3.5 0 5.5 3.5 4 7-2 4.4-9.5 9-9.5 9Z"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    chevronDown: '<path d="m6 9 6 6 6-6"/>',
    chevronLeft: '<path d="m15 6-6 6 6 6"/>',
    chevronRight: '<path d="m9 6 6 6-6 6"/>',
    back: '<path d="M19 12H5M11 18l-6-6 6-6"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    list: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6h.01M4 12h.01M4 18h.01"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.2 1.2"/><path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.2-1.2"/>',
    eye: '<path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/>',
    home: '<path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/>',
    check: '<path d="m5 12 5 5L20 7"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 8h.01M12 11v5"/>',
    warning: '<path d="M12 3 2.5 20h19Z"/><path d="M12 9v5M12 17.5h.01"/>',
    refresh: '<path d="M21 12a9 9 0 1 1-2.6-6.4M21 3v6h-6"/>',
    dots: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    github: '<path fill="currentColor" stroke="none" d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.27-.01-1.17-.02-2.12-3.2.7-3.88-1.36-3.88-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.68 1.25 3.34.95.1-.74.4-1.25.72-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.18-3.09-.12-.29-.51-1.46.11-3.04 0 0 .96-.31 3.15 1.18a10.9 10.9 0 0 1 5.74 0c2.19-1.49 3.15-1.18 3.15-1.18.62 1.58.23 2.75.11 3.04.74.81 1.18 1.83 1.18 3.09 0 4.42-2.7 5.39-5.27 5.68.41.36.78 1.06.78 2.14 0 1.54-.01 2.78-.01 3.16 0 .31.21.68.8.56A11.52 11.52 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z"/>',
    pin: '<path d="M12 17v5M7 12h10M9 12V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v7M8 22h8"/>'
  };

  function icon(name, cls) {
    const inner = ICONS[name] || ICONS.file;
    return `<svg viewBox="0 0 24 24" class="ic ${cls || ""}" aria-hidden="true">${inner}</svg>`;
  }

  /* ---------- тосты ---------- */
  function toast(message, type) {
    const root = document.getElementById("toasts");
    if (!root) return;
    const el = document.createElement("div");
    el.className = "toast " + (type || "info");
    const ic = type === "success" ? "check" : type === "error" ? "warning" : "info";
    el.innerHTML = `<span class="t-ic">${icon(ic)}</span><span>${escapeHtmlSafe(message)}</span>`;
    root.appendChild(el);
    setTimeout(() => {
      el.style.transition = "opacity .3s, transform .3s";
      el.style.opacity = "0";
      el.style.transform = "translateY(10px)";
      setTimeout(() => el.remove(), 320);
    }, 3800);
  }

  /* ---------- модалка (подтверждение) ---------- */
  function confirmModal(opts) {
    return new Promise((resolve) => {
      const root = document.getElementById("modal-root");
      const backdrop = document.createElement("div");
      backdrop.className = "modal-backdrop";
      backdrop.innerHTML = `
        <div class="modal" role="dialog" aria-modal="true">
          <h3>${escapeHtmlSafe(opts.title || "Подтвердите")}</h3>
          ${opts.html ? `<div class="modal-body">${opts.html}</div>` : `<p>${escapeHtmlSafe(opts.message || "")}</p>`}
          <div class="modal-actions">
            <button class="btn btn-ghost" data-act="cancel">Отмена</button>
            <button class="btn ${opts.danger ? "btn-danger" : "btn-primary"}" data-act="ok">${escapeHtmlSafe(opts.confirmText || "OK")}</button>
          </div>
        </div>`;
      root.appendChild(backdrop);

      const cleanup = (val) => { backdrop.remove(); resolve(val); };
      backdrop.querySelector('[data-act="cancel"]').addEventListener("click", () => cleanup(false));
      backdrop.querySelector('[data-act="ok"]').addEventListener("click", () => cleanup(true));
      backdrop.addEventListener("click", (e) => { if (e.target === backdrop) cleanup(false); });
      document.addEventListener("keydown", function esc(e) {
        if (e.key === "Escape") { document.removeEventListener("keydown", esc); cleanup(false); }
      });
    });
  }

  /* ---------- форматирование ---------- */
  function escapeHtmlSafe(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function ruPlural(n, one, few, many) {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
  }

  function timeAgo(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    const diff = Math.max(0, (Date.now() - d.getTime()) / 1000);
    if (diff < 45) return "только что";
    const m = Math.floor(diff / 60);
    if (m < 60) return `${m} ${ruPlural(m, "минуту", "минуты", "минут")} назад`;
    const h = Math.floor(diff / 3600);
    if (h < 24) return `${h} ${ruPlural(h, "час", "часа", "часов")} назад`;
    const days = Math.floor(diff / 86400);
    if (days === 1) return "вчера";
    if (days < 7) return `${days} ${ruPlural(days, "день", "дня", "дней")} назад`;
    return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
  }

  function formatDate(iso) {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" }) +
      ", " + d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  }

  function formatBytes(bytes) {
    if (bytes == null || isNaN(bytes)) return "";
    if (bytes === 0) return "0 Б";
    const units = ["Б", "КБ", "МБ", "ГБ", "ТБ"];
    const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
    const val = bytes / Math.pow(1024, i);
    return (val >= 100 || i === 0 ? Math.round(val) : val.toFixed(1)) + " " + units[i];
  }

  /* ---------- ASCII-логотип и терминальный boot-лог ---------- */
  const ASCII_LOGO = [
    " █████╗ ██╗   ██╗██████╗  ██████╗ ██████╗  █████╗ ",
    "██╔══██╗██║   ██║██╔══██╗██╔═══██╗██╔══██╗██╔══██╗",
    "███████║██║   ██║██████╔╝██║   ██║██████╔╝███████║",
    "██╔══██║██║   ██║██╔══██╗██║   ██║██╔══██╗██╔══██║",
    "██║  ██║╚██████╔╝██║  ██║╚██████╔╝██║  ██║██║  ██║",
    "╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝"
  ].join("\n");

  // печатает строки boot-лога по очереди (эффект терминала)
  function bootType(container, lines, speed) {
    speed = speed || 180;
    const el = container;
    if (!el) return;
    el.innerHTML = "";
    let i = 0;
    (function next() {
      if (i >= lines.length) return;
      const line = document.createElement("div");
      line.className = "l";
      line.innerHTML = lines[i];
      el.appendChild(line);
      i++;
      if (i < lines.length) setTimeout(next, speed + Math.random() * 120);
    })();
  }

  window.UI = { ICONS, ASCII_LOGO, icon, bootType, toast, confirmModal, timeAgo, formatDate, formatBytes, escapeHtml: escapeHtmlSafe, ruPlural };
})();
