/* ============================================================
 *  Админ-панель — доступна только администратору (CFG.admin)
 *  Модерация постов + управление хранилищем пользователей
 * ============================================================ */
(function () {
  "use strict";

  const { icon, toast, timeAgo, formatBytes, escapeHtml, confirmModal } = window.UI;
  const CFG = window.FORUM_CONFIG;

  function isAdmin() {
    return GH.isLoggedIn() &&
      String(GH.getUser().login || "").toLowerCase() === String(CFG.admin || "").toLowerCase();
  }

  async function renderAdmin() {
    if (!GH.isLoggedIn()) { location.hash = "#/login"; return; }
    if (!isAdmin()) {
      toast("Доступ только для администратора @" + CFG.admin, "error");
      location.hash = "#/forum";
      return;
    }
    const app = document.getElementById("app");
    app.innerHTML = `
      <div class="breadcrumbs">
        <a href="#/forum">${icon("home")}</a> <span>›</span>
        <span>Админ-панель</span>
      </div>
      <div class="admin-head">
        <h2>${icon("terminal")} Админ-панель</h2>
        <span class="muted">режим: @${escapeHtml(GH.getUser().login)}</span>
      </div>
      <div class="admin-grid">
        <section class="card admin-section" id="admStats"><div class="loading-row"><div class="spinner"></div></div></section>
        <section class="card admin-section">
          <h3>${icon("chat")} Модерация постов</h3>
          <div id="admPosts"><div class="loading-row"><div class="spinner"></div></div></div>
        </section>
        <section class="card admin-section">
          <h3>${icon("folder")} Хранилища пользователей</h3>
          <div id="admStorage"><div class="loading-row"><div class="spinner"></div></div></div>
        </section>
      </div>`;

    loadStats();
    loadPosts();
    loadStorage();
  }

  /* ============================================================
   *  СТАТИСТИКА
   * ============================================================ */
  async function loadStats() {
    const el = document.getElementById("admStats");
    let posts = [];
    let rate = null;
    try {
      const r = await GH.listIssues({ labels: CFG.postsLabel, state: "all", per_page: 100 });
      posts = (r.body || []).filter((i) => !i.pull_request);
    } catch (e) {}
    try {
      const r = await GH.request("GET", "/rate_limit");
      rate = r.body && r.body.resources && r.body.resources.core;
    } catch (e) {}

    const open = posts.filter((p) => p.state === "open").length;
    const closed = posts.length - open;
    const comments = posts.reduce((s, p) => s + (p.comments || 0), 0);
    const pinned = posts.filter((p) => (p.labels || []).some((l) => l.name === CFG.pinLabel)).length;

    el.innerHTML = `
      <h3>${icon("info")} Сводка</h3>
      <div class="stat-cards">
        <div class="stat-card"><b>${posts.length}</b><span>всего постов</span></div>
        <div class="stat-card"><b>${open}</b><span>открыто</span></div>
        <div class="stat-card"><b>${closed}</b><span>закрыто</span></div>
        <div class="stat-card"><b>${comments}</b><span>комментариев</span></div>
        <div class="stat-card"><b>${pinned}</b><span>закреплено</span></div>
        <div class="stat-card"><b>${rate ? rate.remaining : "—"}</b><span>API-запросов осталось</span></div>
      </div>`;
  }

  /* ============================================================
   *  МОДЕРАЦИЯ ПОСТОВ
   * ============================================================ */
  async function loadPosts() {
    const el = document.getElementById("admPosts");
    try {
      const r = await GH.listIssues({ labels: CFG.postsLabel, state: "all", per_page: 100 });
      const posts = (r.body || []).filter((i) => !i.pull_request);
      if (!posts.length) {
        el.innerHTML = `<div class="state-box" style="padding:24px;">${icon("chat", "big-ic")}<p>Постов пока нет.</p></div>`;
        return;
      }
      el.innerHTML = `
        <div class="admin-wrap">
          <table class="adm-table">
            <thead><tr>
              <th>#</th><th>Заголовок</th><th>Автор</th><th>Статус</th><th>Комм.</th><th>Действия</th>
            </tr></thead>
            <tbody>
              ${posts.map(postRow).join("")}
            </tbody>
          </table>
        </div>`;

      el.querySelectorAll("[data-act]").forEach((b) => {
        b.addEventListener("click", () => {
          const act = b.dataset.act;
          const num = parseInt(b.dataset.num, 10);
          const issue = posts.find((p) => p.number === num);
          if (!issue) return;
          if (act === "pin") togglePin(issue);
          else if (act === "close") (issue.state === "open" ? closePost(issue) : reopenPost(issue));
          else if (act === "lock") toggleLock(issue);
        });
      });
    } catch (e) {
      el.innerHTML = `<p class="error-text">${escapeHtml(e.message)}</p>`;
    }
  }

  function postRow(p) {
    const pinned = (p.labels || []).some((l) => l.name === CFG.pinLabel);
    return `
      <tr>
        <td>#${p.number}</td>
        <td style="max-width:340px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
          ${pinned ? `<span class="adm-badge on" title="Закреплено">${icon("pin")}</span> ` : ""}
          <a href="#/post/${p.number}" title="${escapeHtml(p.title)}">${escapeHtml(p.title)}</a>
        </td>
        <td class="muted">@${escapeHtml(p.user ? p.user.login : "?")}</td>
        <td>${p.state === "open" ? `<span class="adm-badge on">open</span>` : `<span class="adm-badge">closed</span>`}${p.locked ? `<span class="adm-badge" title="Комментарии закрыты">lock</span>` : ""}</td>
        <td>${p.comments}</td>
        <td>
          <div class="adm-actions">
            <button class="icon-btn" data-act="pin" data-num="${p.number}" title="${pinned ? "Открепить" : "Закрепить"}">${icon("pin")}</button>
            <button class="icon-btn" data-act="close" data-num="${p.number}" title="${p.state === "open" ? "Закрыть" : "Открыть"}">${icon(p.state === "open" ? "close" : "check")}</button>
            <button class="icon-btn" data-act="lock" data-num="${p.number}" title="${p.locked ? "Разблокировать комментарии" : "Заблокировать комментарии"}">${icon(p.locked ? "unlock" : "lock")}</button>
            <a class="icon-btn" href="${escapeHtml(p.html_url)}" target="_blank" rel="noopener" title="На GitHub">${icon("github")}</a>
          </div>
        </td>
      </tr>`;
  }

  async function ensurePinLabel() {
    try { await GH.createLabel(CFG.pinLabel, "ffffff", "Закреплённый пост"); } catch (e) {}
  }

  async function togglePin(issue) {
    const labels = (issue.labels || []).map((l) => l.name);
    const pinned = labels.includes(CFG.pinLabel);
    const next = pinned ? labels.filter((l) => l !== CFG.pinLabel) : labels.concat([CFG.pinLabel]);
    try {
      await ensurePinLabel();
      await GH.updateIssue(issue.number, { labels: next });
      toast(pinned ? "Пост откреплён." : "Пост закреплён.", "success");
      loadPosts();
      loadStats();
    } catch (e) { toast(e.message, "error"); }
  }

  async function closePost(issue) {
    const ok = await confirmModal({ title: "Закрыть пост #" + issue.number + "?", message: "Пост исчезнет из ленты.", confirmText: "Закрыть", danger: true });
    if (!ok) return;
    try { await GH.closeIssue(issue.number); toast("Пост закрыт.", "success"); loadPosts(); loadStats(); } catch (e) { toast(e.message, "error"); }
  }

  async function reopenPost(issue) {
    try { await GH.reopenIssue(issue.number); toast("Пост открыт.", "success"); loadPosts(); loadStats(); } catch (e) { toast(e.message, "error"); }
  }

  async function toggleLock(issue) {
    try {
      if (issue.locked) { await GH.unlockIssue(issue.number); toast("Комментарии разблокированы.", "success"); }
      else { await GH.lockIssue(issue.number, "resolved"); toast("Комментарии заблокированы.", "success"); }
      loadPosts();
    } catch (e) { toast(e.message, "error"); }
  }

  /* ============================================================
   *  ХРАНИЛИЩА ПОЛЬЗОВАТЕЛЕЙ
   * ============================================================ */
  async function loadStorage() {
    const el = document.getElementById("admStorage");
    try {
      const r = await GH.request("GET", `/repos/${CFG.owner}/${CFG.repo}/git/trees/${encodeURIComponent(CFG.branch)}?recursive=1`);
      const blobs = (r.body.tree || []).filter((t) => t.type === "blob" && t.path.startsWith(CFG.storageRoot + "/"));
      const users = {};
      for (const b of blobs) {
        const rest = b.path.slice(CFG.storageRoot.length + 1);
        const u = rest.split("/")[0];
        if (!u) continue;
        users[u] = users[u] || { files: 0, size: 0 };
        if (!b.path.endsWith("/.keep")) { users[u].files++; users[u].size += (b.size || 0); }
      }
      const names = Object.keys(users).sort((a, b) => a.localeCompare(b, "ru"));
      if (!names.length) {
        el.innerHTML = `<div class="state-box" style="padding:24px;">${icon("folder", "big-ic")}<p>В хранилище пока пусто.</p></div>`;
        return;
      }
      el.innerHTML = `
        <div class="admin-wrap">
          <table class="adm-table">
            <thead><tr><th>Пользователь</th><th>Файлов</th><th>Размер</th><th>Действия</th></tr></thead>
            <tbody>
              ${names.map((u) => `
                <tr>
                  <td>@${escapeHtml(u)}</td>
                  <td>${users[u].files}</td>
                  <td>${formatBytes(users[u].size)}</td>
                  <td>
                    <div class="adm-actions">
                      <a class="icon-btn" href="https://github.com/${CFG.owner}/${CFG.repo}/tree/${encodeURIComponent(CFG.branch)}/${encodeURIComponent(CFG.storageRoot + "/" + u)}" target="_blank" rel="noopener" title="На GitHub">${icon("github")}</a>
                      <button class="icon-btn" data-deluser="${escapeHtml(u)}" title="Очистить хранилище">${icon("trash")}</button>
                    </div>
                  </td>
                </tr>`).join("")}
            </tbody>
          </table>
        </div>`;

      el.querySelectorAll("[data-deluser]").forEach((b) => {
        b.addEventListener("click", () => clearUserStorage(b.dataset.deluser));
      });
    } catch (e) {
      el.innerHTML = `<p class="error-text">${escapeHtml(e.message)}</p>`;
    }
  }

  async function clearUserStorage(user) {
    const ok = await confirmModal({
      title: "Очистить хранилище @" + user + "?",
      message: "Все файлы и папки пользователя будут удалены безвозвратно.",
      confirmText: "Очистить",
      danger: true
    });
    if (!ok) return;
    try {
      await delDir(user, "");
      toast("Хранилище @" + user + " очищено.", "success");
      loadStorage();
    } catch (e) { toast(e.message, "error"); }
  }

  async function delDir(user, rel) {
    let body;
    try {
      body = (await GH.listDir(user, rel)).body;
    } catch (e) {
      return; // папки нет (или это файл)
    }
    if (!Array.isArray(body)) return;
    for (const c of body) {
      const childRel = rel ? rel + "/" + c.name : c.name;
      if (c.type === "dir") await delDir(user, childRel);
      else {
        try { await GH.deleteFile(user, childRel, c.sha, "Admin: очистка хранилища"); } catch (e) {}
      }
    }
  }

  window.ADMIN = { renderAdmin, isAdmin };
})();
