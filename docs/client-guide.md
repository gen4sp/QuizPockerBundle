# Руководство для клиента

Это руководство помогает подключить QuizPoker Bundle к вашему проекту, обработать события игры и понять, как работает игровой процесс.

## Установка и подключение

```bash
yarn add quizpokerbundle
# или
npm install quizpokerbundle
```

```typescript
import QuizPoker, { Game, GameStatus, BettingAction } from "quizpokerbundle";
```

## Создание и запуск игры

```typescript
// Определяем игроков
const players = [
  { id: "1", name: "Алиса" },
  { id: "2", name: "Боб" }
];

// Функция, возвращающая вопрос
const getQuestion = () => ({
  text: "Сколько дней в году?",
  correctAnswer: 365,
  difficulty: 1
});

// Создаём игру и запускаем её
const game = QuizPoker.createGame(players, getQuestion);
await game.startGame();
```

## Основные события игры

| Событие | Когда возникает | Данные |
| ------- | --------------- | ------ |
| `game_started` | Игра запущена | `{game, startTime}` |
| `player_action` | Игрок сделал действие | `{player, action, isValid}` |
| `player_answer` | Игрок ответил на вопрос | `{player, answer}` |
| `round_started` | Начался раунд | `{round}` |
| `round_finished` | Раунд завершён | `{round, results}` |
| `phase_changed` | Смена фазы игры | `{previousPhase, newPhase}` |
| `game_finished` | Игра завершена | `{game, winner, results}` |

### Подписка на события

```typescript
// Подписка на старт игры
game.on("game_started", ({ game }) => {
  console.log(`Игра ${game.id} началась`);
});

// Отслеживание действий игроков
game.on("player_action", ({ player, action }) => {
  console.log(`${player.name} сделал ${action.type}`);
});
```

## Игровой процесс в кратце

1. **Анте** – все активные игроки делают минимальную ставку.
2. **Вопрос** – игроки получают вопрос и дают ответ.
3. **Ставки** – проходит до трёх кругов ставок с действиями `CHECK`, `CALL`, `RAISE`, `ALL_IN`, `FOLD`.
4. **Подсказка** – может быть показана упрощённая версия вопроса.
5. **Открытие ответа и шоудаун** – правильный ответ показывается, определяется победитель.
6. **Следующий раунд** – игра продолжается, пока не останется один игрок или не достигнут лимиты.

## Пример действий игрока

```typescript
// Игрок уравнивает ставку
await game.action("1", BettingAction.CALL);

// Игрок повышает ставку на 200
await game.action("2", BettingAction.RAISE, 200);

// Игрок отвечает на вопрос
await game.action("1", BettingAction.ANSWER, undefined, 365);
```

## Завершение игры

```typescript
if (game.status === GameStatus.FINISHED) {
  const snapshot = game.getClientSnapshot();
  console.log("Победитель:", snapshot.winner);
}
```

Это базовое руководство покрывает подключение и работу с основными событиями QuizPoker Bundle. Для более подробной информации смотрите файлы [usage.md](./usage.md) и [gameflow.md](./gameflow.md).
