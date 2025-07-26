/**
 * Тесты для WinnerDeterminator
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
    WinnerDeterminator,
    type WinnerDistribution,
} from "./WinnerDeterminator";
import { PlayerStatus } from "../types/player";
import {
    createRound,
    createPlayer,
    createQuestion,
    createRoundPot,
} from "../test-utils";

describe("WinnerDeterminator", () => {
    let winnerDeterminator: WinnerDeterminator;

    beforeEach(() => {
        winnerDeterminator = new WinnerDeterminator();
    });

    describe("Конструктор", () => {
        it("должен создать экземпляр WinnerDeterminator", () => {
            expect(winnerDeterminator).toBeInstanceOf(WinnerDeterminator);
        });
    });

    describe("determineWinners", () => {
        it("должен вернуть пустой массив если нет вопроса", () => {
            const round = createRound({ question: undefined });

            const winners = winnerDeterminator.determineWinners(round);

            expect(winners).toEqual([]);
        });

        it("должен вернуть пустой массив если нет активных игроков с ответами", () => {
            const question = createQuestion({ correctAnswer: 100 });
            const players = [
                createPlayer({ status: PlayerStatus.FOLDED }),
                createPlayer({ answer: undefined }),
            ];
            const round = createRound({
                question,
                activePlayers: players,
            });

            const winners = winnerDeterminator.determineWinners(round);

            expect(winners).toEqual([]);
        });

        it("должен определить единственного победителя", () => {
            const question = createQuestion({ correctAnswer: 100 });
            const players = [
                createPlayer({
                    id: "player1",
                    answer: 95, // Отклонение 5
                    status: PlayerStatus.ACTIVE,
                }),
                createPlayer({
                    id: "player2",
                    answer: 110, // Отклонение 10
                    status: PlayerStatus.ACTIVE,
                }),
                createPlayer({
                    id: "player3",
                    answer: 80, // Отклонение 20
                    status: PlayerStatus.ACTIVE,
                }),
            ];

            const pot = createRoundPot({ totalPot: 300 });
            const round = createRound({
                question,
                activePlayers: players,
                pot,
            });

            const winners = winnerDeterminator.determineWinners(round);

            expect(winners).toHaveLength(1);
            expect(winners[0].playerId).toBe("player1");
            expect(winners[0].winAmount).toBe(300);
            expect(winners[0].accuracy).toBe(95); // 100 - 5
            expect(winners[0].deviation).toBe(5);
        });

        it("должен разделить банк между игроками с одинаковой точностью", () => {
            const question = createQuestion({ correctAnswer: 100 });
            const players = [
                createPlayer({
                    id: "player1",
                    answer: 95, // Отклонение 5
                    status: PlayerStatus.ACTIVE,
                }),
                createPlayer({
                    id: "player2",
                    answer: 105, // Отклонение 5 (такое же)
                    status: PlayerStatus.ACTIVE,
                }),
                createPlayer({
                    id: "player3",
                    answer: 80, // Отклонение 20
                    status: PlayerStatus.ACTIVE,
                }),
            ];

            const pot = createRoundPot({ totalPot: 300 });
            const round = createRound({
                question,
                activePlayers: players,
                pot,
            });

            const winners = winnerDeterminator.determineWinners(round);

            expect(winners).toHaveLength(2);
            expect(winners[0].playerId).toBe("player1");
            expect(winners[0].winAmount).toBe(150); // 300 / 2
            expect(winners[1].playerId).toBe("player2");
            expect(winners[1].winAmount).toBe(150); // 300 / 2
        });

        it("должен игнорировать сбросивших игроков", () => {
            const question = createQuestion({ correctAnswer: 100 });
            const players = [
                createPlayer({
                    id: "player1",
                    answer: 95,
                    status: PlayerStatus.ACTIVE,
                }),
                createPlayer({
                    id: "player2",
                    answer: 99, // Ближе к ответу, но сбросил
                    status: PlayerStatus.FOLDED,
                }),
            ];

            const pot = createRoundPot({ totalPot: 200 });
            const round = createRound({
                question,
                activePlayers: players,
                pot,
            });

            const winners = winnerDeterminator.determineWinners(round);

            expect(winners).toHaveLength(1);
            expect(winners[0].playerId).toBe("player1");
            expect(winners[0].winAmount).toBe(200);
        });

        it("должен правильно рассчитать точность", () => {
            const question = createQuestion({ correctAnswer: 50 });
            const players = [
                createPlayer({
                    id: "player1",
                    answer: 40, // Отклонение 10, точность 80%
                    status: PlayerStatus.ACTIVE,
                }),
            ];

            const pot = createRoundPot({ totalPot: 100 });
            const round = createRound({
                question,
                activePlayers: players,
                pot,
            });

            const winners = winnerDeterminator.determineWinners(round);

            expect(winners).toHaveLength(1);
            expect(winners[0].accuracy).toBeCloseTo(80, 1); // 80% точности
            expect(winners[0].deviation).toBe(10);
        });

        it("должен эмитить событие winners_determined", () => {
            const question = createQuestion({ correctAnswer: 100 });
            const players = [
                createPlayer({
                    answer: 95,
                    status: PlayerStatus.ACTIVE,
                }),
            ];

            const pot = createRoundPot({ totalPot: 100 });
            const round = createRound({
                question,
                activePlayers: players,
                pot,
            });

            const eventSpy = vi.fn();
            winnerDeterminator.on("winners_determined", eventSpy);

            const winners = winnerDeterminator.determineWinners(round);

            expect(eventSpy).toHaveBeenCalledWith({
                round,
                winners,
                totalDistributed: 100,
            });
        });
    });

    describe("distributePot", () => {
        it("должен распределить банк между победителями", () => {
            const winners = [
                { playerId: "player1", deviation: 5, accuracy: 95 },
                { playerId: "player2", deviation: 5, accuracy: 95 },
            ];
            const totalPot = 200;

            const distribution = winnerDeterminator.distributePot(
                winners,
                totalPot
            );

            expect(distribution.winners).toHaveLength(2);
            expect(distribution.winners[0].winAmount).toBe(100);
            expect(distribution.winners[1].winAmount).toBe(100);
            expect(distribution.totalDistributed).toBe(200);
            expect(distribution.remainingPot).toBe(0);
        });

        it("должен обработать остаток при неравном делении", () => {
            const winners = [
                { playerId: "player1", deviation: 5, accuracy: 95 },
                { playerId: "player2", deviation: 5, accuracy: 95 },
                { playerId: "player3", deviation: 5, accuracy: 95 },
            ];
            const totalPot = 100; // Не делится на 3 равно

            const distribution = winnerDeterminator.distributePot(
                winners,
                totalPot
            );

            expect(distribution.winners).toHaveLength(3);
            expect(distribution.winners[0].winAmount).toBe(33);
            expect(distribution.winners[1].winAmount).toBe(33);
            expect(distribution.winners[2].winAmount).toBe(33);
            expect(distribution.totalDistributed).toBe(99);
            expect(distribution.remainingPot).toBe(1);
        });

        it("должен вернуть пустое распределение для пустого массива победителей", () => {
            const distribution = winnerDeterminator.distributePot([], 100);

            expect(distribution.winners).toEqual([]);
            expect(distribution.totalDistributed).toBe(0);
            expect(distribution.remainingPot).toBe(100);
        });
    });

    describe("calculateAccuracy", () => {
        it("должен рассчитать точность для идеального ответа", () => {
            const accuracy = winnerDeterminator.calculateAccuracy(100, 100);
            expect(accuracy).toBe(100);
        });

        it("должен рассчитать точность для частично правильного ответа", () => {
            const accuracy = winnerDeterminator.calculateAccuracy(100, 90);
            expect(accuracy).toBe(90); // 90% точности
        });

        it("должен рассчитать точность для полностью неправильного ответа", () => {
            const accuracy = winnerDeterminator.calculateAccuracy(100, 0);
            expect(accuracy).toBe(0); // 0% точности
        });

        it("должен обработать ответы больше правильного", () => {
            const accuracy = winnerDeterminator.calculateAccuracy(100, 120);
            expect(accuracy).toBe(80); // 80% точности (отклонение 20)
        });

        it("должен обработать отрицательные значения", () => {
            const accuracy = winnerDeterminator.calculateAccuracy(50, -10);
            expect(accuracy).toBe(0); // Минимум 0%
        });
    });

    describe("handleSidePots", () => {
        it("должен обработать боковые банки для all-in игроков", () => {
            const mainWinners = [
                { playerId: "player1", deviation: 5, accuracy: 95 },
            ];

            const sidePots = [
                {
                    amount: 100,
                    eligiblePlayers: ["player1", "player2"],
                    createdBy: "player2",
                },
            ];

            const result = winnerDeterminator.handleSidePots(
                mainWinners,
                sidePots
            );

            expect(result).toHaveLength(1);
            expect(result[0].winAmount).toBe(100);
            expect(result[0].potType).toBe("side");
        });

        it("должен разделить боковой банк между несколькими претендентами", () => {
            const mainWinners = [
                { playerId: "player1", deviation: 5, accuracy: 95 },
                { playerId: "player2", deviation: 5, accuracy: 95 },
            ];

            const sidePots = [
                {
                    amount: 200,
                    eligiblePlayers: ["player1", "player2"],
                    createdBy: "player3",
                },
            ];

            const result = winnerDeterminator.handleSidePots(
                mainWinners,
                sidePots
            );

            expect(result).toHaveLength(2);
            expect(result[0].winAmount).toBe(100);
            expect(result[1].winAmount).toBe(100);
        });

        it("должен пропустить боковые банки где нет подходящих игроков", () => {
            const mainWinners = [
                { playerId: "player1", deviation: 5, accuracy: 95 },
            ];

            const sidePots = [
                {
                    amount: 100,
                    eligiblePlayers: ["player2", "player3"], // player1 не подходит
                    createdBy: "player2",
                },
            ];

            const result = winnerDeterminator.handleSidePots(
                mainWinners,
                sidePots
            );

            expect(result).toEqual([]);
        });
    });

    describe("validateWinners", () => {
        it("должен валидировать корректных победителей", () => {
            const winners = [
                {
                    playerId: "player1",
                    winAmount: 100,
                    potType: "main" as const,
                    accuracy: 95,
                    deviation: 5,
                },
            ];

            const isValid = winnerDeterminator.validateWinners(winners);
            expect(isValid).toBe(true);
        });

        it("должен отклонить победителей с отрицательными выигрышами", () => {
            const winners = [
                {
                    playerId: "player1",
                    winAmount: -10,
                    potType: "main" as const,
                    accuracy: 95,
                    deviation: 5,
                },
            ];

            const isValid = winnerDeterminator.validateWinners(winners);
            expect(isValid).toBe(false);
        });

        it("должен отклонить победителей с некорректной точностью", () => {
            const winners = [
                {
                    playerId: "player1",
                    winAmount: 100,
                    potType: "main" as const,
                    accuracy: 150, // Больше 100%
                    deviation: 5,
                },
            ];

            const isValid = winnerDeterminator.validateWinners(winners);
            expect(isValid).toBe(false);
        });
    });

    describe("События", () => {
        it("должен быть экземпляром EventEmitter", () => {
            const eventSpy = vi.fn();
            winnerDeterminator.on("test_event", eventSpy);
            winnerDeterminator.emit("test_event", { data: "test" });

            expect(eventSpy).toHaveBeenCalledWith({ data: "test" });
        });

        it("должен эмитить pot_distributed при распределении банка", () => {
            const winners = [
                { playerId: "player1", deviation: 5, accuracy: 95 },
            ];

            const eventSpy = vi.fn();
            winnerDeterminator.on("pot_distributed", eventSpy);

            winnerDeterminator.distributePot(winners, 100);

            expect(eventSpy).toHaveBeenCalled();
        });
    });
});
