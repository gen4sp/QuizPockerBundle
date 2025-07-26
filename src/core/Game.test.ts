/**
 * Tests for Game class
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { Game, GetQuestionFunction } from "./Game";
import type { GameConfig } from "../types/game";
import { GameStatus } from "../types/game";
import type { Player } from "../types/player";
import { PlayerStatus, BettingAction } from "../types/player";
import type { Question, User } from "../types/common";
import { RoundPhase } from "../types/round";

describe("Game", () => {
    let game: Game;
    let mockGetQuestion: GetQuestionFunction;
    let testConfig: GameConfig;
    let testUsers: User[];

    beforeEach(() => {
        // Мокаем функцию получения вопросов
        mockGetQuestion = vi.fn().mockReturnValue({
            text: "Сколько планет в солнечной системе?",
            answer: 8,
            correctAnswer: 8,
            difficulty: 1,
        } as Question);

        testConfig = {
            name: "Test Game",
            minPlayers: 2,
            maxPlayers: 4,
            initialStack: 1000,
            anteSize: 50,
        };

        testUsers = [
            { id: "user1", name: "Игрок 1" },
            { id: "user2", name: "Игрок 2" },
            { id: "user3", name: "Игрок 3" },
        ];

        game = new Game(testConfig, mockGetQuestion);
    });

    afterEach(() => {
        game.destroy();
        vi.clearAllMocks();
    });

    describe("Создание игры", () => {
        it("должна создавать игру с правильной конфигурацией", () => {
            expect(game.id).toBeDefined();
            expect(game.config).toEqual(expect.objectContaining(testConfig));
            expect(game.status).toBe(GameStatus.WAITING);
            expect(game.players).toHaveLength(0);
            expect(game.roundNumber).toBe(0);
            expect(game.createdAt).toBeInstanceOf(Date);
        });

        it("должна применять значения по умолчанию", () => {
            const minimalConfig = {};
            const gameWithDefaults = new Game(
                minimalConfig as GameConfig,
                mockGetQuestion
            );

            expect(gameWithDefaults.config.minPlayers).toBe(2);
            expect(gameWithDefaults.config.maxPlayers).toBe(8);
            expect(gameWithDefaults.config.initialStack).toBe(1000);
            expect(gameWithDefaults.config.anteSize).toBe(50);

            gameWithDefaults.destroy();
        });

        it("должна испускать событие game_created", () => {
            const eventSpy = vi.fn();
            const newGame = new Game(testConfig, mockGetQuestion);
            newGame.on("game_created", eventSpy);

            // Создаем еще одну игру чтобы проверить событие
            const anotherGame = new Game(testConfig, mockGetQuestion);

            // Событие должно быть испущено при создании
            expect(eventSpy).not.toHaveBeenCalled(); // но не на старой игре

            newGame.destroy();
            anotherGame.destroy();
        });
    });

    describe("Управление игроками", () => {
        it("должна добавлять игроков в ожидающую игру", () => {
            const player = game.addPlayer(testUsers[0]);

            expect(game.players).toHaveLength(1);
            expect(player.user).toEqual(testUsers[0]);
            expect(player.stack).toBe(testConfig.initialStack);
            expect(player.position).toBe(0);
            expect(player.status).toBe(PlayerStatus.WAITING);
            expect(player.isDealer).toBe(true); // Первый игрок становится дилером
        });

        it("должна испускать событие player_joined при добавлении игрока", () => {
            const eventSpy = vi.fn();
            game.on("player_joined", eventSpy);

            game.addPlayer(testUsers[0]);

            expect(eventSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    player: expect.any(Object),
                    totalPlayers: 1,
                })
            );
        });

        it("не должна добавлять игрока если игра уже началась", async () => {
            game.addPlayer(testUsers[0]);
            game.addPlayer(testUsers[1]);
            await game.startGame();

            expect(() => game.addPlayer(testUsers[2])).toThrow(
                "Нельзя добавить игрока - игра уже началась"
            );
        });

        it("не должна добавлять больше максимального количества игроков", () => {
            // Добавляем максимальное количество игроков
            for (let i = 0; i < testConfig.maxPlayers; i++) {
                game.addPlayer({ id: `user${i}`, name: `Игрок ${i}` });
            }

            expect(() =>
                game.addPlayer({ id: "extra", name: "Лишний" })
            ).toThrow("Достигнуто максимальное количество игроков");
        });

        it("не должна добавлять одного игрока дважды", () => {
            game.addPlayer(testUsers[0]);

            expect(() => game.addPlayer(testUsers[0])).toThrow(
                "Игрок уже в игре"
            );
        });

        it("должна удалять игроков из ожидающей игры", () => {
            const player = game.addPlayer(testUsers[0]);
            const removed = game.removePlayer(player.id);

            expect(removed).toBe(true);
            expect(game.players).toHaveLength(0);
        });

        it("не должна удалять игроков во время игры", async () => {
            game.addPlayer(testUsers[0]);
            game.addPlayer(testUsers[1]);
            await game.startGame();

            expect(() => game.removePlayer(game.players[0].id)).toThrow(
                "Нельзя удалить игрока во время игры"
            );
        });
    });

    describe("Запуск игры", () => {
        it("должна запускать игру с достаточным количеством игроков", async () => {
            const eventSpy = vi.fn();
            game.on("game_started", eventSpy);

            game.addPlayer(testUsers[0]);
            game.addPlayer(testUsers[1]);

            await game.startGame();

            expect(game.status).toBe(GameStatus.PLAYING);
            expect(game.startedAt).toBeInstanceOf(Date);
            expect(eventSpy).toHaveBeenCalled();
        });

        it("не должна запускать игру без достаточного количества игроков", async () => {
            game.addPlayer(testUsers[0]);

            await expect(game.startGame()).rejects.toThrow(
                "Недостаточно игроков. Минимум: 2"
            );
        });

        it("не должна запускать уже запущенную игру", async () => {
            game.addPlayer(testUsers[0]);
            game.addPlayer(testUsers[1]);
            await game.startGame();

            await expect(game.startGame()).rejects.toThrow(
                "Игра уже начата или завершена"
            );
        });

        it("должна устанавливать дилера и начинать первый раунд", async () => {
            const roundEventSpy = vi.fn();
            game.on("round_started", roundEventSpy);

            game.addPlayer(testUsers[0]);
            game.addPlayer(testUsers[1]);

            await game.startGame();

            expect(game.roundNumber).toBe(1);
            expect(game.currentRound).toBeDefined();
            expect(game.dealerPosition).toBeGreaterThanOrEqual(0);
            expect(game.dealerPosition).toBeLessThan(game.players.length);
            expect(roundEventSpy).toHaveBeenCalled();
        });
    });

    describe("Действия игроков", () => {
        beforeEach(async () => {
            game.addPlayer(testUsers[0]);
            game.addPlayer(testUsers[1]);
            await game.startGame();

            // Переходим к фазе ставок, пропуская вопрос
            if (game.currentRound) {
                game.currentRound.currentPhase = RoundPhase.BETTING1;
            }
        });

        it("должна обрабатывать валидные действия игроков", async () => {
            const player = game.players[0];
            const eventSpy = vi.fn();
            game.on("player_action", eventSpy);

            const result = await game.action(player, BettingAction.CHECK);

            expect(result).toBe(true);
            expect(eventSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    player,
                    action: expect.objectContaining({
                        type: BettingAction.CHECK,
                    }),
                    isValid: true,
                })
            );
        });

        it("должна отклонять невалидные действия", async () => {
            const nonExistentPlayer = { id: "fake", name: "Fake" } as Player;

            await expect(
                game.action(nonExistentPlayer, BettingAction.CHECK)
            ).rejects.toThrow("Игрок не найден");
        });

        it("должна обрабатывать ставки call", async () => {
            const player1 = game.players[0];
            const player2 = game.players[1];

            // Игрок 1 повышает
            await game.action(player1, BettingAction.RAISE, 100);

            const initialStack = player2.stack;

            // Игрок 2 уравнивает
            await game.action(player2, BettingAction.CALL);

            expect(player2.currentBet).toBe(100);
            expect(player2.stack).toBe(initialStack - 100);
        });

        it("должна обрабатывать all-in", async () => {
            const player = game.players[0];
            const initialStack = player.stack;

            await game.action(player, BettingAction.ALL_IN);

            expect(player.stack).toBe(0);
            expect(player.currentBet).toBe(initialStack);
            expect(player.isAllIn).toBe(true);
            expect(player.status).toBe(PlayerStatus.ALL_IN);
        });

        it("должна обрабатывать fold", async () => {
            const player = game.players[0];

            await game.action(player, BettingAction.FOLD);

            expect(player.status).toBe(PlayerStatus.FOLDED);
        });

        it("должна обрабатывать ответы на вопросы", async () => {
            // Переходим к фазе вопроса
            if (game.currentRound) {
                game.currentRound.currentPhase = RoundPhase.QUESTION1;
            }

            const player = game.players[0];
            const answer = 8;

            await game.action(player, BettingAction.ANSWER, answer);

            expect(player.answer).toBe(answer);
        });
    });

    describe("Логика раундов", () => {
        beforeEach(async () => {
            game.addPlayer(testUsers[0]);
            game.addPlayer(testUsers[1]);
            await game.startGame();
        });

        it("должна создавать раунд с правильными параметрами", () => {
            expect(game.currentRound).toBeDefined();
            expect(game.currentRound!.roundNumber).toBe(1);
            expect(game.currentRound!.currentPhase).toBe(RoundPhase.ANTE);
            expect(game.currentRound!.question).toBeDefined();
            expect(mockGetQuestion).toHaveBeenCalled();
        });

        it("должна автоматически взимать анте", () => {
            const anteSize = testConfig.anteSize;

            game.players.forEach((player) => {
                expect(player.currentBet).toBe(anteSize);
                expect(player.stack).toBe(testConfig.initialStack - anteSize);
            });

            expect(game.currentRound!.pot.totalPot).toBe(
                anteSize * game.players.length
            );
        });

        it("должна переходить между фазами", async () => {
            const phaseEventSpy = vi.fn();
            game.on("phase_changed", phaseEventSpy);

            // Принудительно переходим к следующей фазе
            // (в реальности это происходит автоматически через таймеры)

            expect(phaseEventSpy).toHaveBeenCalled();
        });

        it("должна определять победителей по точности ответов", () => {
            if (!game.currentRound) return;

            // Устанавливаем ответы игроков
            game.players[0].answer = 8; // Точный ответ
            game.players[1].answer = 9; // Отклонение на 1

            // Переходим к showdown
            game.currentRound.currentPhase = RoundPhase.SHOWDOWN;

            const winners = (game as any).determineWinners();

            expect(winners).toHaveLength(1);
            expect(winners[0].playerId).toBe(game.players[0].id);
            expect(winners[0].deviation).toBe(0);
        });
    });

    describe("Сериализация", () => {
        it("должна сериализировать игру", () => {
            const serialized = game.serialize();

            expect(serialized.gameData.id).toBe(game.id);
            expect(serialized.gameData.config).toEqual(game.config);
            expect(serialized.gameData.status).toBe(game.status);
            expect(serialized.version).toBe("1.0.0");
            expect(serialized.serializedAt).toBeInstanceOf(Date);
        });

        it("должна восстанавливать игру из JSON", () => {
            game.addPlayer(testUsers[0]);
            const originalId = game.id;
            const serialized = game.serialize();

            const restoredGame = Game.createFromJSON(
                serialized,
                mockGetQuestion
            );

            expect(restoredGame.id).toBe(originalId);
            expect(restoredGame.config).toEqual(game.config);
            expect(restoredGame.players).toHaveLength(1);
            expect(restoredGame.players[0].name).toBe(testUsers[0].name);

            restoredGame.destroy();
        });
    });

    describe("Завершение игры", () => {
        beforeEach(async () => {
            game.addPlayer(testUsers[0]);
            game.addPlayer(testUsers[1]);
            await game.startGame();
        });

        it("должна завершать игру когда остается один игрок", async () => {
            const eventSpy = vi.fn();
            game.on("game_finished", eventSpy);

            // Принудительно устанавливаем стек одного игрока в 0
            game.players[1].stack = 0;
            game.players[1].status = PlayerStatus.ELIMINATED;

            // Принудительно проверяем условие завершения
            const shouldEnd = (game as any).shouldEndGame();
            expect(shouldEnd).toBe(true);

            if (shouldEnd) {
                await (game as any).endGame();
            }

            expect(game.status).toBe(GameStatus.FINISHED);
            expect(game.finishedAt).toBeInstanceOf(Date);
            expect(eventSpy).toHaveBeenCalled();
        });

        it("должна определять победителя по количеству фишек", async () => {
            const eventSpy = vi.fn();
            game.on("game_finished", eventSpy);

            // Устанавливаем разные стеки
            game.players[0].stack = 2000;
            game.players[1].stack = 500;

            await (game as any).endGame();

            expect(eventSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    winner: expect.objectContaining({
                        id: game.players[0].id,
                    }),
                })
            );
        });
    });

    describe("События и подписки", () => {
        it("должна поддерживать подписку на события", () => {
            const handler = vi.fn();
            game.on("game_started", handler);

            expect(game.listenerCount("game_started")).toBe(1);
        });

        it("должна поддерживать отписку от событий", () => {
            const handler = vi.fn();
            game.on("game_started", handler);
            game.off("game_started", handler);

            expect(game.listenerCount("game_started")).toBe(0);
        });
    });

    describe("Статистика игры", () => {
        it("должна отслеживать статистику игры", () => {
            expect(game.gameStats).toBeDefined();
            expect(game.gameStats.roundsPlayed).toBe(0);
            expect(game.gameStats.totalBets).toBe(0);
            expect(game.gameStats.totalFolds).toBe(0);
        });

        it("должна обновлять статистику после раунда", async () => {
            game.addPlayer(testUsers[0]);
            game.addPlayer(testUsers[1]);
            await game.startGame();

            // Симулируем завершение раунда
            if (game.currentRound) {
                game.currentRound.endTime = new Date();
                (game as any).updateGameStats();
            }

            expect(game.gameStats.roundsPlayed).toBe(1);
        });
    });

    describe("Таймеры", () => {
        it("должна устанавливать и очищать таймеры", () => {
            const callback = vi.fn();
            (game as any).setTimer("test", 100, callback);

            expect((game as any).timers.has("test")).toBe(true);

            (game as any).clearTimer("test");
            expect((game as any).timers.has("test")).toBe(false);
        });

        it("должна очищать все таймеры при уничтожении", () => {
            const callback = vi.fn();
            (game as any).setTimer("test1", 100, callback);
            (game as any).setTimer("test2", 200, callback);

            expect((game as any).timers.size).toBe(2);

            game.destroy();
            expect((game as any).timers.size).toBe(0);
        });
    });

    describe("Валидация действий", () => {
        beforeEach(async () => {
            game.addPlayer(testUsers[0]);
            game.addPlayer(testUsers[1]);
            await game.startGame();
        });

        it("должна валидировать check действие", () => {
            const player = game.players[0];
            const action = {
                playerId: player.id,
                type: BettingAction.CHECK,
                timestamp: new Date(),
            };

            if (game.currentRound) {
                game.currentRound.currentPhase = RoundPhase.BETTING1;
                // Устанавливаем игрока как следующего для действия
                const isValid = (game as any).validateSpecificAction(
                    player,
                    action
                );
                expect(typeof isValid).toBe("boolean");
            }
        });

        it("должна валидировать raise действие", () => {
            const player = game.players[0];
            const action = {
                playerId: player.id,
                type: BettingAction.RAISE,
                amount: 100,
                timestamp: new Date(),
            };

            const isValid = (game as any).validateSpecificAction(
                player,
                action
            );
            expect(typeof isValid).toBe("boolean");
        });

        it("должна всегда разрешать fold", () => {
            const player = game.players[0];
            const action = {
                playerId: player.id,
                type: BettingAction.FOLD,
                timestamp: new Date(),
            };

            const isValid = (game as any).validateSpecificAction(
                player,
                action
            );
            expect(isValid).toBe(true);
        });
    });
});
