/**
 * Тесты для GamePhaseManager
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { GamePhaseManager } from "./GamePhaseManager";
import { RoundPhase } from "../types/round";
import { PlayerStatus } from "../types/player";
import { createRound, createQuestion, createPlayer } from "../test-utils";

describe("GamePhaseManager", () => {
    let phaseManager: GamePhaseManager;

    beforeEach(() => {
        phaseManager = new GamePhaseManager();
    });

    describe("Конструктор", () => {
        it("должен создать экземпляр GamePhaseManager", () => {
            expect(phaseManager).toBeInstanceOf(GamePhaseManager);
        });

        it("должен инициализировать currentRound как null", () => {
            expect(phaseManager.getCurrentPhase()).toBeNull();
        });
    });

    describe("setCurrentRound", () => {
        it("должен установить текущий раунд", () => {
            const round = createRound();
            phaseManager.setCurrentRound(round);
            expect(phaseManager.getCurrentPhase()).toBe(round.currentPhase);
        });

        it("должен установить null как текущий раунд", () => {
            const round = createRound();
            phaseManager.setCurrentRound(round);
            phaseManager.setCurrentRound(null);
            expect(phaseManager.getCurrentPhase()).toBeNull();
        });
    });

    describe("getCurrentPhase", () => {
        it("должен вернуть null если нет текущего раунда", () => {
            expect(phaseManager.getCurrentPhase()).toBeNull();
        });

        it("должен вернуть текущую фазу раунда", () => {
            const round = createRound({ currentPhase: RoundPhase.BETTING1 });
            phaseManager.setCurrentRound(round);
            expect(phaseManager.getCurrentPhase()).toBe(RoundPhase.BETTING1);
        });
    });

    describe("nextPhase", () => {
        it("должен игнорировать вызов если нет текущего раунда", async () => {
            await expect(phaseManager.nextPhase()).resolves.toBeUndefined();
        });

        it("должен перейти к следующей фазе", async () => {
            const round = createRound({ currentPhase: RoundPhase.ANTE });
            phaseManager.setCurrentRound(round);

            const eventSpy = vi.fn();
            phaseManager.on("phase_changed", eventSpy);

            await phaseManager.nextPhase();

            expect(round.currentPhase).toBe(RoundPhase.QUESTION1);
            expect(eventSpy).toHaveBeenCalledWith({
                round,
                previousPhase: RoundPhase.ANTE,
                newPhase: RoundPhase.QUESTION1,
            });
        });

        it("должен перейти через все фазы последовательно", async () => {
            const round = createRound({ currentPhase: RoundPhase.ANTE });
            phaseManager.setCurrentRound(round);

            const phases = [
                RoundPhase.ANTE,
                RoundPhase.QUESTION1,
                RoundPhase.BETTING1,
                RoundPhase.QUESTION2,
                RoundPhase.BETTING2,
                RoundPhase.REVEAL,
                RoundPhase.BETTING3,
                RoundPhase.SHOWDOWN,
                RoundPhase.FINISHED,
            ];

            for (let i = 0; i < phases.length - 1; i++) {
                expect(round.currentPhase).toBe(phases[i]);
                await phaseManager.nextPhase();
            }

            expect(round.currentPhase).toBe(RoundPhase.FINISHED);
        });

        it("не должен переходить дальше FINISHED фазы", async () => {
            const round = createRound({ currentPhase: RoundPhase.FINISHED });
            phaseManager.setCurrentRound(round);

            await phaseManager.nextPhase();
            expect(round.currentPhase).toBe(RoundPhase.FINISHED);
        });
    });

    describe("processCurrentPhase", () => {
        it("должен игнорировать вызов если нет текущего раунда", async () => {
            await expect(
                phaseManager.processCurrentPhase()
            ).resolves.toBeUndefined();
        });

        it("должен эмитить question_revealed для фазы QUESTION1", async () => {
            const question = createQuestion();
            const round = createRound({
                currentPhase: RoundPhase.QUESTION1,
                question,
            });
            phaseManager.setCurrentRound(round);

            const eventSpy = vi.fn();
            phaseManager.on("question_revealed", eventSpy);

            await phaseManager.processCurrentPhase();

            expect(eventSpy).toHaveBeenCalledWith({
                round,
                question: question.text,
                timeToAnswer: 30,
            });
        });

        it("должен эмитить betting_started для фазы ставок", async () => {
            const round = createRound({ currentPhase: RoundPhase.BETTING1 });
            phaseManager.setCurrentRound(round);

            const eventSpy = vi.fn();
            phaseManager.on("betting_started", eventSpy);

            await phaseManager.processCurrentPhase();

            expect(eventSpy).toHaveBeenCalledWith({
                round,
                phase: RoundPhase.BETTING1,
            });
        });
    });

    describe("isBettingPhaseComplete", () => {
        it("должен вернуть true если нет текущего раунда", () => {
            expect(phaseManager.isBettingPhaseComplete()).toBe(true);
        });

        it("должен вернуть true если остался только один активный игрок", () => {
            const players = [
                createPlayer({ status: PlayerStatus.ACTIVE }),
                createPlayer({ status: PlayerStatus.FOLDED }),
            ];
            const round = createRound({
                currentPhase: RoundPhase.BETTING1,
                activePlayers: players,
            });
            phaseManager.setCurrentRound(round);

            expect(phaseManager.isBettingPhaseComplete()).toBe(true);
        });

        it("должен вернуть false если есть игроки которые могут действовать", () => {
            const players = [
                createPlayer({ currentBet: 100, isAllIn: false }),
                createPlayer({ currentBet: 200, isAllIn: false }),
            ];
            const round = createRound({
                currentPhase: RoundPhase.BETTING1,
                activePlayers: players,
            });
            phaseManager.setCurrentRound(round);

            expect(phaseManager.isBettingPhaseComplete()).toBe(false);
        });
    });

    describe("completeBettingPhase", () => {
        it("должен перейти к следующей фазе если фаза ставок завершена", async () => {
            const players = [
                createPlayer({ currentBet: 100, status: PlayerStatus.ACTIVE }),
                createPlayer({ currentBet: 100, status: PlayerStatus.ACTIVE }),
            ];
            const round = createRound({
                currentPhase: RoundPhase.BETTING1,
                activePlayers: players,
            });
            phaseManager.setCurrentRound(round);

            await phaseManager.completeBettingPhase();

            expect(round.currentPhase).toBe(RoundPhase.QUESTION2);
        });
    });

    describe("destroy", () => {
        it("должен очистить слушатели и сбросить текущий раунд", () => {
            const round = createRound();
            phaseManager.setCurrentRound(round);

            const removeAllListenersSpy = vi.spyOn(
                phaseManager,
                "removeAllListeners"
            );

            phaseManager.destroy();

            expect(removeAllListenersSpy).toHaveBeenCalled();
            expect(phaseManager.getCurrentPhase()).toBeNull();
        });
    });

    describe("События", () => {
        it("должен эмитить phase_changed при переходе фазы", async () => {
            const round = createRound({ currentPhase: RoundPhase.ANTE });
            phaseManager.setCurrentRound(round);

            const eventSpy = vi.fn();
            phaseManager.on("phase_changed", eventSpy);

            await phaseManager.nextPhase();

            expect(eventSpy).toHaveBeenCalledTimes(1);
            expect(eventSpy).toHaveBeenCalledWith({
                round,
                previousPhase: RoundPhase.ANTE,
                newPhase: RoundPhase.QUESTION1,
            });
        });

        it("должен эмитить phase_changed с правильными данными", async () => {
            const round = createRound({ currentPhase: RoundPhase.ANTE });
            phaseManager.setCurrentRound(round);

            const eventSpy = vi.fn();
            phaseManager.on("phase_changed", eventSpy);

            await phaseManager.nextPhase();

            expect(eventSpy).toHaveBeenCalledWith({
                round,
                previousPhase: RoundPhase.ANTE,
                newPhase: RoundPhase.QUESTION1,
                reason: "automatic",
            });
        });
    });
});
