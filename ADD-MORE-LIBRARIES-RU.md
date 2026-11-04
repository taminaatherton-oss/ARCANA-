# Как добавлять новые библиотеки

1. Попроси подготовить отдельный JSON-файл с уникальным именем, например `tarot-thoth-deck.ru.json`.
2. В GitHub открой папку `knowledge/`.
3. Нажми Add file → Upload files.
4. Загрузи новый JSON и сделай Commit changes.
5. Открой `knowledge.html` и нажми «Обновить библиотеки».

Основные файлы приложения менять не нужно. Формат: корректный UTF-8 JSON. Желательно хранить метаданные: `id`, `title`, `tradition`, `source`, `license`, `entries`.
