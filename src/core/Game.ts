/**
 * Рефакторированный основной класс Game с использованием менеджеров
 */

import { EventEmitter } from "events";
import type {
    Game as IGame,
    GameConfig,
    GameStats,
    SerializedGame,
} from "../types/game";
import { GameStatus } from "../types/game";
import type { Player, PlayerAction } from "../types/player";
import { BettingAction, PlayerStatus } from "../types/player";
import type { Round } from "../types/round";
import { RoundPhase } from "../types/round";
import type { User, Question } from "../types/common";

// Импортируем наши менеджеры
import { GamePhaseManager } from "./GamePhaseManager";
import { BettingManager } from "./BettingManager";
import { WinnerDeterminator } from "./WinnerDeterminator";
import { PlayerManager } from "./PlayerManager";
import { GameValidator } from "./GameValidator";
import { GameSerializer } from "./GameSerializer";
import { GameTimerManager } from "./GameTimerManager";

export type GetQuestionFunction = () => Promise<Question> | Question;

export class Game extends EventEmitter implements IGame {
    public readonly id: string;
    public config: GameConfig;
    public status: GameStatus;
    public players: Player[];
    public currentRound?: Round;
    public roundNumber: number;
    public dealerPosition: number;
    public roundHistory: Round[];
    public readonly createdAt: Date;
    public startedAt?: Date;
    public finishedAt?: Date;
    public totalPot: number;
    public gameStats: GameStats;

    // Менеджеры
    private phaseManager: GamePhaseManager;
    private bettingManager: BettingManager;
    private winnerDeterminator: WinnerDeterminator;
    private playerManager: PlayerManager;
    private validator: GameValidator;
    private timerManager: GameTimerManager;

    private getQuestion: GetQuestionFunction;

    constructor(
        config: GameConfig,
        getQuestionFn: GetQuestionFunction,
        gameId?: string
    ) {
        super();

        this.id = gameId || this.generateId();
        this.config = {
            ...config,
            minPlayers: config.minPlayers ?? 2,
            maxPlayers: config.maxPlayers ?? 8,
            initialStack: config.initialStack ?? 1000,
            anteSize: config.anteSize ?? 50,
        };
        this.status = GameStatus.WAITING;
        this.players = [];
        this.roundNumber = 0;
        this.dealerPosition = 0;
        this.roundHistory = [];
        this.createdAt = new Date();
        this.totalPot = 0;
        this.gameStats = this.initializeStats();
        this.getQuestion = getQuestionFn;

        // Инициализируем менеджеры
        this.phaseManager = new GamePhaseManager();
        this.bettingManager = new BettingManager(this.config.anteSize);
        this.winnerDeterminator = new WinnerDeterminator();
        this.playerManager = new PlayerManager(this.config);
        this.validator = new GameValidator(this.config);
        this.timerManager = new GameTimerManager();

        // Подписываемся на события менеджеров
        this.setupManagerEventListeners();

        this.emit("game_created", {
            game: this,
        });
    }

    /**
     * Настройка слушателей событий менеджеров
     */
    private setupManagerEventListeners(): void {
        // События фазового менеджера
        this.phaseManager.on("phase_changed", (data) => {
            this.emit("phase_changed", data);
        });

        this.phaseManager.on("question_revealed", (data) => {
            this.emit("question_revealed", data);
        });

        this.phaseManager.on("betting_started", (data) => {
            this.emit("betting_started", data);
        });

        this.phaseManager.on("round_finish_requested", () => {
            this.finishCurrentRound();
        });

        // События менеджера ставок
        this.bettingManager.on("player_action_processed", (data) => {
            this.emit("player_action", data);

            // Проверяем завершение фазы ставок
            if (this.bettingManager.isBettingComplete()) {
                this.phaseManager.completeBettingPhase();
            }
        });

        // События менеджера игроков
        this.playerManager.on("player_added", (data) => {
            this.players = this.playerManager.getAllPlayers();
            this.emit("player_joined", data);
        });

        this.playerManager.on("dealer_moved", (data) => {
            this.dealerPosition = this.players.findIndex((p) => p.isDealer);
        });

        // События определителя победителей
        this.winnerDeterminator.on("winnings_distributed", (data) => {
            this.emit("winnings_distributed", data);
        });

        // События менеджера таймеров
        this.timerManager.on("timer_started", (data) => {
            this.emit("timer_started", data);
        });

        this.timerManager.on("timer_warning", (data) => {
            this.emit("timer_warning", data);
        });

        this.timerManager.on("timer_expired", (data) => {
            this.emit("timer_expired", data);
        });

        this.timerManager.on("answer_timeout", (data) => {
            this.emit("answer_timeout", data);
            // Автоматически переходим к следующей фазе при timeout ответа
            this.phaseManager.nextPhase();
        });

        this.timerManager.on("player_action_timeout", (data) => {
            this.emit("player_action_timeout", data);
            // Выполняем действие по умолчанию (fold) при timeout действия игрока
            if (data.defaultAction === "fold") {
                this.processFoldOnTimeout(data.playerId);
            }
        });
    }

    /**
     * Добавить игрока в игру
     */
    public addPlayer(user: User): Player {
        // Используем валидатор
        const validation = this.validator.validateAddPlayer(
            this.players,
            user.id,
            this.status
        );

        if (!validation.isValid) {
            throw new Error(validation.error || "Невозможно добавить игрока");
        }

        // Используем менеджер игроков
        return this.playerManager.addPlayer(user);
    }

    /**
     * Удалить игрока из игры
     */
    public removePlayer(playerId: string): boolean {
        const validation = this.validator.validateRemovePlayer(this.status);
        if (!validation.isValid) {
            throw new Error(validation.error || "Невозможно удалить игрока");
        }

        const result = this.playerManager.removePlayer(playerId);
        if (result) {
            this.players = this.playerManager.getAllPlayers();
        }
        return result;
    }

    /**
     * Начать игру
     */
    public async startGame(): Promise<void> {
        // Проверяем что игра еще не запущена
        if (this.status !== GameStatus.WAITING) {
            throw new Error("Игра уже запущена или завершена");
        }

        const validation = this.validator.validateGameStart(this.players);
        if (!validation.isValid) {
            throw new Error(validation.error || "Невозможно начать игру");
        }

        this.status = GameStatus.PLAYING;
        this.startedAt = new Date();

        // Устанавливаем дилера
        const firstPlayer = this.playerManager.getAllPlayers()[0];
        if (firstPlayer) {
            this.playerManager.setDealer(firstPlayer.id);
            this.dealerPosition = 0;
        }

        this.emit("game_started", {
            game: this,
            startTime: this.startedAt,
        });

        await this.startNextRound();
    }

    /**
     * Обработать действие игрока
     */
    public async action(
        player: Player | string,
        actionType: BettingAction,
        amount?: number,
        answer?: number
    ): Promise<boolean> {
        const playerId = typeof player === "string" ? player : player.id;
        const gamePlayer = this.playerManager.getPlayer(playerId);

        if (!gamePlayer) {
            throw new Error("Игрок не найден");
        }

        // Создаем действие
        const action: PlayerAction = {
            playerId,
            type: actionType,
            timestamp: new Date(),
            ...(amount !== undefined && { amount }),
            ...(answer !== undefined && { answer }),
        };

        // Валидируем действие
        const validation = this.validator.validatePlayerAction(
            gamePlayer,
            action,
            this.currentRound || null,
            this.status
        );

        if (!validation.isValid) {
            this.emit("player_action", {
                player: gamePlayer,
                action,
                isValid: false,
                potBefore: this.currentRound?.pot.totalPot || 0,
                potAfter: this.currentRound?.pot.totalPot || 0,
            });
            return false;
        }

        // Обрабатываем действие
        if (actionType === BettingAction.ANSWER) {
            return this.processAnswer(gamePlayer, answer);
        } else {
            return this.bettingManager.processAction(gamePlayer, action);
        }
    }

    /**
     * Обработать действие игрока (для тестов)
     */
    public async processPlayerAction(
        action: PlayerAction
    ): Promise<{ success: boolean; error?: string }> {
        try {
            const result = await this.action(
                action.playerId,
                action.type,
                action.amount,
                action.answer
            );
            return { success: result };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
            };
        }
    }

    /**
     * Получить состояние игры
     */
    public getGameState(): any {
        return {
            id: this.id,
            status: this.status,
            players: this.players,
            roundNumber: this.roundNumber,
            totalPot: this.totalPot,
            currentRound: this.currentRound,
            dealerPosition: this.dealerPosition,
            gameStats: this.gameStats,
            createdAt: this.createdAt,
            startedAt: this.startedAt,
            finishedAt: this.finishedAt,
        };
    }

    /**
     * Приостановить игру
     */
    public pauseGame(): void {
        if (this.status !== GameStatus.PLAYING) {
            throw new Error("Игра не активна");
        }

        this.status = GameStatus.PAUSED;
        this.emit("game_paused", { game: this });
    }

    /**
     * Возобновить игру
     */
    public resumeGame(): void {
        if (this.status !== GameStatus.PAUSED) {
            throw new Error("Игра не приостановлена");
        }

        this.status = GameStatus.PLAYING;
        this.emit("game_resumed", { game: this });
    }

    /**
     * Завершить игру принудительно
     */
    public endGame(): void {
        this.status = GameStatus.FINISHED;
        this.finishedAt = new Date();

        // Определяем победителя
        const rankings = this.playerManager.getPlayerRankings();
        const winner = rankings[0];

        this.emit("game_ended", {
            game: this,
            winner,
            finalStandings: rankings,
            duration:
                this.finishedAt.getTime() - (this.startedAt?.getTime() || 0),
        });
    }

    /**
     * Обработать ответ игрока
     */
    private processAnswer(player: Player, answer?: number): boolean {
        if (answer === undefined || !this.currentRound) return false;

        // Записываем ответ игрока
        player.answer = answer;

        this.emit("player_answer", {
            player,
            answer,
            timeRemaining: 0,
            allAnswersReceived: this.checkAllAnswersReceived(),
        });

        return true;
    }

    /**
     * Проверить получены ли все ответы
     */
    private checkAllAnswersReceived(): boolean {
        if (!this.currentRound) return false;

        const activePlayers = this.currentRound.activePlayers.filter(
            (p) => p.status !== PlayerStatus.FOLDED
        );

        return activePlayers.every((p) => p.answer !== undefined);
    }

    /**
     * Сериализация игры
     */
    public serialize(): { success: boolean; data?: string; error?: string } {
        try {
            const serialized = GameSerializer.serialize(this);
            return {
                success: true,
                data: JSON.stringify(serialized),
            };
        } catch (error) {
            return {
                success: false,
                error:
                    error instanceof Error
                        ? error.message
                        : "Serialization failed",
            };
        }
    }

    /**
     * Создать игру из сериализованных данных
     */
    public static createFromJSON(
        serializedData: SerializedGame,
        getQuestionFn: GetQuestionFunction
    ): Game | null {
        const deserializationResult =
            GameSerializer.deserialize(serializedData);

        if (!deserializationResult.success || !deserializationResult.game) {
            console.error(
                "Ошибка десериализации:",
                deserializationResult.error
            );
            return null;
        }

        const gameData = deserializationResult.game;
        const game = new Game(gameData.config!, getQuestionFn, gameData.id);

        // Восстанавливаем состояние
        if (gameData.status) game.status = gameData.status;
        if (gameData.players) game.players = gameData.players;
        if (gameData.currentRound) game.currentRound = gameData.currentRound;
        if (gameData.roundNumber) game.roundNumber = gameData.roundNumber;
        if (gameData.dealerPosition !== undefined)
            game.dealerPosition = gameData.dealerPosition;
        if (gameData.roundHistory) game.roundHistory = gameData.roundHistory;
        if (gameData.startedAt) game.startedAt = gameData.startedAt;
        if (gameData.finishedAt) game.finishedAt = gameData.finishedAt;
        if (gameData.totalPot) game.totalPot = gameData.totalPot;
        if (gameData.gameStats) game.gameStats = gameData.gameStats;

        return game;
    }

    /**
     * Начать следующий раунд
     */
    private async startNextRound(): Promise<void> {
        this.roundNumber++;

        // Получаем вопрос
        const question = await this.getQuestion();

        // Создаем новый раунд
        const round: Round = {
            id: this.generateId(),
            roundNumber: this.roundNumber,
            currentPhase: RoundPhase.ANTE,
            question,
            activePlayers: this.playerManager.getActivePlayers(),
            pot: {
                mainPot: 0,
                sidePots: [],
                totalPot: 0,
                bettingHistory: [],
            },
            actionHistory: [],
            dealerPosition: this.dealerPosition,
            startTime: new Date(),
            settings: {
                anteSize: this.calculateAnteSize(),
                allowReRaises: true,
                onlyAllIn: false,
            },
        };

        this.currentRound = round;

        // Настраиваем менеджеры для нового раунда
        this.phaseManager.setCurrentRound(round);
        this.bettingManager.setCurrentRound(round);

        this.emit("round_started", {
            round,
            dealerPosition: this.dealerPosition,
            question: question.text,
        });

        // Начинаем с фазы ANTE
        await this.bettingManager.processAntePhase();
        await this.phaseManager.nextPhase();
    }

    /**
     * Завершить текущий раунд
     */
    private async finishCurrentRound(): Promise<void> {
        if (!this.currentRound) return;

        this.currentRound.endTime = new Date();

        // Определяем победителей
        const winners = this.winnerDeterminator.determineWinners(
            this.currentRound
        );

        // Распределяем выигрыш
        this.winnerDeterminator.distributeWinnings(this.players, winners);

        this.emit("winners_determined", {
            round: this.currentRound,
            winners: winners.map((w) => ({
                playerId: w.playerId,
                winAmount: w.winAmount,
                accuracy: w.accuracy,
            })),
            totalDistributed: winners.reduce((sum, w) => sum + w.winAmount, 0),
        });

        // Добавляем в историю
        this.roundHistory.push(this.currentRound);

        // Обновляем статистику
        this.updateGameStats();

        // Проверяем условия завершения игры
        if (this.shouldEndGame()) {
            await this.finishGame();
        } else {
            // Подготавливаем следующий раунд
            this.prepareNextRound();
            setTimeout(() => {
                this.startNextRound();
            }, 5000);
        }
    }

    /**
     * Подготовка к следующему раунду
     */
    private prepareNextRound(): void {
        // Сдвигаем дилера
        this.playerManager.moveDealer();
        this.dealerPosition = this.players.findIndex((p) => p.isDealer);

        // Сбрасываем состояние игроков
        this.playerManager.resetPlayersForNewRound();
        this.players = this.playerManager.getAllPlayers();

        // Исключаем игроков с нулевым стеком
        this.playerManager.eliminatePlayersWithZeroStack();
        this.players = this.playerManager.getAllPlayers();
    }

    /**
     * Проверить нужно ли завершать игру
     */
    private shouldEndGame(): boolean {
        return (
            !this.playerManager.hasEnoughPlayersToContinue() ||
            this.roundNumber >= 10
        );
    }

    /**
     * Завершить игру (приватный метод для автоматического завершения)
     */
    private async finishGame(): Promise<void> {
        this.status = GameStatus.FINISHED;
        this.finishedAt = new Date();

        // Определяем победителя
        const rankings = this.playerManager.getPlayerRankings();
        const winner = rankings[0];

        this.emit("game_finished", {
            game: this,
            winner,
            finalStandings: rankings,
            duration:
                this.finishedAt.getTime() - (this.startedAt?.getTime() || 0),
        });
    }

    /**
     * Вычислить размер анте для текущего раунда
     */
    private calculateAnteSize(): number {
        return (
            this.config.anteSize * Math.max(1, Math.floor(this.roundNumber / 3))
        );
    }

    /**
     * Обновить статистику игры
     */
    private updateGameStats(): void {
        if (!this.currentRound) return;

        const roundDuration = this.currentRound.endTime
            ? this.currentRound.endTime.getTime() -
              this.currentRound.startTime.getTime()
            : 0;

        this.gameStats.roundsPlayed++;
        this.gameStats.totalDuration += roundDuration;
        this.gameStats.averageRoundDuration =
            this.gameStats.totalDuration / this.gameStats.roundsPlayed;

        if (this.currentRound.pot.totalPot > this.gameStats.largestPot) {
            this.gameStats.largestPot = this.currentRound.pot.totalPot;
        }

        // Подсчитываем статистику действий
        const bettingActions = this.currentRound.actionHistory.filter((a) =>
            [
                BettingAction.CALL,
                BettingAction.RAISE,
                BettingAction.ALL_IN,
            ].includes(a.type)
        );
        this.gameStats.totalBets += bettingActions.length;

        const folds = this.currentRound.actionHistory.filter(
            (a) => a.type === BettingAction.FOLD
        );
        this.gameStats.totalFolds += folds.length;

        const allIns = this.currentRound.actionHistory.filter(
            (a) => a.type === BettingAction.ALL_IN
        );
        this.gameStats.totalAllIns += allIns.length;
    }

    /**
     * Инициализация статистики
     */
    private initializeStats(): GameStats {
        return {
            totalDuration: 0,
            roundsPlayed: 0,
            averageRoundDuration: 0,
            totalBets: 0,
            largestPot: 0,
            totalFolds: 0,
            totalAllIns: 0,
        };
    }

    /**
     * Генерация уникального ID
     */
    private generateId(): string {
        return (
            Math.random().toString(36).substring(2) + Date.now().toString(36)
        );
    }

    /**
     * Получить снимок игры для клиента
     */
    public getClientSnapshot(): any {
        return GameSerializer.createClientSnapshot(this);
    }

    /**
     * Обработать фолд при timeout действия игрока
     */
    private processFoldOnTimeout(playerId: string): void {
        const player = this.playerManager.getPlayer(playerId);
        if (player && this.currentRound) {
            // Используем BettingManager для обработки фолда
            const foldAction = {
                playerId,
                type: BettingAction.FOLD,
                timestamp: new Date(),
            };

            this.bettingManager.processAction(player, foldAction);
        }
    }

    /**
     * Очистка ресурсов при уничтожении объекта
     */
    public destroy(): void {
        this.status = GameStatus.CANCELLED;
        this.players = [];
        this.currentRound = null as any;

        this.phaseManager.destroy();
        this.bettingManager.destroy();
        this.winnerDeterminator.destroy();
        this.playerManager.destroy();
        this.timerManager.destroy();
        this.removeAllListeners();
    }
}
