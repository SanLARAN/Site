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
        renderProfile();
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

  /* ---------- профиль ---------- */
  async function renderProfile() {
    const app = document.getElementById("app");
    if (!GH.isLoggedIn()) { location.hash = "#/login"; return; }
    const u = GH.getUser();
    app.innerHTML = `<div class="loading-row"><div class="spinner"></div></div>`;

    let posts = [], filesCount = null, totalSize = null;
    try {
      const p = await GH.listIssues({ creator: u.login, labels: CFG.postsLabel, state: "all", per_page: 100 });
      posts = (p.body || []).filter((i) => !i.pull_request);
    } catch (e) {}
    try {
      const { body } = await GH.request("GET", `/repos/${CFG.owner}/${CFG.repo}/git/trees/${encodeURIComponent(CFG.branch)}?recursive=1`);
      const prefix = CFG.storageRoot + "/" + u.login + "/";
      const blobs = (body.tree || []).filter((t) => t.type === "blob" && t.path.startsWith(prefix));
      filesCount = blobs.filter((b) => !b.path.endsWith("/.keep")).length;
      totalSize = blobs.reduce((s, b) => s + (b.size || 0), 0);
    } catch (e) {}

    app.innerHTML = `
      <div class="card profile-card">
        <img class="profile-avatar gh-avatar" src="${escapeHtml(u.avatar_url + "&s=200")}" alt="" />
        <div style="flex:1;min-width:0;">
          <h2>${escapeHtml(u.name || u.login)}</h2>
          <div class="login">@${escapeHtml(u.login)}</div>
          ${u.bio ? `<p class="muted" style="margin:6px 0 0;font-size:14.5px;">${escapeHtml(u.bio)}</p>` : ""}
          <div class="profile-stats">
            <div class="stat"><b>${posts.length}</b><span>${window.UI.ruPlural(posts.length, "пост", "поста", "постов")}</span></div>
            <div class="stat"><b>${filesCount == null ? "—" : filesCount}</b><span>файлов в хранилище</span></div>
            <div class="stat"><b>${totalSize == null ? "—" : formatBytes(totalSize)}</b><span>занято</span></div>
          </div>
          <div class="profile-actions">
            <a class="btn btn-primary btn-sm" href="#/new">${icon("plus")} Новый пост</a>
            <a class="btn btn-ghost btn-sm" href="#/storage">${icon("folder")} Хранилище</a>
            <a class="btn btn-ghost btn-sm" href="${escapeHtml(u.html_url)}" target="_blank" rel="noopener">${icon("github")} Профиль GitHub</a>
          </div>
        </div>
      </div>

      <h2 class="comments-title" style="margin-top:26px;">Мои посты</h2>
      <div class="post-list" id="myPosts" style="margin-top:12px;"></div>`;

    const list = app.querySelector("#myPosts");
    if (!posts.length) {
      list.innerHTML = `<div class="state-box">${icon("chat", "big-ic")}<h3>Постов пока нет</h3><p>Напишите свой первый пост!</p></div>`;
    } else {
      list.innerHTML = posts.map((p) => {
        const cat = (p.labels || []).find((l) => CFG.categories.some((c) => c.label === l.name));
        return `
          <article class="post-card" data-num="${p.number}">
            <div class="post-card-top">${cat ? `<span class="cat-badge">${escapeHtml(cat.name)}</span>` : ""}${p.state === "closed" ? `<span class="cat-badge closed">закрыт</span>` : ""}</div>
            <h2 class="post-card-title">${escapeHtml(p.title)}</h2>
            <div class="post-card-meta">
              <span class="item">${icon("refresh")}${timeAgo(p.created_at)}</span>
              <span class="item">${icon("comment")}${p.comments}</span>
            </div>
          </article>`;
      }).join("");
      list.querySelectorAll(".post-card").forEach((c) => {
        c.addEventListener("click", () => location.hash = "#/post/" + c.dataset.num);
      });
    }
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
