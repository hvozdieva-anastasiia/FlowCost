# Flow Cost

Плагин Figma: оценка «стоимости» пользовательского сценария по готовому прототипу. Шаги, модельное время (KLM и закон Фиттса), точки трения, сравнение двух версий сценария. Всё считается локально, без сети и ИИ.

Статус: каркас проекта. Функций пока нет. Исследование и каталог возможностей: [docs/research/flow-cost-idea.md](docs/research/flow-cost-idea.md), [docs/research/flow-cost-features.md](docs/research/flow-cost-features.md).

## Запуск

Нужны Node.js 24 и pnpm 11.

```bash
pnpm install
pnpm check
pnpm build
```

В Figma Desktop: Plugins → Development → Import plugin from manifest → `manifest.json`. После импорта записать выданный ID: `pnpm plugin:id <ID>`.

На Windows, если pnpm не в PATH, использовать `tooling/pnpm.ps1` (проверяет версию из `package.json`).
