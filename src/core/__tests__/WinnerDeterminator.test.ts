/**
 * Тесты для WinnerDeterminator
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
    WinnerDeterminator,
    type WinnerDistribution,
} from "../WinnerDeterminator";
import { PlayerStatus } from "../../types/player";
import {
    createRound,
    createPlayer,
    createQuestion,
    createRoundPot,
} from "../../test-utils";

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
            expect(winners[0].accuracy).toBe(95); // 100 - (5/100)*100 = 95
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
                    answer: 40, // Отклонение 10
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
            // Точность рассчитывается как: 100 - (deviation / maxDeviation) * 100
            // maxDeviation = Math.max(correctAnswer, 100) = Math.max(50, 100) = 100
            // accuracy = 100 - (10 / 100) * 100 = 90
            expect(winners[0].accuracy).toBe(90);
            expect(winners[0].deviation).toBe(10);
        });
    });

    describe("determineWinnersWithSidePots", () => {
        it("должен обработать основной банк и боковые банки", () => {
            const question = createQuestion({ correctAnswer: 100 });
            const players = [
                createPlayer({
                    id: "player1",
                    answer: 95,
                    status: PlayerStatus.ACTIVE,
                }),
                createPlayer({
                    id: "player2",
                    answer: 105,
                    status: PlayerStatus.ACTIVE,
                }),
            ];

            const pot = createRoundPot({
                totalPot: 300,
                sidePots: [
                    {
                        amount: 100,
                        eligiblePlayers: ["player1", "player2"],
                        createdBy: "player1",
                    },
                ],
            });

            const round = createRound({
                question,
                activePlayers: players,
                pot,
            });

            const distribution =
                winnerDeterminator.determineWinnersWithSidePots(round);

            expect(distribution.winners.length).toBeGreaterThan(0);
            expect(distribution.totalDistributed).toBeGreaterThan(0);
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
            // deviation = |50 - (-10)| = 60
            // maxDeviation = Math.max(50, 100) = 100
            // accuracy = Math.max(0, 100 - (60/100)*100) = Math.max(0, 40) = 40
            expect(accuracy).toBe(40); // 40% точности
        });
    });

    describe("distributeWinnings", () => {
        it("должен распределить выигрыш игрокам", () => {
            const players = [
                createPlayer({ id: "player1", stack: 1000 }),
                createPlayer({ id: "player2", stack: 1000 }),
            ];

            const winners = [
                {
                    playerId: "player1",
                    winAmount: 100,
                    potType: "main" as const,
                    accuracy: 95,
                    deviation: 5,
                },
                {
                    playerId: "player2",
                    winAmount: 50,
                    potType: "main" as const,
                    accuracy: 90,
                    deviation: 10,
                },
            ];

            const eventSpy = vi.fn();
            winnerDeterminator.on("winnings_distributed", eventSpy);

            winnerDeterminator.distributeWinnings(players, winners);

            expect(players[0].stack).toBe(1100);
            expect(players[1].stack).toBe(1050);
            expect(players[0].stats.totalWinnings).toBe(100);
            expect(players[1].stats.totalWinnings).toBe(50);
            expect(eventSpy).toHaveBeenCalledTimes(2);
        });
    });

    describe("createPlayerAnswers", () => {
        it("должен создать ответы игроков", () => {
            const question = createQuestion({ correctAnswer: 100 });
            const players = [
                createPlayer({
                    id: "player1",
                    answer: 95,
                    status: PlayerStatus.ACTIVE,
                }),
                createPlayer({
                    id: "player2",
                    answer: 105,
                    status: PlayerStatus.FOLDED,
                }),
            ];

            const round = createRound({
                question,
                activePlayers: players,
            });

            const answers = winnerDeterminator.createPlayerAnswers(round);

            expect(answers).toHaveLength(2);
            expect(answers[0].playerId).toBe("player1");
            expect(answers[0].answer).toBe(95);
            expect(answers[0].accuracy).toBe(95);
            expect(answers[0].inShowdown).toBe(true);
            expect(answers[1].inShowdown).toBe(false);
        });
    });

    describe("findBestAnswer", () => {
        it("должен найти игрока с лучшим ответом", () => {
            const players = [
                createPlayer({
                    id: "player1",
                    answer: 95,
                    status: PlayerStatus.ACTIVE,
                }),
                createPlayer({
                    id: "player2",
                    answer: 105,
                    status: PlayerStatus.ACTIVE,
                }),
                createPlayer({
                    id: "player3",
                    answer: 99,
                    status: PlayerStatus.ACTIVE,
                }),
            ];

            const bestPlayer = winnerDeterminator.findBestAnswer(players, 100);

            expect(bestPlayer?.id).toBe("player3"); // Ближайший к 100
        });

        it("должен вернуть null если нет игроков с ответами", () => {
            const players = [
                createPlayer({ answer: undefined }),
                createPlayer({ status: PlayerStatus.FOLDED }),
            ];

            const bestPlayer = winnerDeterminator.findBestAnswer(players, 100);

            expect(bestPlayer).toBeNull();
        });
    });

    describe("getAccuracyStats", () => {
        it("должен вернуть статистику точности", () => {
            const question = createQuestion({ correctAnswer: 100 });
            const players = [
                createPlayer({ answer: 95 }),
                createPlayer({ answer: 105 }),
                createPlayer({ answer: 90 }),
            ];

            const round = createRound({
                question,
                activePlayers: players,
            });

            const stats = winnerDeterminator.getAccuracyStats(round);

            expect(stats).toBeDefined();
            expect(stats.correctAnswer).toBe(100);
            expect(stats.totalAnswers).toBe(3);
            expect(stats.averageAccuracy).toBeGreaterThan(0);
            expect(stats.maxAccuracy).toBe(95);
            expect(stats.minAccuracy).toBe(90);
        });
    });

    describe("hasTie", () => {
        it("должен определить ничью", () => {
            const question = createQuestion({ correctAnswer: 100 });
            const players = [
                createPlayer({ answer: 95, status: PlayerStatus.ACTIVE }),
                createPlayer({ answer: 105, status: PlayerStatus.ACTIVE }),
            ];

            const round = createRound({
                question,
                activePlayers: players,
                pot: createRoundPot({ totalPot: 200 }),
            });

            const hasTie = winnerDeterminator.hasTie(round);

            expect(hasTie).toBe(true); // Оба игрока имеют отклонение 5
        });

        it("должен определить отсутствие ничьи", () => {
            const question = createQuestion({ correctAnswer: 100 });
            const players = [
                createPlayer({ answer: 95, status: PlayerStatus.ACTIVE }),
                createPlayer({ answer: 110, status: PlayerStatus.ACTIVE }),
            ];

            const round = createRound({
                question,
                activePlayers: players,
                pot: createRoundPot({ totalPot: 200 }),
            });

            const hasTie = winnerDeterminator.hasTie(round);

            expect(hasTie).toBe(false);
        });
    });

    describe("updatePlayerAccuracyStats", () => {
        it("должен обновить статистику точности игрока", () => {
            const player = createPlayer({
                stats: {
                    roundsPlayed: 2,
                    roundsWon: 1,
                    totalWinnings: 500,
                    foldCount: 0,
                    allInCount: 1,
                    averageAccuracy: 90,
                },
            });

            winnerDeterminator.updatePlayerAccuracyStats(player, 80);

            // Новая средняя: (90*2 + 80) / 3 = 260/3 ≈ 86.67
            expect(player.stats.averageAccuracy).toBeCloseTo(86.67, 2);
        });
    });

    describe("События", () => {
        it("должен быть экземпляром EventEmitter", () => {
            const eventSpy = vi.fn();
            winnerDeterminator.on("test_event", eventSpy);
            winnerDeterminator.emit("test_event", { data: "test" });

            expect(eventSpy).toHaveBeenCalledWith({ data: "test" });
        });
    });

    describe("destroy", () => {
        it("должен удалить все обработчики событий", () => {
            const eventSpy = vi.fn();
            winnerDeterminator.on("test_event", eventSpy);

            winnerDeterminator.destroy();
            winnerDeterminator.emit("test_event", { data: "test" });

            expect(eventSpy).not.toHaveBeenCalled();
        });
    });
});
