# QuizPoker Bundle - Инструкция по использованию

Данный документ содержит полное руководство по использованию QuizPoker Bundle API для создания и управления играми Quiz Poker.

## 📦 Установка и подключение

```bash
yarn add quizpokerbundle
# или
npm install quizpokerbundle
```

```typescript
import QuizPoker, { Game, GameConfig, GameStatus } from "quizpokerbundle";
// или импорт отдельных компонентов
import {
    Game,
    GamePhaseManager,
    BettingManager,
    PlayerManager,
} from "quizpokerbundle";
```

## 🎯 Основные API

### 1. Создание игры

#### Базовое создание через QuizPoker API

```typescript
import QuizPoker, { User, Question } from "quizpokerbundle";

// Определяем игроков
const players: User[] = [
    { id: "1", name: "Алиса" },
    { id: "2", name: "Боб" },
    { id: "3", name: "Карл" },
];

// Функция получения вопросов
const getQuestionFunction = (): Question => {
    return {
        text: "Какова скорость света в вакууме? (км/с)",
        correctAnswer: 299792458,
        category: "физика",
        difficulty: 3,
    };
};

// Создание игры с настройками по умолчанию
const game = QuizPoker.createGame(players, getQuestionFunction);

// Создание игры с кастомными настройками
const customGame = QuizPoker.createGame(players, getQuestionFunction, {
    minPlayers: 3,
    maxPlayers: 6,
    initialStack: 2000,
    anteSize: 100,
});
```

#### Создание через конструктор Game

```typescript
import { Game, GameConfig, GetQuestionFunction } from "quizpokerbundle";

const config: GameConfig = {
    minPlayers: 2,
    maxPlayers: 8,
    initialStack: 1000,
    anteSize: 50,
    options: {
        timerSettings: {
            actionTimeout: 30,
            answerTimeout: 60,
            timeoutAction: "fold",
        },
    },
};

const getQuestion: GetQuestionFunction = async () => {
    // Асинхронное получение вопроса из базы данных
    const response = await fetch("/api/questions/random");
    return await response.json();
};

const game = new Game(config, getQuestion);

// Добавляем игроков вручную
players.forEach((player) => {
    game.addPlayer(player);
});
```

### 2. Управление игрой

#### Запуск игры

```typescript
// Проверяем статус перед запуском
if (game.status === GameStatus.WAITING) {
    await game.startGame();
    console.log(`Игра ${game.id} запущена!`);
}
```

#### Обработка действий игроков

```typescript
import { BettingAction, PlayerAction } from "quizpokerbundle";

// Ставки
await game.action("player-1", BettingAction.CALL);
await game.action("player-2", BettingAction.RAISE, 200);
await game.action("player-3", BettingAction.FOLD);

// Ответы на вопросы
await game.action("player-1", BettingAction.ANSWER, undefined, 299792458);
await game.action("player-2", BettingAction.ANSWER, undefined, 300000000);

// Проверка результата действия
const actionResult = await game.processPlayerAction({
    playerId: "player-1",
    type: BettingAction.CALL,
    timestamp: new Date(),
});

if (!actionResult.success) {
    console.error("Ошибка действия:", actionResult.error);
}
```

### 3. События игры

QuizPoker Bundle использует EventEmitter для уведомлений о событиях:

```typescript
import { GameEventType } from "quizpokerbundle";

// Основные события игры
game.on("game_started", (data) => {
    console.log("Игра началась:", data.startTime);
});

game.on("game_finished", (data) => {
    console.log("Игра завершена:", data.winner);
});

// События игроков
game.on("player_joined", (data) => {
    console.log(`${data.player.name} присоединился к игре`);
});

game.on("player_action", (data) => {
    console.log(`${data.player.name} сделал ход:`, data.action);
    console.log(`Банк: ${data.potBefore} -> ${data.potAfter}`);
});

// События раундов
game.on("round_started", (data) => {
    console.log(`Начался раунд ${data.round.number}`);
});

game.on("phase_changed", (data) => {
    console.log(`Фаза изменилась: ${data.previousPhase} -> ${data.newPhase}`);
});

game.on("question_revealed", (data) => {
    console.log("Вопрос:", data.question.text);
});

// События ставок
game.on("betting_started", (data) => {
    console.log("Начался раунд ставок:", data.phase);
});

game.on("pot_updated", (data) => {
    console.log(`Банк обновлен: ${data.amount}`);
});

// События таймера
game.on("timer_expired", (data) => {
    console.log("Время истекло для игрока:", data.playerId);
});

game.on("answer_timeout", (data) => {
    console.log("Timeout ответа:", data.playerId);
});
```

### 4. Работа с менеджерами

QuizPoker Bundle использует модульную архитектуру с менеджерами:

```typescript
import {
    GamePhaseManager,
    BettingManager,
    PlayerManager,
    GameValidator,
    WinnerDeterminator,
    GameSerializer,
} from "quizpokerbundle";

// Прямое использование менеджеров (для расширенного функционала)
const phaseManager = new GamePhaseManager();
const bettingManager = new BettingManager(50); // размер анте
const playerManager = new PlayerManager(config);
const validator = new GameValidator(config);
```

### 5. Сохранение и восстановление игры

#### Сериализация игры

```typescript
// Сохранение полного состояния игры
const serializedGame = game.serialize({
    includePlayerStats: true,
    includeRoundHistory: true,
    compressionLevel: 1,
});

// Сохранение в JSON
const gameJson = JSON.stringify(serializedGame);
localStorage.setItem(`game_${game.id}`, gameJson);
```

#### Восстановление игры

```typescript
// Загрузка из JSON
const gameData = JSON.parse(localStorage.getItem(`game_${game.id}`));

// Восстановление игры
const restoredGame = QuizPoker.createFromJSON(gameData, getQuestion);

if (restoredGame) {
    console.log("Игра успешно восстановлена:", restoredGame.id);
} else {
    console.error("Ошибка восстановления игры");
}
```

### 6. Расширенные настройки

#### Конфигурация с таймерами

```typescript
const advancedConfig: GameConfig = {
    minPlayers: 3,
    maxPlayers: 6,
    initialStack: 5000,
    anteSize: 100,
    options: {
        timerSettings: {
            actionTimeout: 30, // 30 секунд на действие
            answerTimeout: 90, // 90 секунд на ответ
            timeoutAction: "fold", // действие по умолчанию
        },
    },
};
```

#### Асинхронные вопросы с категориями

```typescript
const categorizedQuestions: GetQuestionFunction = async () => {
    const topics = ["физика", "история", "география", "спорт"];
    const randomTopic = topics[Math.floor(Math.random() * topics.length)];

    const response = await fetch(`/api/questions/${randomTopic}`);
    const question = await response.json();

    return {
        text: question.text,
        answer: question.answer,
        correctAnswer: question.correctAnswer,
        category: randomTopic,
        difficulty: question.difficulty || 1,
    };
};
```

## 🔧 Практические примеры

### Пример 1: Простая игра для двух игроков

```typescript
import QuizPoker, { User, Question, BettingAction } from "quizpokerbundle";

const players: User[] = [
    { id: "alice", name: "Алиса" },
    { id: "bob", name: "Боб" },
];

const simpleQuestions = [
    { text: "2 + 2 = ?", answer: 4, correctAnswer: 4 },
    { text: "Столица России?", answer: 1, correctAnswer: 1 }, // Москва = 1
];

let questionIndex = 0;
const getQuestion = () =>
    simpleQuestions[questionIndex++ % simpleQuestions.length];

const game = QuizPoker.createGame(players, getQuestion, {
    initialStack: 1000,
    anteSize: 25,
});

// Слушаем события
game.on("round_started", async () => {
    console.log("Новый раунд! Делаем ставки...");

    // Алиса коллирует
    await game.action("alice", BettingAction.CALL);

    // Боб повышает
    await game.action("bob", BettingAction.RAISE, 50);

    // Алиса коллирует повышение
    await game.action("alice", BettingAction.CALL);
});

game.on("question_revealed", async (data) => {
    console.log("Вопрос:", data.question.text);

    // Игроки отвечают
    await game.action("alice", BettingAction.ANSWER, undefined, 4);
    await game.action("bob", BettingAction.ANSWER, undefined, 5);
});

game.on("round_finished", (data) => {
    console.log("Результаты раунда:", data.results);
});

// Запускаем игру
await game.startGame();
```

### Пример 2: Использование с веб-сокетами

```typescript
import { Server } from "socket.io";
import QuizPoker, { Game, GameEventType } from "quizpokerbundle";

class GameServer {
    private games: Map<string, Game> = new Map();
    private io: Server;

    constructor(io: Server) {
        this.io = io;
    }

    createGame(gameId: string, players: User[]): Game {
        const game = QuizPoker.createGame(players, this.getQuestionFromDB);

        // Пробрасываем все события игры в веб-сокеты
        Object.values(GameEventType).forEach((eventType) => {
            game.on(eventType, (data) => {
                this.io.to(gameId).emit(eventType, data);
            });
        });

        this.games.set(gameId, game);
        return game;
    }

    async handlePlayerAction(gameId: string, playerId: string, action: any) {
        const game = this.games.get(gameId);
        if (!game) return;

        try {
            await game.action(
                playerId,
                action.type,
                action.amount,
                action.answer
            );
        } catch (error) {
            this.io.to(playerId).emit("action_error", { error: error.message });
        }
    }

    private async getQuestionFromDB(): Promise<Question> {
        // Загрузка вопроса из базы данных
        return {
            text: "Sample question",
            answer: 42,
            correctAnswer: 42,
        };
    }
}
```

### Пример 3: Валидация и обработка ошибок

```typescript
import { Game, GameValidator, ValidationResult } from "quizpokerbundle";

const game = new Game(config, getQuestion);

// Проверка перед добавлением игрока
function addPlayerSafely(user: User): boolean {
    const validator = new GameValidator(game.config);
    const validation = validator.validateAddPlayer(
        game.players,
        user.id,
        game.status
    );

    if (!validation.isValid) {
        console.error("Нельзя добавить игрока:", validation.error);
        return false;
    }

    try {
        game.addPlayer(user);
        return true;
    } catch (error) {
        console.error("Ошибка добавления игрока:", error.message);
        return false;
    }
}

// Проверка действия игрока
async function makeActionSafely(
    playerId: string,
    action: BettingAction,
    amount?: number
) {
    const player = game.players.find((p) => p.id === playerId);
    if (!player) {
        console.error("Игрок не найден");
        return false;
    }

    const playerAction = {
        playerId,
        type: action,
        timestamp: new Date(),
        ...(amount && { amount }),
    };

    const validator = new GameValidator(game.config);
    const validation = validator.validatePlayerAction(
        player,
        playerAction,
        game.currentRound,
        game.status
    );

    if (!validation.isValid) {
        console.error("Недопустимое действие:", validation.error);
        return false;
    }

    return await game.action(playerId, action, amount);
}
```

## 📊 Мониторинг и статистика

```typescript
// Получение статистики игры
console.log("Статистика игры:", game.gameStats);
console.log("Текущий банк:", game.totalPot);
console.log("Количество раундов:", game.roundNumber);

// Статистика игроков
game.players.forEach((player) => {
    console.log(`${player.name}:`);
    console.log(`  Стек: ${player.stack}`);
    console.log(`  Статус: ${player.status}`);
    console.log(`  Статистика:`, player.stats);
});

// История раундов
game.roundHistory.forEach((round, index) => {
    console.log(`Раунд ${index + 1}:`);
    console.log(`  Банк: ${round.pot.totalPot}`);
    console.log(`  Победители:`, round.results?.winners);
});
```

## 🔍 Отладка и логирование

```typescript
import { logger } from "quizpokerbundle/utils";

// Включение дебаг-режима
logger.setLevel("debug");

// Собственные обработчики событий для логирования
game.on("player_action", (data) => {
    logger.debug("Player action:", {
        player: data.player.name,
        action: data.action.type,
        amount: data.action.amount,
        pot: data.potAfter,
    });
});

game.on("error", (error) => {
    logger.error("Game error:", error);
});
```

## 🚨 Частые ошибки и их решения

### 1. "Игрок не найден"

```typescript
// Проверяйте существование игрока перед действиями
const player = game.players.find((p) => p.id === playerId);
if (!player) {
    throw new Error(`Игрок ${playerId} не найден в игре`);
}
```

### 2. "Игра уже запущена"

```typescript
// Проверяйте статус игры
if (game.status !== GameStatus.WAITING) {
    throw new Error("Нельзя добавить игрока после начала игры");
}
```

### 3. "Недостаточно фишек для ставки"

```typescript
// Проверяйте стек игрока
if (player.stack < betAmount) {
    console.log("Недостаточно фишек, ставка all-in");
    await game.action(playerId, BettingAction.ALL_IN);
}
```

### 4. Проблемы с асинхронными вопросами

```typescript
// Обрабатывайте ошибки загрузки вопросов
const getQuestionSafely: GetQuestionFunction = async () => {
    try {
        const response = await fetch("/api/questions");
        if (!response.ok) throw new Error("Ошибка загрузки вопроса");
        return await response.json();
    } catch (error) {
        console.error("Ошибка получения вопроса:", error);
        // Возвращаем вопрос по умолчанию
        return {
            text: "Запасной вопрос: 2 + 2 = ?",
            answer: 4,
            correctAnswer: 4,
        };
    }
};
```

---

## 📚 Дополнительные ресурсы

-   **[Игровой процесс](gameflow.md)** — подробное описание механики игры
-   **[Техническая документация](tech.md)** — архитектура и разработка
-   **[README](../README.md)** — быстрый старт и обзор проекта

---

_Эта документация покрывает основные сценарии использования QuizPoker Bundle. Для более специфических случаев обращайтесь к исходному коду и тестам в папке `src/core/__tests__/`._
