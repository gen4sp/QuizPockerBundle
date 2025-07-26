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
