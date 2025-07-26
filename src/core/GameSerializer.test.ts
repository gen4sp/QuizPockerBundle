/**
 * Тесты для GameSerializer
 */

import { describe, it, expect, beforeEach } from "vitest";
import { GameSerializer, type SerializationOptions } from "./GameSerializer";
import { GameStatus } from "../types/game";
import { PlayerStatus } from "../types/player";
import { RoundPhase } from "../types/round";
import {
    createGameConfig,
    createPlayer,
    createRound,
    createQuestion,
} from "../test-utils";

describe("GameSerializer", () => {
    describe("serialize", () => {
        it("должен сериализовать базовую игру", () => {
            const gameData = {
                id: "game-1",
                config: createGameConfig(),
                status: GameStatus.WAITING,
                players: [createPlayer()],
                roundNumber: 0,
                dealerPosition: 0,
                roundHistory: [],
                createdAt: new Date("2024-01-01"),
                totalPot: 0,
                gameStats: {
                    totalDuration: 0,
                    roundsPlayed: 0,
                    averageRoundDuration: 0,
                    totalBets: 0,
                    largestPot: 0,
                    totalFolds: 0,
                    totalAllIns: 0,
                },
            };

            const result = GameSerializer.serialize(gameData);

            expect(result.gameData).toBeDefined();
            expect(result.version).toBe("1.0.0");
            expect(result.serializedAt).toBeInstanceOf(Date);
        });

        it("должен сериализовать игру с текущим раундом", () => {
            const round = createRound({
                currentPhase: RoundPhase.BETTING1,
                question: createQuestion(),
            });

            const gameData = {
                id: "game-1",
                config: createGameConfig(),
                status: GameStatus.PLAYING,
                players: [createPlayer()],
                currentRound: round,
                roundNumber: 1,
                dealerPosition: 0,
                roundHistory: [],
                createdAt: new Date(),
                totalPot: 100,
                gameStats: {
                    totalDuration: 5000,
                    roundsPlayed: 1,
                    averageRoundDuration: 5000,
                    totalBets: 5,
                    largestPot: 100,
                    totalFolds: 2,
                    totalAllIns: 1,
                },
            };

            const result = GameSerializer.serialize(gameData);

            expect(result.gameData).toBeDefined();
            expect(result.gameData.currentRound).toBeDefined();
            expect(result.gameData.currentRound?.currentPhase).toBe(
                RoundPhase.BETTING1
            );
        });

        it("должен применить опции сериализации", () => {
            const gameData = {
                id: "game-1",
                config: createGameConfig(),
                status: GameStatus.FINISHED,
                players: [createPlayer()],
                roundNumber: 0,
                dealerPosition: 0,
                roundHistory: [createRound()],
                createdAt: new Date(),
                totalPot: 0,
                gameStats: {
                    totalDuration: 10000,
                    roundsPlayed: 3,
                    averageRoundDuration: 3333,
                    totalBets: 15,
                    largestPot: 500,
                    totalFolds: 8,
                    totalAllIns: 2,
                },
            };

            const options: SerializationOptions = {
                includeHistory: false,
                includePlayerStats: false,
                compressionLevel: "full",
            };

            const result = GameSerializer.serialize(gameData, options);

            expect(result.gameData).toBeDefined();
            expect(result.gameData.roundHistory).toEqual([]);
        });
    });

    describe("deserialize", () => {
        it("должен десериализовать валидные данные", () => {
            const gameData = {
                id: "game-1",
                config: createGameConfig(),
                status: GameStatus.WAITING,
                players: [createPlayer()],
                roundNumber: 0,
                dealerPosition: 0,
                roundHistory: [],
                createdAt: new Date(),
                totalPot: 0,
                gameStats: {
                    totalDuration: 0,
                    roundsPlayed: 0,
                    averageRoundDuration: 0,
                    totalBets: 0,
                    largestPot: 0,
                    totalFolds: 0,
                    totalAllIns: 0,
                },
            };

            const serialized = GameSerializer.serialize(gameData);
            const result = GameSerializer.deserialize(serialized);

            expect(result.success).toBe(true);
            expect(result.game?.id).toBe("game-1");
            expect(result.game?.status).toBe(GameStatus.WAITING);
        });

        it("должен восстановить даты как объекты Date", () => {
            const createdAt = new Date("2024-01-01T10:00:00Z");
            const gameData = {
                id: "game-1",
                config: createGameConfig(),
                status: GameStatus.WAITING,
                players: [],
                roundNumber: 0,
                dealerPosition: 0,
                roundHistory: [],
                createdAt,
                totalPot: 0,
                gameStats: {
                    totalDuration: 0,
                    roundsPlayed: 0,
                    averageRoundDuration: 0,
                    totalBets: 0,
                    largestPot: 0,
                    totalFolds: 0,
                    totalAllIns: 0,
                },
            };

            const serialized = GameSerializer.serialize(gameData);
            const result = GameSerializer.deserialize(serialized);

            expect(result.success).toBe(true);
            expect(result.game?.createdAt).toBeInstanceOf(Date);
            expect(result.game?.createdAt?.getTime()).toBe(createdAt.getTime());
        });

        it("должен обработать невалидные JSON данные", () => {
            const result = GameSerializer.deserialize("invalid json");

            expect(result.success).toBe(false);
            expect(result.error).toContain("JSON");
        });

        it("должен обработать устаревшую версию", () => {
            const oldVersionData = {
                version: "0.5.0",
                gameData: { id: "test" },
                serializedAt: new Date(),
            } as any;

            const result = GameSerializer.deserialize(oldVersionData);

            expect(result.success).toBe(false);
            expect(result.error).toContain("версия");
        });
    });

    describe("createClientSnapshot", () => {
        it("должен создать снимок для клиента", () => {
            const gameData = {
                id: "game-1",
                config: createGameConfig(),
                status: GameStatus.WAITING,
                players: [createPlayer()],
                roundNumber: 0,
                dealerPosition: 0,
                roundHistory: [],
                createdAt: new Date(),
                totalPot: 0,
            };

            const snapshot = GameSerializer.createClientSnapshot(gameData);

            expect(snapshot.id).toBe("game-1");
            expect(snapshot.status).toBe(GameStatus.WAITING);
            expect(snapshot.players).toBeDefined();
            expect(snapshot.config).toBeDefined();
        });
    });

    describe("checkCompatibility", () => {
        it("должен проверить совместимость валидных данных", () => {
            const validData = {
                version: "1.0.0",
                gameData: {
                    id: "test",
                    config: { anteSize: 10 },
                },
                serializedAt: new Date(),
            } as any;

            const result = GameSerializer.checkCompatibility(validData);

            expect(result.compatible).toBe(true);
            expect(result.version).toBe("1.0.0");
        });

        it("должен обнаружить несовместимую версию", () => {
            const incompatibleData = {
                version: "0.5.0",
                gameData: { id: "test" },
                serializedAt: new Date(),
            } as any;

            const result = GameSerializer.checkCompatibility(incompatibleData);

            expect(result.compatible).toBe(false);
            expect(result.issues).toContain("Неподдерживаемая версия: 0.5.0");
        });
    });
});
