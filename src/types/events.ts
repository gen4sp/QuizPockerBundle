/**
 * Event type definitions for QuizPoker
 */

import type { Player, PlayerAction } from "./player";
import type { Game } from "./game";
import type { Round, RoundPhase, RoundResults } from "./round";

export interface GameEvent<T = any> {
    /** Тип события */
    type: GameEventType;
    /** Данные события */
    data: T;
    /** Время события */
    timestamp: Date;
    /** ID игры */
    gameId: string;
    /** ID раунда (если применимо) */
    roundId?: string;
}

export enum GameEventType {
    // События игры
    GAME_CREATED = "game_created",
    GAME_STARTED = "game_started",
    GAME_PAUSED = "game_paused",
    GAME_RESUMED = "game_resumed",
    GAME_FINISHED = "game_finished",
    GAME_CANCELLED = "game_cancelled",

    // События игроков
    PLAYER_JOINED = "player_joined",
    PLAYER_LEFT = "player_left",
    PLAYER_ACTION = "player_action",
    PLAYER_TIMEOUT = "player_timeout",
    PLAYER_ELIMINATED = "player_eliminated",
    PLAYER_ANSWER = "player_answer",

    // События раунда
    ROUND_STARTED = "round_started",
    ROUND_FINISHED = "round_finished",
    PHASE_CHANGED = "phase_changed",
    QUESTION_REVEALED = "question_revealed",
    HINT_REVEALED = "hint_revealed",
    ANSWER_REVEALED = "answer_revealed",

    // События ставок
    BETTING_STARTED = "betting_started",
    BETTING_FINISHED = "betting_finished",
    POT_UPDATED = "pot_updated",
    SIDE_POT_CREATED = "side_pot_created",

    // События результатов
    SHOWDOWN_STARTED = "showdown_started",
    WINNERS_DETERMINED = "winners_determined",
    CHIPS_DISTRIBUTED = "chips_distributed",

    // События таймера
    TIMER_STARTED = "timer_started",
    TIMER_WARNING = "timer_warning",
    TIMER_EXPIRED = "timer_expired",

    // Системные события
    ERROR_OCCURRED = "error_occurred",
    DEBUG_INFO = "debug_info",
}

// Типы данных для конкретных событий

export interface GameCreatedData {
    game: Game;
    creator?: string;
}

export interface GameStartedData {
    game: Game;
    startTime: Date;
}

export interface GameFinishedData {
    game: Game;
    winner?: Player;
    finalStandings: Player[];
    duration: number;
}

export interface PlayerJoinedData {
    player: Player;
    totalPlayers: number;
}

export interface PlayerLeftData {
    player: Player;
    reason: "disconnect" | "quit" | "kicked";
    totalPlayers: number;
}

export interface PlayerActionData {
    player: Player;
    action: PlayerAction;
    isValid: boolean;
    potBefore: number;
    potAfter: number;
}

export interface PlayerTimeoutData {
    player: Player;
    phase: RoundPhase;
    defaultAction: PlayerAction;
}

export interface PlayerAnswerData {
    player: Player;
    answer: number;
    timeRemaining: number;
    allAnswersReceived: boolean;
}

export interface RoundStartedData {
    round: Round;
    dealerPosition: number;
    question: string;
}

export interface RoundFinishedData {
    round: Round;
    results: RoundResults;
    duration: number;
}

export interface PhaseChangedData {
    round: Round;
    previousPhase: RoundPhase;
    newPhase: RoundPhase;
    reason: "timer" | "all_actions_complete" | "manual";
}

export interface QuestionRevealedData {
    round: Round;
    question: string;
    timeToAnswer: number;
}

export interface HintRevealedData {
    round: Round;
    hint: string;
}

export interface AnswerRevealedData {
    round: Round;
    correctAnswer: number;
    playerAnswers: Array<{
        playerId: string;
        answer: number;
        deviation: number;
    }>;
}

export interface BettingStartedData {
    round: Round;
    phase: RoundPhase;
    currentPlayer: string;
    currentBet: number;
    minRaise: number;
}

export interface BettingFinishedData {
    round: Round;
    phase: RoundPhase;
    totalActions: number;
    potSize: number;
}

export interface PotUpdatedData {
    round: Round;
    previousTotal: number;
    newTotal: number;
    lastAction: PlayerAction;
}

export interface SidePotCreatedData {
    round: Round;
    sidePotAmount: number;
    eligiblePlayers: string[];
    triggeredBy: string;
}

export interface ShowdownStartedData {
    round: Round;
    remainingPlayers: Player[];
    correctAnswer: number;
}

export interface WinnersDeterminedData {
    round: Round;
    winners: Array<{
        playerId: string;
        winAmount: number;
        accuracy: number;
    }>;
    totalDistributed: number;
}

export interface ChipsDistributedData {
    round: Round;
    distributions: Array<{
        playerId: string;
        amount: number;
        newStack: number;
    }>;
}

export interface TimerStartedData {
    phase: RoundPhase;
    duration: number;
    playerId?: string;
}

export interface TimerWarningData {
    phase: RoundPhase;
    remainingTime: number;
    playerId?: string;
}

export interface TimerExpiredData {
    phase: RoundPhase;
    playerId?: string;
    defaultAction?: PlayerAction;
}

export interface ErrorData {
    error: Error;
    context: string;
    gameId: string;
    roundId?: string;
    playerId?: string;
}

export interface DebugData {
    message: string;
    data?: any;
    level: "info" | "warn" | "debug";
}

// Объединенный тип для всех возможных данных событий
export type EventData =
    | GameCreatedData
    | GameStartedData
    | GameFinishedData
    | PlayerJoinedData
    | PlayerLeftData
    | PlayerActionData
    | PlayerTimeoutData
    | PlayerAnswerData
    | RoundStartedData
    | RoundFinishedData
    | PhaseChangedData
    | QuestionRevealedData
    | HintRevealedData
    | AnswerRevealedData
    | BettingStartedData
    | BettingFinishedData
    | PotUpdatedData
    | SidePotCreatedData
    | ShowdownStartedData
    | WinnersDeterminedData
    | ChipsDistributedData
    | TimerStartedData
    | TimerWarningData
    | TimerExpiredData
    | ErrorData
    | DebugData;

// Типы для обработчиков событий
export type EventHandler<T = any> = (
    event: GameEvent<T>
) => void | Promise<void>;

export interface EventSubscription {
    /** Тип события */
    eventType: GameEventType;
    /** Обработчик события */
    handler: EventHandler;
    /** Уникальный ID подписки */
    id: string;
    /** Одноразовое событие */
    once?: boolean;
}

export interface EventEmitter {
    /** Подписаться на событие */
    on<T>(eventType: GameEventType, handler: EventHandler<T>): string;
    /** Подписаться на событие (одноразово) */
    once<T>(eventType: GameEventType, handler: EventHandler<T>): string;
    /** Отписаться от события */
    off(subscriptionId: string): boolean;
    /** Испустить событие */
    emit<T>(eventType: GameEventType, data: T): void;
    /** Получить все активные подписки */
    getSubscriptions(): EventSubscription[];
    /** Очистить все подписки */
    clear(): void;
}
