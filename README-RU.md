# Исправление ARCANA Knowledge 404 (v1.2)

В корень репозитория GitHub загрузите два файла из этого архива, заменив существующие:
- `knowledge-loader.js`
- `knowledge.html`

Библиотеки и `catalog.json` повторно загружать не нужно. Загрузчик читает `catalog.json` напрямую с `raw.githubusercontent.com`, поэтому не использует GitHub Contents API. Поддерживаются файлы в корне репозитория и в папке `knowledge/`.

После Commit changes откройте `https://taminaatherton-oss.github.io/ARCANA-/knowledge.html?refresh=12` и нажмите «Обновить библиотеки». Если GitHub Pages ещё публикует старую версию, подождите завершения Actions и обновите страницу.
