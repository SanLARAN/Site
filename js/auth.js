/* ============================================================
 *  Аутентификация через персональный GitHub-токен
 * ============================================================ */
(function () {
  "use strict";

  const { icon, toast, escapeHtml } = window.UI;

  function emitChange() {
    window.dispatchEvent(new CustomEvent("auth:change"));
  }

  /* ---------- слот в шапке ---------- */
  function renderAuthSlot() {
    const slot = document.getElementById("authSlot");
    if (!slot) return;

    if (GH.isLoggedIn()) {
      const u = GH.getUser();
      slot.innerHTML = `
        <div class="dropdown" id="userDropdown">
          <button class="user-chip" id="userChip" title="${escapeHtml(u.login)}">
            <img class="gh-avatar" src="${escapeHtml(u.avatar_url)}" alt="" />
            <span class="name">${escapeHtml(u.login)}</span>
            <span class="chev">${icon("chevronDown")}</span>
          </button>
          <div class="dropdown-menu">
            <div style="padding:10px 12px;border-bottom:1px solid var(--border);margin-bottom:6px;">
              <div style="font-weight:700;font-size:14px;">${escapeHtml(u.name || u.login)}</div>
              <div class="muted" style="font-size:12.5px;">@${escapeHtml(u.login)}</div>
            </div>
            <button class="dropdown-item" data-act="profile">${icon("user")} Профиль</button>
            <button class="dropdown-item" data-act="newpost">${icon("plus")} Новый пост</button>
            <button class="dropdown-item" data-act="storage">${icon("folder")} Моё хранилище</button>
            ${window.ADMIN && window.ADMIN.isAdmin() ? `<button class="dropdown-item" data-act="admin">${icon("shield")} Админ-панель</button>` : ""}
            <div class="dropdown-sep"></div>
            <a class="dropdown-item" href="${escapeHtml(u.html_url)}" target="_blank" rel="noopener">${icon("github")} GitHub профиль</a>
            <button class="dropdown-item danger" data-act="logout">${icon("logout")} Выйти</button>
          </div>
        </div>`;
      const dd = slot.querySelector("#userDropdown");
      const chip = slot.querySelector("#userChip");
      chip.addEventListener("click", (e) => {
        e.stopPropagation();
        dd.classList.toggle("open");
      });
      document.addEventListener("click", (e) => {
        if (!dd.contains(e.target)) dd.classList.remove("open");
      });
      slot.querySelectorAll("[data-act]").forEach((b) => b.addEventListener("click", () => {
        dd.classList.remove("open");
        const act = b.getAttribute("data-act");
        if (act === "logout") logout();
        else if (act === "profile") location.hash = "#/profile";
        else if (act === "newpost") location.hash = "#/new";
        else if (act === "storage") location.hash = "#/storage";
        else if (act === "admin") location.hash = "#/admin";
      }));
    } else {
      slot.innerHTML = `
        <button class="btn btn-primary login-btn" id="loginBtn">
          ${icon("github")} Войти
        </button>`;
      slot.querySelector("#loginBtn").addEventListener("click", () => {
        location.hash = "#/login";
      });
    }
  }

  /* ---------- вход ---------- */
  async function loginWithToken(token) {
    const trimmed = (token || "").trim();
    if (!trimmed) { toast("Вставьте токен.", "error"); return false; }
    if (!/^(ghp_|github_pat_|gho_|ghu_|ghs_)/.test(trimmed)) {
      toast("Похоже, это не GitHub-токен. Он должен начинаться с ghp_ или github_pat_.", "error");
      return false;
    }
    GH.saveToken(trimmed);
    try {
      const user = await GH.fetchUser();
      GH.saveUser(user);
      toast(`Добро пожаловать, ${user.login}!`, "success");
      emitChange();
      return true;
    } catch (e) {
      GH.clearSession();
      toast(e.message, "error");
      return false;
    }
  }

  function logout() {
    GH.clearSession();
    toast("Вы вышли из аккаунта.", "info");
    emitChange();
    if (location.hash.startsWith("#/storage") || location.hash.startsWith("#/new") || location.hash.startsWith("#/profile")) {
      location.hash = "#/forum";
    }
  }

  function ensureLogin() {
    if (GH.isLoggedIn()) return true;
    toast("Сначала войдите через GitHub-токен.", "info");
    location.hash = "#/login";
    return false;
  }

  /* ---------- страница входа ---------- */
  function renderLoginView() {
    const app = document.getElementById("app");
    app.innerHTML = `
      <div class="card auth-card">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;">
          <span style="display:grid;place-items:center;width:44px;height:44px;border-radius:12px;background:var(--surface-2);border:1px solid var(--border);color:var(--a3);">${icon("github")}</span>
          <h2 style="margin:0;">Вход в аккаунт</h2>
        </div>
        <p class="lead">Aurora хранит всё в вашем GitHub-репозитории, поэтому для регистрации достаточно <b>персонального токена</b> — без паролей и email.</p>

        <div class="field">
          <label for="tokenInput">Персональный токен GitHub</label>
          <div class="token-row">
            <input class="input" id="tokenInput" type="password" placeholder="ghp_… или github_pat_…" autocomplete="off" spellcheck="false" />
            <button class="btn btn-primary" id="tokenSubmit">Войти</button>
          </div>
          <div class="hint">Токен хранится только в вашем браузере (localStorage) и никуда не отправляется, кроме GitHub API.</div>
        </div>

        <div class="auth-note">
          <b>Как получить токен:</b>
          <ol>
            <li>Откройте <a href="https://github.com/settings/tokens/new?scopes=public_repo&description=Aurora" target="_blank" rel="noopener">github.com/settings/tokens/new</a>.</li>
            <li>Выберите срок действия и отметьте галочку <code>public_repo</code>.</li>
            <li>Нажмите <b>Generate token</b> и скопируйте его.</li>
            <li>Вставьте сюда и нажмите «Войти».</li>
          </ol>
        </div>

        <div class="auth-note" style="margin-top:12px;">
          <b>Почему так?</b> GitHub Pages — только статика, здесь нет своего сервера. Токен даёт вам доступ к GitHub API прямо из браузера: вы сможете писать посты (это issues), комментировать и сохранять файлы в своё личное Хранилище.
        </div>
      </div>`;

    const input = app.querySelector("#tokenInput");
    const submit = app.querySelector("#tokenSubmit");
    input.focus();
    const doLogin = async () => {
      submit.disabled = true;
      submit.textContent = "Проверяем…";
      const ok = await loginWithToken(input.value);
      if (ok) location.hash = "#/forum";
      else {
        submit.disabled = false;
        submit.textContent = "Войти";
      }
    };
    submit.addEventListener("click", doLogin);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") doLogin(); });
  }

  window.AUTH = { renderAuthSlot, renderLoginView, loginWithToken, logout, ensureLogin, emitChange };
})();
