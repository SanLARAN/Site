/* ============================================================
 *  Приложение: роутер, тема, профиль, загрузка
 * ============================================================ */
(function () {
  "use strict";

  const { icon, toast, formatBytes, escapeHtml, timeAgo } = window.UI;
  const CFG = window.FORUM_CONFIG;

  /* ---------- тема ---------- */
  function initTheme() {
    let t = localStorage.getItem("aurora:theme");
    if (!t) {
      t = (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches) ? "light" : "dark";
    }
    document.documentElement.setAttribute("data-theme", t);
    const btn = document.getElementById("themeToggle");
    btn.addEventListener("click", () => {
      const cur = document.documentElement.getAttribute("data-theme");
      const next = cur === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem("aurora:theme", next);
    });
  }

  /* ---------- роутер ---------- */
  function currentRoute() {
    const hash = location.hash || "#/forum";
    const parts = hash.replace(/^#\//, "").split("/");
    return { name: parts[0] || "forum", args: parts.slice(1) };
  }

  function render() {
    const route = currentRoute();
    const app = document.getElementById("app");
    window.scrollTo(0, 0);
    updateNav(route.name);
    // плавный переход страницы (Apple-стиль)
    app.classList.remove("page-enter");
    void app.offsetWidth; // перезапуск анимации
    app.classList.add("page-enter");

    // ASCII-переход между страницами
    UI.startPageTransition(route.name);

    switch (route.name) {
      case "forum":
        FORUM.renderFeed();
        break;
      case "post": {
        const num = parseInt(route.args[0], 10);
        if (!num) { location.hash = "#/forum"; break; }
        FORUM.renderPost(num);
        break;
      }
      case "new":
        FORUM.renderComposer(null);
        break;
      case "storage":
        STORAGE.renderStorage();
        break;
      case "login":
        if (GH.isLoggedIn()) { location.hash = "#/forum"; break; }
        AUTH.renderLoginView();
        break;
      case "profile":
        PROFILES.renderProfile();
        break;
      case "shop":
        SHOP.renderShop();
        break;
      case "admin":
        ADMIN.renderAdmin();
        break;
      default:
        location.hash = "#/forum";
        break;
    }
  }

  function updateNav(active) {
    document.querySelectorAll(".mainnav a").forEach((a) => {
      a.classList.toggle("active", a.dataset.nav === active);
    });
  }

  /* ---------- запуск ---------- */
  function boot() {
    const footer = document.getElementById("footerRepo");
    if (footer) {
      footer.href = `https://github.com/${CFG.owner}/${CFG.repo}`;
      footer.textContent = `${CFG.owner}/${CFG.repo}`;
    }
    initTheme();
    AUTH.renderAuthSlot();
    render();
    window.addEventListener("hashchange", render);
    window.addEventListener("auth:change", () => {
      AUTH.renderAuthSlot();
      render();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
