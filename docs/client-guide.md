# Руководство для разработчиков

Краткое руководство по интеграции QuizPokerBundle в ваше приложение.

## 📦 Установка

```bash
yarn add quizpokerbundle
# или
npm install quizpokerbundle
```

## 🚀 Быстрый старт

```typescript
import QuizPoker, { Game, Player, Round } from "quizpokerbundle";

// Создание игры
const game = QuizPoker.createGame();

// Добавление игроков
const alice = game.addPlayer("alice", "Алиса", 1000);
const bob = game.addPlayer("bob", "Боб", 1000);

// Запуск раунда
const round = game.startRound();

// Игровые действия
round.bet(round.activePlayer, 100); // Ставка
round.fold(alice); // Фолд
round.award(bob); // Присуждение банка
```

## 🎮 Основные классы

### Game

```typescript
// Создание и управление игрой
const game = new Game();
game.addPlayer(id, name, stack); // Добавить игрока
game.startRound(); // Запустить раунд
```

### Player

```typescript
// Свойства игрока
player.id; // Уникальный идентификатор
player.name; // Имя игрока
player.stack; // Количество фишек
player.currentBet; // Текущая ставка в раунде
player.folded; // Сбросил ли карты

// Методы
player.bet(amount); // Сделать ставку
player.fold(); // Сбросить карты
player.win(amount); // Получить выигрыш
player.resetForNextRound(); // Сброс для нового раунда
```

### Round

```typescript
// Управление раундом
round.activePlayer; // Текущий активный игрок
round.bet(player, amount); // Ставка игрока
round.fold(player); // Фолд игрока
round.award(winner); // Присуждение банка
```

### Pot

```typescript
// Банк ставок
pot.total; // Общая сумма банка
pot.add(amount); // Добавить в банк
pot.distribute(winner); // Распределить победителю
```

## 🔧 Примеры использования

### Базовая игра

```typescript
import QuizPoker from "quizpokerbundle";

// Создание игры с двумя игроками
const game = QuizPoker.createGame();
const alice = game.addPlayer("1", "Алиса", 1000);
const bob = game.addPlayer("2", "Боб", 1000);

// Запуск раунда и игра
const round = game.startRound();
round.bet(alice, 50); // Алиса ставит 50
round.bet(bob, 100); // Боб ставит 100

// Алиса сбрасывает карты
round.fold(alice);

// Боб получает банк
round.award(bob);
console.log(bob.stack); // 1050
```

### Обработка ошибок

```typescript
try {
    // Попытка ставки больше стека
    round.bet(player, 2000);
} catch (error) {
    console.error(error.message); // "Not enough chips"
}

try {
    // Попытка хода не в свою очередь
    round.bet(wrongPlayer, 100);
} catch (error) {
    console.error(error.message); // "Not this player's turn"
}
```

## 📋 Справочник методов

| Метод                        | Класс     | Описание           |
| ---------------------------- | --------- | ------------------ |
| `createGame()`               | QuizPoker | Создать новую игру |
| `addPlayer(id, name, stack)` | Game      | Добавить игрока    |
| `startRound()`               | Game      | Начать новый раунд |
| `bet(player, amount)`        | Round     | Сделать ставку     |
| `fold(player)`               | Round     | Сбросить карты     |
| `award(winner)`              | Round     | Присудить банк     |

## 🔗 Дополнительная информация

-   **[Игровой процесс](gameflow.md)** — детальное описание механики
-   **[Техническое руководство](tech.md)** — разработка и сборка
