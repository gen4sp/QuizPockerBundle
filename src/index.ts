/**
 * QuizPoker Bundle - Main API Export
 */

import { Game, GetQuestionFunction } from "./core/Game";
import type { GameConfig, SerializedGame } from "./types/game";
import type { User } from "./types/common";
import { GameEventType } from "./types/events";

// Export all types
export * from "./types";
export { Game };

/**
 * QuizPoker main API object
 */
const QuizPoker = {
    /**
     * Создать новую игру
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
     * Создать игру из сериализованных данных
     */
    createFromJSON(
        data: SerializedGame,
        getQuestionFunction: GetQuestionFunction
    ): Game {
        return Game.createFromJSON(data, getQuestionFunction);
    },

    /**
     * События игры
     */
    events: GameEventType,
};

export default QuizPoker;
