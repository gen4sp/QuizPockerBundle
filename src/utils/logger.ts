import { LogLevel } from "../types";

/**
 * Simple logger utility
 */
export class Logger {
    private logLevel: LogLevel;

    constructor(logLevel: LogLevel = "info") {
        this.logLevel = logLevel;
    }

    public setLevel(level: LogLevel): void {
        this.logLevel = level;
    }

    private shouldLog(level: LogLevel): boolean {
        const levels: LogLevel[] = ["debug", "info", "warn", "error"];
        return levels.indexOf(level) >= levels.indexOf(this.logLevel);
    }

    debug(message: string, ...args: unknown[]): void {
        if (this.shouldLog("debug")) {
            console.log(`[DEBUG] ${message}`, ...args);
        }
    }

    info(message: string, ...args: unknown[]): void {
        if (this.shouldLog("info")) {
            console.log(`[INFO] ${message}`, ...args);
        }
    }

    warn(message: string, ...args: unknown[]): void {
        if (this.shouldLog("warn")) {
            console.warn(`[WARN] ${message}`, ...args);
        }
    }

    error(message: string, ...args: unknown[]): void {
        if (this.shouldLog("error")) {
            console.error(`[ERROR] ${message}`, ...args);
        }
    }
}

// Singleton instance for global usage
export const logger = new Logger();
