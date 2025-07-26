/**
 * Common type definitions for QuizPokerBundle
 */

export interface QuizPokerConfig {
    name: string;
    version: string;
}

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface BundleOptions {
    logLevel?: LogLevel;
    enableDebug?: boolean;
}

// Export all types from modules
export * from "./common";
export * from "./player";
export * from "./game";
export * from "./round";
export * from "./events";

// Re-export commonly used types for convenience
export type {
    Player,
    PlayerAction,
    BettingAction,
    PlayerStatus,
} from "./player";

export type { Game, GameConfig, GameStatus, Question } from "./game";

export type {
    Round,
    RoundPhase,
    RoundResults,
    RoundWinner,
    TimerState,
} from "./round";

export type {
    GameEvent,
    GameEventType,
    EventHandler,
    EventEmitter,
} from "./events";
