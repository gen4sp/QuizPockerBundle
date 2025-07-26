/**
 * Экспорт всех основных классов игры
 */

// Основной рефакторированный класс с менеджерами
export { Game } from "./Game";

// Менеджеры
export { GamePhaseManager } from "./GamePhaseManager";
export { BettingManager } from "./BettingManager";
export { WinnerDeterminator } from "./WinnerDeterminator";
export { PlayerManager } from "./PlayerManager";
export { GameValidator } from "./GameValidator";
export { GameSerializer } from "./GameSerializer";
export { GameTimerManager } from "./GameTimerManager";

// Типы и интерфейсы
export type { GetQuestionFunction } from "./Game";
export type { ValidationResult } from "./GameValidator";
export type { WinnerDistribution } from "./WinnerDeterminator";
export type {
    SerializationOptions,
    DeserializationResult,
} from "./GameSerializer";
export type { TimerConfig, TimerState } from "./GameTimerManager";
