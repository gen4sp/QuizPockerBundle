/**
 * Тесты для PlayerManager
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { PlayerManager } from "./PlayerManager";
import { PlayerStatus } from "../types/player";
import { createGameConfig, createUser, createPlayer } from "../test-utils";

describe("PlayerManager", () => {
    let playerManager: PlayerManager;
    let gameConfig: any;

    beforeEach(() => {
        gameConfig = createGameConfig();
        playerManager = new PlayerManager(gameConfig);
    });

    describe("Конструктор", () => {
        it("должен создать экземпляр PlayerManager", () => {
            expect(playerManager).toBeInstanceOf(PlayerManager);
        });

        it("должен сохранить конфигурацию игры", () => {
            expect(playerManager["config"]).toEqual(gameConfig);
        });
    });

    describe("addPlayer", () => {
        it("должен добавить игрока в игру", () => {
            const user = createUser();
            const player = playerManager.addPlayer(user);

            expect(player).toBeDefined();
            expect(player.user).toBe(user);
            expect(player.name).toBe(user.name);
            expect(player.stack).toBe(gameConfig.initialStack);
            expect(player.position).toBe(0);
            expect(player.status).toBe(PlayerStatus.WAITING);
            expect(player.isDealer).toBe(true); // Первый игрок становится дилером
        });

        it("должен эмитить событие player_added", () => {
            const user = createUser();
            const eventSpy = vi.fn();
            playerManager.on("player_added", eventSpy);

            const player = playerManager.addPlayer(user);

            expect(eventSpy).toHaveBeenCalledWith({
                player,
                totalPlayers: 1,
            });
        });

        it("должен установить правильные позиции для игроков", () => {
            const user1 = createUser({ id: "1" });
            const user2 = createUser({ id: "2" });

            const player1 = playerManager.addPlayer(user1);
            const player2 = playerManager.addPlayer(user2);

            expect(player1.position).toBe(0);
            expect(player1.isDealer).toBe(true);
            expect(player2.position).toBe(1);
            expect(player2.isDealer).toBe(false);
        });

        it("должен выбросить ошибку при превышении максимального количества игроков", () => {
            for (let i = 0; i < gameConfig.maxPlayers; i++) {
                playerManager.addPlayer(createUser({ id: `user-${i}` }));
            }

            expect(() => {
                playerManager.addPlayer(createUser({ id: "overflow" }));
            }).toThrow("Достигнуто максимальное количество игроков");
        });

        it("должен выбросить ошибку при попытке добавить уже существующего игрока", () => {
            const user = createUser();
            playerManager.addPlayer(user);

            expect(() => {
                playerManager.addPlayer(user);
            }).toThrow("Игрок уже в игре");
        });
    });

    describe("removePlayer", () => {
        it("должен удалить игрока по ID", () => {
            const user = createUser();
            const player = playerManager.addPlayer(user);

            const result = playerManager.removePlayer(player.id);

            expect(result).toBe(true);
            expect(playerManager.getPlayer(player.id)).toBeNull();
        });

        it("должен эмитить событие player_removed", () => {
            const user = createUser();
            const player = playerManager.addPlayer(user);

            const eventSpy = vi.fn();
            playerManager.on("player_removed", eventSpy);

            playerManager.removePlayer(player.id);

            expect(eventSpy).toHaveBeenCalledWith({
                playerId: player.id,
                player,
            });
        });

        it("должен вернуть false для несуществующего игрока", () => {
            const result = playerManager.removePlayer("nonexistent");
            expect(result).toBe(false);
        });

        it("должен обновить позиции дилера при удалении дилера", () => {
            const user1 = createUser({ id: "1" });
            const user2 = createUser({ id: "2" });

            const player1 = playerManager.addPlayer(user1);
            const player2 = playerManager.addPlayer(user2);

            expect(player1.isDealer).toBe(true);
            expect(player2.isDealer).toBe(false);

            playerManager.removePlayer(player1.id);

            expect(player2.isDealer).toBe(true);
        });
    });

    describe("getPlayer", () => {
        it("должен вернуть игрока по ID", () => {
            const user = createUser();
            const player = playerManager.addPlayer(user);

            const found = playerManager.getPlayer(player.id);
            expect(found).toBe(player);
        });

        it("должен вернуть null для несуществующего игрока", () => {
            const found = playerManager.getPlayer("nonexistent");
            expect(found).toBeNull();
        });
    });

    describe("getAllPlayers", () => {
        it("должен вернуть всех игроков", () => {
            const user1 = createUser({ id: "1" });
            const user2 = createUser({ id: "2" });

            const player1 = playerManager.addPlayer(user1);
            const player2 = playerManager.addPlayer(user2);

            const players = playerManager.getAllPlayers();
            expect(players).toHaveLength(2);
            expect(players).toContain(player1);
            expect(players).toContain(player2);
        });

        it("должен вернуть пустой массив если нет игроков", () => {
            const players = playerManager.getAllPlayers();
            expect(players).toEqual([]);
        });
    });

    describe("getActivePlayers", () => {
        it("должен вернуть только активных игроков", () => {
            const user1 = createUser({ id: "1" });
            const user2 = createUser({ id: "2" });
            const user3 = createUser({ id: "3" });

            const player1 = playerManager.addPlayer(user1);
            const player2 = playerManager.addPlayer(user2);
            const player3 = playerManager.addPlayer(user3);

            player1.status = PlayerStatus.ACTIVE;
            player2.status = PlayerStatus.FOLDED;
            player3.status = PlayerStatus.ACTIVE;

            const activePlayers = playerManager.getActivePlayers();
            expect(activePlayers).toHaveLength(2);
            expect(activePlayers).toContain(player1);
            expect(activePlayers).toContain(player3);
        });
    });

    describe("updatePlayerStatus", () => {
        it("должен обновить статус игрока", () => {
            const user = createUser();
            const player = playerManager.addPlayer(user);

            playerManager.updatePlayerStatus(player.id, PlayerStatus.ACTIVE);

            expect(player.status).toBe(PlayerStatus.ACTIVE);
        });

        it("должен эмитить событие player_status_changed", () => {
            const user = createUser();
            const player = playerManager.addPlayer(user);

            const eventSpy = vi.fn();
            playerManager.on("player_status_changed", eventSpy);

            playerManager.updatePlayerStatus(player.id, PlayerStatus.ACTIVE);

            expect(eventSpy).toHaveBeenCalledWith({
                playerId: player.id,
                previousStatus: PlayerStatus.WAITING,
                newStatus: PlayerStatus.ACTIVE,
            });
        });

        it("должен игнорировать обновление для несуществующего игрока", () => {
            expect(() => {
                playerManager.updatePlayerStatus(
                    "nonexistent",
                    PlayerStatus.ACTIVE
                );
            }).not.toThrow();
        });
    });

    describe("setPlayerAnswer", () => {
        it("должен установить ответ игрока", () => {
            const user = createUser();
            const player = playerManager.addPlayer(user);

            playerManager.setPlayerAnswer(player.id, 100);

            expect(player.answer).toBe(100);
            expect(player.lastActionTime).toBeInstanceOf(Date);
        });

        it("должен эмитить событие player_answered", () => {
            const user = createUser();
            const player = playerManager.addPlayer(user);

            const eventSpy = vi.fn();
            playerManager.on("player_answered", eventSpy);

            playerManager.setPlayerAnswer(player.id, 100);

            expect(eventSpy).toHaveBeenCalledWith({
                playerId: player.id,
                answer: 100,
            });
        });
    });

    describe("resetPlayersForNewRound", () => {
        it("должен сбросить состояние игроков для нового раунда", () => {
            const user1 = createUser({ id: "1" });
            const user2 = createUser({ id: "2" });

            const player1 = playerManager.addPlayer(user1);
            const player2 = playerManager.addPlayer(user2);

            // Установим некоторые значения
            player1.currentBet = 100;
            player1.totalBetInRound = 100;
            player1.answer = 50;
            player1.status = PlayerStatus.ACTIVE;

            player2.currentBet = 200;
            player2.totalBetInRound = 200;
            player2.answer = 75;
            player2.status = PlayerStatus.FOLDED;

            playerManager.resetPlayersForNewRound();

            // Проверим сброс
            expect(player1.currentBet).toBe(0);
            expect(player1.totalBetInRound).toBe(0);
            expect(player1.answer).toBeUndefined();
            expect(player1.status).toBe(PlayerStatus.WAITING);

            expect(player2.currentBet).toBe(0);
            expect(player2.totalBetInRound).toBe(0);
            expect(player2.answer).toBeUndefined();
            expect(player2.status).toBe(PlayerStatus.WAITING);
        });
    });

    describe("moveDealer", () => {
        it("должен переместить позицию дилера к следующему игроку", () => {
            const user1 = createUser({ id: "1" });
            const user2 = createUser({ id: "2" });
            const user3 = createUser({ id: "3" });

            const player1 = playerManager.addPlayer(user1);
            const player2 = playerManager.addPlayer(user2);
            const player3 = playerManager.addPlayer(user3);

            expect(player1.isDealer).toBe(true);

            const newDealer = playerManager.moveDealer();

            expect(player1.isDealer).toBe(false);
            expect(player2.isDealer).toBe(true);
            expect(newDealer).toBe(player2);
        });

        it("должен циклически переместить дилера обратно к первому игроку", () => {
            const user1 = createUser({ id: "1" });
            const user2 = createUser({ id: "2" });

            const player1 = playerManager.addPlayer(user1);
            const player2 = playerManager.addPlayer(user2);

            playerManager.moveDealer(); // Дилер -> player2
            playerManager.moveDealer(); // Дилер -> player1

            expect(player1.isDealer).toBe(true);
            expect(player2.isDealer).toBe(false);
        });

        it("должен эмитить событие dealer_moved", () => {
            const user1 = createUser({ id: "1" });
            const user2 = createUser({ id: "2" });

            const player1 = playerManager.addPlayer(user1);
            const player2 = playerManager.addPlayer(user2);

            const eventSpy = vi.fn();
            playerManager.on("dealer_moved", eventSpy);

            playerManager.moveDealer();

            expect(eventSpy).toHaveBeenCalledWith({
                previousDealer: player1.id,
                newDealer: player2.id,
            });
        });

        it("должен назначить первого игрока дилером если нет текущего дилера", () => {
            const user = createUser();
            const player = playerManager.addPlayer(user);
            player.isDealer = false; // Убираем дилера

            const newDealer = playerManager.moveDealer();

            expect(player.isDealer).toBe(true);
            expect(newDealer).toBe(player);
        });
    });

    describe("hasEnoughPlayersToStart", () => {
        it("должен вернуть true если достаточно игроков для начала", () => {
            playerManager.addPlayer(createUser({ id: "1" }));
            playerManager.addPlayer(createUser({ id: "2" }));

            expect(playerManager.hasEnoughPlayersToStart()).toBe(true);
        });

        it("должен вернуть false если недостаточно игроков", () => {
            playerManager.addPlayer(createUser({ id: "1" }));

            expect(playerManager.hasEnoughPlayersToStart()).toBe(false);
        });
    });

    describe("eliminatePlayersWithZeroStack", () => {
        it("должен исключить игроков с нулевым стеком", () => {
            const user1 = createUser({ id: "1" });
            const user2 = createUser({ id: "2" });

            const player1 = playerManager.addPlayer(user1);
            const player2 = playerManager.addPlayer(user2);

            player1.stack = 0;
            player2.stack = 100;

            const eliminated = playerManager.eliminatePlayersWithZeroStack();

            expect(eliminated).toHaveLength(1);
            expect(eliminated[0]).toBe(player1);
            expect(player1.status).toBe(PlayerStatus.ELIMINATED);
            expect(player2.status).toBe(PlayerStatus.WAITING);
        });

        it("должен эмитить событие players_eliminated", () => {
            const user = createUser();
            const player = playerManager.addPlayer(user);
            player.stack = 0;

            const eventSpy = vi.fn();
            playerManager.on("players_eliminated", eventSpy);

            playerManager.eliminatePlayersWithZeroStack();

            expect(eventSpy).toHaveBeenCalledWith({
                eliminatedPlayers: [player.id],
                remainingPlayers: 0,
            });
        });
    });

    describe("События", () => {
        it("должен быть экземпляром EventEmitter", () => {
            const eventSpy = vi.fn();
            playerManager.on("test_event", eventSpy);
            playerManager.emit("test_event", { data: "test" });

            expect(eventSpy).toHaveBeenCalledWith({ data: "test" });
        });
    });
});
