/**
 * QuizPoker Bundle - Main API Export
 */

import { Game, GetQuestionFunction } from "./core";
import type { GameConfig, SerializedGame } from "./types/game";
import type { User } from "./types/common";
import { GameEventType } from "./types/events";

// Export all types
export * from "./types";

// Export core classes and managers (excluding Game to avoid conflict)
export {
    GamePhaseManager,
    BettingManager,
    WinnerDeterminator,
    PlayerManager,
    GameValidator,
    GameSerializer,
    GameTimerManager,
} from "./core";

// Export utilities
export { Logger, logger } from "./utils/logger";

// Export Game as the main class
export { Game };

/**
 * QuizPoker main API object
 */
const QuizPoker = {
    /**
     * Создать новую игру (оригинальная версия)
     */

    /**
     * Создать новую игру (рефакторированная версия с менеджерами)
     */
    createGame(
        players: User[],
        getQuestionFunction: GetQuestionFunction,
        options?: Partial<GameConfig>
    ): Game {
        const config: GameConfig = {
            minPlayers: 2,
            maxPlayers: 8,
            initialStack: 1000,
            anteSize: 50,
            ...options,
        };

        const game = new Game(config, getQuestionFunction);

        // Добавляем игроков
        players.forEach((user) => {
            game.addPlayer(user);
        });

        return game;
    },

    /**
     * Создать рефакторированную игру из сериализованных данных
     */
    createFromJSON(
        data: SerializedGame,
        getQuestionFunction: GetQuestionFunction
    ): Game | null {
        return Game.createFromJSON(data, getQuestionFunction);
    },

    /**
     * События игры
     */
    events: GameEventType,
};

export default QuizPoker;
