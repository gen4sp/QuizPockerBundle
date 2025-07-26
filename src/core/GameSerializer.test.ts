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
    let serializer: GameSerializer;

    beforeEach(() => {
        serializer = new GameSerializer();
    });

    describe("Конструктор", () => {
        it("должен создать экземпляр GameSerializer", () => {
            expect(serializer).toBeInstanceOf(GameSerializer);
        });
    });

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

            const result = serializer.serialize(gameData);

            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();
            expect(result.metadata?.version).toBe("1.0.0");
            expect(result.metadata?.serializedAt).toBeInstanceOf(Date);
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

            const result = serializer.serialize(gameData);

            expect(result.success).toBe(true);
            expect(result.data).toContain("currentRound");
            expect(result.data).toContain("BETTING1");
        });

        it("должен применить опции сериализации", () => {
            const gameData = {
                id: "game-1",
                config: createGameConfig(),
                status: GameStatus.FINISHED,
                players: [createPlayer()],
                roundNumber: 0,
                dealerPosition: 0,
                roundHistory: [],
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
                includePrivateData: false,
                compressData: true,
                includeHistory: false,
            };

            const result = serializer.serialize(gameData, options);

            expect(result.success).toBe(true);
            expect(result.compressed).toBe(true);
        });

        it("должен обработать ошибку сериализации", () => {
            // Создаем объект с циклической ссылкой
            const cyclicData: any = {
                id: "game-1",
                config: createGameConfig(),
                status: GameStatus.WAITING,
                players: [],
                roundNumber: 0,
                dealerPosition: 0,
                roundHistory: [],
                createdAt: new Date(),
                totalPot: 0,
                gameStats: {},
            };
            cyclicData.self = cyclicData; // Циклическая ссылка

            const result = serializer.serialize(cyclicData);

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
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

            const serialized = serializer.serialize(gameData);
            const result = serializer.deserialize(serialized.data!);

            expect(result.success).toBe(true);
            expect(result.gameData?.id).toBe("game-1");
            expect(result.gameData?.status).toBe(GameStatus.WAITING);
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

            const serialized = serializer.serialize(gameData);
            const result = serializer.deserialize(serialized.data!);

            expect(result.success).toBe(true);
            expect(result.gameData?.createdAt).toBeInstanceOf(Date);
            expect(result.gameData?.createdAt?.getTime()).toBe(
                createdAt.getTime()
            );
        });

        it("должен обработать невалидные JSON данные", () => {
            const result = serializer.deserialize("invalid json");

            expect(result.success).toBe(false);
            expect(result.error).toContain("JSON");
        });

        it("должен обработать устаревшую версию", () => {
            const oldVersionData = JSON.stringify({
                version: "0.5.0",
                gameData: { id: "test" },
            });

            const result = serializer.deserialize(oldVersionData);

            expect(result.success).toBe(false);
            expect(result.error).toContain("версия");
        });
    });

    describe("compress и decompress", () => {
        it("должен сжать и распаковать данные", () => {
            const originalData =
                "This is a test string that should be compressed";

            const compressed = serializer.compress(originalData);
            const decompressed = serializer.decompress(compressed);

            expect(decompressed).toBe(originalData);
            expect(compressed.length).toBeLessThan(originalData.length);
        });

        it("должен обработать пустые данные", () => {
            const compressed = serializer.compress("");
            const decompressed = serializer.decompress(compressed);

            expect(decompressed).toBe("");
        });
    });

    describe("validateGameData", () => {
        it("должен валидировать корректную структуру игры", () => {
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

            const isValid = serializer.validateGameData(gameData);
            expect(isValid).toBe(true);
        });

        it("должен отклонить данные без обязательных полей", () => {
            const incompleteData = {
                id: "game-1",
                // Отсутствуют обязательные поля
            };

            const isValid = serializer.validateGameData(incompleteData);
            expect(isValid).toBe(false);
        });

        it("должен отклонить данные с неправильными типами", () => {
            const invalidData = {
                id: "game-1",
                config: createGameConfig(),
                status: "invalid_status", // Неправильный тип
                players: "not_an_array", // Неправильный тип
                roundNumber: "zero", // Неправильный тип
                dealerPosition: 0,
                roundHistory: [],
                createdAt: new Date(),
                totalPot: 0,
                gameStats: {},
            };

            const isValid = serializer.validateGameData(invalidData);
            expect(isValid).toBe(false);
        });
    });

    describe("getSerializationStats", () => {
        it("должен вернуть статистику сериализации", () => {
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

            serializer.serialize(gameData);
            const stats = serializer.getSerializationStats();

            expect(stats.totalSerializations).toBe(1);
            expect(stats.totalDeserializations).toBe(0);
            expect(stats.averageSerializationTime).toBeGreaterThan(0);
        });
    });
});
