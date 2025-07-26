/**
 * Round type definitions for QuizPoker
 */

import type { Player, PlayerAction } from "./player";
import type { Question } from "./common";

export interface Round {
    /** Уникальный ID раунда */
    id: string;
    /** Номер раунда в игре */
    roundNumber: number;
    /** Текущая фаза раунда */
    currentPhase: RoundPhase;
    /** Вопрос раунда */
    question?: Question;
    /** Игроки участвующие в раунде */
    activePlayers: Player[];
    /** Банк раунда */
    pot: RoundPot;
    /** История действий в раунде */
    actionHistory: PlayerAction[];
    /** Текущий игрок для действия */
    currentPlayer?: string;
    /** Позиция дилера */
    dealerPosition: number;
    /** Время начала раунда */
    startTime: Date;
    /** Время завершения раунда */
    endTime?: Date;
    /** Результаты раунда */
    results?: RoundResults;
    /** Состояние таймера */
    timer?: TimerState;
    /** Настройки раунда */
    settings: RoundSettings;
}

export enum RoundPhase {
    /** Автоматические анте-ставки */
    ANTE = "ante",
    /** Показ основного вопроса */
    QUESTION1 = "question1",
    /** Первый круг ставок */
    BETTING1 = "betting1",
    /** Показ подсказки */
    QUESTION2 = "question2",
    /** Второй круг ставок */
    BETTING2 = "betting2",
    /** Показ правильного ответа */
    REVEAL = "reveal",
    /** Финальный круг ставок */
    BETTING3 = "betting3",
    /** Открытие ответов, определение победителей */
    SHOWDOWN = "showdown",
    /** Завершение раунда, обновление стеков */
    FINISHED = "finished",
}

export interface RoundPot {
    /** Основной банк */
    mainPot: number;
    /** Боковые банки (для all-in ситуаций) */
    sidePots: SidePot[];
    /** Общий размер всех банков */
    totalPot: number;
    /** История ставок по фазам */
    bettingHistory: BettingRound[];
}

export interface SidePot {
    /** Размер бокового банка */
    amount: number;
    /** Игроки имеющие право на этот банк */
    eligiblePlayers: string[];
    /** Создан из-за all-in игрока */
    createdBy: string;
}

export interface BettingRound {
    /** Фаза ставок */
    phase: RoundPhase;
    /** Действия в этой фазе */
    actions: PlayerAction[];
    /** Минимальная ставка */
    minBet: number;
    /** Текущая ставка для уравнивания */
    currentBet: number;
    /** Игрок который последний повысил */
    lastRaiser?: string;
    /** Завершена ли фаза */
    isComplete: boolean;
}

export interface RoundResults {
    /** Победители раунда */
    winners: RoundWinner[];
    /** Все ответы игроков */
    playerAnswers: PlayerAnswer[];
    /** Правильный ответ */
    correctAnswer: number;
    /** Время определения результатов */
    determinedAt: Date;
}

export interface RoundWinner {
    /** ID игрока-победителя */
    playerId: string;
    /** Выигранная сумма */
    winAmount: number;
    /** Банк из которого выиграл */
    potType: "main" | "side";
    /** Точность ответа */
    accuracy: number;
    /** Отклонение от правильного ответа */
    deviation: number;
}

export interface PlayerAnswer {
    /** ID игрока */
    playerId: string;
    /** Ответ игрока */
    answer: number;
    /** Время ответа */
    answeredAt: Date;
    /** Точность ответа (0-100) */
    accuracy: number;
    /** Отклонение от правильного ответа */
    deviation: number;
    /** Участвует ли в showdown */
    inShowdown: boolean;
}

export interface TimerState {
    /** Активен ли таймер */
    isActive: boolean;
    /** Время начала отсчета */
    startedAt: Date;
    /** Время окончания */
    endedAt: Date;
}

export interface RoundSettings {
    /** Размер анте */
    anteSize: number;

    /** Разрешить повторные повышения в одной фазе */
    allowReRaises: boolean;
    /** Максимальное количество повышений в фазе */
    maxRaisesPerPhase?: number;
    /** Только олл-ин */
    onlyAllIn: boolean;
}

export interface PhaseTransition {
    /** Из какой фазы */
    from: RoundPhase;
    /** В какую фазу */
    to: RoundPhase;
    /** Время перехода */
    timestamp: Date;
    /** Причина перехода */
    reason: "timer" | "all_actions_complete" | "manual" | "automatic";
    /** Дополнительные данные */
    data?: any;
}

export type AccuracyCalculation = (
    correctAnswer: number,
    playerAnswer: number
) => number;

export interface RoundManager {
    /** Текущий раунд */
    currentRound: Round | null;
    /** Перейти к следующей фазе */
    nextPhase(): void;
    /** Обработать действие игрока */
    processAction(action: PlayerAction): boolean;
    /** Определить победителей */
    determineWinners(): RoundWinner[];
    /** Завершить раунд */
    finishRound(): void;
}
