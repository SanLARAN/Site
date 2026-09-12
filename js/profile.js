/* ============================================================
 *  Профили: кастомизация (цвет, баннер, рамки, значки),
 *  очки, декорация аватарок по всему сайту
 * ============================================================ */
(function () {
  "use strict";

  const { icon, toast, timeAgo, formatBytes, escapeHtml } = window.UI;
  const CFG = window.FORUM_CONFIG;

  /* ---------- кэши ---------- */
  const ProfileCache = {
    map: {},
    async get(login) {
      if (this.map[login]) return this.map[login];
      const p = await GH.getProfile(login);
      this.map[login] = p;
      return p;
    },
    invalidate(login) { delete this.map[login]; }
  };

  const ShopCache = {
    cache: null,
    async get() {
      if (!this.cache) this.cache = await GH.getShop();
      return this.cache.data;
    },
    async getRaw() {
      if (!this.cache) this.cache = await GH.getShop();
      return this.cache;
    },
    invalidate() { this.cache = null; }
  };

  /* ---------- очки ---------- */
  async function earn(login, action) {
    const amt = (CFG.points || {})[action] || 0;
    if (!amt || !login) return 0;
    try {
      await GH.earnPoints(login, amt);
      ProfileCache.invalidate(login);
      return amt;
    } catch (e) {
      console.warn("[points] earn failed:", e.message);
      return 0;
    }
  }

  /* ---------- декорация аватарок/значков ---------- */
  async function decorateUsers(root) {
    if (!root || !root.querySelectorAll) return;
    const nodes = root.querySelectorAll(".uframe[data-user], .nb[data-user], .uname[data-user]");
    if (!nodes.length) return;

    const logins = [];
    nodes.forEach((n) => {
      const l = n.getAttribute("data-user");
      if (l && logins.indexOf(l) === -1) logins.push(l);
    });

    let shop;
    try { shop = await ShopCache.get(); } catch (e) { return; }
    const frames = {}; (shop.frames || []).forEach((f) => frames[f.id] = f);
    const badges = {}; (shop.badges || []).forEach((b) => badges[b.id] = b);

    for (const login of logins) {
      let p;
      try { p = await ProfileCache.get(login); } catch (e) { continue; }
      const frame = p.equipped && p.equipped.frame ? frames[p.equipped.frame] : null;
      const badge = p.equipped && p.equipped.badge ? badges[p.equipped.badge] : null;

      root.querySelectorAll(".uframe[data-user]").forEach((el) => {
        if (el.getAttribute("data-user") !== login) return;
        if (frame) {
          el.classList.add("has-frame");
          el.style.background = frame.bg || "";
          el.style.boxShadow = frame.shadow || "";
          el.title = frame.name;
        }
      });
      root.querySelectorAll(".nb[data-user]").forEach((el) => {
        if (el.getAttribute("data-user") !== login) return;
        if (badge) {
          el.style.display = "inline-flex";
          el.textContent = badge.label || "";
          el.style.background = badge.bg || "";
          el.style.color = badge.color || "";
          el.title = badge.name;
        } else {
          el.style.display = "none";
        }
      });
      root.querySelectorAll(".uname[data-user]").forEach((el) => {
        if (el.getAttribute("data-user") !== login) return;
        if (p.color) el.style.color = p.color;
      });
    }
  }

  /* ---------- служебное ---------- */
  function readFileBase64(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => { const i = r.result.indexOf(","); resolve(r.result.slice(i + 1)); };
      r.onerror = () => reject(new Error("Не удалось прочитать файл"));
      r.readAsDataURL(file);
    });
  }

  async function equipItem(login, kind, id, on) {
    try {
      await GH.updateProfile(login, (p) => {
        p.equipped = p.equipped || { frame: "", badge: "" };
        p.equipped[kind] = on ? id : "";
      });
      ProfileCache.invalidate(login);
      return true;
    } catch (e) { return false; }
  }

  /* ============================================================
   *  СТРАНИЦА ПРОФИЛЯ
   * ============================================================ */
  async function renderProfile() {
    const app = document.getElementById("app");
    if (!GH.isLoggedIn()) { location.hash = "#/login"; return; }
    const u = GH.getUser();
    const login = u.login;
    app.innerHTML = `<div class="loading-row"><div class="spinner"></div></div>`;

    let prof;
    try { prof = await ProfileCache.get(login); } catch (e) { prof = GH.defaultProfile(login); }

    let posts = [], filesCount = null, totalSize = null;
    try {
      const r = await GH.listIssues({ creator: login, labels: CFG.postsLabel, state: "all", per_page: 100 });
      posts = (r.body || []).filter((i) => !i.pull_request);
    } catch (e) {}
    try {
      const { body } = await GH.request("GET", `/repos/${CFG.owner}/${CFG.repo}/git/trees/${encodeURIComponent(CFG.branch)}?recursive=1`);
      const prefix = CFG.storageRoot + "/" + login + "/";
      const blobs = (body.tree || []).filter((t) => t.type === "blob" && t.path.startsWith(prefix));
      filesCount = blobs.filter((b) => !b.path.endsWith("/.keep")).length;
      totalSize = blobs.reduce((s, b) => s + (b.size || 0), 0);
    } catch (e) {}

    const bannerHtml = prof.banner
      ? `<img class="banner-img" src="${escapeHtml(GH.rawUrl(prof.banner))}?cb=${Date.now()}" alt="баннер" />`
      : `<div class="banner-img banner-placeholder" style="--uc:${escapeHtml(prof.color || "#3a3a3a")}"></div>`;

    app.innerHTML = `
      <div class="breadcrumbs">
        <a href="#/forum">${icon("home")}</a> <span>›</span>
        <span>Профиль</span>
      </div>

      <div class="profile-wrap">
        <div class="card profile-hero">
          <div class="banner">
            ${bannerHtml}
            <div class="banner-actions">
              <label class="icon-btn" title="Загрузить баннер (GIF/PNG/JPG)">${icon("image")}<input type="file" id="bannerInput" accept=".gif,.png,.jpg,.jpeg,.webp" class="hidden" /></label>
              ${prof.banner ? `<button class="icon-btn" id="bannerRemove" title="Убрать баннер">${icon("trash")}</button>` : ""}
              <label class="icon-btn" title="Цвет профиля">${icon("palette")}<input type="color" id="colorInput" value="${escapeHtml(prof.color || "#ffffff")}" class="hidden" /></label>
            </div>
          </div>
          <div class="profile-hero-body">
            <span class="uframe big" data-user="${escapeHtml(login)}"><img class="gh-avatar big" src="${escapeHtml(u.avatar_url + "&s=200")}" alt="" /></span>
            <div class="profile-hero-info">
              <h2 class="uname" data-user="${escapeHtml(login)}">${escapeHtml(u.name || login)}</h2>
              <div class="profile-hero-sub">
                <span class="muted">@${escapeHtml(login)}</span>
                <span class="nb" data-user="${escapeHtml(login)}"></span>
              </div>
              <div class="points-badge" id="pointsBadge">${icon("star")} ${prof.points || 0} очков</div>
              <div class="profile-stats">
                <div class="stat"><b>${posts.length}</b><span>${window.UI.ruPlural(posts.length, "пост", "поста", "постов")}</span></div>
                <div class="stat"><b>${filesCount == null ? "—" : filesCount}</b><span>файлов</span></div>
                <div class="stat"><b>${totalSize == null ? "—" : formatBytes(totalSize)}</b><span>занято</span></div>
              </div>
              <div class="profile-actions">
                <a class="btn btn-primary btn-sm" href="#/new">${icon("plus")} Новый пост</a>
                <a class="btn btn-ghost btn-sm" href="#/storage">${icon("folder")} Хранилище</a>
                <a class="btn btn-ghost btn-sm" href="#/shop">${icon("cart")} Магазин</a>
              </div>
            </div>
          </div>
        </div>

        <div class="card admin-section">
          <h3>${icon("gift")} Мои предметы</h3>
          <div id="ownedItems"><div class="loading-row"><div class="spinner"></div></div></div>
        </div>

        <h2 class="comments-title" style="margin-top:8px;">Мои посты</h2>
        <div class="post-list" id="myPosts"></div>
      </div>`;

    decorateUsers(app);
    renderOwnedItems(login, prof);
    renderMyPosts(posts);

    // обработчики
    const colorInput = app.querySelector("#colorInput");
    if (colorInput) {
      colorInput.addEventListener("change", async () => {
        try {
          await GH.updateProfile(login, (p) => { p.color = colorInput.value; });
          ProfileCache.invalidate(login);
          toast("Цвет сохранён.", "success");
          renderProfile();
        } catch (e) { toast(e.message, "error"); }
      });
    }
    const bannerInput = app.querySelector("#bannerInput");
    if (bannerInput) bannerInput.addEventListener("change", (e) => {
      if (e.target.files && e.target.files[0]) uploadBanner(login, e.target.files[0]);
    });
    const bannerRemove = app.querySelector("#bannerRemove");
    if (bannerRemove) bannerRemove.addEventListener("click", () => removeBanner(login));
  }

  async function uploadBanner(login, file) {
    const m = file.name.match(/\.(gif|png|jpe?g|webp)$/i);
    if (!m) { toast("Поддерживаются GIF, PNG, JPG, WebP.", "error"); return; }
    const ext = m[1].toLowerCase() === "jpeg" ? "jpg" : m[1].toLowerCase();
    toast("Загружаем баннер…", "info");
    try {
      const base64 = await readFileBase64(file);
      // удаляем старые баннеры
      let entries = [];
      try { const r = await GH.listPath(`${GH.PROFILES_DIR}/${login}`); entries = Array.isArray(r.body) ? r.body : []; } catch (e) {}
      for (const en of entries) {
        if (/^banner\./i.test(en.name)) {
          try { await GH.deletePath(`${GH.PROFILES_DIR}/${login}/${en.name}`, en.sha, "Удалить баннер"); } catch (e) {}
        }
      }
      const path = `${GH.PROFILES_DIR}/${login}/banner.${ext}`;
      await GH.putRawFile(path, base64, "Загрузить баннер профиля", null);
      await GH.updateProfile(login, (p) => { p.banner = path; });
      ProfileCache.invalidate(login);
      toast("Баннер обновлён.", "success");
      renderProfile();
    } catch (e) {
      toast(e.message, "error");
    }
  }

  async function removeBanner(login) {
    try {
      const prof = await ProfileCache.get(login);
      if (prof.banner) {
        try {
          const { body } = await GH.request("GET", `/repos/${CFG.owner}/${CFG.repo}/contents/${GH.encodePath(prof.banner)}?ref=${encodeURIComponent(CFG.branch)}`);
          await GH.deletePath(prof.banner, body.sha, "Удалить баннер");
        } catch (e) {}
      }
      await GH.updateProfile(login, (p) => { p.banner = ""; });
      ProfileCache.invalidate(login);
      toast("Баннер убран.", "success");
      renderProfile();
    } catch (e) { toast(e.message, "error"); }
  }

  /* ---------- предметы пользователя ---------- */
  async function renderOwnedItems(login, prof) {
    const el = document.getElementById("ownedItems");
    if (!el) return;
    let shop;
    try { shop = await ShopCache.get(); } catch (e) {
      el.innerHTML = `<p class="error-text">${escapeHtml(e.message)}</p>`;
      return;
    }
    const frames = shop.frames.filter((f) => (prof.owned || []).includes(f.id));
    const badges = shop.badges.filter((b) => (prof.owned || []).includes(b.id));

    if (!frames.length && !badges.length) {
      el.innerHTML = `<div class="state-box" style="padding:22px;">
        <p>У вас пока нет предметов. Зарабатывайте очки за активность и заходите в <a href="#/shop">магазин</a>.</p>
        <a class="btn btn-ghost btn-sm" href="#/shop">${icon("cart")} Открыть магазин</a>
      </div>`;
      return;
    }

    el.innerHTML = `
      <div class="owned-grid">
        ${frames.length ? `<div class="owned-col"><h4>Рамки аватарки</h4><div class="items-grid">${frames.map((f) => itemCard(f, "frame", prof)).join("")}</div></div>` : ""}
        ${badges.length ? `<div class="owned-col"><h4>Значки</h4><div class="items-grid">${badges.map((b) => itemCard(b, "badge", prof)).join("")}</div></div>` : ""}
      </div>`;

    el.querySelectorAll("[data-equip]").forEach((b) => {
      b.addEventListener("click", async () => {
        const id = b.dataset.equip;
        const kind = b.dataset.kind;
        const on = b.dataset.on === "1";
        const ok = await equipItem(login, kind, id, on);
        if (ok) { toast(on ? "Надето." : "Снято.", "success"); renderProfile(); }
        else toast("Не удалось сохранить.", "error");
      });
    });
  }

  function itemCard(item, kind, prof) {
    const equipped = prof.equipped && prof.equipped[kind] === item.id;
    const preview = kind === "frame"
      ? `<div class="item-preview"><span class="frame-preview" style="background:${escapeHtml(item.bg || "")};box-shadow:${escapeHtml(item.shadow || "")}"></span></div>`
      : `<div class="item-preview"><span class="badge-preview" style="background:${escapeHtml(item.bg || "")};color:${escapeHtml(item.color || "")}">${escapeHtml(item.label || item.name)}</span></div>`;
    return `
      <div class="card item-card">
        ${preview}
        <div class="item-name">${escapeHtml(item.name)}</div>
        <button class="btn btn-sm ${equipped ? "btn-ghost" : "btn-primary"}" data-equip="${escapeHtml(item.id)}" data-kind="${kind}" data-on="${equipped ? "0" : "1"}">
          ${equipped ? "Снять" : "Надеть"}
        </button>
      </div>`;
  }

  /* ---------- мои посты ---------- */
  function renderMyPosts(posts) {
    const list = document.getElementById("myPosts");
    if (!list) return;
    if (!posts.length) {
      list.innerHTML = `<div class="state-box">${icon("chat", "big-ic")}<h3>Постов пока нет</h3><p>Напишите свой первый пост!</p></div>`;
      return;
    }
    list.innerHTML = posts.map((p) => {
      const cat = (p.labels || []).find((l) => CFG.categories.some((c) => c.label === l.name));
      return `
        <article class="post-card" data-num="${p.number}">
          <div class="post-card-top">${cat ? `<span class="cat-badge" style="background:${cat.color}">${escapeHtml(cat.name)}</span>` : ""}${p.state === "closed" ? `<span class="cat-badge closed">закрыт</span>` : ""}</div>
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

  window.PROFILES = { ProfileCache, ShopCache, earn, decorateUsers, equipItem, renderProfile };
})();
