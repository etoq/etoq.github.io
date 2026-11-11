# eto

Персональное портфолио начинающего исследователя malware analysis и Linux reverse engineering. Русская версия находится в `/`, английская в `/en/`. Сайт собирается в статические файлы для GitHub Pages.

## Локальный запуск

Понадобятся Node.js 24 или новее и npm.

```bash
npm install
npm run dev
```

Открой адрес, который выведет Next.js. Для повторяемой установки с сохранённым `package-lock.json` используй `npm ci`.

## Статическая сборка

```bash
npm run build
python3 -m http.server 4173 --bind 127.0.0.1 --directory out
```

Проверь русскую страницу по `http://127.0.0.1:4173/` и английскую по `http://127.0.0.1:4173/en/`. Содержимое `out/` готово для статического хостинга.

## Содержание и оформление

`src/lib/content.ts` содержит тексты RU/EN и данные для проектов, достижений и публичных контактов. `src/lib/config.ts` хранит адрес сайта и параметры визуальной сцены. Основные стили находятся в `src/app/globals.css`. `src/lib/assembly.ts` содержит стилизованный ассемблерный граф, а `AssemblyBackdrop` рисует его на Canvas. Прокрутка перемещает камеру между сценами, консоль раскрывает направления обучения, блик и XOR-цикл повторяются автоматически.

Проекты и достижения хранятся отдельно для каждой локали в `publicData.projects.ru` / `.en` и `publicData.achievements.ru` / `.en`.

Проекты, достижения и контакты сейчас показывают «Скоро» / “Coming soon”. Заполняй их реальными данными по мере готовности. Контакт GitHub подключается после отдельного указания владельца. Пока его публичное значение остаётся `null`.

## Размещение на GitHub Pages

Целевой репозиторий — `etoq/etoq.github.io`, адрес сайта — `https://etoq.github.io/`. Для корневого сайта `NEXT_PUBLIC_BASE_PATH` остаётся пустым.

1. Подготовь репозиторий `etoq.github.io` в аккаунте `etoq` и загрузи исходники вместе с `package-lock.json`.
2. В настройках репозитория открой Pages и выбери GitHub Actions как Source.
3. В Actions выбери `Publish portfolio to GitHub Pages` и запусти `Run workflow`.
4. Проверь завершение jobs `build` и `deploy`, затем открой адрес из deployment.

Workflow запускается вручную. Он устанавливает зависимости через `npm ci`, выполняет сборку и передаёт `out/` в GitHub Pages.

Для сайта проекта с адресом вида `https://etoq.github.io/portfolio/` перед сборкой задай префикс пути.

```bash
NEXT_PUBLIC_BASE_PATH=/portfolio npm run build
```

Такую сборку размещай под тем же `/portfolio/`. При запуске workflow префикс берётся из конфигурации GitHub Pages.

## Шрифты

Шрифты Geologica и IBM Plex Mono в формате WOFF2 находятся в `public/fonts/`, вместе с лицензиями SIL Open Font License. Локальная загрузка позволяет использовать кириллицу и латиницу без обращения посетителя к внешнему CDN.

- [Geologica в официальном репозитории Google Fonts](https://github.com/google/fonts/tree/main/ofl/geologica)
- [IBM Plex Mono в официальном репозитории Google Fonts](https://github.com/google/fonts/tree/main/ofl/ibmplexmono)

## Основания workflow

Версии actions проверены по официальным releases при подготовке проекта 10 ноября 2026 года.

- [Создание сайта GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site)
- [Workflow для GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)

## Проверка реализации

Проверено 11 ноября 2026 года.

- TypeScript и статическая сборка проходят.
- Chromium и WebKit проверены на 320×568, 360×560, 390×844, 768×1024 и 1440×900 в обеих локалях.
- Проверены повторяющиеся блик и XOR-цикл, движение ассемблерного фона при прокрутке, последовательное раскрытие консоли, реакция на указатель, якорная навигация, переключение языка, reduced motion и режим без JS.
- Сборка под `/portfolio/`, включая прямой вход на `/portfolio/en/` и загрузку ресурсов, ранее проверена 10 ноября 2026 года.
- Lighthouse mobile на локальной финальной сборке показал Performance 92, Accessibility 100, Best Practices 100 и SEO 100. Результаты производительности зависят от среды запуска.

