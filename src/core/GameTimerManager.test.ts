/**
 * Тесты для GameTimerManager
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { GameTimerManager, type TimerConfig } from "./GameTimerManager";
import { RoundPhase } from "../types/round";
import { createRound } from "../test-utils";

describe("GameTimerManager", () => {
    let timerManager: GameTimerManager;
    let mockTimerConfig: TimerConfig;

    beforeEach(() => {
        vi.useFakeTimers();
        mockTimerConfig = {
            answerTimeout: 30,
            bettingTimeout: 20,
            hintTimeout: 5,
            revealTimeout: 3,
            showdownTimeout: 10,
            warningBeforeTimeout: 5,
        };
        timerManager = new GameTimerManager(mockTimerConfig);
    });

    afterEach(() => {
        timerManager.destroy();
        vi.useRealTimers();
    });

    describe("Конструктор", () => {
        it("должен создать экземпляр GameTimerManager", () => {
            expect(timerManager).toBeInstanceOf(GameTimerManager);
        });

        it("должен использовать конфигурацию по умолчанию если не передана", () => {
            const defaultManager = new GameTimerManager();
            expect(defaultManager).toBeInstanceOf(GameTimerManager);
        });
    });

    describe("startAnswerTimer", () => {
        it("должен запустить таймер ответа", () => {
            const playerId = "player1";
            const eventSpy = vi.fn();
            timerManager.on("answer_timer_started", eventSpy);

            timerManager.startAnswerTimer(playerId);

            expect(eventSpy).toHaveBeenCalledWith({
                playerId,
                duration: 30000,
                phase: "answer",
            });
        });

        it("должен эмитить предупреждение перед истечением времени", () => {
            const playerId = "player1";
            const warningSpy = vi.fn();
            timerManager.on("timer_warning", warningSpy);

            timerManager.startAnswerTimer(playerId);

            // Перематываем на время предупреждения (30 - 5 = 25 секунд)
            vi.advanceTimersByTime(25000);

            expect(warningSpy).toHaveBeenCalledWith({
                playerId,
                remainingTime: 5000,
                phase: "answer",
            });
        });

        it("должен эмитить событие истечения времени", () => {
            const playerId = "player1";
            const timeoutSpy = vi.fn();
            timerManager.on("answer_timeout", timeoutSpy);

            timerManager.startAnswerTimer(playerId);

            // Перематываем на полное время
            vi.advanceTimersByTime(30000);

            expect(timeoutSpy).toHaveBeenCalledWith({
                playerId,
                phase: "answer",
            });
        });
    });

    describe("startBettingTimer", () => {
        it("должен запустить таймер ставок", () => {
            const playerId = "player1";
            const eventSpy = vi.fn();
            timerManager.on("betting_timer_started", eventSpy);

            timerManager.startBettingTimer(playerId);

            expect(eventSpy).toHaveBeenCalledWith({
                playerId,
                duration: 20000,
                phase: "betting",
            });
        });

        it("должен обработать истечение времени ставок", () => {
            const playerId = "player1";
            const timeoutSpy = vi.fn();
            timerManager.on("betting_timeout", timeoutSpy);

            timerManager.startBettingTimer(playerId);
            vi.advanceTimersByTime(20000);

            expect(timeoutSpy).toHaveBeenCalledWith({
                playerId,
                phase: "betting",
            });
        });
    });

    describe("startPhaseTimer", () => {
        it("должен запустить таймер фазы", () => {
            const round = createRound({ currentPhase: RoundPhase.QUESTION1 });
            const eventSpy = vi.fn();
            timerManager.on("phase_timer_started", eventSpy);

            timerManager.startPhaseTimer(RoundPhase.QUESTION1, round);

            expect(eventSpy).toHaveBeenCalledWith({
                phase: RoundPhase.QUESTION1,
                duration: 30000,
                round,
            });
        });

        it("должен использовать правильную длительность для разных фаз", () => {
            const round = createRound();
            const eventSpy = vi.fn();
            timerManager.on("phase_timer_started", eventSpy);

            // Тест для фазы подсказки
            timerManager.startPhaseTimer(RoundPhase.QUESTION2, round);

            expect(eventSpy).toHaveBeenCalledWith({
                phase: RoundPhase.QUESTION2,
                duration: 5000, // hintTimeout
                round,
            });
        });
    });

    describe("clearTimer", () => {
        it("должен очистить активный таймер", () => {
            const playerId = "player1";
            timerManager.startAnswerTimer(playerId);

            const result = timerManager.clearTimer(`answer_${playerId}`);

            expect(result).toBe(true);
        });

        it("должен вернуть false для несуществующего таймера", () => {
            const result = timerManager.clearTimer("nonexistent");
            expect(result).toBe(false);
        });
    });

    describe("clearAllTimers", () => {
        it("должен очистить все активные таймеры", () => {
            timerManager.startAnswerTimer("player1");
            timerManager.startBettingTimer("player2");

            const clearedCount = timerManager.clearAllTimers();

            expect(clearedCount).toBe(2);
        });
    });

    describe("pauseTimer", () => {
        it("должен приостановить активный таймер", () => {
            const playerId = "player1";
            timerManager.startAnswerTimer(playerId);

            const result = timerManager.pauseTimer(`answer_${playerId}`);

            expect(result).toBe(true);
        });

        it("должен эмитить событие паузы", () => {
            const playerId = "player1";
            const pauseSpy = vi.fn();
            timerManager.on("timer_paused", pauseSpy);

            timerManager.startAnswerTimer(playerId);
            timerManager.pauseTimer(`answer_${playerId}`);

            expect(pauseSpy).toHaveBeenCalledWith({
                timerId: `answer_${playerId}`,
                remainingTime: expect.any(Number),
            });
        });
    });

    describe("resumeTimer", () => {
        it("должен возобновить приостановленный таймер", () => {
            const playerId = "player1";
            timerManager.startAnswerTimer(playerId);
            timerManager.pauseTimer(`answer_${playerId}`);

            const result = timerManager.resumeTimer(`answer_${playerId}`);

            expect(result).toBe(true);
        });

        it("должен эмитить событие возобновления", () => {
            const playerId = "player1";
            const resumeSpy = vi.fn();
            timerManager.on("timer_resumed", resumeSpy);

            timerManager.startAnswerTimer(playerId);
            timerManager.pauseTimer(`answer_${playerId}`);
            timerManager.resumeTimer(`answer_${playerId}`);

            expect(resumeSpy).toHaveBeenCalledWith({
                timerId: `answer_${playerId}`,
                remainingTime: expect.any(Number),
            });
        });
    });

    describe("getTimerState", () => {
        it("должен вернуть состояние активного таймера", () => {
            const playerId = "player1";
            timerManager.startAnswerTimer(playerId);

            const state = timerManager.getTimerState(`answer_${playerId}`);

            expect(state).toMatchObject({
                name: `answer_${playerId}`,
                isActive: true,
                duration: 30000,
                playerId,
                phase: "answer",
            });
        });

        it("должен вернуть null для несуществующего таймера", () => {
            const state = timerManager.getTimerState("nonexistent");
            expect(state).toBeNull();
        });
    });

    describe("getAllTimerStates", () => {
        it("должен вернуть состояния всех таймеров", () => {
            timerManager.startAnswerTimer("player1");
            timerManager.startBettingTimer("player2");

            const states = timerManager.getAllTimerStates();

            expect(states).toHaveLength(2);
            expect(states[0].name).toBe("answer_player1");
            expect(states[1].name).toBe("betting_player2");
        });

        it("должен вернуть пустой массив если нет таймеров", () => {
            const states = timerManager.getAllTimerStates();
            expect(states).toEqual([]);
        });
    });

    describe("updateConfig", () => {
        it("должен обновить конфигурацию таймеров", () => {
            const newConfig = { answerTimeout: 45 };
            timerManager.updateConfig(newConfig);

            const eventSpy = vi.fn();
            timerManager.on("answer_timer_started", eventSpy);

            timerManager.startAnswerTimer("player1");

            expect(eventSpy).toHaveBeenCalledWith({
                playerId: "player1",
                duration: 45000, // Новая длительность
                phase: "answer",
            });
        });
    });

    describe("События", () => {
        it("должен быть экземпляром EventEmitter", () => {
            const eventSpy = vi.fn();
            timerManager.on("test_event", eventSpy);
            timerManager.emit("test_event", { data: "test" });

            expect(eventSpy).toHaveBeenCalledWith({ data: "test" });
        });

        it("должен эмитить all_timers_cleared при очистке всех таймеров", () => {
            const eventSpy = vi.fn();
            timerManager.on("all_timers_cleared", eventSpy);

            timerManager.startAnswerTimer("player1");
            timerManager.clearAllTimers();

            expect(eventSpy).toHaveBeenCalledWith({
                clearedCount: 1,
            });
        });
    });

    describe("destroy", () => {
        it("должен очистить все таймеры и слушатели", () => {
            timerManager.startAnswerTimer("player1");
            timerManager.startBettingTimer("player2");

            timerManager.destroy();

            const states = timerManager.getAllTimerStates();
            expect(states).toEqual([]);
        });
    });
});
