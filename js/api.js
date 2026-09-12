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

  /* ---------- профили, очки и магазин ---------- */
  const PROFILES_DIR = "profiles";
  const SHOP_PATH = "data/shop.json";

  const DEFAULT_SHOP = {
    frames: [],
    badges: []
  };

  function b64decode(str) {
    const bin = atob(String(str).replace(/\s/g, ""));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  function listPath(path) {
    return request("GET", `/repos/${CFG.owner}/${CFG.repo}/contents/${encodePath(path)}?ref=${encodeURIComponent(CFG.branch)}`);
  }

  async function getJson(path) {
    try {
      const { body } = await request("GET", `/repos/${CFG.owner}/${CFG.repo}/contents/${encodePath(path)}?ref=${encodeURIComponent(CFG.branch)}`);
      return { data: JSON.parse(b64decode(body.content)), sha: body.sha };
    } catch (e) {
      if (e.status === 404) return { data: null, sha: null };
      throw e;
    }
  }

  function putJson(path, data, sha, message) {
    const payload = { message: message || "update", content: base64EncodeUnicode(JSON.stringify(data, null, 2)), branch: CFG.branch };
    if (sha) payload.sha = sha;
    return request("PUT", `/repos/${CFG.owner}/${CFG.repo}/contents/${encodePath(path)}`, { json: payload });
  }

  function putRawFile(path, base64, message, sha) {
    const payload = { message: message || "upload", content: base64, branch: CFG.branch };
    if (sha) payload.sha = sha;
    return request("PUT", `/repos/${CFG.owner}/${CFG.repo}/contents/${encodePath(path)}`, { json: payload });
  }

  function deletePath(path, sha, message) {
    return request("DELETE", `/repos/${CFG.owner}/${CFG.repo}/contents/${encodePath(path)}`, {
      json: { message: message || "delete", sha: sha, branch: CFG.branch }
    });
  }

  function rawUrl(path) {
    const p = String(path).split("/").map(encodeURIComponent).join("/");
    return `https://raw.githubusercontent.com/${CFG.owner}/${CFG.repo}/${encodeURIComponent(CFG.branch)}/${p}`;
  }

  function defaultProfile(login) {
    return { login: login, color: "", banner: "", points: 0, owned: [], equipped: { frame: "", badge: "" } };
  }

  async function getProfile(login) {
    try {
      const { data } = await getJson(`${PROFILES_DIR}/${login}.json`);
      const base = defaultProfile(login);
      if (data && typeof data === "object") {
        return Object.assign(base, data, {
          equipped: Object.assign({ frame: "", badge: "" }, data.equipped || {}),
          owned: Array.isArray(data.owned) ? data.owned : []
        });
      }
      return base;
    } catch (e) {
      return defaultProfile(login);
    }
  }

  async function updateProfile(login, mutator) {
    let lastErr = null;
    for (let i = 0; i < 3; i++) {
      try {
        const { data, sha } = await getJson(`${PROFILES_DIR}/${login}.json`);
        const p = data && typeof data === "object" ? Object.assign(defaultProfile(login), data) : defaultProfile(login);
        p.equipped = Object.assign({ frame: "", badge: "" }, p.equipped || {});
        p.owned = Array.isArray(p.owned) ? p.owned : [];
        mutator(p);
        p.updated_at = new Date().toISOString();
        const res = await putJson(`${PROFILES_DIR}/${login}.json`, p, sha, `Профиль ${login}: обновление`);
        return res.body;
      } catch (e) {
        lastErr = e;
        if (e.status !== 409) throw e;
      }
    }
    throw lastErr || new ApiError("Не удалось сохранить профиль (конфликт версий).", 409);
  }

  async function earnPoints(login, amount) {
    if (!amount || !login) return;
    await updateProfile(login, (p) => {
      p.points = Math.max(0, (p.points || 0) + amount);
    });
  }

  async function getShop() {
    const { data, sha } = await getJson(SHOP_PATH);
    if (data && typeof data === "object") {
      return { data: { frames: Array.isArray(data.frames) ? data.frames : [], badges: Array.isArray(data.badges) ? data.badges : [] }, sha: sha };
    }
    return { data: JSON.parse(JSON.stringify(DEFAULT_SHOP)), sha: null };
  }

  function saveShop(shop, sha) {
    return putJson(SHOP_PATH, shop, sha, "Магазин: обновление ассортимента");
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
    encodePath, base64EncodeUnicode,
    b64decode, listPath, getJson, putJson, putRawFile, deletePath, rawUrl,
    defaultProfile, getProfile, updateProfile, earnPoints, getShop, saveShop,
    DEFAULT_SHOP, PROFILES_DIR, SHOP_PATH
  };
})();
