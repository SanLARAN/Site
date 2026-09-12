/* ============================================================
 *  Личное Хранилище — файлы, папки, картинки (в репозитории)
 *  У каждого пользователя своя папка: storage/<login>/
 * ============================================================ */
(function () {
  "use strict";

  const { icon, toast, timeAgo, formatBytes, escapeHtml, confirmModal } = window.UI;
  const CFG = window.FORUM_CONFIG;

  const state = {
    path: [],            // массив имён папок относительно корня пользователя
    entries: [],
    selected: new Set(),
    selectMode: false,
    view: localStorage.getItem("aurora:fsview") || "grid",
    loading: false
  };

  function user() { return GH.isLoggedIn() ? GH.getUser().login : null; }

  function innerPath() { return state.path.join("/"); }

  function fileExt(name) {
    const m = /\.([a-z0-9]{1,5})$/i.exec(name || "");
    return m ? m[1].toLowerCase() : "";
  }

  const IMG_EXTS = ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico", "avif"];
  const VIDEO_EXTS = ["mp4", "webm", "mov", "m4v", "ogv", "mkv"];
  const AUDIO_EXTS = ["mp3", "wav", "ogg", "flac", "m4a", "aac", "opus", "weba"];
  const PDF_EXTS = ["pdf"];
  const TEXT_EXTS = ["md", "txt", "json", "js", "css", "html", "htm", "xml", "yml", "yaml",
    "sh", "py", "java", "c", "cpp", "h", "hpp", "ts", "tsx", "jsx", "rs", "go", "rb", "php",
    "sql", "csv", "log", "ini", "toml", "conf", "bat", "ps1", "lua", "swift", "kt"];

  function previewKind(entry) {
    if (!entry || entry.type === "dir") return "dir";
    const ext = fileExt(entry.name);
    if (IMG_EXTS.includes(ext)) return "image";
    if (VIDEO_EXTS.includes(ext)) return "video";
    if (AUDIO_EXTS.includes(ext)) return "audio";
    if (PDF_EXTS.includes(ext)) return "pdf";
    if (TEXT_EXTS.includes(ext)) return "text";
    return "other";
  }

  function rawUrl(entry) {
    if (!entry) return "";
    const p = entry.path.split("/").map(encodeURIComponent).join("/");
    return `https://raw.githubusercontent.com/${CFG.owner}/${CFG.repo}/${encodeURIComponent(CFG.branch)}/${p}`;
  }

  /* ============================================================
   *  ГЛАВНЫЙ ВИД
   * ============================================================ */
  function renderStorage() {
    if (!GH.isLoggedIn()) {
      const app = document.getElementById("app");
      app.innerHTML = `
        <div class="card state-box" style="margin-top:40px;">
          ${icon("folder", "big-ic")}
          <h3>Хранилище доступно после входа</h3>
          <p>У каждого пользователя — своя личная папка в репозитории. Войдите через GitHub-токен, чтобы загружать файлы, картинки и создавать папки.</p>
          <button class="btn btn-primary" onclick="location.hash='#/login'">${icon("github")} Войти</button>
        </div>`;
      return;
    }

    const app = document.getElementById("app");
    app.innerHTML = `
      <div class="storage-head">
        <h2>${icon("folder")} Моё хранилище</h2>
        <span class="storage-usage" id="usage"></span>
      </div>
      <div class="storage-breadcrumb" id="breadcrumb"></div>
      <div class="dropzone" id="dropzone">
        ${icon("upload")}
        <div><b>Перетащите файлы сюда</b> или <u>нажмите, чтобы выбрать</u></div>
        <div class="sub">Картинки, документы, архивы — до ${CFG.maxFileMB} МБ на файл</div>
      </div>
      <input type="file" id="fileInput" multiple class="hidden" />
      <div class="storage-toolbar">
        <button class="btn btn-primary btn-sm" id="btnUpload">${icon("upload")} Загрузить</button>
        <button class="btn btn-ghost btn-sm" id="btnFolder">${icon("folderPlus")} Папка</button>
        <span class="spacer"></span>
        <button class="btn btn-ghost btn-sm" id="btnSelect">${icon("check")} Выбрать</button>
        <div class="view-toggle">
          <button id="viewGrid" class="${state.view === "grid" ? "active" : ""}" title="Сетка">${icon("grid")}</button>
          <button id="viewList" class="${state.view === "list" ? "active" : ""}" title="Список">${icon("list")}</button>
        </div>
        <button class="icon-btn" id="btnRefresh" title="Обновить">${icon("refresh")}</button>
      </div>
      <div id="fsContainer"></div>
      <div id="selectionBar"></div>`;

    app.querySelector("#btnUpload").addEventListener("click", () => app.querySelector("#fileInput").click());
    app.querySelector("#dropzone").addEventListener("click", () => app.querySelector("#fileInput").click());
    app.querySelector("#fileInput").addEventListener("change", (e) => { uploadFiles(e.target.files); e.target.value = ""; });
    app.querySelector("#btnFolder").addEventListener("click", createFolderFlow);
    app.querySelector("#btnRefresh").addEventListener("click", () => loadDir(true));
    app.querySelector("#btnSelect").addEventListener("click", toggleSelectMode);
    app.querySelector("#viewGrid").addEventListener("click", () => setView("grid"));
    app.querySelector("#viewList").addEventListener("click", () => setView("list"));

    // drag & drop
    const dz = app.querySelector("#dropzone");
    ["dragenter", "dragover"].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add("dragover"); }));
    ["dragleave", "drop"].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove("dragover"); }));
    dz.addEventListener("drop", (e) => uploadFiles(e.dataTransfer.files));

    renderBreadcrumb();
    loadDir(true);
    loadUsage();
  }

  function setView(v) {
    state.view = v;
    localStorage.setItem("aurora:fsview", v);
    const app = document.getElementById("app");
    app.querySelector("#viewGrid").classList.toggle("active", v === "grid");
    app.querySelector("#viewList").classList.toggle("active", v === "list");
    renderEntries();
  }

  function toggleSelectMode() {
    state.selectMode = !state.selectMode;
    state.selected.clear();
    const btn = document.getElementById("btnSelect");
    btn.classList.toggle("btn-primary", state.selectMode);
    btn.classList.toggle("btn-ghost", !state.selectMode);
    renderEntries();
    renderSelectionBar();
  }

  function renderBreadcrumb() {
    const bc = document.getElementById("breadcrumb");
    if (!bc) return;
    let html = `<span class="crumb root" data-path="">${icon("folder")} /${escapeHtml(user())}</span>`;
    state.path.forEach((seg, i) => {
      const p = state.path.slice(0, i + 1).join("/");
      html += `<span class="sep">›</span><span class="crumb" data-path="${escapeHtml(p)}">${escapeHtml(seg)}</span>`;
    });
    bc.innerHTML = html;
    bc.querySelectorAll(".crumb").forEach((c) => {
      c.addEventListener("click", () => {
        const p = c.dataset.path;
        state.path = p ? p.split("/") : [];
        state.selected.clear();
        loadDir(true);
      });
    });
  }

  /* ============================================================
   *  ЗАГРУЗКА СПИСКА
   * ============================================================ */
  async function loadDir(silent) {
    if (state.loading) return;
    state.loading = true;
    const container = document.getElementById("fsContainer");
    if (!container) return;
    if (!silent) container.innerHTML = `<div class="loading-row"><div class="spinner"></div></div>`;

    try {
      const { body } = await GH.listDir(user(), innerPath());
      state.entries = Array.isArray(body) ? body : [];
      state.selected.clear();
      renderEntries();
      renderSelectionBar();
    } catch (e) {
      if (e.status === 404) {
        state.entries = [];
        renderEntries();
      } else {
        container.innerHTML = `<div class="state-box">${icon("warning", "big-ic")}<h3>Ошибка загрузки</h3><p class="error-text">${escapeHtml(e.message)}</p></div>`;
      }
    } finally {
      state.loading = false;
    }
  }

  async function loadUsage() {
    const el = document.getElementById("usage");
    if (!el) return;
    try {
      const { body } = await GH.request("GET", `/repos/${CFG.owner}/${CFG.repo}/git/trees/${encodeURIComponent(CFG.branch)}?recursive=1`);
      const prefix = CFG.storageRoot + "/" + user() + "/";
      const blobs = (body.tree || []).filter((t) => t.type === "blob" && t.path.startsWith(prefix));
      const total = blobs.reduce((s, b) => s + (b.size || 0), 0);
      const files = blobs.filter((b) => !b.path.endsWith("/.keep")).length;
      el.innerHTML = `<span>${files} ${window.UI.ruPlural(files, "файл", "файла", "файлов")} · ${formatBytes(total)}</span>`;
      // маленький прогресс (условный, 1 ГБ = 100%)
      const pct = Math.min(100, Math.round((total / (1024 * 1024 * 1024)) * 100));
      el.innerHTML += `<span class="usage-bar"><span style="width:${pct}%"></span></span>`;
    } catch (e) {
      el.textContent = "";
    }
  }

  function renderEntries() {
    const container = document.getElementById("fsContainer");
    if (!container) return;
    const entries = state.entries;
    if (!entries.length) {
      container.innerHTML = `
        <div class="card state-box">
          ${icon(state.path.length ? "folder" : "folder", "big-ic")}
          <h3>${state.path.length ? "Папка пуста" : "Хранилище пусто"}</h3>
          <p>${state.path.length ? "Загрузите сюда файлы или создайте вложенную папку." : "Перетащите файлы в область выше или нажмите «Загрузить»."}</p>
        </div>`;
      return;
    }

    // сортировка: папки сверху, затем по имени
    const sorted = [...entries].sort((a, b) => {
      if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
      return a.name.localeCompare(b.name, "ru");
    });

    const cls = state.view === "grid" ? "fs-grid" : "fs-list";
    container.innerHTML = `<div class="${cls}" id="fsGrid">` +
      sorted.map((e, i) => entryHTML(e, i)).join("") + `</div>`;

    const grid = container.querySelector("#fsGrid");
    grid.querySelectorAll(".fs-item").forEach((item) => {
      const path = item.dataset.path;
      const entry = sorted.find((e) => e.path === path);
      item.addEventListener("click", (e) => {
        if (e.target.closest(".fs-actions") || e.target.closest(".check")) return;
        if (state.selectMode) { toggleSelect(path); return; }
        openEntry(entry);
      });
      const check = item.querySelector(".check");
      if (check) check.addEventListener("click", (e) => { e.stopPropagation(); toggleSelect(path); });
      item.querySelectorAll(".fs-actions button").forEach((b) => {
        b.addEventListener("click", (e) => {
          e.stopPropagation();
          const act = b.dataset.act;
          if (act === "download") downloadEntry(entry);
          else if (act === "del") deleteFlow([entry]);
          else if (act === "link") copyLink(entry);
          else if (act === "rename") renameFlow(entry);
        });
      });
      item.addEventListener("dblclick", () => { if (!state.selectMode) openEntry(entry); });
    });
  }

  function entryHTML(entry, i) {
    const isDir = entry.type === "dir";
    const ext = fileExt(entry.name);
    const kind = previewKind(entry);
    const selected = state.selected.has(entry.path);
    const thumb = isDir
      ? `<div class="thumb">${icon("folder")}</div>`
      : kind === "image"
        ? `<div class="thumb"><img src="${escapeHtml(entry.download_url)}" alt="" loading="lazy" /></div>`
        : kind === "video"
          ? `<div class="thumb"><video src="${escapeHtml(entry.download_url)}" muted preload="metadata" playsinline></video></div>`
          : `<div class="thumb">${icon(fileIconFor(ext))}</div>`;
    const meta = isDir ? "папка" : formatBytes(entry.size);
    const actions = `
      <div class="fs-actions">
        ${isDir ? "" : `<button class="mini-btn" data-act="download" title="Скачать">${icon("download")}</button>`}
        <button class="mini-btn" data-act="link" title="Скопировать ссылку">${icon("link")}</button>
        ${isDir ? "" : `<button class="mini-btn" data-act="rename" title="Переименовать">${icon("edit")}</button>`}
        <button class="mini-btn danger" data-act="del" title="Удалить">${icon("trash")}</button>
      </div>`;
    return `
      <div class="fs-item ${isDir ? "folder" : ""} ${state.selectMode ? "selectable" : ""} ${selected ? "selected" : ""}" data-path="${escapeHtml(entry.path)}" style="--i:${i}">
        <div class="check"></div>
        ${thumb}
        <div class="fname" title="${escapeHtml(entry.name)}">${escapeHtml(entry.name)}</div>
        <div class="fmeta">${meta}</div>
        ${actions}
      </div>`;
  }

  function fileIconFor(ext) {
    if (IMG_EXTS.includes(ext)) return "image";
    if (VIDEO_EXTS.includes(ext)) return "film";
    if (AUDIO_EXTS.includes(ext)) return "music";
    if (PDF_EXTS.includes(ext)) return "doc";
    if (TEXT_EXTS.includes(ext)) return "file";
    if (["zip", "rar", "7z", "tar", "gz", "bz2", "xz"].includes(ext)) return "folder";
    return "file";
  }

  function toggleSelect(path) {
    if (state.selected.has(path)) state.selected.delete(path);
    else state.selected.add(path);
    renderEntries();
    renderSelectionBar();
  }

  function renderSelectionBar() {
    const bar = document.getElementById("selectionBar");
    if (!bar) return;
    if (!state.selectMode || !state.selected.size) { bar.innerHTML = ""; return; }
    bar.innerHTML = `
      <span class="sel-count">Выбрано: ${state.selected.size}</span>
      <button id="selDownload">${icon("download")} Скачать</button>
      <button class="danger" id="selDelete">${icon("trash")} Удалить</button>
      <button id="selClear">${icon("close")}</button>`;
    bar.querySelector("#selDownload").addEventListener("click", () => {
      const entries = state.entries.filter((e) => state.selected.has(e.path));
      entries.forEach((e) => { if (e.type !== "dir") window.open(e.download_url, "_blank"); });
      toggleSelectMode();
    });
    bar.querySelector("#selDelete").addEventListener("click", () => {
      const entries = state.entries.filter((e) => state.selected.has(e.path));
      deleteFlow(entries);
    });
    bar.querySelector("#selClear").addEventListener("click", toggleSelectMode);
  }

  /* ============================================================
   *  ОТКРЫТИЕ / ПРЕВЬЮ
   * ============================================================ */
  function openEntry(entry) {
    if (entry.type === "dir") {
      state.path.push(entry.name);
      loadDir(true);
      return;
    }
    const kind = previewKind(entry);
    const ext = fileExt(entry.name);
    const root = document.getElementById("modal-root");
    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";

    const header = `
      <div class="flex" style="padding:6px 8px 12px;">
        <div style="font-weight:700;font-size:15px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(entry.name)}</div>
        <span class="spacer"></span>
        <button class="icon-btn" data-act="link" title="Ссылка">${icon("link")}</button>
        <button class="icon-btn" data-act="dl" title="Скачать">${icon("download")}</button>
        <button class="icon-btn" data-act="x" title="Закрыть">${icon("close")}</button>
      </div>`;

    if (kind === "image") {
      backdrop.innerHTML = `
        <div class="modal" style="max-width:820px;padding:12px;">
          ${header}
          <img src="${escapeHtml(entry.download_url)}" alt="${escapeHtml(entry.name)}" style="width:100%;border-radius:12px;display:block;max-height:76vh;object-fit:contain;background:var(--code-bg);" />
        </div>`;
    } else if (kind === "video") {
      backdrop.innerHTML = `
        <div class="modal" style="max-width:860px;padding:12px;">
          ${header}
          <video src="${escapeHtml(entry.download_url)}" controls autoplay playsinline style="width:100%;max-height:76vh;border-radius:12px;display:block;background:#000;"></video>
        </div>`;
    } else if (kind === "audio") {
      backdrop.innerHTML = `
        <div class="modal" style="max-width:560px;padding:12px;">
          ${header}
          <div style="display:grid;place-items:center;padding:26px 0;border-radius:12px;background:var(--surface-2);margin-bottom:12px;">
            <div class="big-ic" style="color:var(--a3);">${icon("music", "big-ic")}</div>
          </div>
          <audio src="${escapeHtml(entry.download_url)}" controls style="width:100%;"></audio>
          <p class="muted" style="margin:12px 0 0;font-size:13px;text-align:center;">${formatBytes(entry.size)}</p>
        </div>`;
    } else if (kind === "pdf") {
      backdrop.innerHTML = `
        <div class="modal" style="max-width:900px;padding:12px;">
          ${header}
          <iframe src="${escapeHtml(entry.download_url)}" title="${escapeHtml(entry.name)}" style="width:100%;height:76vh;border:0;border-radius:12px;background:#fff;"></iframe>
          <p class="muted" style="margin:10px 4px 0;font-size:12.5px;">Если документ не открылся встроенным просмотрщиком — скачайте файл.</p>
        </div>`;
    } else if (kind === "text") {
      backdrop.innerHTML = `
        <div class="modal" style="max-width:860px;padding:12px;">
          ${header}
          <div class="text-preview"><pre id="textPreview"><span class="muted">Загрузка…</span></pre></div>
        </div>`;
      fetchTextPreview(entry, backdrop.querySelector("#textPreview"));
    } else {
      backdrop.innerHTML = `
        <div class="modal">
          <div class="flex" style="margin-bottom:12px;">
            <div style="display:grid;place-items:center;width:46px;height:46px;border-radius:12px;background:var(--surface-2);color:var(--a3);">${icon(fileIconFor(ext))}</div>
            <div style="min-width:0;">
              <div style="font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(entry.name)}</div>
              <div class="muted" style="font-size:13px;">${formatBytes(entry.size)}</div>
            </div>
            <span class="spacer"></span>
            <button class="icon-btn" data-act="x">${icon("close")}</button>
          </div>
          <p>Этот тип файла нельзя предпросмотреть в браузере. Скачайте его или откройте ссылку.</p>
          <div class="modal-actions">
            <button class="btn btn-ghost" data-act="link">${icon("link")} Ссылка</button>
            <button class="btn btn-primary" data-act="dl">${icon("download")} Скачать</button>
          </div>
        </div>`;
    }
    root.appendChild(backdrop);
    const close = () => backdrop.remove();
    backdrop.addEventListener("click", (e) => { if (e.target === backdrop) close(); });
    backdrop.querySelectorAll("[data-act]").forEach((b) => b.addEventListener("click", (e) => {
      const act = b.dataset.act;
      if (act === "x") close();
      else if (act === "dl") { window.open(entry.download_url, "_blank"); close(); }
      else if (act === "link") { copyLink(entry); close(); }
    }));
  }

  async function fetchTextPreview(entry, target) {
    if (!target) return;
    try {
      const res = await fetch(entry.download_url);
      if (!res.ok) throw new Error("HTTP " + res.status);
      const head = await res.text();
      const LIMIT = 256 * 1024;
      const text = head.length > LIMIT ? head.slice(0, LIMIT) + "\n… (показаны первые " + formatBytes(LIMIT) + ")" : head;
      target.textContent = text;
    } catch (e) {
      target.innerHTML = `<span class="error-text">${escapeHtml("Не удалось загрузить текст: " + e.message)}</span>`;
    }
  }

  function downloadEntry(entry) {
    window.open(entry.download_url, "_blank");
  }

  async function copyLink(entry) {
    try {
      await navigator.clipboard.writeText(entry.html_url);
      toast("Ссылка скопирована.", "success");
    } catch (e) {
      try {
        const ta = document.createElement("textarea");
        ta.value = entry.html_url;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
        toast("Ссылка скопирована.", "success");
      } catch (e2) {
        toast("Не удалось скопировать.", "error");
      }
    }
  }

  /* ============================================================
   *  ЗАГРУЗКА ФАЙЛОВ
   * ============================================================ */
  async function uploadFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    let done = 0, failed = 0;

    toast(`Загрузка ${files.length} ${window.UI.ruPlural(files.length, "файла", "файлов", "файлов")}…`, "info");

    for (const file of files) {
      if (file.size === 0) { toast(`«${file.name}» пустой файл — пропущен.`, "info"); continue; }
      if (file.size > CFG.maxFileMB * 1024 * 1024) {
        toast(`«${file.name}» больше ${CFG.maxFileMB} МБ — пропущен.`, "error");
        failed++;
        continue;
      }
      try {
        const base64 = await readFileToBase64(file);
        const name = await uniqueName(sanitizeName(file.name));
        await GH.putFile(user(), innerPath() + (innerPath() ? "/" : "") + name, base64, `Загрузить ${name}`);
        done++;
      } catch (e) {
        failed++;
        toast(`«${file.name}»: ${e.message}`, "error");
      }
    }

    if (done) toast(`Загружено файлов: ${done}.`, "success");
    loadDir(true);
    loadUsage();
  }

  function sanitizeName(name) {
    return (name || "").replace(/[\\/:*?"<>|#%\x00-\x1f]/g, "_").trim().replace(/^\.+/, "") || "file";
  }

  async function uniqueName(name) {
    const existing = new Set(state.entries.map((e) => e.name));
    if (!existing.has(name)) return name;
    const dot = name.lastIndexOf(".");
    const stem = dot > 0 ? name.slice(0, dot) : name;
    const ext = dot > 0 ? name.slice(dot) : "";
    for (let i = 1; i < 1000; i++) {
      const cand = `${stem} (${i})${ext}`;
      if (!existing.has(cand)) return cand;
    }
    return `${stem}-${Date.now()}${ext}`;
  }

  function readFileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataURL = reader.result;
        const comma = dataURL.indexOf(",");
        resolve(dataURL.slice(comma + 1));
      };
      reader.onerror = () => reject(new Error("Не удалось прочитать файл"));
      reader.readAsDataURL(file);
    });
  }

  /* ============================================================
   *  ПАПКИ / ПЕРЕИМЕНОВАНИЕ / УДАЛЕНИЕ
   * ============================================================ */
  async function createFolderFlow() {
    const name = await promptText("Новая папка", "Введите название папки:", "Создать");
    if (!name) return;
    try {
      await GH.createFolder(user(), innerPath() + (innerPath() ? "/" : "") + name);
      toast("Папка создана.", "success");
      loadDir(true);
    } catch (e) {
      toast(e.message, "error");
    }
  }

  async function renameFlow(entry) {
    const name = await promptText("Переименовать", "Новое имя файла:", "Переименовать", entry.name);
    if (!name || name === entry.name) return;
    try {
      const { body: meta } = await GH.getFileMeta(user(), relPath(entry));
      const base64 = meta.content.replace(/\n/g, "");
      const parent = state.path.join("/");
      const newPath = (parent ? parent + "/" : "") + sanitizeName(name);
      await GH.putFile(user(), newPath, base64, `Переименовать ${entry.name} → ${name}`);
      await GH.deleteFile(user(), relPath(entry), entry.sha, `Переименовать в ${name}`);
      toast("Файл переименован.", "success");
      loadDir(true);
      loadUsage();
    } catch (e) {
      toast(e.message, "error");
    }
  }

  function relPath(entry) {
    // путь файла относительно корня пользователя
    const root = CFG.storageRoot + "/" + user();
    let p = entry.path;
    if (p.startsWith(root)) p = p.slice(root.length + 1);
    return p;
  }

  function deleteFlow(entries) {
    const list = entries || [];
    if (!list.length) return;
    confirmModal({
      title: "Удалить?",
      message: list.length === 1
        ? `Удалить «${list[0].name}»? Это действие необратимо.`
        : `Удалить ${list.length} ${window.UI.ruPlural(list.length, "элемент", "элемента", "элементов")}? Это действие необратимо.`,
      confirmText: "Удалить",
      danger: true
    }).then(async (ok) => {
      if (!ok) return;
      for (const entry of list) {
        try {
          await removeRecursive(relPath(entry));
          toast(`«${entry.name}» удалено.`, "success");
        } catch (e) {
          toast(`«${entry.name}»: ${e.message}`, "error");
        }
      }
      state.selected.clear();
      loadDir(true);
      loadUsage();
    });
  }

  async function removeRecursive(rel) {
    // 1. попытка удалить как файл
    try {
      const { body } = await GH.listDir(user(), rel);
      // если это директория — массив
      if (Array.isArray(body)) {
        for (const child of body) {
          await removeRecursive(rel + "/" + child.name);
        }
        // удаляем маркер .keep, если есть
        try {
          const { body: keep } = await GH.getFileMeta(user(), rel + "/.keep");
          await GH.deleteFile(user(), rel + "/.keep", keep.sha, `Удалить папку ${rel}`);
        } catch (e) { /* нет маркера — ок */ }
        return;
      }
    } catch (e) {
      if (e.status === 404) {
        // директория без содержимого или уже удалена — удаляем как файл (маркер)
        try {
          const { body: keep } = await GH.getFileMeta(user(), rel + "/.keep");
          await GH.deleteFile(user(), rel + "/.keep", keep.sha, `Удалить папку ${rel}`);
        } catch (e2) { /* ignore */ }
        return;
      }
      throw e;
    }
    // 2. это файл
    const { body: meta } = await GH.getFileMeta(user(), rel);
    await GH.deleteFile(user(), rel, meta.sha, `Удалить ${rel}`);
  }

  /* ---------- текстовый prompt ---------- */
  function promptText(title, message, confirmText, value) {
    return new Promise((resolve) => {
      const root = document.getElementById("modal-root");
      const backdrop = document.createElement("div");
      backdrop.className = "modal-backdrop";
      backdrop.innerHTML = `
        <div class="modal">
          <h3>${escapeHtml(title)}</h3>
          <p>${escapeHtml(message)}</p>
          <input class="input" id="promptInput" value="${escapeHtml(value || "")}" />
          <div class="modal-actions" style="margin-top:14px;">
            <button class="btn btn-ghost" data-act="cancel">Отмена</button>
            <button class="btn btn-primary" data-act="ok">${escapeHtml(confirmText)}</button>
          </div>
        </div>`;
      root.appendChild(backdrop);
      const input = backdrop.querySelector("#promptInput");
      input.focus();
      input.select();
      const done = (val) => { backdrop.remove(); resolve(val); };
      backdrop.querySelector('[data-act="cancel"]').addEventListener("click", () => done(null));
      backdrop.querySelector('[data-act="ok"]').addEventListener("click", () => done(input.value.trim()));
      input.addEventListener("keydown", (e) => { if (e.key === "Enter") done(input.value.trim()); if (e.key === "Escape") done(null); });
      backdrop.addEventListener("click", (e) => { if (e.target === backdrop) done(null); });
    });
  }

  window.STORAGE = { renderStorage };
})();
