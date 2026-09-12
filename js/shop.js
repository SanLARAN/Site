/* ============================================================
 *  Магазин: рамки аватарок и значки за очки.
 *  Ассортимент пополняет администратор (CFG.admin).
 * ============================================================ */
(function () {
  "use strict";

  const { icon, toast, escapeHtml, confirmModal } = window.UI;
  const CFG = window.FORUM_CONFIG;
  const { ProfileCache, ShopCache, equipItem } = window.PROFILES;

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
        <div class="items-grid" id="framesGrid">${shop.frames.map((f) => shopItem(f, "frame", prof)).join("")}</div>
      </section>

      <section class="card admin-section" style="margin-top:14px;">
        <h3>${icon("star")} Значки у ника</h3>
        <div class="items-grid" id="badgesGrid">${shop.badges.map((b) => shopItem(b, "badge", prof)).join("")}</div>
      </section>

      <div class="auth-note" style="margin-top:14px;">
        <b>Как заработать очки:</b> пост +${CFG.points.post} · комментарий +${CFG.points.comment} · лайк +${CFG.points.like} · лайк вашего поста +${CFG.points.receiveLike}.
      </div>`;

    bindItemActions(app, login, prof);

    const addBtn = app.querySelector("#addItem");
    if (addBtn) addBtn.addEventListener("click", () => renderAddForm());
  }

  function shopItem(item, kind, prof) {
    const owned = (prof.owned || []).includes(item.id);
    const equipped = prof.equipped && prof.equipped[kind] === item.id;
    const canBuy = (prof.points || 0) >= item.price;
    const preview = kind === "frame"
      ? `<div class="item-preview"><span class="frame-preview" style="background:${escapeHtml(item.bg || "")};box-shadow:${escapeHtml(item.shadow || "")}"></span></div>`
      : `<div class="item-preview"><span class="badge-preview" style="background:${escapeHtml(item.bg || "")};color:${escapeHtml(item.color || "")}">${escapeHtml(item.label || item.name)}</span></div>`;

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
    // покупка
    app.querySelectorAll("[data-buy]").forEach((b) => b.addEventListener("click", () => {
      const id = b.dataset.buy;
      const kind = b.dataset.kind;
      buyItem(login, kind, id);
    }));
    // надеть/снять
    app.querySelectorAll("[data-equip]").forEach((b) => b.addEventListener("click", async () => {
      const id = b.dataset.equip;
      const kind = b.dataset.kind;
      const on = b.dataset.on === "1";
      const ok = await equipItem(login, kind, id, on);
      if (ok) { toast(on ? "Надето." : "Снято.", "success"); renderShop(); }
      else toast("Не удалось сохранить.", "error");
    }));
    // удаление (админ)
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

  /* ---------- админ: добавление и удаление товаров ---------- */
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

        <div id="frameFields">
          <div class="field"><label>CSS-градиент рамки (background)</label><textarea class="textarea" id="itemBg" rows="2" placeholder="conic-gradient(from 180deg, #22d3ee, #a855f7, #f472b6, #22d3ee)"></textarea></div>
          <div class="field"><label>Свечение (box-shadow)</label><input class="input" id="itemShadow" placeholder="0 0 14px rgba(168,85,247,0.55)" /></div>
        </div>
        <div id="badgeFields" class="hidden">
          <div class="field"><label>Текст/эмодзи</label><input class="input" id="itemLabel" placeholder="★ или DEV" maxlength="6" /></div>
          <div class="field"><label>Цвет текста</label><input class="input" id="itemColor" placeholder="#ffffff" /></div>
          <div class="field"><label>Цвет фона</label><input class="input" id="itemBg2" placeholder="#ffd84d" /></div>
        </div>

        <div class="modal-actions">
          <button class="btn btn-ghost" data-act="cancel">Отмена</button>
          <button class="btn btn-primary" data-act="save">Добавить</button>
        </div>
      </div>`;
    root.appendChild(backdrop);

    const typeSel = backdrop.querySelector("#itemType");
    const toggleFields = () => {
      const isFrame = typeSel.value === "frame";
      backdrop.querySelector("#frameFields").classList.toggle("hidden", !isFrame);
      backdrop.querySelector("#badgeFields").classList.toggle("hidden", isFrame);
    };
    typeSel.addEventListener("change", toggleFields);
    toggleFields();

    const cleanup = () => backdrop.remove();
    backdrop.querySelector('[data-act="cancel"]').addEventListener("click", cleanup);
    backdrop.addEventListener("click", (e) => { if (e.target === backdrop) cleanup(); });
    backdrop.querySelector('[data-act="save"]').addEventListener("click", async () => {
      const type = typeSel.value;
      const name = backdrop.querySelector("#itemName").value.trim();
      const price = parseInt(backdrop.querySelector("#itemPrice").value, 10);
      if (!name || !price) { toast("Укажите название и цену.", "error"); return; }
      const id = (type === "frame" ? "f_" : "b_") + Date.now().toString(36);
      let item;
      if (type === "frame") {
        item = { id, name, price, icon: "💠", bg: backdrop.querySelector("#itemBg").value.trim(), shadow: backdrop.querySelector("#itemShadow").value.trim() };
      } else {
        item = {
          id, name, price,
          icon: backdrop.querySelector("#itemLabel").value.trim() || "★",
          label: backdrop.querySelector("#itemLabel").value.trim() || "★",
          color: backdrop.querySelector("#itemColor").value.trim() || "#ffffff",
          bg: backdrop.querySelector("#itemBg2").value.trim() || "#555555"
        };
      }
      try {
        const raw = await ShopCache.getRaw();
        const shop = JSON.parse(JSON.stringify(raw.data));
        if (type === "frame") shop.frames.push(item); else shop.badges.push(item);
        await GH.saveShop(shop, raw.sha);
        ShopCache.invalidate();
        toast("Товар добавлен.", "success");
        cleanup();
        renderShop();
      } catch (e) { toast(e.message, "error"); }
    });
  }

  async function deleteItem(kind, id) {
    const ok = await confirmModal({ title: "Удалить товар?", message: "Товар исчезнет из магазина.", confirmText: "Удалить", danger: true });
    if (!ok) return;
    try {
      const raw = await ShopCache.getRaw();
      const shop = JSON.parse(JSON.stringify(raw.data));
      const list = kind === "frame" ? shop.frames : shop.badges;
      shop[kind === "frame" ? "frames" : "badges"] = list.filter((i) => i.id !== id);
      await GH.saveShop(shop, raw.sha);
      ShopCache.invalidate();
      toast("Товар удалён.", "success");
      renderShop();
    } catch (e) { toast(e.message, "error"); }
  }

  window.SHOP = { renderShop };
})();
