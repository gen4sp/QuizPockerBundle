/**
 * Фабрики для создания тестовых данных
 */

import type { User, Question } from "../types/common";
import type { Player, PlayerStats } from "../types/player";
import { PlayerStatus } from "../types/player";
import type { GameConfig } from "../types/game";
import type { Round, RoundPot, RoundSettings } from "../types/round";
import { RoundPhase } from "../types/round";

/**
 * Создать тестового пользователя
 */
export function createUser(overrides: Partial<User> = {}): User {
    return {
        id: "user-" + Math.random().toString(36).substr(2, 9),
        name: "Test User",
        ...overrides,
    };
}

/**
 * Создать тестового игрока
 */
export function createPlayer(overrides: Partial<Player> = {}): Player {
    const defaultStats: PlayerStats = {
        roundsPlayed: 0,
        roundsWon: 0,
        totalWinnings: 0,
        foldCount: 0,
        allInCount: 0,
        averageAccuracy: 0,
    };

    return {
        id: "player-" + Math.random().toString(36).substr(2, 9),
        user: createUser(),
        name: "Test Player",
        stack: 1000,
        position: 0,
        status: PlayerStatus.WAITING,
        currentBet: 0,
        totalBetInRound: 0,
        isAllIn: false,
        isDealer: false,
        stats: defaultStats,
        ...overrides,
    };
}

/**
 * Создать конфигурацию игры
 */
export function createGameConfig(
    overrides: Partial<GameConfig> = {}
): GameConfig {
    return {
        minPlayers: 2,
        maxPlayers: 6,
        initialStack: 1000,
        anteSize: 50,
        ...overrides,
    };
}

/**
 * Создать тестовый вопрос
 */
export function createQuestion(overrides: Partial<Question> = {}): Question {
    return {
        text: "Сколько дней в году?",
        correctAnswer: 365,
        difficulty: 1,
        ...overrides,
    };
}

/**
 * Создать банк раунда
 */
export function createRoundPot(overrides: Partial<RoundPot> = {}): RoundPot {
    return {
        mainPot: 0,
        sidePots: [],
        totalPot: 0,
        bettingHistory: [],
        ...overrides,
    };
}

/**
 * Создать настройки раунда
 */
export function createRoundSettings(
    overrides: Partial<RoundSettings> = {}
): RoundSettings {
    return {
        anteSize: 50,
        allowReRaises: true,
        maxRaisesPerPhase: 3,
        onlyAllIn: false,
        ...overrides,
    };
}

/**
 * Создать тестовый раунд
 */
export function createRound(overrides: Partial<Round> = {}): Round {
    return {
        id: "round-" + Math.random().toString(36).substr(2, 9),
        roundNumber: 1,
        currentPhase: RoundPhase.ANTE,
        activePlayers: [createPlayer(), createPlayer()],
        pot: createRoundPot(),
        actionHistory: [],
        dealerPosition: 0,
        startTime: new Date(),
        settings: createRoundSettings(),
        ...overrides,
    };
}

/**
 * Создать множество игроков
 */
export function createPlayers(count: number): Player[] {
    return Array.from({ length: count }, (_, index) =>
        createPlayer({
            name: `Player ${index + 1}`,
            position: index,
            isDealer: index === 0,
        })
    );
}

/**
 * Создать простую функцию получения вопроса для тестов
 */
export function createGetQuestionFunction(question?: Question) {
    return () => question || createQuestion();
}
