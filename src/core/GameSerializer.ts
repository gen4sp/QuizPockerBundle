/**
 * Сериализатор для сохранения и загрузки состояния игры
 */

import type { Game, SerializedGame } from "../types/game";
import type { Player } from "../types/player";
import type { Round } from "../types/round";
import type { GameStats } from "../types/game";

export interface SerializationOptions {
    includeHistory?: boolean;
    includePlayerStats?: boolean;
    includeTimerState?: boolean;
    compressionLevel?: "none" | "basic" | "full";
}

export interface DeserializationResult {
    success: boolean;
    game?: Partial<Game>;
    error?: string;
    warnings?: string[];
}

export class GameSerializer {
    private static readonly CURRENT_VERSION = "1.0.0";
    private static readonly SUPPORTED_VERSIONS = ["1.0.0"];

    /**
     * Сериализация игры в JSON
     */
    public static serialize(
        gameData: Partial<Game>,
        options: SerializationOptions = {}
    ): SerializedGame {
        const {
            includeHistory = true,
            includePlayerStats = true,
            includeTimerState = false,
            compressionLevel = "basic",
        } = options;

        // Создаем копию данных для обработки
        const processedData = this.processForSerialization(gameData, {
            includeHistory,
            includePlayerStats,
            includeTimerState,
            compressionLevel,
        });

        return {
            gameData: processedData as Game,
            version: this.CURRENT_VERSION,
            serializedAt: new Date(),
        };
    }

    /**
     * Десериализация игры из JSON
     */
    public static deserialize(
        serializedData: SerializedGame | string
    ): DeserializationResult {
        try {
            // Парсим JSON если нужно
            const data =
                typeof serializedData === "string"
                    ? JSON.parse(serializedData)
                    : serializedData;

            // Проверяем версию
            const versionCheck = this.validateVersion(data.version);
            if (!versionCheck.success) {
                return {
                    success: false,
                    error: versionCheck.error!,
                };
            }

            // Валидируем структуру данных
            const validationResult = this.validateSerializedData(data);
            if (!validationResult.success) {
                return {
                    success: false,
                    error: validationResult.error!,
                };
            }

            // Восстанавливаем данные
            const restoredGame = this.processForDeserialization(data.gameData);

            return {
                success: true,
                game: restoredGame,
                ...(validationResult.warnings && {
                    warnings: validationResult.warnings,
                }),
            };
        } catch (error) {
            return {
                success: false,
                error: `Ошибка десериализации: ${
                    error instanceof Error
                        ? error.message
                        : "Неизвестная ошибка"
                }`,
            };
        }
    }

    /**
     * Обработка данных для сериализации
     */
    private static processForSerialization(
        gameData: Partial<Game>,
        options: SerializationOptions
    ): Partial<Game> {
        const processed = { ...gameData };

        // Обрабатываем историю раундов
        if (!options.includeHistory && processed.roundHistory) {
            processed.roundHistory = [];
        }

        // Обрабатываем статистику игроков
        if (!options.includePlayerStats && processed.players) {
            processed.players = processed.players.map((player) => ({
                ...player,
                stats: {
                    roundsPlayed: 0,
                    roundsWon: 0,
                    totalWinnings: 0,
                    foldCount: 0,
                    allInCount: 0,
                    averageAccuracy: 0,
                },
            }));
        }

        // Обрабатываем состояние таймеров
        if (!options.includeTimerState && processed.currentRound?.timer) {
            const { timer, ...roundWithoutTimer } = processed.currentRound;
            processed.currentRound = roundWithoutTimer as Round;
        }

        // Применяем сжатие
        return this.applyCompression(
            processed,
            options.compressionLevel || "basic"
        );
    }

    /**
     * Обработка данных для десериализации
     */
    private static processForDeserialization(gameData: Game): Partial<Game> {
        const processed = { ...gameData };

        // Восстанавливаем даты из строк
        if (typeof processed.createdAt === "string") {
            processed.createdAt = new Date(processed.createdAt);
        }
        if (typeof processed.startedAt === "string") {
            processed.startedAt = new Date(processed.startedAt);
        }
        if (typeof processed.finishedAt === "string") {
            processed.finishedAt = new Date(processed.finishedAt);
        }

        // Восстанавливаем даты в раундах
        if (processed.currentRound) {
            processed.currentRound = this.restoreRoundDates(
                processed.currentRound
            );
        }

        if (processed.roundHistory) {
            processed.roundHistory = processed.roundHistory.map((round) =>
                this.restoreRoundDates(round)
            );
        }

        return processed;
    }

    /**
     * Восстановление дат в раунде
     */
    private static restoreRoundDates(round: Round): Round {
        const restored = { ...round };

        if (typeof restored.startTime === "string") {
            restored.startTime = new Date(restored.startTime);
        }
        if (typeof restored.endTime === "string") {
            restored.endTime = new Date(restored.endTime);
        }

        // Восстанавливаем даты в истории действий
        if (restored.actionHistory) {
            restored.actionHistory = restored.actionHistory.map((action) => ({
                ...action,
                timestamp:
                    typeof action.timestamp === "string"
                        ? new Date(action.timestamp)
                        : action.timestamp,
            }));
        }

        return restored;
    }

    /**
     * Применение сжатия данных
     */
    private static applyCompression(
        data: Partial<Game>,
        level: "none" | "basic" | "full"
    ): Partial<Game> {
        if (level === "none") return data;

        const compressed = { ...data };

        if (level === "basic" || level === "full") {
            // Убираем необязательные поля
            if (compressed.currentRound?.timer) {
                delete compressed.currentRound.timer;
            }

            // Сжимаем историю действий
            if (compressed.currentRound?.actionHistory) {
                compressed.currentRound.actionHistory =
                    compressed.currentRound.actionHistory.map((action) => ({
                        playerId: action.playerId,
                        type: action.type,
                        ...(action.amount !== undefined && {
                            amount: action.amount,
                        }),
                        ...(action.answer !== undefined && {
                            answer: action.answer,
                        }),
                        timestamp: action.timestamp,
                    }));
            }
        }

        if (level === "full") {
            // Дополнительное сжатие - убираем подробную статистику
            if (compressed.gameStats) {
                compressed.gameStats = {
                    roundsPlayed: compressed.gameStats.roundsPlayed,
                    totalDuration: compressed.gameStats.totalDuration,
                    averageRoundDuration: 0,
                    totalBets: 0,
                    largestPot: compressed.gameStats.largestPot,
                    totalFolds: 0,
                    totalAllIns: 0,
                };
            }
        }

        return compressed;
    }

    /**
     * Валидация версии
     */
    private static validateVersion(version: string): {
        success: boolean;
        error?: string;
    } {
        if (!version) {
            return {
                success: false,
                error: "Отсутствует версия данных",
            };
        }

        if (!this.SUPPORTED_VERSIONS.includes(version)) {
            return {
                success: false,
                error: `Неподдерживаемая версия: ${version}. Поддерживаемые версии: ${this.SUPPORTED_VERSIONS.join(
                    ", "
                )}`,
            };
        }

        return { success: true };
    }

    /**
     * Валидация сериализованных данных
     */
    private static validateSerializedData(data: SerializedGame): {
        success: boolean;
        error?: string;
        warnings?: string[];
    } {
        const warnings: string[] = [];

        // Проверяем обязательные поля
        if (!data.gameData) {
            return {
                success: false,
                error: "Отсутствуют данные игры",
            };
        }

        if (!data.gameData.id) {
            return {
                success: false,
                error: "Отсутствует ID игры",
            };
        }

        if (!data.gameData.config) {
            return {
                success: false,
                error: "Отсутствует конфигурация игры",
            };
        }

        if (!Array.isArray(data.gameData.players)) {
            return {
                success: false,
                error: "Некорректные данные игроков",
            };
        }

        // Проверяем целостность данных
        if (data.gameData.currentRound && !data.gameData.currentRound.id) {
            warnings.push("Текущий раунд не имеет ID");
        }

        if (data.gameData.dealerPosition >= data.gameData.players.length) {
            warnings.push("Некорректная позиция дилера");
        }

        return {
            success: true,
            ...(warnings.length > 0 && { warnings }),
        };
    }

    /**
     * Создание минимальной копии игры для передачи клиенту
     */
    public static createClientSnapshot(gameData: Partial<Game>): any {
        return {
            id: gameData.id,
            status: gameData.status,
            config: {
                minPlayers: gameData.config?.minPlayers,
                maxPlayers: gameData.config?.maxPlayers,
                initialStack: gameData.config?.initialStack,
                anteSize: gameData.config?.anteSize,
            },
            players: gameData.players?.map((player) => ({
                id: player.id,
                name: player.name,
                stack: player.stack,
                position: player.position,
                status: player.status,
                isDealer: player.isDealer,
                isAllIn: player.isAllIn,
            })),
            roundNumber: gameData.roundNumber,
            totalPot: gameData.totalPot,
            currentRound: gameData.currentRound
                ? {
                      roundNumber: gameData.currentRound.roundNumber,
                      currentPhase: gameData.currentRound.currentPhase,
                      pot: gameData.currentRound.pot,
                      question: gameData.currentRound.question
                          ? {
                                text: gameData.currentRound.question.text,
                                // Не включаем правильный ответ
                            }
                          : undefined,
                  }
                : undefined,
            createdAt: gameData.createdAt,
            startedAt: gameData.startedAt,
        };
    }

    /**
     * Создание полного экспорта игры
     */
    public static createFullExport(gameData: Partial<Game>): SerializedGame {
        return this.serialize(gameData, {
            includeHistory: true,
            includePlayerStats: true,
            includeTimerState: true,
            compressionLevel: "none",
        });
    }

    /**
     * Создание сжатого экспорта игры
     */
    public static createCompactExport(gameData: Partial<Game>): SerializedGame {
        return this.serialize(gameData, {
            includeHistory: false,
            includePlayerStats: false,
            includeTimerState: false,
            compressionLevel: "full",
        });
    }

    /**
     * Проверка совместимости данных
     */
    public static checkCompatibility(serializedData: SerializedGame | string): {
        compatible: boolean;
        version: string;
        issues?: string[];
    } {
        try {
            const data =
                typeof serializedData === "string"
                    ? JSON.parse(serializedData)
                    : serializedData;

            const issues: string[] = [];

            if (!this.SUPPORTED_VERSIONS.includes(data.version)) {
                issues.push(`Неподдерживаемая версия: ${data.version}`);
            }

            // Дополнительные проверки совместимости
            if (
                data.gameData?.config &&
                typeof data.gameData.config.anteSize !== "number"
            ) {
                issues.push("Некорректная конфигурация ante");
            }

            return {
                compatible: issues.length === 0,
                version: data.version || "unknown",
                ...(issues.length > 0 && { issues }),
            };
        } catch (error) {
            return {
                compatible: false,
                version: "unknown",
                issues: ["Ошибка парсинга данных"],
            };
        }
    }
}
