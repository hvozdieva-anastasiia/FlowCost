# Flow Cost

Рабочая папка: D:\Projects\FlowCost. Имя продукта: Flow Cost. Это отдельный плагин Figma, не связанный с Personal Notes & Tasks (D:\Projects\PrivateNotes) и другими соседними проектами. Не копировать их plugin ID и не менять их файлы.

Продукт: калькулятор «стоимости» пользовательского сценария по прототипу Figma (шаги, время по KLM и закону Фиттса, точки трения, сравнение двух версий сценария). Идея, доказательства и каталог функций: docs/research/flow-cost-idea.md и docs/research/flow-cost-features.md. Это исследование, а не спецификация: правила расчёта и макеты ещё не составлены.

Состояние: создан только каркас (окно с заголовком, один тест). Логики сценариев, чтения прототипа и модели стоимости нет. Plugin ID не получен: после импорта плагина в Figma записать его командой `pnpm plugin:id <ID>`.

## Принципы

- Только фронтенд: React в окне плагина, логика в Plugin Main. Без бэкенда, аккаунтов, ИИ, аналитики и сети (`networkAccess: none`).
- Расчёт детерминированный и объяснимый: каждую цифру можно разложить на операторы, допущения правит пользователь.
- Плагин ничего не меняет в дизайне без явной команды. Настройки и метки хранятся в pluginData, наложения на холст строятся в отдельной группе, которую можно удалить.
- Интерфейс плагина на английском (как в Personal Notes & Tasks), документы проекта на русском, пока пользователь не решит иначе.
- Один этап: одна отдельная рабочая сессия. Следующий этап: спецификация версии 0.1, затем зонд Plugin API (единицы `Transition.duration`, форма `CONDITIONAL`, производительность обхода, высота содержимого для прокрутки).

## Инструменты

Node.js 24, pnpm 11; TypeScript 7.0.2 strict; React; Vite для UI; esbuild для Figma sandbox. UI и plugin имеют отдельные типы окружений (tsconfig.ui.json, tsconfig.plugin.json).

Проверки: `pnpm check` (typecheck, lint, format:check, test, build). Команда test допускает пустой набор и сама по себе не означает, что поведение продукта проверено.

Если node и pnpm нет в PATH (так на этой машине), использовать Node из `C:\Users\h29an\.cache\codex-runtimes\codex-primary-runtime\dependencies\node` и `tooling/pnpm.ps1`, либо положить в PATH папку `work\toolchain-bin` (там pnpm.cmd, папка в .gitignore). Для вложенных скриптов вроде `pnpm check` обёртка в PATH обязательна.

## Skills

Проектные skills находятся в .agents/skills/ (скопированы из PrivateNotes, источники и ревизии в docs/skills-sources.json). Перед применением читать соответствующий SKILL.md.

- typescript-advanced-types: точные типы и безопасные модели данных; использовать простейшие достаточные типы.
- react-best-practices: React, производительность, размер сборки; рекомендации Next.js/SSR использовать только если они действительно применимы.
- composition-patterns: структура и API React-компонентов.
- web-design-guidelines: аудит доступности и поведения интерфейса.
- impeccable: планирование UI, дизайн, critique, audit и polish; учитывать компактное окно плагина и тему Figma.

Не изменять скачанные upstream skills при форматировании; обновлять их отдельно, с указанием источника и ревизии.

## TypeScript и линтер

Компилятор tsc поставляется пакетом @typescript/native (alias typescript@7.0.2). Пакет typescript — официальный alias @typescript/typescript6@6.0.2 исключительно для JavaScript API линтера. Не заменять компилятор на TypeScript 6 из-за зависимости typescript-eslint. Схема соответствует рекомендации Microsoft.
