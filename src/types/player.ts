/**
 * Player type definitions for QuizPoker
 */
import { User } from "./common";

export interface Player {
    /** Уникальный идентификатор игрока */
    id: string;
    /** Пользователь */
    user: User;
    /** Имя игрока */
    name: string;
    /** Текущий стек фишек */
    stack: number;
    /** Позиция за столом (0-8) */
    position: number;
    /** Статус игрока в текущем раунде */
    status: PlayerStatus;
    /** Текущая ставка в раунде */
    currentBet: number;
    /** Общая сумма ставок в раунде */
    totalBetInRound: number;
    /** Ответ игрока на текущий вопрос */
    answer?: number;
    /** Время последнего действия */
    lastActionTime?: Date;
    /** Флаг all-in */
    isAllIn: boolean;
    /** Флаг дилера */
    isDealer: boolean;
    /** Статистика игрока */
    stats: PlayerStats;
}

export enum PlayerStatus {
    /** Активен в раунде */
    ACTIVE = "active",
    /** Сбросил карты/вышел из раунда */
    FOLDED = "folded",
    /** Ушел в all-in */
    ALL_IN = "all_in",
    /** Ожидает действия */
    WAITING = "waiting",
    /** Действует сейчас */
    ACTING = "acting",
    /** Исключен из игры (стек = 0) */
    ELIMINATED = "eliminated",
}

export interface PlayerStats {
    /** Количество сыграных раундов */
    roundsPlayed: number;
    /** Количество выигранных раундов */
    roundsWon: number;
    /** Общая сумма выигрыша */
    totalWinnings: number;
    /** Количество фолдов */
    foldCount: number;
    /** Количество all-in */
    allInCount: number;
    /** Средняя точность ответов */
    averageAccuracy: number;
}

export interface PlayerAction {
    /** ID игрока */
    playerId: string;
    /** Тип действия */
    type: BettingAction;
    /** Сумма ставки (для raise) */
    amount?: number;
    /** Ответ на вопрос */
    answer?: number;
    /** Время действия */
    timestamp: Date;
}

export enum BettingAction {
    /** Остаюсь без ставки */
    CHECK = "check",
    /** Уравниваю ставку */
    CALL = "call",
    /** Повышаю ставку */
    RAISE = "raise",
    /** Ставлю все фишки */
    ALL_IN = "all_in",
    /** Выхожу из раунда */
    FOLD = "fold",
    /** Ответ на вопрос */
    ANSWER = "answer",
}
