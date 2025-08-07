/**
 * Тесты для BettingManager
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { BettingManager } from "../BettingManager";
import { PlayerStatus, BettingAction } from "../../types/player";
import { RoundPhase } from "../../types/round";
import {
    createRound,
    createPlayer,
    createRoundPot,
    createRoundSettings,
} from "../../test-utils";

describe("BettingManager", () => {
    let bettingManager: BettingManager;
    const anteSize = 50;

    beforeEach(() => {
        bettingManager = new BettingManager(anteSize);
    });

    describe("Конструктор", () => {
        it("должен создать экземпляр BettingManager", () => {
            expect(bettingManager).toBeInstanceOf(BettingManager);
        });
    });

    describe("setCurrentRound", () => {
        it("должен установить текущий раунд", () => {
            const round = createRound();
            bettingManager.setCurrentRound(round);
            expect(bettingManager["currentRound"]).toBe(round);
        });

        it("должен установить null как текущий раунд", () => {
            const round = createRound();
            bettingManager.setCurrentRound(round);
            bettingManager.setCurrentRound(null);
            expect(bettingManager["currentRound"]).toBeNull();
        });
    });

    describe("processAntePhase", () => {
        it("должен игнорировать вызов если нет текущего раунда", async () => {
            await expect(
                bettingManager.processAntePhase()
            ).resolves.toBeUndefined();
        });

        it("должен обработать фазу анте для всех игроков", async () => {
            const players = [
                createPlayer({ stack: 1000 }),
                createPlayer({ stack: 500 }),
                createPlayer({ stack: 25 }), // Меньше чем анте
            ];

            const round = createRound({
                activePlayers: players,
                settings: createRoundSettings({ anteSize }),
            });

            bettingManager.setCurrentRound(round);
            await bettingManager.processAntePhase();

            // Проверяем первого игрока (полное анте)
            expect(players[0].stack).toBe(950);
            expect(players[0].currentBet).toBe(50);
            expect(players[0].totalBetInRound).toBe(50);
            expect(players[0].status).toBe(PlayerStatus.ACTIVE);

            // Проверяем второго игрока (полное анте)
            expect(players[1].stack).toBe(450);
            expect(players[1].currentBet).toBe(50);
            expect(players[1].totalBetInRound).toBe(50);
            expect(players[1].status).toBe(PlayerStatus.ACTIVE);

            // Проверяем третьего игрока (частичное анте, all-in)
            expect(players[2].stack).toBe(0);
            expect(players[2].currentBet).toBe(25);
            expect(players[2].totalBetInRound).toBe(25);
            expect(players[2].isAllIn).toBe(true);
            expect(players[2].status).toBe(PlayerStatus.ALL_IN);

            // Проверяем банк
            expect(round.pot.mainPot).toBe(125); // 50 + 50 + 25
            expect(round.pot.totalPot).toBe(125);
        });

        it("должен эмитить событие ante_collected", async () => {
            const players = [createPlayer({ stack: 1000 })];
            const round = createRound({
                activePlayers: players,
                settings: createRoundSettings({ anteSize }),
            });

            bettingManager.setCurrentRound(round);

            const eventSpy = vi.fn();
            bettingManager.on("ante_collected", eventSpy);

            await bettingManager.processAntePhase();

            expect(eventSpy).toHaveBeenCalledWith({
                round,
                totalAnte: 50,
                playersCount: 1,
            });
        });
    });

    describe("processAction", () => {
        let round: any;
        let player: any;

        beforeEach(() => {
            player = createPlayer({
                stack: 1000,
                currentBet: 0,
                status: PlayerStatus.ACTIVE,
            });
            round = createRound({
                activePlayers: [player],
                currentPhase: RoundPhase.BETTING1,
            });
            bettingManager.setCurrentRound(round);
        });

        it("должен обработать действие CHECK", async () => {
            const action = {
                playerId: player.id,
                type: BettingAction.CHECK,
                timestamp: new Date(),
            };

            const result = await bettingManager.processAction(player, action);

            expect(result).toBe(true);
            expect(player.currentBet).toBe(0);
        });

        it("должен обработать действие CALL", async () => {
            // Создаем ситуацию где есть ставка для уравнивания
            const otherPlayer = createPlayer({
                stack: 800,
                currentBet: 100,
                status: PlayerStatus.ACTIVE,
            });
            round.activePlayers.push(otherPlayer);

            const action = {
                playerId: player.id,
                type: BettingAction.CALL,
                timestamp: new Date(),
            };

            const result = await bettingManager.processAction(player, action);

            expect(result).toBe(true);
            expect(player.currentBet).toBe(100);
            expect(player.stack).toBe(900);
            expect(player.totalBetInRound).toBe(100);
        });

        it("должен обработать действие RAISE", async () => {
            const action = {
                playerId: player.id,
                type: BettingAction.RAISE,
                amount: 200,
                timestamp: new Date(),
            };

            const result = await bettingManager.processAction(player, action);

            expect(result).toBe(true);
            expect(player.currentBet).toBe(200);
            expect(player.stack).toBe(800);
            expect(player.totalBetInRound).toBe(200);
            expect(round.pot.mainPot).toBe(200);
        });

        it("должен обработать действие FOLD", async () => {
            const action = {
                playerId: player.id,
                type: BettingAction.FOLD,
                timestamp: new Date(),
            };

            const result = await bettingManager.processAction(player, action);

            expect(result).toBe(true);
            expect(player.status).toBe(PlayerStatus.FOLDED);
        });

        it("должен обработать действие ALL_IN", async () => {
            const action = {
                playerId: player.id,
                type: BettingAction.ALL_IN,
                timestamp: new Date(),
            };

            const result = await bettingManager.processAction(player, action);

            expect(result).toBe(true);
            expect(player.stack).toBe(0);
            expect(player.currentBet).toBe(1000);
            expect(player.isAllIn).toBe(true);
            expect(player.status).toBe(PlayerStatus.ALL_IN);
            expect(round.pot.mainPot).toBe(1000);
        });

        it("должен вернуть false для недостаточного стека при RAISE", async () => {
            const action = {
                playerId: player.id,
                type: BettingAction.RAISE,
                amount: 2000, // Больше чем стек
                timestamp: new Date(),
            };

            const result = await bettingManager.processAction(player, action);

            expect(result).toBe(false);
        });

        it("должен эмитить событие player_action_processed", async () => {
            const action = {
                playerId: player.id,
                type: BettingAction.CHECK,
                timestamp: new Date(),
            };

            const eventSpy = vi.fn();
            bettingManager.on("player_action_processed", eventSpy);

            await bettingManager.processAction(player, action);

            expect(eventSpy).toHaveBeenCalledWith({
                player,
                action,
                potBefore: 0,
                potAfter: 0,
                isValid: true,
            });
        });
    });

    describe("getCurrentBet", () => {
        it("должен вернуть 0 если нет текущего раунда", () => {
            const currentBet = bettingManager.getCurrentBet();
            expect(currentBet).toBe(0);
        });

        it("должен вычислить текущую ставку на основе максимальной ставки", () => {
            const players = [
                createPlayer({ currentBet: 100 }),
                createPlayer({ currentBet: 200 }),
                createPlayer({ currentBet: 150 }),
            ];

            const round = createRound({ activePlayers: players });
            bettingManager.setCurrentRound(round);

            const currentBet = bettingManager.getCurrentBet();
            expect(currentBet).toBe(200); // Максимальная текущая ставка
        });
    });

    describe("createSidePot", () => {
        it("должен создать боковой банк для all-in ситуации", () => {
            const players = [
                createPlayer({
                    id: "1",
                    currentBet: 100,
                    isAllIn: true,
                    stack: 0,
                }),
                createPlayer({
                    id: "2",
                    currentBet: 200,
                    stack: 300,
                }),
                createPlayer({
                    id: "3",
                    currentBet: 200,
                    stack: 400,
                }),
            ];

            const round = createRound({ activePlayers: players });
            bettingManager.setCurrentRound(round);

            bettingManager.createSidePot(players[0]);

            expect(round.pot.sidePots).toHaveLength(1);
            expect(round.pot.sidePots[0].amount).toBe(300); // 100 * 3 игрока
            expect(round.pot.sidePots[0].eligiblePlayers).toEqual([
                "1",
                "2",
                "3",
            ]);
            expect(round.pot.sidePots[0].createdBy).toBe("1");
        });
    });

    describe("isBettingComplete", () => {
        it("должен вернуть true если все игроки уравняли ставки", () => {
            const players = [
                createPlayer({ currentBet: 100, status: PlayerStatus.ACTIVE }),
                createPlayer({ currentBet: 100, status: PlayerStatus.ACTIVE }),
            ];

            const round = createRound({ activePlayers: players });
            bettingManager.setCurrentRound(round);

            const result = bettingManager.isBettingComplete();
            expect(result).toBe(true);
        });

        it("должен вернуть false если есть игроки которые могут действовать", () => {
            const players = [
                createPlayer({ currentBet: 100, status: PlayerStatus.ACTIVE }),
                createPlayer({ currentBet: 50, status: PlayerStatus.ACTIVE }),
            ];

            const round = createRound({ activePlayers: players });
            bettingManager.setCurrentRound(round);

            const result = bettingManager.isBettingComplete();
            expect(result).toBe(false);
        });
    });

    describe("События", () => {
        it("должен быть экземпляром EventEmitter", () => {
            const eventSpy = vi.fn();
            bettingManager.on("test_event", eventSpy);
            bettingManager.emit("test_event", { data: "test" });

            expect(eventSpy).toHaveBeenCalledWith({ data: "test" });
        });
    });
});
