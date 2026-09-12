/* ============================================================
 *  Форум: лента постов, пост, комментарии, реакции
 *  (посты = GitHub Issues с меткой "forum")
 * ============================================================ */
(function () {
  "use strict";

  const { icon, toast, timeAgo, formatDate, escapeHtml, confirmModal } = window.UI;
  const CFG = window.FORUM_CONFIG;

  const state = {
    category: "all",
    search: "",
    page: 1,
    hasMore: false,
    posts: [],
    loading: false,
    perPage: 50
  };

  function getCategory(issue) {
    const names = (issue.labels || []).map((l) => l.name);
    for (const cat of CFG.categories) {
      if (names.includes(cat.label)) return cat;
    }
    return null;
  }

  function isAuthor(issue) {
    return GH.isLoggedIn() && issue.user && issue.user.login === GH.getUser().login;
  }

  function isPinned(issue) {
    return (issue.labels || []).some((l) => l.name === CFG.pinLabel);
  }

  /* ============================================================
   *  ЛЕНТА
   * ============================================================ */
  function renderFeed() {
    const app = document.getElementById("app");
    const { ASCII_LOGO, bootType } = window.UI;
    app.innerHTML = `
      <section class="hero">
        <div class="hero-inner">
          <pre class="ascii-logo">${ASCII_LOGO}</pre>
          <p class="hero-tag">// ${escapeHtml(CFG.siteName)} · терминал-форум · посты = issues · хранилище = репозиторий</p>
          <div class="boot-log" id="bootLog"></div>
          <div class="hero-actions">
            <button class="btn btn-primary btn-lg" id="heroNewPost">${icon("plus")} [ новый_пост ]</button>
            <a class="btn btn-ghost btn-lg" href="#/storage">${icon("folder")} [ хранилище ]</a>
          </div>
        </div>
      </section>

      <div class="forum-toolbar">
        <div class="chips" id="catChips"></div>
        <div class="search-box">
          ${icon("search")}
          <input id="feedSearch" type="search" placeholder="grep постов…" value="${escapeHtml(state.search)}" />
        </div>
        <button class="btn btn-primary" id="feedNewPost">${icon("plus")} Написать</button>
      </div>

      <div id="feedList" class="post-list"></div>
      <div class="load-more" id="loadMoreWrap"></div>`;

    bootType(app.querySelector("#bootLog"), [
      '<span class="dim">$</span> <span class="cyan">init aurora://forum</span>',
      '<span class="dim">…</span> подключение к <span class="cyan">api.github.com</span> <span class="ok">[ok]</span>',
      '<span class="dim">…</span> загрузка каналов <span class="ok">[ok]</span>',
      '<span class="dim">…</span> проверка меток <span class="ok">[ok]</span>',
      '<span class="dim">></span> <span class="mag">ждите, извлекаем данные…</span>'
    ]);

    // чипы категорий
    const chips = app.querySelector("#catChips");
    const all = document.createElement("button");
    all.className = "chip" + (state.category === "all" ? " active" : "");
    all.dataset.cat = "all";
    all.innerHTML = `<span class="dot"></span>Все`;
    all.addEventListener("click", () => setCategory("all"));
    chips.appendChild(all);
    for (const cat of CFG.categories) {
      const b = document.createElement("button");
      b.className = "chip" + (state.category === cat.label ? " active" : "");
      b.dataset.cat = cat.label;
      b.innerHTML = `<span class="dot" style="background:${cat.color}"></span>${escapeHtml(cat.label)}`;
      b.addEventListener("click", () => setCategory(cat.label));
      chips.appendChild(b);
    }

    app.querySelector("#feedList").addEventListener("click", (e) => {
      const card = e.target.closest(".post-card");
      if (card) location.hash = "#/post/" + card.dataset.num;
    });

    app.querySelector("#heroNewPost").addEventListener("click", () => location.hash = "#/new");
    app.querySelector("#feedNewPost").addEventListener("click", () => location.hash = "#/new");

    let debounce;
    app.querySelector("#feedSearch").addEventListener("input", (e) => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        state.search = e.target.value.trim();
        renderList();
      }, 220);
    });

    app.querySelector("#loadMoreWrap").addEventListener("click", (e) => {
      if (e.target.closest("#loadMoreBtn")) loadMore();
    });

    loadPosts(true);
  }

  function setCategory(cat) {
    state.category = cat;
    document.querySelectorAll("#catChips .chip").forEach((c) => {
      c.classList.toggle("active", c.dataset.cat === cat);
    });
    renderList();
  }

  async function loadPosts(reset) {
    if (state.loading) return;
    if (reset) { state.posts = []; state.page = 1; state.hasMore = false; }
    state.loading = true;
    const list = document.getElementById("feedList");
    if (reset) list.innerHTML = `<div class="loading-row"><div class="spinner"></div></div>`;

    try {
      const { body } = await GH.listIssues({ labels: CFG.postsLabel, page: state.page, per_page: state.perPage });
      const fresh = Array.isArray(body) ? body.filter((i) => !i.pull_request) : [];
      if (reset) state.posts = fresh; else state.posts = state.posts.concat(fresh);
      state.hasMore = fresh.length === state.perPage;
      state.page += 1;
      renderList();
    } catch (e) {
      if (reset) list.innerHTML = errorBox(e.message);
      else toast(e.message, "error");
    } finally {
      state.loading = false;
    }
  }

  function loadMore() {
    if (state.hasMore && !state.loading) {
      const wrap = document.getElementById("loadMoreWrap");
      wrap.innerHTML = `<div class="loading-row"><div class="spinner"></div></div>`;
      loadPosts(false);
    }
  }

  function renderList() {
    const list = document.getElementById("feedList");
    const wrap = document.getElementById("loadMoreWrap");
    if (!list) return;

    const filtered = state.posts.filter((p) => {
      if (state.category !== "all") {
        const c = getCategory(p);
        if (!c || c.label !== state.category) return false;
      }
      if (state.search) {
        const hay = (p.title + " " + (p.body || "")).toLowerCase();
        if (!hay.includes(state.search.toLowerCase())) return false;
      }
      return true;
    });

    // закреплённые посты — сверху
    filtered.sort((a, b) => (isPinned(b) ? 1 : 0) - (isPinned(a) ? 1 : 0));

    if (!filtered.length) {
      list.innerHTML = state.search || state.category !== "all"
        ? `<div class="state-box">${icon("search", "big-ic")}<h3>Ничего не найдено</h3><p>Попробуйте другой запрос или категорию.</p></div>`
        : `<div class="state-box">${icon("chat", "big-ic")}<h3>Пока нет постов</h3><p>Станьте первым — напишите первый пост!</p><button class="btn btn-primary" id="emptyNew">${icon("plus")} Создать пост</button></div>`;
      const en = list.querySelector("#emptyNew");
      if (en) en.addEventListener("click", () => location.hash = "#/new");
      wrap.innerHTML = "";
      return;
    }

    list.innerHTML = filtered.map((p, i) => postCardHTML(p, i)).join("");
    wrap.innerHTML = state.hasMore ? `<button class="btn btn-ghost" id="loadMoreBtn">Показать ещё</button>` : "";
  }

  function postCardHTML(p, i) {
    const cat = getCategory(p);
    const preview = escapeHtml(MD.stripMarkdown(p.body).slice(0, 220));
    return `
      <article class="post-card" data-num="${p.number}" style="--i:${i}">
        <div class="post-card-top">
          ${isPinned(p) ? `<span class="cat-badge pinned">${icon("pin")} закреплено</span>` : ""}
          ${cat ? `<span class="cat-badge" style="background:${cat.color}">${icon(cat.icon)} ${escapeHtml(cat.label)}</span>` : ""}
          ${p.state === "closed" ? `<span class="cat-badge closed">закрыт</span>` : ""}
        </div>
        <h2 class="post-card-title">${escapeHtml(p.title)}</h2>
        ${preview ? `<p class="post-card-preview">${preview}</p>` : ""}
        <div class="post-card-meta">
          <span class="post-author">${avatar(p.user)}${escapeHtml(p.user ? p.user.login : "unknown")}</span>
          <span class="item">${icon("refresh")}${timeAgo(p.created_at)}</span>
          <span class="item">${icon("comment")}${p.comments}</span>
        </div>
      </article>`;
  }

  function avatar(user, size) {
    size = size || 64;
    if (!user) return "";
    return `<img src="${escapeHtml(user.avatar_url + "&s=" + size)}" alt="" loading="lazy" width="${size / 2.5}" height="${size / 2.5}" />`;
  }

  function errorBox(msg) {
    return `<div class="state-box">${icon("warning", "big-ic")}<h3>Не удалось загрузить</h3><p class="error-text">${escapeHtml(msg)}</p></div>`;
  }

  /* ============================================================
   *  ПОСТ (детальная страница)
   * ============================================================ */
  async function renderPost(number) {
    const app = document.getElementById("app");
    app.innerHTML = `<div class="loading-row"><div class="spinner"></div></div>`;

    let issue;
    try {
      issue = (await GH.getIssue(number)).body;
    } catch (e) {
      app.innerHTML = errorBox(e.message);
      return;
    }

    const cat = getCategory(issue);
    app.innerHTML = `
      <div class="breadcrumbs">
        <a href="#/forum">${icon("home")}</a> <span>›</span>
        <a href="#/forum">Форум</a> <span>›</span>
        <span>#${issue.number}</span>
      </div>
      <div class="post-detail">
        <article class="card post-article">
          <div class="post-article-header">
            ${cat ? `<span class="cat-badge" style="background:${cat.color}">${icon(cat.icon)} ${escapeHtml(cat.label)}</span>` : ""}
            ${issue.state === "closed" ? `<span class="cat-badge closed">закрыт</span>` : ""}
            ${isPinned(issue) ? `<span class="cat-badge pinned">${icon("pin")} закреплено</span>` : ""}
            <h1>${escapeHtml(issue.title)}</h1>
            <div class="byline">
              ${avatar(issue.user, 80)}
              <span>Автор: <a href="${escapeHtml(issue.user ? issue.user.html_url : "#")}" target="_blank" rel="noopener">${escapeHtml(issue.user ? issue.user.login : "unknown")}</a></span>
              <span>·</span>
              <span>${formatDate(issue.created_at)}</span>
            </div>
          </div>
          <div class="article-body md-content">${MD.renderMarkdown(issue.body)}</div>
          <div class="post-actions-row">
            <button class="like-btn" id="likeBtn">${icon("heart")} <span id="likeCount">…</span></button>
            ${isAuthor(issue) ? `<button class="btn btn-ghost btn-sm" id="editPost">${icon("edit")} Редактировать</button>` : ""}
            ${isAuthor(issue) ? (issue.state === "open"
              ? `<button class="btn btn-ghost btn-sm" id="closePost">Закрыть</button>`
              : `<button class="btn btn-ghost btn-sm" id="reopenPost">Открыть</button>`) : ""}
            <span class="spacer"></span>
            <a class="btn btn-ghost btn-sm" href="${escapeHtml(issue.html_url)}" target="_blank" rel="noopener">${icon("github")} На GitHub</a>
          </div>
        </article>

        <section class="comments-wrap" id="commentsWrap">
          <h2 class="comments-title">Комментарии <span class="count" id="commentsCount"></span></h2>
          <div id="commentsList"></div>
          <div id="commentComposer"></div>
        </section>
      </div>`;

    // реакции
    loadReactions(issue);

    const likeBtn = app.querySelector("#likeBtn");
    likeBtn.addEventListener("click", () => toggleLike(issue));

    const editBtn = app.querySelector("#editPost");
    if (editBtn) editBtn.addEventListener("click", () => renderComposer(issue));
    const closeBtn = app.querySelector("#closePost");
    if (closeBtn) closeBtn.addEventListener("click", async () => {
      const ok = await confirmModal({ title: "Закрыть пост?", message: "Пост исчезнет из ленты, но останется доступным по ссылке.", confirmText: "Закрыть", danger: true });
      if (ok) { try { await GH.closeIssue(issue.number); toast("Пост закрыт.", "success"); location.hash = "#/forum"; } catch (e) { toast(e.message, "error"); } }
    });
    const reopenBtn = app.querySelector("#reopenPost");
    if (reopenBtn) reopenBtn.addEventListener("click", async () => {
      try { await GH.reopenIssue(issue.number); toast("Пост открыт.", "success"); renderPost(issue.number); } catch (e) { toast(e.message, "error"); }
    });

    loadComments(issue);
    renderCommentComposer(issue);
  }

  async function loadReactions(issue) {
    const btn = document.getElementById("likeBtn");
    const countEl = document.getElementById("likeCount");
    try {
      const { body } = await GH.listReactions(issue.number);
      const total = (body || []).length;
      const mine = GH.isLoggedIn() && (body || []).some((r) => r.user && r.user.login === GH.getUser().login);
      countEl.textContent = total;
      if (mine) { btn.classList.add("liked"); btn.dataset.mine = "1"; }
      btn.dataset.ready = "1";
    } catch (e) {
      countEl.textContent = "—";
      btn.title = e.message;
    }
  }

  async function toggleLike(issue) {
    if (!GH.isLoggedIn()) { toast("Войдите, чтобы ставить лайки.", "info"); location.hash = "#/login"; return; }
    const btn = document.getElementById("likeBtn");
    btn.disabled = true;
    try {
      const { body } = await GH.listReactions(issue.number);
      const mine = (body || []).find((r) => r.user && r.user.login === GH.getUser().login);
      if (mine) {
        await GH.deleteReaction(mine.id);
        btn.classList.remove("liked");
      } else {
        await GH.addReaction(issue.number, "+1");
        btn.classList.add("liked");
        UI.asciiBurst(btn);
      }
      loadReactions(issue);
    } catch (e) {
      toast(e.message, "error");
    } finally {
      btn.disabled = false;
    }
  }

  /* ============================================================
   *  КОММЕНТАРИИ
   * ============================================================ */
  async function loadComments(issue) {
    const list = document.getElementById("commentsList");
    const countEl = document.getElementById("commentsCount");
    list.innerHTML = `<div class="loading-row"><div class="spinner"></div></div>`;
    try {
      const { body } = await GH.listComments(issue.number);
      countEl.textContent = "· " + (body || []).length;
      if (!(body || []).length) {
        list.innerHTML = `<div class="state-box" style="padding:26px;">${icon("comment", "big-ic")}<p>Комментариев пока нет — будьте первым!</p></div>`;
        return;
      }
      list.innerHTML = body.map(commentHTML).join("");
      list.querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => editComment(b.dataset.edit)));
      list.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", () => deleteCommentFlow(b.dataset.del)));
    } catch (e) {
      list.innerHTML = errorBox(e.message);
    }
  }

  function commentHTML(c) {
    const mine = GH.isLoggedIn() && c.user && c.user.login === GH.getUser().login;
    return `
      <div class="card comment" data-comment="${c.id}">
        <div class="comment-head">
          ${avatar(c.user, 80)}
          <div class="who">
            <div><a href="${escapeHtml(c.user ? c.user.html_url : "#")}" target="_blank" rel="noopener">${escapeHtml(c.user ? c.user.login : "unknown")}</a>${c.author_association === "OWNER" || c.author_association === "MEMBER" ? `<span class="badge-author">автор</span>` : ""}</div>
            <span class="when">${formatDate(c.created_at)}</span>
          </div>
          ${mine ? `<div class="comment-actions">
            <button class="icon-btn" data-edit="${c.id}" title="Редактировать">${icon("edit")}</button>
            <button class="icon-btn" data-del="${c.id}" title="Удалить">${icon("trash")}</button>
          </div>` : ""}
        </div>
        <div class="comment-body md-content">${MD.renderMarkdown(c.body)}</div>
      </div>`;
  }

  function renderCommentComposer(issue) {
    const wrap = document.getElementById("commentComposer");
    if (!GH.isLoggedIn()) {
      wrap.innerHTML = `<div class="card" style="padding:16px 20px;display:flex;align-items:center;gap:12px;">
        <span class="muted" style="font-size:14.5px;">Войдите, чтобы оставить комментарий.</span>
        <button class="btn btn-ghost btn-sm" id="loginToComment">${icon("github")} Войти</button>
      </div>`;
      wrap.querySelector("#loginToComment").addEventListener("click", () => location.hash = "#/login");
      return;
    }
    const u = GH.getUser();
    wrap.innerHTML = `
      <div class="card" style="padding:16px 20px;">
        <div class="comment-composer">
          <img class="gh-avatar" src="${escapeHtml(u.avatar_url)}" alt="" />
          <div style="flex:1;">
            <div class="md-editor">
              <div class="md-toolbar"></div>
              <textarea class="textarea" id="commentText" placeholder="Напишите комментарий… (поддерживается Markdown)"></textarea>
            </div>
            <div class="composer-foot">
              <button class="btn btn-primary" id="sendComment">${icon("comment")} Отправить</button>
            </div>
          </div>
        </div>
      </div>`;
    const ta = wrap.querySelector("#commentText");
    attachMdToolbar(ta, wrap.querySelector(".md-toolbar"));
    wrap.querySelector("#sendComment").addEventListener("click", async () => {
      const val = ta.value.trim();
      if (!val) { toast("Комментарий пуст.", "info"); return; }
      const btn = wrap.querySelector("#sendComment");
      btn.disabled = true; btn.textContent = "Отправка…";
      try {
        await GH.createComment(issue.number, val);
        ta.value = "";
        toast("Комментарий опубликован.", "success");
        loadComments(issue);
      } catch (e) {
        toast(e.message, "error");
      } finally {
        btn.disabled = false; btn.innerHTML = `${icon("comment")} Отправить`;
      }
    });
  }

  function editComment(id) {
    const el = document.querySelector(`[data-comment="${id}"] .comment-body`);
    const orig = el.dataset.orig || el.textContent;
    // получаем исходный markdown из data-атрибута, если есть
    // проще: открываем prompt-модалку с textarea
    const root = document.getElementById("modal-root");
    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";
    backdrop.innerHTML = `
      <div class="modal" style="max-width:560px;">
        <h3>Редактировать комментарий</h3>
        <textarea id="editCommentTa" class="textarea" style="min-height:140px;"></textarea>
        <div class="modal-actions" style="margin-top:14px;">
          <button class="btn btn-ghost" id="editCancel">Отмена</button>
          <button class="btn btn-primary" id="editSave">Сохранить</button>
        </div>
      </div>`;
    root.appendChild(backdrop);
    const ta = backdrop.querySelector("#editCommentTa");
    ta.value = el.dataset.md || "";
    const cleanup = () => backdrop.remove();
    backdrop.querySelector("#editCancel").addEventListener("click", cleanup);
    backdrop.addEventListener("click", (e) => { if (e.target === backdrop) cleanup(); });
    backdrop.querySelector("#editSave").addEventListener("click", async () => {
      const val = ta.value.trim();
      if (!val) { cleanup(); return; }
      try {
        await GH.updateComment(id, val);
        toast("Комментарий обновлён.", "success");
        cleanup();
        // перезагружаем текущий пост
        const m = location.hash.match(/#\/post\/(\d+)/);
        if (m) renderPost(parseInt(m[1], 10));
      } catch (e) { toast(e.message, "error"); }
    });
  }

  async function deleteCommentFlow(id) {
    const ok = await confirmModal({ title: "Удалить комментарий?", message: "Это действие необратимо.", confirmText: "Удалить", danger: true });
    if (!ok) return;
    try {
      await GH.deleteComment(id);
      toast("Комментарий удалён.", "success");
      const m = location.hash.match(/#\/post\/(\d+)/);
      if (m) renderPost(parseInt(m[1], 10));
    } catch (e) { toast(e.message, "error"); }
  }

  // сохраняем исходный markdown комментариев для редактирования
  // (при рендере добавляем data-md)
  const _origCommentHTML = commentHTML;
  commentHTML = function (c) {
    return _origCommentHTML(c).replace('<div class="comment-body md-content">', `<div class="comment-body md-content" data-md="${escapeAttr(c.body)}">`);
  };
  function escapeAttr(s) {
    return String(s || "").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  /* ============================================================
   *  СОЗДАНИЕ / РЕДАКТИРОВАНИЕ ПОСТА
   * ============================================================ */
  function renderComposer(existing) {
    if (!GH.isLoggedIn()) { toast("Войдите, чтобы писать посты.", "info"); location.hash = "#/login"; return; }
    const app = document.getElementById("app");
    const isEdit = !!existing;
    app.innerHTML = `
      <div class="breadcrumbs">
        <a href="#/forum">${icon("home")}</a> <span>›</span>
        <a href="#/forum">Форум</a> <span>›</span>
        <span>${isEdit ? "Редактирование поста" : "Новый пост"}</span>
      </div>
      <form class="card form-card" id="postForm" style="max-width:820px;">
        <h2 style="margin:0 0 4px;font-size:22px;font-weight:800;">${isEdit ? "Редактировать пост" : "Новый пост"}</h2>
        <p class="muted" style="margin:0 0 20px;font-size:14px;">${isEdit ? "Измените заголовок, категорию или текст." : "Расскажите сообществу о чём-то важном."}</p>

        <div class="field">
          <label for="postTitle">Заголовок</label>
          <input class="input" id="postTitle" placeholder="О чём этот пост?" maxlength="256" value="${escapeHtml(existing ? existing.title : "")}" />
        </div>

        <div class="field">
          <label for="postCat">Категория</label>
          <select class="select" id="postCat">
            ${CFG.categories.map((c) => `<option value="${escapeHtml(c.label)}" ${existing && getCategory(existing) && getCategory(existing).label === c.label ? "selected" : (!existing && c.label === CFG.defaultCategory ? "selected" : "")}>${escapeHtml(c.label)}</option>`).join("")}
          </select>
        </div>

        <div class="field">
          <label>Текст <span class="muted" style="font-weight:400;">(Markdown)</span></label>
          <div class="md-editor">
            <div class="md-toolbar"></div>
            <textarea class="textarea" id="postBody" rows="12" placeholder="Введите текст… Поддерживаются **жирный**, *курсив*, списки, код, ссылки и картинки.">${escapeHtml(existing ? existing.body : "")}</textarea>
          </div>
          <div class="editor-tabs">
            <button type="button" class="active" id="tabWrite">Писать</button>
            <button type="button" id="tabPreview">Предпросмотр</button>
          </div>
          <div class="md-preview md-content hidden" id="postPreview"></div>
        </div>

        <div class="flex" style="justify-content:flex-end;gap:10px;margin-top:8px;">
          <a class="btn btn-ghost" href="#/forum">Отмена</a>
          <button type="submit" class="btn btn-primary btn-lg" id="postSubmit">${isEdit ? "Сохранить" : "Опубликовать"}</button>
        </div>
      </form>`;

    const ta = app.querySelector("#postBody");
    attachMdToolbar(ta, app.querySelector(".md-toolbar"));

    const preview = app.querySelector("#postPreview");
    const tabWrite = app.querySelector("#tabWrite");
    const tabPreview = app.querySelector("#tabPreview");
    tabWrite.addEventListener("click", () => { tabWrite.classList.add("active"); tabPreview.classList.remove("active"); preview.classList.add("hidden"); ta.classList.remove("hidden"); });
    tabPreview.addEventListener("click", () => { tabPreview.classList.add("active"); tabWrite.classList.remove("active"); preview.classList.remove("hidden"); ta.classList.add("hidden"); preview.innerHTML = MD.renderMarkdown(ta.value); });

    app.querySelector("#postForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const title = app.querySelector("#postTitle").value.trim();
      const body = ta.value.trim();
      const cat = app.querySelector("#postCat").value;
      if (!title) { toast("Введите заголовок.", "info"); return; }
      if (!body) { toast("Введите текст поста.", "info"); return; }

      const btn = app.querySelector("#postSubmit");
      btn.disabled = true; btn.textContent = isEdit ? "Сохраняем…" : "Публикуем…";
      try {
        if (isEdit) {
          await GH.updateIssue(existing.number, { title, body, labels: [CFG.postsLabel, cat] });
          toast("Пост обновлён.", "success");
          location.hash = "#/post/" + existing.number;
        } else {
          const { body: created } = await GH.createIssue({ title, body, labels: [CFG.postsLabel, cat] });
          toast("Пост опубликован!", "success");
          location.hash = "#/post/" + created.number;
        }
      } catch (err) {
        toast(err.message, "error");
        btn.disabled = false; btn.textContent = isEdit ? "Сохранить" : "Опубликовать";
      }
    });
  }

  /* ============================================================
   *  Панель Markdown
   * ============================================================ */
  function attachMdToolbar(ta, toolbar) {
    const btns = [
      { label: "B", title: "Жирный", before: "**", after: "**", ph: "жирный" },
      { label: "I", title: "Курсив", before: "*", after: "*", ph: "курсив" },
      { label: "S", title: "Зачёркнутый", before: "~~", after: "~~", ph: "зачёркнутый" },
      { label: "H", title: "Заголовок", before: "\n## ", after: "", ph: "Заголовок", line: true },
      { label: "`", title: "Код", before: "`", after: "`", ph: "код" },
      { label: "```", title: "Блок кода", before: "\n```\n", after: "\n```\n", ph: "код" },
      { label: "•", title: "Список", before: "\n- ", after: "", ph: "элемент", line: true },
      { label: "❝", title: "Цитата", before: "\n> ", after: "", ph: "цитата", line: true }
    ];
    toolbar.innerHTML = "";
    btns.forEach((b, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.title = b.title;
      btn.textContent = b.label;
      if (b.line) btn.style.fontWeight = "700";
      btn.addEventListener("mousedown", (e) => { e.preventDefault(); });
      btn.addEventListener("click", () => wrapSelection(ta, b.before, b.after, b.ph));
      toolbar.appendChild(btn);
      if (b.line) {
        const div = document.createElement("span");
        div.className = "md-divider";
        toolbar.appendChild(div);
      }
    });
    // ссылка
    const link = document.createElement("button");
    link.type = "button"; link.title = "Ссылка"; link.innerHTML = icon("link");
    link.style.width = "32px"; link.style.height = "32px"; link.style.display = "inline-grid"; link.style.placeItems = "center";
    link.addEventListener("mousedown", (e) => e.preventDefault());
    link.addEventListener("click", () => wrapSelection(ta, "[", "](https://)", "текст ссылки"));
    toolbar.appendChild(link);
    // картинка
    const img = document.createElement("button");
    img.type = "button"; img.title = "Картинка"; img.innerHTML = icon("image");
    img.style.width = "32px"; img.style.height = "32px"; img.style.display = "inline-grid"; img.style.placeItems = "center";
    img.addEventListener("mousedown", (e) => e.preventDefault());
    img.addEventListener("click", () => wrapSelection(ta, "![", "](https://)", "описание"));
    toolbar.appendChild(img);
  }

  function wrapSelection(ta, before, after, placeholder) {
    const start = ta.selectionStart, end = ta.selectionEnd;
    const selected = ta.value.slice(start, end);
    const insert = before + (selected || placeholder) + after;
    ta.setRangeText(insert, start, end, "end");
    ta.focus();
    if (!selected) {
      const phStart = start + before.length;
      ta.setSelectionRange(phStart, phStart + placeholder.length);
    }
  }

  window.FORUM = { renderFeed, renderPost, renderComposer };
})();
