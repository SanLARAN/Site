# Aurora — форум и личное хранилище на GitHub Pages

Полностью статичный форум-сайт, который хостится на **GitHub Pages**, а в качестве базы данных использует сам GitHub:

- 📝 **Посты** — это [GitHub Issues](https://github.com/SanLARAN/Site/issues) с меткой `forum`
- 💬 **Комментарии** — комментарии к issues
- ❤️ **Лайки** — реакции (+1)
- 📁 **Хранилище** — личная папка `storage/<ваш-логин>/` в этом репозитории

Никакого бэкенда и базы данных не нужно — всё работает из браузера через [GitHub REST API](https://docs.github.com/en/rest) (на `api.github.com` разрешён CORS).

## Как включить

1. Откройте `config.js` и при необходимости поменяйте `owner`, `repo`, `branch`.
2. Включите GitHub Pages: **Settings → Pages → Source: GitHub Actions**.
3. Запушьте ветку `main` (или слейте PR). Workflow `.github/workflows/pages.yml` сам соберёт и опубликует сайт.

## Вход (регистрация)

Регистрация = вход по **персональному токену GitHub**:

1. Откройте <https://github.com/settings/tokens/new?scopes=public_repo&description=Aurora>
2. Выберите срок, отметьте **`public_repo`** и нажмите **Generate token**
3. Вставьте токен на странице «Войти» сайта

Токен хранится только в вашем браузере (`localStorage`) и отправляется только на `api.github.com`. С правами `public_repo` вы можете создавать issues/комментарии/реакции и записывать файлы в репозиторий.

## Что может каждый пользователь

- Создавать, редактировать и закрывать свои посты (категории = GitHub-метки)
- Комментировать и ставить лайки
- Загружать файлы, картинки и папки в **своё** хранилище (`storage/<login>/`)
- Скачивать, предпросматривать, переименовывать и удалять файлы

## Лимиты (важно)

- GitHub Pages — только статика, поэтому всё хранится в репозитории (issues + файлы)
- Один файл в хранилище — до **25 МБ** (мягкий лимит настроен в `config.js`; GitHub API разрешает до 100 МБ)
- Репозиторий лучше держать до ~1 ГБ — большие файлы храните в другом месте
- У GitHub API есть rate-limit: ~5000 запросов/час с токеном

## Локальный запуск

```bash
python3 -m http.server 8080
# или
npx serve .
```

Откройте <http://localhost:8080>.

## Структура

```
config.js               # настройки (owner/repo/branch/категории/лимиты)
index.html              # оболочка SPA
css/style.css           # дизайн (тёмная/светлая тема)
js/api.js               # клиент GitHub REST API
js/markdown.js          # Markdown → безопасный HTML (marked + DOMPurify)
js/ui.js                # иконки, тосты, модалки, форматирование
js/auth.js              # вход по токену
js/forum.js             # лента, пост, комментарии, реакции
js/storage.js           # личное хранилище
js/app.js               # роутер, тема, профиль
vendor/                 # marked, dompurify (локальные копии)
assets/favicon.svg
```
