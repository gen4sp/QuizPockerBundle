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

##### Основной метод `action()`

Метод `action()` — это универсальный способ выполнения всех игровых действий:

```typescript
import { BettingAction, PlayerAction } from "quizpokerbundle";

// Сигнатура метода
await game.action(
    player: Player | string,    // игрок или ID игрока
    actionType: BettingAction,  // тип действия
    amount?: number,           // сумма ставки (опционально)
    answer?: number            // ответ на вопрос (опционально)
): Promise<boolean>            // возвращает true при успехе

// Примеры использования:

// 1. Ставки
await game.action("player-1", BettingAction.CHECK);         // чек
await game.action("player-1", BettingAction.CALL);          // колл
await game.action("player-2", BettingAction.RAISE, 200);    // рейз на 200
await game.action("player-3", BettingAction.ALL_IN);        // олл-ин
await game.action("player-4", BettingAction.FOLD);          // фолд

// 2. Ответы на вопросы
await game.action("player-1", BettingAction.ANSWER, undefined, 299792458);
await game.action("player-2", BettingAction.ANSWER, undefined, 300000000);

// 3. Использование объекта игрока вместо ID
const player = game.players.find(p => p.id === "player-1");
await game.action(player, BettingAction.CALL);

// 4. Обработка ошибок
try {
    const success = await game.action("player-1", BettingAction.RAISE, 1000);
    if (!success) {
        console.log("Действие отклонено валидацией");
    }
} catch (error) {
    console.error("Ошибка действия:", error.message);
}
```

##### Альтернативный метод `processPlayerAction()`

Метод для тестирования и отладки с детальной информацией об ошибках:

```typescript
const actionResult = await game.processPlayerAction({
    playerId: "player-1",
    type: BettingAction.CALL,
    timestamp: new Date(),
    amount: 100, // опционально
    answer: 42, // опционально
});

if (!actionResult.success) {
    console.error("Ошибка действия:", actionResult.error);
} else {
    console.log("Действие выполнено успешно");
}
```

### 3. Управление состоянием игры

#### Получение состояния игры

```typescript
// Получить полное состояние игры
const gameState = game.getGameState();

console.log("Информация об игре:");
console.log(`ID: ${gameState.id}`);
console.log(`Статус: ${gameState.status}`);
console.log(`Раунд: ${gameState.roundNumber}`);
console.log(`Общий банк: ${gameState.totalPot}`);
console.log(`Игроки: ${gameState.players.length}`);
console.log(`Создана: ${gameState.createdAt}`);
console.log(`Запущена: ${gameState.startedAt}`);
console.log(`Завершена: ${gameState.finishedAt}`);

// Проверка конкретных состояний
if (gameState.status === GameStatus.PLAYING) {
    console.log("Игра активна");
    console.log(`Текущий раунд:`, gameState.currentRound);
}

// Статистика игры
console.log("Статистика:", gameState.gameStats);
```

#### Управление жизненным циклом игры

```typescript
import { GameStatus } from "quizpokerbundle";

// Приостановка игры
try {
    game.pauseGame();
    console.log("Игра приостановлена");
} catch (error) {
    console.error("Нельзя приостановить игру:", error.message);
    // Ошибка если игра не в статусе PLAYING
}

// Возобновление игры
try {
    game.resumeGame();
    console.log("Игра возобновлена");
} catch (error) {
    console.error("Нельзя возобновить игру:", error.message);
    // Ошибка если игра не в статусе PAUSED
}

// Принудительное завершение игры
game.endGame();
console.log("Игра завершена принудительно");

// Проверка статуса перед действиями
switch (game.status) {
    case GameStatus.WAITING:
        console.log("Ожидание игроков");
        // Можно добавлять игроков
        break;
    case GameStatus.PLAYING:
        console.log("Игра идет");
        // Можно делать ходы
        break;
    case GameStatus.PAUSED:
        console.log("Игра на паузе");
        // Можно возобновить
        break;
    case GameStatus.FINISHED:
        console.log("Игра завершена");
        // Показать результаты
        break;
}
```

#### Добавление игроков

```typescript
import { User, GameStatus } from "quizpokerbundle";

// Проверка возможности добавления игрока
function canAddPlayer(game: Game, userId: string): boolean {
    // Проверяем статус игры
    if (game.status !== GameStatus.WAITING) {
        console.log("Нельзя добавить игрока после начала игры");
        return false;
    }

    // Проверяем лимиты
    if (game.players.length >= game.config.maxPlayers) {
        console.log("Достигнуто максимальное количество игроков");
        return false;
    }

    // Проверяем дубликаты
    if (game.players.some((p) => p.id === userId)) {
        console.log("Игрок уже в игре");
        return false;
    }

    return true;
}

// Безопасное добавление игрока
function addPlayerSafely(game: Game, user: User): boolean {
    if (!canAddPlayer(game, user.id)) {
        return false;
    }

    try {
        const player = game.addPlayer(user);
        console.log(`Игрок ${player.name} добавлен в игру`);
        return true;
    } catch (error) {
        console.error("Ошибка добавления игрока:", error.message);
        return false;
    }
}

// Пример использования
const newUser: User = { id: "player-3", name: "Карл" };
if (addPlayerSafely(game, newUser)) {
    console.log("Игрок успешно добавлен");
} else {
    console.log("Не удалось добавить игрока");
}
```

#### Удаление игроков

```typescript
// Удаление игрока (только до начала игры)
function removePlayerSafely(game: Game, playerId: string): boolean {
    try {
        const removed = game.removePlayer(playerId);
        if (removed) {
            console.log(`Игрок ${playerId} удален из игры`);
            console.log(`Осталось игроков: ${game.players.length}`);
        } else {
            console.log("Игрок не найден или не может быть удален");
        }
        return removed;
    } catch (error) {
        console.error("Ошибка удаления игрока:", error.message);
        // Возможные ошибки:
        // - "Нельзя удалить игрока после начала игры"
        // - "Игрок не найден"
        return false;
    }
}

// Пример использования
if (game.status === GameStatus.WAITING) {
    removePlayerSafely(game, "player-2");
} else {
    console.log("Нельзя удалить игрока после начала игры");
}
```

#### Получение снимка для клиента

```typescript
// Получить облегченный снимок игры для клиента (без внутренних данных)
const clientSnapshot = game.getClientSnapshot();

console.log("Снимок для клиента:");
console.log(`ID игры: ${clientSnapshot.id}`);
console.log(`Статус: ${clientSnapshot.status}`);
console.log(`Игроки: ${clientSnapshot.players.length}`);
console.log("Данные оптимизированы для передачи по сети");

// Подходит для отправки через WebSocket или API
function broadcastGameState(game: Game) {
    const snapshot = game.getClientSnapshot();
    // socket.emit('game_state', snapshot);
    // или
    // res.json(snapshot);
}
```

#### Уничтожение игры

```typescript
// Полное уничтожение игры и освобождение ресурсов
function cleanupGame(game: Game): void {
    console.log(`Уничтожение игры ${game.id}`);

    // Метод destroy() автоматически:
    // - Устанавливает статус CANCELLED
    // - Очищает массив игроков
    // - Уничтожает все менеджеры
    // - Удаляет все слушатели событий
    game.destroy();

    console.log("Игра полностью уничтожена, ресурсы освобождены");
}

// Использование при завершении работы приложения
process.on("SIGTERM", () => {
    const activeGames = getActiveGames(); // ваша функция получения активных игр
    activeGames.forEach((game) => {
        cleanupGame(game);
    });
});

// Или при удалении игры из системы
function deleteGame(gameId: string) {
    const game = findGameById(gameId);
    if (game) {
        cleanupGame(game);
        removeGameFromStorage(gameId);
    }
}
```

### 4. События игры

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

// События управления игрой
game.on("game_paused", (data) => {
    console.log("Игра приостановлена:", data.game.id);
});

game.on("game_resumed", (data) => {
    console.log("Игра возобновлена:", data.game.id);
});

game.on("game_ended", (data) => {
    console.log("Игра завершена принудительно");
    console.log("Победитель:", data.winner?.name);
    console.log("Финальная таблица:", data.finalStandings);
    console.log("Длительность игры:", data.duration, "мс");
});

// События ответов на вопросы
game.on("player_answer", (data) => {
    console.log(`${data.player.name} ответил: ${data.answer}`);
    console.log("Все ответы получены:", data.allAnswersReceived);
    console.log("Осталось времени:", data.timeRemaining);
});
```

### 5. Работа с менеджерами

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

### 6. Сохранение и восстановление игры

#### Сериализация игры

```typescript
import { SerializationOptions } from "quizpokerbundle";

// Основной метод сериализации
const serializationResult = game.serialize({
    includePlayerStats: true, // включить статистику игроков
    includeRoundHistory: true, // включить историю раундов
    compressionLevel: 1, // уровень сжатия
});

// Проверка результата
if (serializationResult.success && serializationResult.data) {
    // Сохранение в localStorage
    localStorage.setItem(`game_${game.id}`, serializationResult.data);
    console.log("Игра сохранена");
} else {
    console.error("Ошибка сериализации:", serializationResult.error);
}

// Различные варианты сериализации
const minimalSerialization = game.serialize({
    includePlayerStats: false,
    includeRoundHistory: false,
    compressionLevel: 2,
});

const fullSerialization = game.serialize({
    includePlayerStats: true,
    includeRoundHistory: true,
    compressionLevel: 0, // без сжатия
});
```

#### Восстановление игры

```typescript
// Загрузка из JSON с обработкой ошибок
function loadGame(
    gameId: string,
    getQuestion: GetQuestionFunction
): Game | null {
    try {
        const gameJson = localStorage.getItem(`game_${gameId}`);
        if (!gameJson) {
            console.error("Данные игры не найдены");
            return null;
        }

        const gameData = JSON.parse(gameJson);

        // Восстановление игры через статический метод
        const restoredGame = QuizPoker.createFromJSON(gameData, getQuestion);

        if (restoredGame) {
            console.log("Игра успешно восстановлена:", restoredGame.id);
            console.log("Статус игры:", restoredGame.status);
            console.log("Количество игроков:", restoredGame.players.length);
            return restoredGame;
        } else {
            console.error("Ошибка восстановления игры из данных");
            return null;
        }
    } catch (error) {
        console.error("Ошибка загрузки игры:", error.message);
        return null;
    }
}

// Использование
const game = loadGame("game-123", getQuestionFunction);
if (game) {
    // Игра успешно загружена, можно продолжить
    console.log("Текущий раунд:", game.roundNumber);
}
```

#### Автосохранение игры

```typescript
// Настройка автосохранения на события
function setupAutoSave(game: Game) {
    const saveGame = () => {
        const result = game.serialize({
            includePlayerStats: true,
            includeRoundHistory: true,
        });

        if (result.success && result.data) {
            localStorage.setItem(`autosave_${game.id}`, result.data);
            console.log("Автосохранение выполнено");
        }
    };

    // Сохранять после каждого хода
    game.on("player_action", saveGame);

    // Сохранять при смене фазы
    game.on("phase_changed", saveGame);

    // Сохранять при завершении раунда
    game.on("round_finished", saveGame);

    // Сохранять при паузе
    game.on("game_paused", saveGame);
}

// Применение автосохранения
setupAutoSave(game);
```

### 7. Расширенные настройки

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

## 📋 Справочник методов API

### Основные методы класса Game

| Метод                   | Описание                             | Параметры                              | Возврат                      |
| ----------------------- | ------------------------------------ | -------------------------------------- | ---------------------------- |
| `createGame()`          | Создание игры через QuizPoker API    | `players, getQuestion, config?`        | `Game`                       |
| `addPlayer()`           | Добавить игрока в игру               | `user: User`                           | `Player`                     |
| `removePlayer()`        | Удалить игрока (до начала игры)      | `playerId: string`                     | `boolean`                    |
| `startGame()`           | Запустить игру                       | -                                      | `Promise<void>`              |
| `action()`              | **Основной метод действий**          | `player, actionType, amount?, answer?` | `Promise<boolean>`           |
| `processPlayerAction()` | Действие с детальным результатом     | `action: PlayerAction`                 | `Promise<{success, error?}>` |
| `getGameState()`        | Получить полное состояние игры       | -                                      | `GameState`                  |
| `getClientSnapshot()`   | Облегченный снимок для клиента       | -                                      | `ClientSnapshot`             |
| `pauseGame()`           | Приостановить игру                   | -                                      | `void`                       |
| `resumeGame()`          | Возобновить игру                     | -                                      | `void`                       |
| `endGame()`             | Завершить игру принудительно         | -                                      | `void`                       |
| `serialize()`           | Сериализовать игру                   | `options?: SerializationOptions`       | `{success, data?, error?}`   |
| `createFromJSON()`      | Восстановить игру из JSON            | `data, getQuestion`                    | `Game \| null`               |
| `destroy()`             | Уничтожить игру и освободить ресурсы | -                                      | `void`                       |

### Типы действий игрока (BettingAction)

| Действие | Описание                       | Дополнительные параметры |
| -------- | ------------------------------ | ------------------------ |
| `CHECK`  | Пропустить без ставки          | -                        |
| `CALL`   | Уравнять ставку                | -                        |
| `RAISE`  | Повысить ставку                | `amount: number`         |
| `ALL_IN` | Поставить все фишки            | -                        |
| `FOLD`   | Сбросить карты/выйти из раунда | -                        |
| `ANSWER` | Ответить на вопрос             | `answer: number`         |

### Основные события игры

| Событие             | Когда возникает              | Данные                                                |
| ------------------- | ---------------------------- | ----------------------------------------------------- |
| `game_started`      | Игра запущена                | `{game, startTime}`                                   |
| `game_finished`     | Игра завершена               | `{game, winner, results}`                             |
| `game_paused`       | Игра приостановлена          | `{game}`                                              |
| `game_resumed`      | Игра возобновлена            | `{game}`                                              |
| `game_ended`        | Игра завершена принудительно | `{game, winner, finalStandings, duration}`            |
| `player_joined`     | Игрок присоединился          | `{player}`                                            |
| `player_action`     | Действие игрока              | `{player, action, isValid, potBefore, potAfter}`      |
| `player_answer`     | Ответ на вопрос              | `{player, answer, timeRemaining, allAnswersReceived}` |
| `round_started`     | Начался раунд                | `{round}`                                             |
| `round_finished`    | Раунд завершен               | `{round, results}`                                    |
| `phase_changed`     | Смена фазы                   | `{previousPhase, newPhase}`                           |
| `question_revealed` | Показан вопрос               | `{question}`                                          |
| `betting_started`   | Начались ставки              | `{phase}`                                             |
| `pot_updated`       | Банк обновлен                | `{amount}`                                            |
| `timer_expired`     | Истекло время                | `{playerId}`                                          |
| `answer_timeout`    | Timeout ответа               | `{playerId}`                                          |

### Статусы игры (GameStatus)

| Статус      | Описание         | Доступные действия                  |
| ----------- | ---------------- | ----------------------------------- |
| `WAITING`   | Ожидание игроков | Добавление/удаление игроков, запуск |
| `PLAYING`   | Игра идет        | Действия игроков, пауза, завершение |
| `PAUSED`    | Игра на паузе    | Возобновление, завершение           |
| `FINISHED`  | Игра завершена   | Только просмотр результатов         |
| `CANCELLED` | Игра отменена    | -                                   |

---

_Эта документация покрывает основные сценарии использования QuizPoker Bundle. Для более специфических случаев обращайтесь к исходному коду и тестам в папке `src/core/__tests__/`._
