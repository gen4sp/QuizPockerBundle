/**
 * Тесты для GameValidator
 */

import { describe, it, expect, beforeEach } from "vitest";
import { GameValidator, type ValidationResult } from "./GameValidator";
import { PlayerStatus, BettingAction } from "../types/player";
import { GameStatus } from "../types/game";
import { RoundPhase } from "../types/round";
import { createGameConfig, createPlayer, createRound } from "../test-utils";

describe("GameValidator", () => {
    let validator: GameValidator;
    let gameConfig: any;

    beforeEach(() => {
        gameConfig = createGameConfig();
        validator = new GameValidator(gameConfig);
    });

    describe("Конструктор", () => {
        it("должен создать экземпляр GameValidator", () => {
            expect(validator).toBeInstanceOf(GameValidator);
        });

        it("должен сохранить конфигурацию игры", () => {
            expect(validator["config"]).toEqual(gameConfig);
        });
    });

    describe("validatePlayerAction", () => {
        let player: any;
        let round: any;

        beforeEach(() => {
            player = createPlayer({
                stack: 1000,
                status: PlayerStatus.ACTIVE,
            });
            round = createRound({
                activePlayers: [player],
                currentPhase: RoundPhase.BETTING1,
            });
        });

        it("должен отклонить действие если игра не активна", () => {
            const action = {
                playerId: player.id,
                type: BettingAction.CHECK,
                timestamp: new Date(),
            };

            const result = validator.validatePlayerAction(
                player,
                action,
                round,
                GameStatus.WAITING
            );

            expect(result.isValid).toBe(false);
            expect(result.error).toBe("Игра не активна");
            expect(result.errorCode).toBe("GAME_NOT_ACTIVE");
        });

        it("должен отклонить действие если нет активного раунда", () => {
            const action = {
                playerId: player.id,
                type: BettingAction.CHECK,
                timestamp: new Date(),
            };

            const result = validator.validatePlayerAction(
                player,
                action,
                null,
                GameStatus.PLAYING
            );

            expect(result.isValid).toBe(false);
            expect(result.error).toBe("Раунд не активен");
            expect(result.errorCode).toBe("NO_ACTIVE_ROUND");
        });

        it("должен отклонить действие исключенного игрока", () => {
            player.status = PlayerStatus.ELIMINATED;
            const action = {
                playerId: player.id,
                type: BettingAction.CHECK,
                timestamp: new Date(),
            };

            const result = validator.validatePlayerAction(
                player,
                action,
                round,
                GameStatus.PLAYING
            );

            expect(result.isValid).toBe(false);
            expect(result.error).toBe("Игрок исключен из игры");
            expect(result.errorCode).toBe("PLAYER_ELIMINATED");
        });

        it("должен отклонить действие сбросившего игрока в фазе ставок", () => {
            player.status = PlayerStatus.FOLDED;
            const action = {
                playerId: player.id,
                type: BettingAction.CHECK,
                timestamp: new Date(),
            };

            const result = validator.validatePlayerAction(
                player,
                action,
                round,
                GameStatus.PLAYING
            );

            expect(result.isValid).toBe(false);
            expect(result.error).toBe("Игрок сбросил карты");
            expect(result.errorCode).toBe("PLAYER_FOLDED");
        });

        it("должен валидировать CHECK действие", () => {
            player.currentBet = 100;
            // Устанавливаем такую же ставку у других игроков
            const otherPlayer = createPlayer({ currentBet: 100 });
            round.activePlayers.push(otherPlayer);

            const action = {
                playerId: player.id,
                type: BettingAction.CHECK,
                timestamp: new Date(),
            };

            const result = validator.validatePlayerAction(
                player,
                action,
                round,
                GameStatus.PLAYING
            );

            expect(result.isValid).toBe(true);
        });

        it("должен отклонить CHECK если есть ставка для уравнивания", () => {
            player.currentBet = 50;
            // Другой игрок поставил больше
            const otherPlayer = createPlayer({ currentBet: 100 });
            round.activePlayers.push(otherPlayer);

            const action = {
                playerId: player.id,
                type: BettingAction.CHECK,
                timestamp: new Date(),
            };

            const result = validator.validatePlayerAction(
                player,
                action,
                round,
                GameStatus.PLAYING
            );

            expect(result.isValid).toBe(false);
            expect(result.error).toBe(
                "Нельзя чекать, есть ставка для уравнивания"
            );
            expect(result.errorCode).toBe("INVALID_CHECK");
        });

        it("должен валидировать CALL действие", () => {
            player.currentBet = 50;
            player.stack = 100;
            // Другой игрок поставил больше
            const otherPlayer = createPlayer({ currentBet: 100 });
            round.activePlayers.push(otherPlayer);

            const action = {
                playerId: player.id,
                type: BettingAction.CALL,
                timestamp: new Date(),
            };

            const result = validator.validatePlayerAction(
                player,
                action,
                round,
                GameStatus.PLAYING
            );

            expect(result.isValid).toBe(true);
        });

        it("должен отклонить CALL если недостаточно фишек", () => {
            player.currentBet = 50;
            player.stack = 25; // Недостаточно для call
            const otherPlayer = createPlayer({ currentBet: 100 });
            round.activePlayers.push(otherPlayer);

            const action = {
                playerId: player.id,
                type: BettingAction.CALL,
                timestamp: new Date(),
            };

            const result = validator.validatePlayerAction(
                player,
                action,
                round,
                GameStatus.PLAYING
            );

            expect(result.isValid).toBe(false);
            expect(result.error).toBe("Недостаточно фишек для уравнивания");
            expect(result.errorCode).toBe("INSUFFICIENT_CHIPS_CALL");
        });

        it("должен валидировать RAISE действие", () => {
            player.currentBet = 50;
            player.stack = 200;

            const action = {
                playerId: player.id,
                type: BettingAction.RAISE,
                amount: 150,
                timestamp: new Date(),
            };

            const result = validator.validatePlayerAction(
                player,
                action,
                round,
                GameStatus.PLAYING
            );

            expect(result.isValid).toBe(true);
        });

        it("должен отклонить RAISE без указания суммы", () => {
            const action = {
                playerId: player.id,
                type: BettingAction.RAISE,
                timestamp: new Date(),
            };

            const result = validator.validatePlayerAction(
                player,
                action,
                round,
                GameStatus.PLAYING
            );

            expect(result.isValid).toBe(false);
            expect(result.error).toBe("Не указана сумма повышения");
            expect(result.errorCode).toBe("MISSING_RAISE_AMOUNT");
        });

        it("должен отклонить RAISE с недостаточным стеком", () => {
            player.currentBet = 50;
            player.stack = 50; // Недостаточно

            const action = {
                playerId: player.id,
                type: BettingAction.RAISE,
                amount: 200,
                timestamp: new Date(),
            };

            const result = validator.validatePlayerAction(
                player,
                action,
                round,
                GameStatus.PLAYING
            );

            expect(result.isValid).toBe(false);
            expect(result.error).toBe("Недостаточно фишек для повышения");
            expect(result.errorCode).toBe("INSUFFICIENT_CHIPS_RAISE");
        });

        it("должен валидировать ALL_IN действие", () => {
            player.stack = 100;

            const action = {
                playerId: player.id,
                type: BettingAction.ALL_IN,
                timestamp: new Date(),
            };

            const result = validator.validatePlayerAction(
                player,
                action,
                round,
                GameStatus.PLAYING
            );

            expect(result.isValid).toBe(true);
        });

        it("должен отклонить ALL_IN если стек пустой", () => {
            player.stack = 0;

            const action = {
                playerId: player.id,
                type: BettingAction.ALL_IN,
                timestamp: new Date(),
            };

            const result = validator.validatePlayerAction(
                player,
                action,
                round,
                GameStatus.PLAYING
            );

            expect(result.isValid).toBe(false);
            expect(result.error).toBe("Нет фишек для all-in");
            expect(result.errorCode).toBe("NO_CHIPS_ALL_IN");
        });

        it("должен всегда валидировать FOLD действие", () => {
            const action = {
                playerId: player.id,
                type: BettingAction.FOLD,
                timestamp: new Date(),
            };

            const result = validator.validatePlayerAction(
                player,
                action,
                round,
                GameStatus.PLAYING
            );

            expect(result.isValid).toBe(true);
        });

        it("должен валидировать ANSWER в фазе вопроса", () => {
            round.currentPhase = RoundPhase.QUESTION1;
            const action = {
                playerId: player.id,
                type: BettingAction.ANSWER,
                answer: 100,
                timestamp: new Date(),
            };

            const result = validator.validatePlayerAction(
                player,
                action,
                round,
                GameStatus.PLAYING
            );

            expect(result.isValid).toBe(true);
        });

        it("должен отклонить ANSWER в фазе ставок", () => {
            round.currentPhase = RoundPhase.BETTING1;
            const action = {
                playerId: player.id,
                type: BettingAction.ANSWER,
                answer: 100,
                timestamp: new Date(),
            };

            const result = validator.validatePlayerAction(
                player,
                action,
                round,
                GameStatus.PLAYING
            );

            expect(result.isValid).toBe(false);
            expect(result.error).toBe(
                "Ответы принимаются только в фазе вопроса"
            );
            expect(result.errorCode).toBe("INVALID_PHASE_FOR_ANSWER");
        });
    });

    describe("validateGameStart", () => {
        it("должен валидировать начало игры с достаточным количеством игроков", () => {
            const players = [createPlayer(), createPlayer()];

            const result = validator.validateGameStart(players);

            expect(result.isValid).toBe(true);
        });

        it("должен отклонить начало игры с недостаточным количеством игроков", () => {
            const players = [createPlayer()];

            const result = validator.validateGameStart(players);

            expect(result.isValid).toBe(false);
            expect(result.error).toBe("Недостаточно игроков для начала игры");
            expect(result.errorCode).toBe("INSUFFICIENT_PLAYERS");
        });

        it("должен отклонить начало игры с превышением максимального количества игроков", () => {
            const players = Array(gameConfig.maxPlayers + 1)
                .fill(null)
                .map(() => createPlayer());

            const result = validator.validateGameStart(players);

            expect(result.isValid).toBe(false);
            expect(result.error).toBe(
                "Превышено максимальное количество игроков"
            );
            expect(result.errorCode).toBe("TOO_MANY_PLAYERS");
        });
    });

    describe("validateRoundStart", () => {
        it("должен валидировать начало раунда", () => {
            const players = [
                createPlayer({ stack: 100 }),
                createPlayer({ stack: 200 }),
            ];

            const result = validator.validateRoundStart(players);

            expect(result.isValid).toBe(true);
        });

        it("должен отклонить начало раунда если остался только один игрок", () => {
            const players = [
                createPlayer({ stack: 100 }),
                createPlayer({ stack: 0, status: PlayerStatus.ELIMINATED }),
            ];

            const result = validator.validateRoundStart(players);

            expect(result.isValid).toBe(false);
            expect(result.error).toBe("Недостаточно активных игроков");
            expect(result.errorCode).toBe("INSUFFICIENT_ACTIVE_PLAYERS");
        });
    });

    describe("validateBettingPhase", () => {
        it("должен валидировать фазу ставок", () => {
            const round = createRound({
                currentPhase: RoundPhase.BETTING1,
                activePlayers: [
                    createPlayer({ status: PlayerStatus.ACTIVE }),
                    createPlayer({ status: PlayerStatus.ACTIVE }),
                ],
            });

            const result = validator.validateBettingPhase(round);

            expect(result.isValid).toBe(true);
        });

        it("должен отклонить валидацию если неправильная фаза", () => {
            const round = createRound({
                currentPhase: RoundPhase.QUESTION1,
            });

            const result = validator.validateBettingPhase(round);

            expect(result.isValid).toBe(false);
            expect(result.error).toBe("Неправильная фаза для ставок");
            expect(result.errorCode).toBe("INVALID_BETTING_PHASE");
        });
    });

    describe("Вспомогательные методы", () => {
        it("должен правильно вычислять текущую ставку", () => {
            const players = [
                createPlayer({ currentBet: 100 }),
                createPlayer({ currentBet: 200 }),
                createPlayer({ currentBet: 150 }),
            ];

            const currentBet = validator["getCurrentBet"](players);
            expect(currentBet).toBe(200);
        });

        it("должен вернуть 0 как текущую ставку для пустого массива", () => {
            const currentBet = validator["getCurrentBet"]([]);
            expect(currentBet).toBe(0);
        });

        it("должен правильно считать активных игроков", () => {
            const players = [
                createPlayer({ status: PlayerStatus.ACTIVE }),
                createPlayer({ status: PlayerStatus.FOLDED }),
                createPlayer({ status: PlayerStatus.ELIMINATED }),
                createPlayer({ status: PlayerStatus.ACTIVE }),
            ];

            const activeCount = validator["getActivePlayersCount"](players);
            expect(activeCount).toBe(2);
        });
    });
});
