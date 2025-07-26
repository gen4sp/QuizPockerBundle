/**
 * Менеджер для управления таймерами в игре
 */

import { EventEmitter } from "events";
import type { Player } from "../types/player";
import type { Round } from "../types/round";
import { RoundPhase } from "../types/round";

export interface TimerConfig {
    /** Время на ответ на вопрос (секунды) */
    answerTimeout: number;
    /** Время на действие в ставках (секунды) */
    bettingTimeout: number;
    /** Время показа подсказки (секунды) */
    hintTimeout: number;
    /** Время показа результата (секунды) */
    revealTimeout: number;
    /** Время на showdown (секунды) */
    showdownTimeout: number;
    /** Предупреждение за N секунд до истечения */
    warningBeforeTimeout: number;
}

export interface TimerState {
    /** Название таймера */
    name: string;
    /** Активен ли таймер */
    isActive: boolean;
    /** Время начала */
    startedAt: Date;
    /** Длительность в миллисекундах */
    duration: number;
    /** Оставшееся время в миллисекундах */
    remainingTime: number;
    /** Для какого игрока (если применимо) */
    playerId?: string;
    /** Фаза игры */
    phase?: RoundPhase;
}

export class GameTimerManager extends EventEmitter {
    private timers: Map<string, NodeJS.Timeout> = new Map();
    private timerStates: Map<string, TimerState> = new Map();
    private config: TimerConfig;
    private currentRound: Round | null = null;

    constructor(config: Partial<TimerConfig> = {}) {
        super();

        this.config = {
            answerTimeout: 30,
            bettingTimeout: 30,
            hintTimeout: 5,
            revealTimeout: 5,
            showdownTimeout: 3,
            warningBeforeTimeout: 10,
            ...config,
        };
    }

    /**
     * Установить текущий раунд
     */
    public setCurrentRound(round: Round | null): void {
        this.currentRound = round;
    }

    /**
     * Запустить таймер для фазы ответа на вопрос
     */
    public startAnswerTimer(phase: RoundPhase = RoundPhase.QUESTION1): string {
        const timerName = `answer_${phase}`;
        return this.startTimer(
            timerName,
            this.config.answerTimeout * 1000,
            () => {
                this.emit("answer_timeout", {
                    phase,
                    round: this.currentRound,
                });
            },
            { phase }
        );
    }

    /**
     * Запустить таймер для действия игрока
     */
    public startPlayerActionTimer(playerId: string, phase: RoundPhase): string {
        const timerName = `player_action_${playerId}`;
        return this.startTimer(
            timerName,
            this.config.bettingTimeout * 1000,
            () => {
                this.emit("player_action_timeout", {
                    playerId,
                    phase,
                    round: this.currentRound,
                    defaultAction: this.getDefaultActionForTimeout(phase),
                });
            },
            { phase, playerId }
        );
    }

    /**
     * Запустить таймер для показа подсказки
     */
    public startHintTimer(): string {
        const timerName = "hint_display";
        return this.startTimer(
            timerName,
            this.config.hintTimeout * 1000,
            () => {
                this.emit("hint_timeout", {
                    round: this.currentRound,
                });
            },
            { phase: RoundPhase.QUESTION2 }
        );
    }

    /**
     * Запустить таймер для показа результата
     */
    public startRevealTimer(): string {
        const timerName = "reveal_display";
        return this.startTimer(
            timerName,
            this.config.revealTimeout * 1000,
            () => {
                this.emit("reveal_timeout", {
                    round: this.currentRound,
                });
            },
            { phase: RoundPhase.REVEAL }
        );
    }

    /**
     * Запустить таймер для showdown
     */
    public startShowdownTimer(): string {
        const timerName = "showdown_display";
        return this.startTimer(
            timerName,
            this.config.showdownTimeout * 1000,
            () => {
                this.emit("showdown_timeout", {
                    round: this.currentRound,
                });
            },
            { phase: RoundPhase.SHOWDOWN }
        );
    }

    /**
     * Запустить пользовательский таймер
     */
    public startCustomTimer(
        name: string,
        durationMs: number,
        callback: () => void,
        options: { phase?: RoundPhase; playerId?: string } = {}
    ): string {
        return this.startTimer(name, durationMs, callback, options);
    }

    /**
     * Остановить таймер
     */
    public stopTimer(timerName: string): boolean {
        const timer = this.timers.get(timerName);
        if (timer) {
            clearTimeout(timer);
            this.timers.delete(timerName);

            const state = this.timerStates.get(timerName);
            if (state) {
                state.isActive = false;
                state.remainingTime = 0;

                this.emit("timer_stopped", {
                    timerName,
                    state: { ...state },
                });
            }

            this.timerStates.delete(timerName);
            return true;
        }
        return false;
    }

    /**
     * Остановить все таймеры
     */
    public stopAllTimers(): void {
        for (const timerName of this.timers.keys()) {
            this.stopTimer(timerName);
        }
    }

    /**
     * Приостановить таймер
     */
    public pauseTimer(timerName: string): boolean {
        const state = this.timerStates.get(timerName);
        const timer = this.timers.get(timerName);

        if (state && timer && state.isActive) {
            // Вычисляем оставшееся время
            const elapsed = Date.now() - state.startedAt.getTime();
            state.remainingTime = Math.max(0, state.duration - elapsed);

            // Останавливаем таймер
            clearTimeout(timer);
            this.timers.delete(timerName);
            state.isActive = false;

            this.emit("timer_paused", {
                timerName,
                remainingTime: state.remainingTime,
                state: { ...state },
            });

            return true;
        }
        return false;
    }

    /**
     * Возобновить приостановленный таймер
     */
    public resumeTimer(timerName: string): boolean {
        const state = this.timerStates.get(timerName);

        if (state && !state.isActive && state.remainingTime > 0) {
            // Создаем новый таймер с оставшимся временем
            const timer = setTimeout(() => {
                const currentState = this.timerStates.get(timerName);
                if (currentState) {
                    this.emit("timer_expired", {
                        timerName,
                        state: { ...currentState },
                    });
                    this.timerStates.delete(timerName);
                }
                this.timers.delete(timerName);
            }, state.remainingTime);

            this.timers.set(timerName, timer);
            state.isActive = true;
            state.startedAt = new Date();
            state.duration = state.remainingTime;

            // Устанавливаем предупреждение если нужно
            this.scheduleWarning(timerName, state.remainingTime);

            this.emit("timer_resumed", {
                timerName,
                remainingTime: state.remainingTime,
                state: { ...state },
            });

            return true;
        }
        return false;
    }

    /**
     * Получить состояние таймера
     */
    public getTimerState(timerName: string): TimerState | null {
        const state = this.timerStates.get(timerName);
        if (!state) return null;

        if (state.isActive) {
            const elapsed = Date.now() - state.startedAt.getTime();
            state.remainingTime = Math.max(0, state.duration - elapsed);
        }

        return { ...state };
    }

    /**
     * Получить все активные таймеры
     */
    public getActiveTimers(): TimerState[] {
        const activeTimers: TimerState[] = [];

        for (const [name, state] of this.timerStates.entries()) {
            if (state.isActive) {
                const elapsed = Date.now() - state.startedAt.getTime();
                state.remainingTime = Math.max(0, state.duration - elapsed);
                activeTimers.push({ ...state });
            }
        }

        return activeTimers;
    }

    /**
     * Проверить истек ли таймер
     */
    public isTimerExpired(timerName: string): boolean {
        const state = this.getTimerState(timerName);
        return state ? state.remainingTime <= 0 : true;
    }

    /**
     * Остановить таймеры для конкретного игрока
     */
    public stopPlayerTimers(playerId: string): void {
        const playerTimers = Array.from(this.timerStates.entries())
            .filter(([name, state]) => state.playerId === playerId)
            .map(([name]) => name);

        playerTimers.forEach((timerName) => this.stopTimer(timerName));
    }

    /**
     * Остановить таймеры для конкретной фазы
     */
    public stopPhaseTimers(phase: RoundPhase): void {
        const phaseTimers = Array.from(this.timerStates.entries())
            .filter(([name, state]) => state.phase === phase)
            .map(([name]) => name);

        phaseTimers.forEach((timerName) => this.stopTimer(timerName));
    }

    /**
     * Обновить конфигурацию таймеров
     */
    public updateConfig(newConfig: Partial<TimerConfig>): void {
        this.config = { ...this.config, ...newConfig };

        this.emit("timer_config_updated", {
            config: { ...this.config },
        });
    }

    /**
     * Получить конфигурацию таймеров
     */
    public getConfig(): TimerConfig {
        return { ...this.config };
    }

    /**
     * Внутренний метод для запуска таймера
     */
    private startTimer(
        timerName: string,
        durationMs: number,
        callback: () => void,
        options: { phase?: RoundPhase; playerId?: string } = {}
    ): string {
        // Останавливаем существующий таймер с тем же именем
        this.stopTimer(timerName);

        const startedAt = new Date();
        const state: TimerState = {
            name: timerName,
            isActive: true,
            startedAt,
            duration: durationMs,
            remainingTime: durationMs,
            ...options,
        };

        // Сохраняем состояние
        this.timerStates.set(timerName, state);

        // Создаем таймер
        const timer = setTimeout(() => {
            callback();
            this.emit("timer_expired", {
                timerName,
                state: { ...state },
            });
            this.timers.delete(timerName);
            this.timerStates.delete(timerName);
        }, durationMs);

        this.timers.set(timerName, timer);

        // Устанавливаем предупреждение если нужно
        this.scheduleWarning(timerName, durationMs);

        this.emit("timer_started", {
            timerName,
            duration: durationMs,
            state: { ...state },
        });

        return timerName;
    }

    /**
     * Запланировать предупреждение
     */
    private scheduleWarning(timerName: string, durationMs: number): void {
        const warningTime = this.config.warningBeforeTimeout * 1000;

        if (durationMs > warningTime) {
            const warningDelay = durationMs - warningTime;

            setTimeout(() => {
                const state = this.timerStates.get(timerName);
                if (state && state.isActive) {
                    this.emit("timer_warning", {
                        timerName,
                        remainingTime: warningTime,
                        state: { ...state },
                    });
                }
            }, warningDelay);
        }
    }

    /**
     * Получить действие по умолчанию при timeout
     */
    private getDefaultActionForTimeout(phase: RoundPhase): string {
        switch (phase) {
            case RoundPhase.BETTING1:
            case RoundPhase.BETTING2:
            case RoundPhase.BETTING3:
                return "fold"; // По умолчанию фолд при timeout ставок
            case RoundPhase.QUESTION1:
            case RoundPhase.QUESTION2:
                return "no_answer"; // Нет ответа при timeout вопроса
            default:
                return "timeout";
        }
    }

    /**
     * Получить статистику таймеров
     */
    public getTimerStats(): any {
        const activeTimers = this.getActiveTimers();
        const totalTimers = this.timerStates.size;

        return {
            totalTimers,
            activeTimers: activeTimers.length,
            pausedTimers: totalTimers - activeTimers.length,
            timersByPhase: this.getTimersByPhase(),
            timersByPlayer: this.getTimersByPlayer(),
        };
    }

    /**
     * Получить таймеры по фазам
     */
    private getTimersByPhase(): Record<string, number> {
        const phaseCount: Record<string, number> = {};

        for (const state of this.timerStates.values()) {
            if (state.phase) {
                phaseCount[state.phase] = (phaseCount[state.phase] || 0) + 1;
            }
        }

        return phaseCount;
    }

    /**
     * Получить таймеры по игрокам
     */
    private getTimersByPlayer(): Record<string, number> {
        const playerCount: Record<string, number> = {};

        for (const state of this.timerStates.values()) {
            if (state.playerId) {
                playerCount[state.playerId] =
                    (playerCount[state.playerId] || 0) + 1;
            }
        }

        return playerCount;
    }

    /**
     * Уничтожить менеджер
     */
    public destroy(): void {
        this.stopAllTimers();
        this.removeAllListeners();
        this.currentRound = null;
    }
}
