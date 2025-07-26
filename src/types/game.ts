/**
 * Game type definitions for QuizPoker
 */

import type { Player, PlayerAction } from "./player";
import type { Round } from "./round";

export interface Game {
    /** Уникальный идентификатор игры */
    id: string;
    /** Конфигурация игры */
    config: GameConfig;
    /** Текущий статус игры */
    status: GameStatus;
    /** Список игроков */
    players: Player[];
    /** Текущий раунд */
    currentRound?: Round;
    /** Номер текущего раунда */
    roundNumber: number;
    /** Позиция дилера */
    dealerPosition: number;
    /** История раундов */
    roundHistory: Round[];
    /** Время создания игры */
    createdAt: Date;
    /** Время начала игры */
    startedAt?: Date;
    /** Время завершения игры */
    finishedAt?: Date;
    /** Общий банк игры */
    totalPot: number;
    /** Статистика игры */
    gameStats: GameStats;
}

export enum GameStatus {
    /** Ожидание игроков */
    WAITING = "waiting",
    /** Игра идет */
    PLAYING = "playing",
    /** Игра завершена */
    FINISHED = "finished",
    /** Игра приостановлена */
    PAUSED = "paused",
    /** Игра отменена */
    CANCELLED = "cancelled",
}

export interface GameConfig {
    /** Название игры */
    name?: string;
    /** Минимальное количество игроков */
    minPlayers: number;
    /** Максимальное количество игроков */
    maxPlayers: number;
    /** Начальный стек для каждого игрока */
    initialStack: number;
    /** Размер анте */
    anteSize: number;

    /** Дополнительные параметры */
    options?: GameOptions;
}

export interface GameOptions {
    /** Дополнительные настройки таймера */
    timerSettings?: TimerSettings;
}

export interface TimerSettings {
    /** Время на действие (секунды) */
    actionTimeout: number;
    /** Время на ответ (секунды) */
    answerTimeout: number;
    /** Автоматическое действие при timeout */
    timeoutAction: "fold" | "check" | "call";
}

export interface GameStats {
    /** Общее время игры (мс) */
    totalDuration: number;
    /** Количество сыгранных раундов */
    roundsPlayed: number;
    /** Средняя длительность раунда (мс) */
    averageRoundDuration: number;
    /** Общее количество ставок */
    totalBets: number;
    /** Самый большой банк в раунде */
    largestPot: number;
    /** Общее количество фолдов */
    totalFolds: number;
    /** Общее количество all-in */
    totalAllIns: number;
}

export interface GameAction {
    /** Тип действия */
    type:
        | "player_action"
        | "timer_expired"
        | "round_transition"
        | "game_control";
    /** Действие игрока (если применимо) */
    playerAction?: PlayerAction;
    /** Данные действия */
    data?: any;
    /** Время действия */
    timestamp: Date;
}

// Question and GetQuestionFunction are imported from common.ts
// Re-export for convenience
export { Question } from "./common";

export interface SerializedGame {
    /** Сериализованные данные игры */
    gameData: Game;
    /** Версия сериализации */
    version: string;
    /** Время сериализации */
    serializedAt: Date;
}
