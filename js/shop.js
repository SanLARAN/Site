/* ============================================================
 *  Магазин: рамки аватарок и значки за очки.
 *  Товары — картинки (PNG/SVG/GIF), которые добавляет
 *  администратор (CFG.admin) через интерфейс.
 * ============================================================ */
(function () {
  "use strict";

  const { icon, toast, escapeHtml, confirmModal } = window.UI;
  const CFG = window.FORUM_CONFIG;
  const { ProfileCache, ShopCache, equipItem } = window.PROFILES;

  const IMG_ACCEPT = ".png,.svg,.gif,.webp,.jpg,.jpeg";

  function isAdmin() {
    return window.ADMIN && window.ADMIN.isAdmin && window.ADMIN.isAdmin();
  }

  async function renderShop() {
    if (!GH.isLoggedIn()) { location.hash = "#/login"; return; }
    const app = document.getElementById("app");
    const u = GH.getUser();
    const login = u.login;

    let prof, shop;
    try {
      prof = await ProfileCache.get(login);
      shop = await ShopCache.get();
    } catch (e) {
      app.innerHTML = `<div class="state-box">${icon("warning", "big-ic")}<h3>Ошибка</h3><p class="error-text">${escapeHtml(e.message)}</p></div>`;
      return;
    }

    app.innerHTML = `
      <div class="breadcrumbs">
        <a href="#/forum">${icon("home")}</a> <span>›</span>
        <span>Магазин</span>
      </div>

      <div class="shop-head">
        <h2>${icon("cart")} Магазин</h2>
        <span class="points-badge">${icon("star")} ${prof.points || 0} очков</span>
        <span class="spacer"></span>
        ${isAdmin() ? `<button class="btn btn-primary btn-sm" id="addItem">${icon("plus")} Добавить товар</button>` : ""}
      </div>

      <section class="card admin-section">
        <h3>${icon("palette")} Рамки аватарки</h3>
        <div class="items-grid" id="framesGrid">
          ${shop.frames.length ? shop.frames.map((f) => shopItem(f, "frame", prof)).join("") : emptyHint("Пока нет рамок.")}
        </div>
      </section>

      <section class="card admin-section" style="margin-top:14px;">
        <h3>${icon("star")} Значки у ника</h3>
        <div class="items-grid" id="badgesGrid">
          ${shop.badges.length ? shop.badges.map((b) => shopItem(b, "badge", prof)).join("") : emptyHint("Пока нет значков.")}
        </div>
      </section>

      <div class="auth-note" style="margin-top:14px;">
        <b>Как заработать очки:</b> пост +${CFG.points.post} · комментарий +${CFG.points.comment} · лайк +${CFG.points.like} · лайк вашего поста +${CFG.points.receiveLike}.
      </div>`;

    bindItemActions(app, login, prof);

    const addBtn = app.querySelector("#addItem");
    if (addBtn) addBtn.addEventListener("click", () => renderAddForm());
  }

  function emptyHint(text) {
    return `<div class="state-box" style="padding:20px;grid-column:1/-1;"><p>${escapeHtml(text)}</p></div>`;
  }

  function shopItem(item, kind, prof) {
    const owned = (prof.owned || []).includes(item.id);
    const equipped = prof.equipped && prof.equipped[kind] === item.id;
    const canBuy = (prof.points || 0) >= item.price;
    const src = escapeHtml(GH.rawUrl(item.image));

    const preview = kind === "frame"
      ? `<div class="item-preview"><span class="frame-preview" style="background-image:url('${src}')"></span></div>`
      : `<div class="item-preview"><img class="badge-preview-img" src="${src}" alt="" loading="lazy" /></div>`;

    let actionBtn;
    if (owned) {
      actionBtn = `<button class="btn btn-sm ${equipped ? "btn-ghost" : "btn-primary"}" data-equip="${escapeHtml(item.id)}" data-kind="${kind}" data-on="${equipped ? "0" : "1"}">${equipped ? "Снять" : "Надеть"}</button>`;
    } else {
      actionBtn = `<button class="btn btn-sm btn-primary" data-buy="${escapeHtml(item.id)}" data-kind="${kind}" ${canBuy ? "" : "disabled"}>${icon("star")} ${item.price}</button>`;
    }

    return `
      <div class="card item-card">
        ${preview}
        <div class="item-name">${escapeHtml(item.name)}</div>
        <div class="item-price">${owned ? "куплено" : item.price + " очков"}</div>
        <div class="item-actions">
          ${actionBtn}
          ${isAdmin() ? `<button class="icon-btn" data-del="${escapeHtml(item.id)}" data-kind="${kind}" title="Удалить товар">${icon("trash")}</button>` : ""}
        </div>
      </div>`;
  }

  function bindItemActions(app, login, prof) {
    app.querySelectorAll("[data-buy]").forEach((b) => b.addEventListener("click", () => {
      buyItem(login, b.dataset.kind, b.dataset.buy);
    }));
    app.querySelectorAll("[data-equip]").forEach((b) => b.addEventListener("click", async () => {
      const id = b.dataset.equip;
      const kind = b.dataset.kind;
      const on = b.dataset.on === "1";
      const ok = await equipItem(login, kind, id, on);
      if (ok) { toast(on ? "Надето." : "Снято.", "success"); renderShop(); }
      else toast("Не удалось сохранить.", "error");
    }));
    app.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", () => {
      deleteItem(b.dataset.kind, b.dataset.del);
    }));
  }

  async function buyItem(login, kind, id) {
    const shop = await ShopCache.get();
    const list = kind === "frame" ? shop.frames : shop.badges;
    const item = list.find((i) => i.id === id);
    if (!item) return;
    const prof = await ProfileCache.get(login);
    if ((prof.points || 0) < item.price) { toast("Не хватает очков.", "error"); return; }
    const ok = await confirmModal({
      title: "Купить «" + item.name + "»?",
      message: `С вашего счёта спишется ${item.price} очков.`,
      confirmText: "Купить"
    });
    if (!ok) return;
    try {
      await GH.updateProfile(login, (p) => {
        p.points = Math.max(0, (p.points || 0) - item.price);
        p.owned = p.owned || [];
        if (p.owned.indexOf(id) === -1) p.owned.push(id);
      });
      ProfileCache.invalidate(login);
      toast("Предмет куплен!", "success");
      renderShop();
    } catch (e) { toast(e.message, "error"); }
  }

  /* ---------- админ: добавление товара (картинка) ---------- */
  function renderAddForm() {
    const root = document.getElementById("modal-root");
    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";
    backdrop.innerHTML = `
      <div class="modal" style="max-width:520px;">
        <h3>${icon("plus")} Новый товар</h3>
        <div class="field">
          <label>Тип</label>
          <select class="select" id="itemType">
            <option value="frame">Рамка аватарки</option>
            <option value="badge">Значок у ника</option>
          </select>
        </div>
        <div class="field"><label>Название</label><input class="input" id="itemName" placeholder="Например: Неон" /></div>
        <div class="field"><label>Цена (очки)</label><input class="input" id="itemPrice" type="number" min="1" value="100" /></div>
        <div class="field">
          <label>Картинка (PNG / SVG / GIF)</label>
          <label class="btn btn-ghost btn-sm" id="fileBtn" style="justify-content:center;">${icon("image")} Выбрать файл</label>
          <input type="file" id="itemFile" accept="${IMG_ACCEPT}" class="hidden" />
          <div class="hint" id="fileHint">Файл не выбран</div>
          <div id="filePreview" style="margin-top:8px;"></div>
        </div>
        <div class="modal-actions">
          <button class="btn btn-ghost" data-act="cancel">Отмена</button>
          <button class="btn btn-primary" data-act="save">Добавить</button>
        </div>
      </div>`;
    root.appendChild(backdrop);

    let file = null;
    const fileInput = backdrop.querySelector("#itemFile");
    backdrop.querySelector("#fileBtn").addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", () => {
      file = fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;
      const hint = backdrop.querySelector("#fileHint");
      const prev = backdrop.querySelector("#filePreview");
      if (file) {
        hint.textContent = file.name + " · " + Math.round(file.size / 1024) + " КБ";
        if (file.type === "image/svg+xml") {
          prev.innerHTML = ""; // svg превью не делаем
        } else {
          const url = URL.createObjectURL(file);
          prev.innerHTML = `<img src="${url}" style="max-height:60px;border-radius:6px;border:1px solid var(--border);" />`;
        }
      } else {
        hint.textContent = "Файл не выбран";
        prev.innerHTML = "";
      }
    });

    const cleanup = () => backdrop.remove();
    backdrop.querySelector('[data-act="cancel"]').addEventListener("click", cleanup);
    backdrop.addEventListener("click", (e) => { if (e.target === backdrop) cleanup(); });
    backdrop.querySelector('[data-act="save"]').addEventListener("click", async () => {
      const type = backdrop.querySelector("#itemType").value;
      const name = backdrop.querySelector("#itemName").value.trim();
      const price = parseInt(backdrop.querySelector("#itemPrice").value, 10);
      if (!name || !price) { toast("Укажите название и цену.", "error"); return; }
      if (!file) { toast("Выберите картинку товара.", "error"); return; }
      const m = file.name.match(/\.(png|svg|gif|webp|jpe?g)$/i);
      if (!m) { toast("Поддерживаются PNG, SVG, GIF, WebP, JPG.", "error"); return; }
      const ext = m[1].toLowerCase() === "jpeg" ? "jpg" : m[1].toLowerCase();
      const id = (type === "frame" ? "f_" : "b_") + Date.now().toString(36);
      const path = `data/shop/${type}s/${id}.${ext}`;

      const saveBtn = backdrop.querySelector('[data-act="save"]');
      saveBtn.disabled = true; saveBtn.textContent = "Загрузка…";
      try {
        const base64 = await readFileBase64(file);
        await GH.putRawFile(path, base64, `Магазин: добавить ${type} «${name}»`, null);
        const raw = await ShopCache.getRaw();
        const shop = JSON.parse(JSON.stringify(raw.data));
        const item = { id, name, price, image: path };
        if (type === "frame") shop.frames.push(item); else shop.badges.push(item);
        await GH.saveShop(shop, raw.sha);
        ShopCache.invalidate();
        toast("Товар добавлен.", "success");
        cleanup();
        renderShop();
      } catch (e) {
        toast(e.message, "error");
        saveBtn.disabled = false; saveBtn.textContent = "Добавить";
      }
    });
  }

  function readFileBase64(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => { const i = r.result.indexOf(","); resolve(r.result.slice(i + 1)); };
      r.onerror = () => reject(new Error("Не удалось прочитать файл"));
      r.readAsDataURL(file);
    });
  }

  async function deleteItem(kind, id) {
    const ok = await confirmModal({ title: "Удалить товар?", message: "Товар и его картинка будут удалены из магазина.", confirmText: "Удалить", danger: true });
    if (!ok) return;
    try {
      const raw = await ShopCache.getRaw();
      const shop = JSON.parse(JSON.stringify(raw.data));
      const list = kind === "frame" ? shop.frames : shop.badges;
      const item = list.find((i) => i.id === id);
      shop[kind === "frame" ? "frames" : "badges"] = list.filter((i) => i.id !== id);
      await GH.saveShop(shop, raw.sha);
      // удаляем картинку товара
      if (item && item.image) {
        try {
          const { body } = await GH.request("GET", `/repos/${CFG.owner}/${CFG.repo}/contents/${GH.encodePath(item.image)}?ref=${encodeURIComponent(CFG.branch)}`);
          await GH.deletePath(item.image, body.sha, "Магазин: удалить товар");
        } catch (e) {}
      }
      ShopCache.invalidate();
      toast("Товар удалён.", "success");
      renderShop();
    } catch (e) { toast(e.message, "error"); }
  }

  window.SHOP = { renderShop };
})();
