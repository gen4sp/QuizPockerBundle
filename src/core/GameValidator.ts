/**
 * Валидатор игровых действий и состояний
 */

import type { Player, PlayerAction } from "../types/player";
import { BettingAction, PlayerStatus } from "../types/player";
import type { Round } from "../types/round";
import { RoundPhase } from "../types/round";
import type { GameConfig } from "../types/game";
import { GameStatus } from "../types/game";

export interface ValidationResult {
    isValid: boolean;
    error?: string;
    errorCode?: string;
}

export class GameValidator {
    private config: GameConfig;

    constructor(config: GameConfig) {
        this.config = config;
    }

    /**
     * Валидация действия игрока
     */
    public validatePlayerAction(
        player: Player,
        action: PlayerAction,
        round: Round | null,
        gameStatus: GameStatus
    ): ValidationResult {
        // Проверяем статус игры
        if (gameStatus !== GameStatus.PLAYING) {
            return {
                isValid: false,
                error: "Игра не активна",
                errorCode: "GAME_NOT_ACTIVE",
            };
        }

        // Проверяем наличие раунда
        if (!round) {
            return {
                isValid: false,
                error: "Раунд не активен",
                errorCode: "NO_ACTIVE_ROUND",
            };
        }

        // Проверяем статус игрока
        const playerStatusCheck = this.validatePlayerStatus(player, action);
        if (!playerStatusCheck.isValid) {
            return playerStatusCheck;
        }

        // Проверяем фазу раунда
        const phaseCheck = this.validatePhaseForAction(
            round.currentPhase,
            action
        );
        if (!phaseCheck.isValid) {
            return phaseCheck;
        }

        // Проверяем конкретное действие
        return this.validateSpecificAction(player, action, round);
    }

    /**
     * Валидация статуса игрока для действия
     */
    public validatePlayerStatus(
        player: Player,
        action: PlayerAction
    ): ValidationResult {
        // Исключенные игроки не могут делать действия
        if (player.status === PlayerStatus.ELIMINATED) {
            return {
                isValid: false,
                error: "Игрок исключен из игры",
                errorCode: "PLAYER_ELIMINATED",
            };
        }

        // Игроки в фолде не могут делать ставки
        if (
            player.status === PlayerStatus.FOLDED &&
            [
                BettingAction.CHECK,
                BettingAction.CALL,
                BettingAction.RAISE,
                BettingAction.ALL_IN,
            ].includes(action.type)
        ) {
            return {
                isValid: false,
                error: "Игрок уже сбросил карты",
                errorCode: "PLAYER_FOLDED",
            };
        }

        // All-in игроки не могут делать дополнительные ставки
        if (
            player.isAllIn &&
            [
                BettingAction.CHECK,
                BettingAction.CALL,
                BettingAction.RAISE,
            ].includes(action.type)
        ) {
            return {
                isValid: false,
                error: "Игрок уже поставил все фишки",
                errorCode: "PLAYER_ALL_IN",
            };
        }

        return { isValid: true };
    }

    /**
     * Валидация фазы для действия
     */
    public validatePhaseForAction(
        phase: RoundPhase,
        action: PlayerAction
    ): ValidationResult {
        const bettingPhases = [
            RoundPhase.BETTING1,
            RoundPhase.BETTING2,
            RoundPhase.BETTING3,
        ];
        const questionPhases = [RoundPhase.QUESTION1, RoundPhase.QUESTION2];

        // Ставки только в фазах ставок
        if (
            [
                BettingAction.CHECK,
                BettingAction.CALL,
                BettingAction.RAISE,
                BettingAction.ALL_IN,
                BettingAction.FOLD,
            ].includes(action.type)
        ) {
            if (!bettingPhases.includes(phase)) {
                return {
                    isValid: false,
                    error: "Ставки недоступны в данной фазе",
                    errorCode: "BETTING_NOT_ALLOWED_IN_PHASE",
                };
            }
        }

        // Ответы только в фазах вопросов
        if (action.type === BettingAction.ANSWER) {
            if (!questionPhases.includes(phase)) {
                return {
                    isValid: false,
                    error: "Ответы недоступны в данной фазе",
                    errorCode: "ANSWERS_NOT_ALLOWED_IN_PHASE",
                };
            }
        }

        return { isValid: true };
    }

    /**
     * Валидация конкретного действия
     */
    public validateSpecificAction(
        player: Player,
        action: PlayerAction,
        round: Round
    ): ValidationResult {
        const currentBet = this.getCurrentBet(round);

        switch (action.type) {
            case BettingAction.CHECK:
                return this.validateCheck(player, currentBet);

            case BettingAction.CALL:
                return this.validateCall(player, currentBet);

            case BettingAction.RAISE:
                return this.validateRaise(player, action, currentBet);

            case BettingAction.ALL_IN:
                return this.validateAllIn(player);

            case BettingAction.FOLD:
                return this.validateFold();

            case BettingAction.ANSWER:
                return this.validateAnswer(action);

            default:
                return {
                    isValid: false,
                    error: "Неизвестный тип действия",
                    errorCode: "UNKNOWN_ACTION_TYPE",
                };
        }
    }

    /**
     * Валидация чека
     */
    private validateCheck(
        player: Player,
        currentBet: number
    ): ValidationResult {
        if (player.currentBet !== currentBet) {
            return {
                isValid: false,
                error: "Нельзя чекать, есть ставка для уравнивания",
                errorCode: "CANNOT_CHECK_WITH_BET",
            };
        }

        return { isValid: true };
    }

    /**
     * Валидация колла
     */
    private validateCall(player: Player, currentBet: number): ValidationResult {
        if (player.currentBet >= currentBet) {
            return {
                isValid: false,
                error: "Нет ставки для уравнивания",
                errorCode: "NO_BET_TO_CALL",
            };
        }

        if (player.stack <= 0) {
            return {
                isValid: false,
                error: "Недостаточно фишек для колла",
                errorCode: "INSUFFICIENT_CHIPS_FOR_CALL",
            };
        }

        return { isValid: true };
    }

    /**
     * Валидация рейза
     */
    private validateRaise(
        player: Player,
        action: PlayerAction,
        currentBet: number
    ): ValidationResult {
        if (action.amount === undefined) {
            return {
                isValid: false,
                error: "Не указана сумма рейза",
                errorCode: "RAISE_AMOUNT_MISSING",
            };
        }

        if (action.amount <= currentBet) {
            return {
                isValid: false,
                error: "Рейз должен быть больше текущей ставки",
                errorCode: "RAISE_TOO_LOW",
            };
        }

        const requiredChips = action.amount - player.currentBet;
        if (player.stack < requiredChips) {
            return {
                isValid: false,
                error: "Недостаточно фишек для рейза",
                errorCode: "INSUFFICIENT_CHIPS_FOR_RAISE",
            };
        }

        // Проверяем минимальный рейз (должен быть хотя бы размером анте)
        const minRaise = currentBet + this.config.anteSize;
        if (action.amount < minRaise) {
            return {
                isValid: false,
                error: `Минимальный рейз: ${minRaise}`,
                errorCode: "RAISE_BELOW_MINIMUM",
            };
        }

        return { isValid: true };
    }

    /**
     * Валидация all-in
     */
    private validateAllIn(player: Player): ValidationResult {
        if (player.stack <= 0) {
            return {
                isValid: false,
                error: "Нет фишек для all-in",
                errorCode: "NO_CHIPS_FOR_ALL_IN",
            };
        }

        return { isValid: true };
    }

    /**
     * Валидация фолда
     */
    private validateFold(): ValidationResult {
        // Фолд всегда разрешен
        return { isValid: true };
    }

    /**
     * Валидация ответа
     */
    private validateAnswer(action: PlayerAction): ValidationResult {
        if (action.answer === undefined) {
            return {
                isValid: false,
                error: "Не указан ответ",
                errorCode: "ANSWER_MISSING",
            };
        }

        if (typeof action.answer !== "number") {
            return {
                isValid: false,
                error: "Ответ должен быть числом",
                errorCode: "ANSWER_NOT_NUMBER",
            };
        }

        if (action.answer < 0) {
            return {
                isValid: false,
                error: "Ответ не может быть отрицательным",
                errorCode: "ANSWER_NEGATIVE",
            };
        }

        return { isValid: true };
    }

    /**
     * Валидация начала игры
     */
    public validateGameStart(
        players: Player[],
        gameStatus: GameStatus
    ): ValidationResult {
        if (gameStatus !== GameStatus.WAITING) {
            return {
                isValid: false,
                error: "Игра уже начата или завершена",
                errorCode: "GAME_ALREADY_STARTED",
            };
        }

        const activePlayers = players.filter(
            (p) => p.status !== PlayerStatus.ELIMINATED
        );

        if (activePlayers.length < this.config.minPlayers) {
            return {
                isValid: false,
                error: `Недостаточно игроков. Минимум: ${this.config.minPlayers}`,
                errorCode: "NOT_ENOUGH_PLAYERS",
            };
        }

        return { isValid: true };
    }

    /**
     * Валидация добавления игрока
     */
    public validateAddPlayer(
        players: Player[],
        newPlayerUserId: string,
        gameStatus: GameStatus
    ): ValidationResult {
        if (gameStatus !== GameStatus.WAITING) {
            return {
                isValid: false,
                error: "Нельзя добавить игрока - игра уже началась",
                errorCode: "GAME_ALREADY_STARTED",
            };
        }

        if (players.length >= this.config.maxPlayers) {
            return {
                isValid: false,
                error: "Достигнуто максимальное количество игроков",
                errorCode: "MAX_PLAYERS_REACHED",
            };
        }

        if (players.some((p) => p.user.id === newPlayerUserId)) {
            return {
                isValid: false,
                error: "Игрок уже в игре",
                errorCode: "PLAYER_ALREADY_IN_GAME",
            };
        }

        return { isValid: true };
    }

    /**
     * Валидация удаления игрока
     */
    public validateRemovePlayer(gameStatus: GameStatus): ValidationResult {
        if (gameStatus === GameStatus.PLAYING) {
            return {
                isValid: false,
                error: "Нельзя удалить игрока во время игры",
                errorCode: "CANNOT_REMOVE_DURING_GAME",
            };
        }

        return { isValid: true };
    }

    /**
     * Валидация окончания игры
     */
    public validateGameEnd(players: Player[]): ValidationResult {
        const activePlayers = players.filter(
            (p) => p.status !== PlayerStatus.ELIMINATED && p.stack > 0
        );

        if (activePlayers.length > 1) {
            return {
                isValid: false,
                error: "Игра не может закончиться - есть активные игроки",
                errorCode: "GAME_CANNOT_END_WITH_ACTIVE_PLAYERS",
            };
        }

        return { isValid: true };
    }

    /**
     * Получить текущую ставку в раунде
     */
    private getCurrentBet(round: Round): number {
        if (round.activePlayers.length === 0) return 0;
        return Math.max(...round.activePlayers.map((p) => p.currentBet));
    }

    /**
     * Обновить конфигурацию
     */
    public updateConfig(newConfig: Partial<GameConfig>): void {
        this.config = { ...this.config, ...newConfig };
    }

    /**
     * Получить конфигурацию
     */
    public getConfig(): GameConfig {
        return { ...this.config };
    }
}
