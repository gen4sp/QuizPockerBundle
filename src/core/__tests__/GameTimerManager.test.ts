/**
 * Тесты для GameTimerManager
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { GameTimerManager, type TimerConfig } from "../GameTimerManager";
import { RoundPhase } from "../../types/round";
import { createRound } from "../../test-utils";

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
            const eventSpy = vi.fn();
            timerManager.on("timer_started", eventSpy);

            timerManager.startAnswerTimer(RoundPhase.QUESTION1);

            expect(eventSpy).toHaveBeenCalledWith({
                timerName: "answer_question1",
                duration: 30000,
                state: expect.objectContaining({
                    name: "answer_question1",
                    isActive: true,
                    phase: "question1",
                }),
            });
        });

        it("должен эмитить предупреждение перед истечением времени", () => {
            const warningSpy = vi.fn();
            timerManager.on("timer_warning", warningSpy);

            timerManager.startAnswerTimer(RoundPhase.QUESTION1);

            // Перематываем на время предупреждения (30 - 5 = 25 секунд)
            vi.advanceTimersByTime(25000);

            expect(warningSpy).toHaveBeenCalledWith({
                timerName: "answer_question1",
                remainingTime: 5000,
                state: expect.objectContaining({
                    name: "answer_question1",
                    phase: "question1",
                }),
            });
        });

        it("должен эмитить событие истечения времени", () => {
            const timeoutSpy = vi.fn();
            timerManager.on("answer_timeout", timeoutSpy);

            timerManager.startAnswerTimer(RoundPhase.QUESTION1);

            // Перематываем на полное время
            vi.advanceTimersByTime(30000);

            expect(timeoutSpy).toHaveBeenCalledWith({
                phase: "question1",
                round: null,
            });
        });
    });

    describe("startPlayerActionTimer", () => {
        it("должен запустить таймер действия игрока", () => {
            const playerId = "player1";
            const eventSpy = vi.fn();
            timerManager.on("timer_started", eventSpy);

            timerManager.startPlayerActionTimer(playerId, RoundPhase.BETTING1);

            expect(eventSpy).toHaveBeenCalledWith({
                timerName: "player_action_player1",
                duration: 20000,
                state: expect.objectContaining({
                    name: "player_action_player1",
                    isActive: true,
                    phase: "betting1",
                    playerId,
                }),
            });
        });

        it("должен обработать истечение времени действия игрока", () => {
            const playerId = "player1";
            const timeoutSpy = vi.fn();
            timerManager.on("player_action_timeout", timeoutSpy);

            timerManager.startPlayerActionTimer(playerId, RoundPhase.BETTING1);
            vi.advanceTimersByTime(20000);

            expect(timeoutSpy).toHaveBeenCalledWith({
                playerId,
                phase: "betting1",
                round: null,
                defaultAction: "fold",
            });
        });
    });

    describe("startHintTimer", () => {
        it("должен запустить таймер подсказки", () => {
            const eventSpy = vi.fn();
            timerManager.on("timer_started", eventSpy);

            timerManager.startHintTimer();

            expect(eventSpy).toHaveBeenCalledWith({
                timerName: "hint_display",
                duration: 5000,
                state: expect.objectContaining({
                    name: "hint_display",
                    isActive: true,
                    phase: "question2",
                }),
            });
        });

        it("должен использовать правильную длительность для подсказки", () => {
            const eventSpy = vi.fn();
            timerManager.on("timer_started", eventSpy);

            timerManager.startHintTimer();

            expect(eventSpy).toHaveBeenCalledWith({
                timerName: "hint_display",
                duration: 5000, // hintTimeout
                state: expect.objectContaining({
                    phase: "question2",
                }),
            });
        });
    });

    describe("stopTimer", () => {
        it("должен остановить активный таймер", () => {
            timerManager.startAnswerTimer(RoundPhase.QUESTION1);

            const result = timerManager.stopTimer("answer_question1");

            expect(result).toBe(true);
        });

        it("должен вернуть false для несуществующего таймера", () => {
            const result = timerManager.stopTimer("nonexistent");
            expect(result).toBe(false);
        });
    });

    describe("stopAllTimers", () => {
        it("должен остановить все активные таймеры", () => {
            timerManager.startAnswerTimer(RoundPhase.QUESTION1);
            timerManager.startPlayerActionTimer("player1", RoundPhase.BETTING1);

            timerManager.stopAllTimers();

            const activeTimers = timerManager.getActiveTimers();
            expect(activeTimers).toHaveLength(0);
        });
    });

    describe("pauseTimer", () => {
        it("должен приостановить активный таймер", () => {
            timerManager.startAnswerTimer(RoundPhase.QUESTION1);

            const result = timerManager.pauseTimer("answer_question1");

            expect(result).toBe(true);
        });

        it("должен эмитить событие паузы", () => {
            const pauseSpy = vi.fn();
            timerManager.on("timer_paused", pauseSpy);

            timerManager.startAnswerTimer(RoundPhase.QUESTION1);
            timerManager.pauseTimer("answer_question1");

            expect(pauseSpy).toHaveBeenCalledWith({
                timerName: "answer_question1",
                remainingTime: expect.any(Number),
                state: expect.objectContaining({
                    name: "answer_question1",
                    isActive: false,
                }),
            });
        });
    });

    describe("resumeTimer", () => {
        it("должен возобновить приостановленный таймер", () => {
            timerManager.startAnswerTimer(RoundPhase.QUESTION1);
            timerManager.pauseTimer("answer_question1");

            const result = timerManager.resumeTimer("answer_question1");

            expect(result).toBe(true);
        });

        it("должен эмитить событие возобновления", () => {
            const resumeSpy = vi.fn();
            timerManager.on("timer_resumed", resumeSpy);

            timerManager.startAnswerTimer(RoundPhase.QUESTION1);
            timerManager.pauseTimer("answer_question1");
            timerManager.resumeTimer("answer_question1");

            expect(resumeSpy).toHaveBeenCalledWith({
                timerName: "answer_question1",
                remainingTime: expect.any(Number),
                state: expect.objectContaining({
                    name: "answer_question1",
                    isActive: true,
                }),
            });
        });
    });

    describe("getTimerState", () => {
        it("должен вернуть состояние активного таймера", () => {
            const playerId = "player1";
            timerManager.startPlayerActionTimer(playerId, RoundPhase.BETTING1);

            const state = timerManager.getTimerState("player_action_player1");

            expect(state).toMatchObject({
                name: "player_action_player1",
                isActive: true,
                duration: 20000,
                playerId,
                phase: "betting1",
            });
        });

        it("должен вернуть null для несуществующего таймера", () => {
            const state = timerManager.getTimerState("nonexistent");
            expect(state).toBeNull();
        });
    });

    describe("getActiveTimers", () => {
        it("должен вернуть состояния всех активных таймеров", () => {
            timerManager.startAnswerTimer(RoundPhase.QUESTION1);
            timerManager.startPlayerActionTimer("player1", RoundPhase.BETTING1);

            const states = timerManager.getActiveTimers();

            expect(states).toHaveLength(2);
            expect(
                states.find((s) => s.name === "answer_question1")
            ).toBeDefined();
            expect(
                states.find((s) => s.name === "player_action_player1")
            ).toBeDefined();
        });

        it("должен вернуть пустой массив если нет активных таймеров", () => {
            const states = timerManager.getActiveTimers();
            expect(states).toEqual([]);
        });
    });

    describe("updateConfig", () => {
        it("должен обновить конфигурацию таймеров", () => {
            const newConfig = { answerTimeout: 45 };
            const eventSpy = vi.fn();
            timerManager.on("timer_config_updated", eventSpy);

            timerManager.updateConfig(newConfig);

            expect(eventSpy).toHaveBeenCalledWith({
                config: expect.objectContaining({
                    answerTimeout: 45,
                }),
            });

            // Проверяем что новая конфигурация применяется
            const startSpy = vi.fn();
            timerManager.on("timer_started", startSpy);

            timerManager.startAnswerTimer(RoundPhase.QUESTION1);

            expect(startSpy).toHaveBeenCalledWith({
                timerName: "answer_question1",
                duration: 45000, // Новая длительность
                state: expect.any(Object),
            });
        });
    });

    describe("startRevealTimer", () => {
        it("должен запустить таймер показа результата", () => {
            const eventSpy = vi.fn();
            timerManager.on("timer_started", eventSpy);

            timerManager.startRevealTimer();

            expect(eventSpy).toHaveBeenCalledWith({
                timerName: "reveal_display",
                duration: 3000,
                state: expect.objectContaining({
                    name: "reveal_display",
                    phase: "reveal",
                }),
            });
        });
    });

    describe("startShowdownTimer", () => {
        it("должен запустить таймер showdown", () => {
            const eventSpy = vi.fn();
            timerManager.on("timer_started", eventSpy);

            timerManager.startShowdownTimer();

            expect(eventSpy).toHaveBeenCalledWith({
                timerName: "showdown_display",
                duration: 10000,
                state: expect.objectContaining({
                    name: "showdown_display",
                    phase: "showdown",
                }),
            });
        });
    });

    describe("stopPlayerTimers", () => {
        it("должен остановить все таймеры игрока", () => {
            const playerId = "player1";
            timerManager.startPlayerActionTimer(playerId, RoundPhase.BETTING1);
            timerManager.startPlayerActionTimer("player2", RoundPhase.BETTING1);

            timerManager.stopPlayerTimers(playerId);

            const activeTimers = timerManager.getActiveTimers();
            expect(
                activeTimers.find((t) => t.playerId === playerId)
            ).toBeUndefined();
            expect(
                activeTimers.find((t) => t.playerId === "player2")
            ).toBeDefined();
        });
    });

    describe("stopPhaseTimers", () => {
        it("должен остановить все таймеры фазы", () => {
            timerManager.startAnswerTimer(RoundPhase.QUESTION1);
            timerManager.startPlayerActionTimer("player1", RoundPhase.BETTING1);

            timerManager.stopPhaseTimers(RoundPhase.QUESTION1);

            const activeTimers = timerManager.getActiveTimers();
            expect(
                activeTimers.find((t) => t.phase === "question1")
            ).toBeUndefined();
            expect(
                activeTimers.find((t) => t.phase === "betting1")
            ).toBeDefined();
        });
    });

    describe("getTimerStats and isTimerExpired", () => {
        it("должен получить статистику таймеров", () => {
            timerManager.startAnswerTimer(RoundPhase.QUESTION1);
            timerManager.startPlayerActionTimer("player1", RoundPhase.BETTING1);

            const stats = timerManager.getTimerStats();

            expect(stats.totalTimers).toBe(2);
            expect(stats.activeTimers).toBe(2);
            expect(stats.pausedTimers).toBe(0);
        });

        it("должен проверить истечение таймера", () => {
            timerManager.startAnswerTimer(RoundPhase.QUESTION1);

            expect(timerManager.isTimerExpired("answer_question1")).toBe(false);

            vi.advanceTimersByTime(30000);

            expect(timerManager.isTimerExpired("answer_question1")).toBe(true);
        });
    });

    describe("События", () => {
        it("должен быть экземпляром EventEmitter", () => {
            const eventSpy = vi.fn();
            timerManager.on("test_event", eventSpy);
            timerManager.emit("test_event", { data: "test" });

            expect(eventSpy).toHaveBeenCalledWith({ data: "test" });
        });
    });

    describe("destroy", () => {
        it("должен очистить все таймеры и слушатели", () => {
            timerManager.startAnswerTimer(RoundPhase.QUESTION1);
            timerManager.startPlayerActionTimer("player1", RoundPhase.BETTING1);

            timerManager.destroy();

            const states = timerManager.getActiveTimers();
            expect(states).toEqual([]);
        });
    });
});
