/* ============================================================
 *  GitHub REST API клиент (всё работает из браузера, без бэкенда)
 *  CORS на api.github.com разрешён, авторизация — Bearer-токен.
 * ============================================================ */
(function () {
  "use strict";

  const CFG = window.FORUM_CONFIG;
  const API = "https://api.github.com";
  const TOKEN_KEY = "aurora:token";
  const USER_KEY = "aurora:user";

  const state = {
    token: null,
    user: null
  };

  /* ---------- токен ---------- */
  function loadToken() {
    try {
      state.token = localStorage.getItem(TOKEN_KEY) || null;
      state.user = JSON.parse(localStorage.getItem(USER_KEY) || "null");
    } catch (e) {
      state.token = null;
      state.user = null;
    }
  }
  loadToken();

  function saveToken(token) {
    state.token = token;
    try { localStorage.setItem(TOKEN_KEY, token); } catch (e) {}
  }
  function saveUser(user) {
    state.user = user;
    try { localStorage.setItem(USER_KEY, JSON.stringify(user)); } catch (e) {}
  }
  function clearSession() {
    state.token = null;
    state.user = null;
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    } catch (e) {}
  }

  function getToken() { return state.token; }
  function getUser() { return state.user; }
  function isLoggedIn() { return !!state.token && !!state.user; }

  /* ---------- ошибки ---------- */
  class ApiError extends Error {
    constructor(message, status, details) {
      super(message);
      this.status = status;
      this.details = details;
    }
  }

  function friendlyError(status, body) {
    if (status === 401) return "Неверный или просроченный токен. Обновите его в настройках входа.";
    if (status === 403) {
      const m = (body && body.message) || "";
      if (/rate limit/i.test(m)) return "Превышен лимит запросов GitHub API. Подождите немного.";
      if (/secondary rate/i.test(m)) return "Слишком много запросов. Подождите минуту и повторите.";
      return "Недостаточно прав для этого действия (нужен токен с доступом public_repo).";
    }
    if (status === 404) return "Не найдено.";
    if (status === 409) return "Конфликт версий — данные изменились. Обновите страницу.";
    if (status === 422) {
      const m = (body && body.message) || "";
      if (/too large/i.test(m)) return "Файл слишком большой для GitHub API.";
      if (/spam/i.test(m)) return "Слишком частые действия. Подождите минуту.";
      return "Ошибка валидации: " + m;
    }
    return "Ошибка сети или GitHub API (" + (status || "?") + ").";
  }

  /* ---------- ядро запроса ---------- */
  async function request(method, path, opts) {
    opts = opts || {};
    const url = path.startsWith("http") ? path : API + path;
    const headers = {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28"
    };
    if (opts.json !== undefined) headers["Content-Type"] = "application/json";
    if (state.token) headers.Authorization = "Bearer " + state.token;

    let res;
    try {
      res = await fetch(url, {
        method: method,
        headers: headers,
        body: opts.json !== undefined ? JSON.stringify(opts.json) : undefined
      });
    } catch (e) {
      throw new ApiError("Нет соединения с GitHub. Проверьте интернет.", 0, e);
    }

    let body = null;
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("json")) {
      try { body = await res.json(); } catch (e) { body = null; }
    }

    if (!res.ok) {
      throw new ApiError(friendlyError(res.status, body), res.status, body);
    }
    return { status: res.status, headers: res.headers, body: body };
  }

  /* ---------- пользователь ---------- */
  async function fetchUser() {
    const { body } = await request("GET", "/user");
    return body;
  }

  /* ---------- тикеты (посты) ---------- */
  function listIssues(opts) {
    opts = opts || {};
    const q = new URLSearchParams();
    q.set("state", opts.state || "open");
    q.set("per_page", String(opts.per_page || CFG.perPage));
    if (opts.page) q.set("page", String(opts.page));
    if (opts.labels) q.set("labels", opts.labels);
    if (opts.creator) q.set("creator", opts.creator);
    return request("GET", `/repos/${CFG.owner}/${CFG.repo}/issues?${q.toString()}`);
  }
  function getIssue(number) {
    return request("GET", `/repos/${CFG.owner}/${CFG.repo}/issues/${number}`);
  }
  function createIssue(payload) {
    return request("POST", `/repos/${CFG.owner}/${CFG.repo}/issues`, { json: payload });
  }
  function updateIssue(number, payload) {
    return request("PATCH", `/repos/${CFG.owner}/${CFG.repo}/issues/${number}`, { json: payload });
  }
  function closeIssue(number) {
    return request("PATCH", `/repos/${CFG.owner}/${CFG.repo}/issues/${number}`, { json: { state: "closed" } });
  }
  function reopenIssue(number) {
    return request("PATCH", `/repos/${CFG.owner}/${CFG.repo}/issues/${number}`, { json: { state: "open" } });
  }
  function listComments(number, opts) {
    opts = opts || {};
    const q = new URLSearchParams();
    q.set("per_page", String(opts.per_page || 100));
    if (opts.page) q.set("page", String(opts.page));
    return request("GET", `/repos/${CFG.owner}/${CFG.repo}/issues/${number}/comments?${q.toString()}`);
  }
  function createComment(number, body) {
    return request("POST", `/repos/${CFG.owner}/${CFG.repo}/issues/${number}/comments`, { json: { body } });
  }
  function updateComment(commentId, body) {
    return request("PATCH", `/repos/${CFG.owner}/${CFG.repo}/issues/comments/${commentId}`, { json: { body } });
  }
  function deleteComment(commentId) {
    return request("DELETE", `/repos/${CFG.owner}/${CFG.repo}/issues/comments/${commentId}`);
  }

  /* ---------- блокировка обсуждения ---------- */
  function lockIssue(number, reason) {
    return request("PUT", `/repos/${CFG.owner}/${CFG.repo}/issues/${number}/lock`, { json: { lock_reason: reason || "resolved" } });
  }
  function unlockIssue(number) {
    return request("DELETE", `/repos/${CFG.owner}/${CFG.repo}/issues/${number}/lock`);
  }

  /* ---------- реакции ---------- */
  function listReactions(number) {
    return request("GET", `/repos/${CFG.owner}/${CFG.repo}/issues/${number}/reactions?per_page=100`);
  }
  function addReaction(number, content) {
    return request("POST", `/repos/${CFG.owner}/${CFG.repo}/issues/${number}/reactions`, { json: { content } });
  }
  function deleteReaction(reactionId) {
    return request("DELETE", `/repos/${CFG.owner}/${CFG.repo}/reactions/${reactionId}`);
  }

  /* ---------- метки ---------- */
  function listLabels() {
    return request("GET", `/repos/${CFG.owner}/${CFG.repo}/labels?per_page=100`);
  }
  function createLabel(name, color, description) {
    return request("POST", `/repos/${CFG.owner}/${CFG.repo}/labels`, { json: { name, color, description } });
  }

  /* ---------- файлы (contents API) ---------- */
  function contentPath(user, innerPath) {
    let base = CFG.storageRoot + "/" + user;
    if (innerPath) base += "/" + innerPath;
    return base.replace(/\/+/g, "/").replace(/^\/|\/$/g, "");
  }
  function listDir(user, innerPath) {
    const p = contentPath(user, innerPath);
    return request("GET", `/repos/${CFG.owner}/${CFG.repo}/contents/${encodePath(p)}?ref=${encodeURIComponent(CFG.branch)}`);
  }
  function getFileMeta(user, innerPath) {
    const p = contentPath(user, innerPath);
    return request("GET", `/repos/${CFG.owner}/${CFG.repo}/contents/${encodePath(p)}?ref=${encodeURIComponent(CFG.branch)}`);
  }
  function putFile(user, innerPath, base64, message) {
    const p = contentPath(user, innerPath);
    return request("PUT", `/repos/${CFG.owner}/${CFG.repo}/contents/${encodePath(p)}`, {
      json: { message: message, content: base64, branch: CFG.branch }
    });
  }
  function putFileUpdate(user, innerPath, base64, sha, message) {
    const p = contentPath(user, innerPath);
    return request("PUT", `/repos/${CFG.owner}/${CFG.repo}/contents/${encodePath(p)}`, {
      json: { message: message, content: base64, sha: sha, branch: CFG.branch }
    });
  }
  function deleteFile(user, innerPath, sha, message) {
    const p = contentPath(user, innerPath);
    return request("DELETE", `/repos/${CFG.owner}/${CFG.repo}/contents/${encodePath(p)}`, {
      json: { message: message, sha: sha, branch: CFG.branch }
    });
  }
  function createFolder(user, innerPath) {
    const p = contentPath(user, innerPath) + "/.keep";
    const b64 = base64EncodeUnicode("");
    return request("PUT", `/repos/${CFG.owner}/${CFG.repo}/contents/${encodePath(p)}`, {
      json: { message: "Создать папку", content: b64, branch: CFG.branch }
    });
  }

  // path может содержать слэши — кодируем только спецсимволы, не слэши
  function encodePath(p) {
    return p.split("/").map(encodeURIComponent).join("/");
  }

  function base64EncodeUnicode(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(bin);
  }

  /* ---------- публичный API ---------- */
  window.GH = {
    state,
    loadToken, saveToken, saveUser, clearSession,
    getToken, getUser, isLoggedIn,
    request, ApiError,
    fetchUser,
    listIssues, getIssue, createIssue, updateIssue, closeIssue, reopenIssue,
    listComments, createComment, updateComment, deleteComment,
    lockIssue, unlockIssue,
    listReactions, addReaction, deleteReaction,
    listLabels, createLabel,
    contentPath, listDir, getFileMeta, putFile, putFileUpdate, deleteFile, createFolder,
    encodePath, base64EncodeUnicode
  };
})();
