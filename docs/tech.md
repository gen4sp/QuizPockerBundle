# Техническое руководство

Руководство по установке, сборке и разработке QuizPokerBundle.

## 📦 Установка

```bash
# Клонирование репозитория
git clone <repository-url>
cd QuizPokerBundle

# Установка зависимостей
yarn install
```

## 🛠️ Разработка

### Основные команды

```bash
# Запуск в режиме разработки
yarn dev

# Сборка библиотеки
yarn build

# Запуск собранной версии
yarn start

# Отслеживание изменений
yarn watch

# Очистка директории dist
yarn clean
```

### Тестирование

```bash
# Запуск всех тестов
yarn test

# Запуск тестов в режиме наблюдения
yarn test:watch

# Запуск конкретного теста
npx vitest run src/__tests__/round.test.ts
```

## 🏗️ Структура проекта

```
QuizPokerBundle/
├── src/
│   ├── domain/          # Основные классы
│   │   ├── game.ts      # Управление игрой
│   │   ├── player.ts    # Логика игрока
│   │   ├── round.ts     # Раунд игры
│   │   ├── pot.ts       # Банк ставок
│   │   └── index.ts     # Экспорты домена
│   ├── types/           # TypeScript определения
│   │   ├── common.ts    # Общие типы
│   │   ├── game.ts      # Типы игры
│   │   ├── player.ts    # Типы игрока
│   │   └── index.ts     # Сводные экспорты
│   ├── utils/           # Утилиты
│   │   └── logger.ts    # Логирование
│   ├── test-utils/      # Тестовые утилиты
│   │   ├── factories.ts # Фабрики объектов
│   │   └── mocks.ts     # Моки
│   ├── __tests__/       # Тесты
│   └── index.ts         # Главная точка входа
├── docs/                # Документация
├── dist/                # Собранные файлы
├── package.json         # Зависимости и скрипты
├── tsconfig.json        # Конфигурация TypeScript
└── vitest.config.ts     # Конфигурация тестов
```

## 📋 Технические требования

-   **Node.js** >= 16.0.0
-   **Package Manager**: Yarn (предпочтительно)
-   **TypeScript** 5.3+
-   **Vitest** для тестирования

## 🔧 Конфигурация

### TypeScript

Проект использует строгую конфигурацию TypeScript с полной типизацией.

### Тестирование

-   Фреймворк: **Vitest**
-   Тесты находятся в `src/__tests__/`
-   Покрытие: основные классы и методы

### Сборка

-   Сборщик: **tsc** (TypeScript Compiler)
-   Выходная директория: `dist/`
-   Форматы: CommonJS модули
