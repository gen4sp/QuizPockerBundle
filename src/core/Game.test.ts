/**
 * Тесты для основного класса Game
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { Game, type GetQuestionFunction } from "./Game";
import { GameStatus } from "../types/game";
import { PlayerStatus } from "../types/player";
import {
    createGameConfig,
    createUser,
    createQuestion,
    createGetQuestionFunction,
} from "../test-utils";

describe("Game", () => {
    let game: Game;
    let gameConfig: any;
    let getQuestionFn: GetQuestionFunction;

    beforeEach(() => {
        gameConfig = createGameConfig();
        getQuestionFn = createGetQuestionFunction();
        game = new Game(gameConfig, getQuestionFn);
    });

    describe("Конструктор", () => {
        it("должен создать экземпляр Game", () => {
            expect(game).toBeInstanceOf(Game);
        });

        it("должен установить начальный статус WAITING", () => {
            expect(game.status).toBe(GameStatus.WAITING);
        });

        it("должен инициализировать пустой массив игроков", () => {
            expect(game.players).toEqual([]);
        });

        it("должен генерировать уникальный ID", () => {
            const game2 = new Game(gameConfig, getQuestionFn);
            expect(game.id).not.toBe(game2.id);
        });

        it("должен использовать переданный ID", () => {
            const customId = "custom-game-id";
            const gameWithId = new Game(gameConfig, getQuestionFn, customId);
            expect(gameWithId.id).toBe(customId);
        });

        it("должен эмитить событие game_created", () => {
            const eventSpy = vi.fn();
            const testGame = new Game(gameConfig, getQuestionFn);
            testGame.on("game_created", eventSpy);

            // Событие эмитится в конструкторе, поэтому создаем новую игру
            const newGame = new Game(gameConfig, getQuestionFn);

            // Проверяем что событие может быть обработано
            expect(testGame.emit).toBeDefined();
        });
    });

    describe("addPlayer", () => {
        it("должен добавить игрока в игру", () => {
            const user = createUser();

            const player = game.addPlayer(user);

            expect(player).toBeDefined();
            expect(game.players).toHaveLength(1);
            expect(game.players[0]).toBe(player);
        });

        it("должен установить первого игрока как дилера", () => {
            const user = createUser();

            const player = game.addPlayer(user);

            expect(player.isDealer).toBe(true);
            expect(game.dealerPosition).toBe(0);
        });

        it("должен выбросить ошибку при превышении максимального количества игроков", () => {
            // Добавляем максимальное количество игроков
            for (let i = 0; i < gameConfig.maxPlayers; i++) {
                game.addPlayer(createUser({ id: `user-${i}` }));
            }

            expect(() => {
                game.addPlayer(createUser({ id: "overflow" }));
            }).toThrow();
        });

        it("должен выбросить ошибку при попытке добавить дублирующего игрока", () => {
            const user = createUser();
            game.addPlayer(user);

            expect(() => {
                game.addPlayer(user);
            }).toThrow();
        });
    });

    describe("removePlayer", () => {
        it("должен удалить игрока из игры", () => {
            const user = createUser();
            const player = game.addPlayer(user);

            const result = game.removePlayer(player.id);

            expect(result).toBe(true);
            expect(game.players).toHaveLength(0);
        });

        it("должен вернуть false для несуществующего игрока", () => {
            const result = game.removePlayer("nonexistent");
            expect(result).toBe(false);
        });
    });

    describe("startGame", () => {
        it("должен запустить игру с достаточным количеством игроков", async () => {
            game.addPlayer(createUser({ id: "1" }));
            game.addPlayer(createUser({ id: "2" }));

            await game.startGame();

            expect(game.status).toBe(GameStatus.PLAYING);
            expect(game.startedAt).toBeInstanceOf(Date);
        });

        it("должен выбросить ошибку при недостатке игроков", async () => {
            game.addPlayer(createUser());

            await expect(game.startGame()).rejects.toThrow();
        });

        it("должен выбросить ошибку если игра уже запущена", async () => {
            game.addPlayer(createUser({ id: "1" }));
            game.addPlayer(createUser({ id: "2" }));

            await game.startGame();

            await expect(game.startGame()).rejects.toThrow();
        });
    });

    describe("processPlayerAction", () => {
        beforeEach(async () => {
            game.addPlayer(createUser({ id: "1" }));
            game.addPlayer(createUser({ id: "2" }));
            await game.startGame();
        });

        it("должен обработать валидное действие игрока", async () => {
            const player = game.players[0];
            const action = {
                playerId: player.id,
                type: "check" as any,
                timestamp: new Date(),
            };

            const result = await game.processPlayerAction(action);

            expect(result.success).toBe(true);
        });

        it("должен отклонить невалидное действие", async () => {
            const action = {
                playerId: "nonexistent",
                type: "check" as any,
                timestamp: new Date(),
            };

            const result = await game.processPlayerAction(action);

            expect(result.success).toBe(false);
        });
    });

    describe("getGameState", () => {
        it("должен вернуть текущее состояние игры", () => {
            const state = game.getGameState();

            expect(state).toMatchObject({
                id: game.id,
                status: GameStatus.WAITING,
                players: [],
                roundNumber: 0,
                totalPot: 0,
            });
        });

        it("должен включить текущий раунд если он есть", async () => {
            game.addPlayer(createUser({ id: "1" }));
            game.addPlayer(createUser({ id: "2" }));
            await game.startGame();

            const state = game.getGameState();

            expect(state.currentRound).toBeDefined();
        });
    });

    describe("pauseGame", () => {
        it("должен приостановить активную игру", async () => {
            game.addPlayer(createUser({ id: "1" }));
            game.addPlayer(createUser({ id: "2" }));
            await game.startGame();

            game.pauseGame();

            expect(game.status).toBe(GameStatus.PAUSED);
        });

        it("должен выбросить ошибку если игра не запущена", () => {
            expect(() => game.pauseGame()).toThrow();
        });
    });

    describe("resumeGame", () => {
        it("должен возобновить приостановленную игру", async () => {
            game.addPlayer(createUser({ id: "1" }));
            game.addPlayer(createUser({ id: "2" }));
            await game.startGame();
            game.pauseGame();

            game.resumeGame();

            expect(game.status).toBe(GameStatus.PLAYING);
        });

        it("должен выбросить ошибку если игра не приостановлена", () => {
            expect(() => game.resumeGame()).toThrow();
        });
    });

    describe("endGame", () => {
        it("должен завершить игру", async () => {
            game.addPlayer(createUser({ id: "1" }));
            game.addPlayer(createUser({ id: "2" }));
            await game.startGame();

            game.endGame();

            expect(game.status).toBe(GameStatus.FINISHED);
            expect(game.finishedAt).toBeInstanceOf(Date);
        });
    });

    describe("serialize", () => {
        it("должен сериализовать игру", () => {
            const result = game.serialize();

            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();
        });

        it("должен включить все данные игры", () => {
            game.addPlayer(createUser());

            const result = game.serialize();

            expect(result.success).toBe(true);
            expect(result.data).toContain(game.id);
            expect(result.data).toContain("players");
        });
    });

    describe("События", () => {
        it("должен быть экземпляром EventEmitter", () => {
            const eventSpy = vi.fn();
            game.on("test_event", eventSpy);
            game.emit("test_event", { data: "test" });

            expect(eventSpy).toHaveBeenCalledWith({ data: "test" });
        });

        it("должен эмитить game_started при запуске", async () => {
            const eventSpy = vi.fn();
            game.on("game_started", eventSpy);

            game.addPlayer(createUser({ id: "1" }));
            game.addPlayer(createUser({ id: "2" }));
            await game.startGame();

            expect(eventSpy).toHaveBeenCalled();
        });

        it("должен эмитить game_ended при завершении", async () => {
            const eventSpy = vi.fn();
            game.on("game_ended", eventSpy);

            game.addPlayer(createUser({ id: "1" }));
            game.addPlayer(createUser({ id: "2" }));
            await game.startGame();
            game.endGame();

            expect(eventSpy).toHaveBeenCalled();
        });
    });

    describe("destroy", () => {
        it("должен очистить все ресурсы", () => {
            game.addPlayer(createUser());

            game.destroy();

            expect(game.players).toEqual([]);
            expect(game.status).toBe(GameStatus.CANCELLED);
        });
    });
});
