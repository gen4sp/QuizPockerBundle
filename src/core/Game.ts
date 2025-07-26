/**
 * Main Game class for QuizPoker
 * Handles game lifecycle, player management, rounds, and events
 */

import { EventEmitter } from "events";
import type {
    Game as IGame,
    GameConfig,
    GameStats,
    GameAction,
    SerializedGame,
    Question,
} from "../types/game";
import { GameStatus } from "../types/game";
import type { Player, PlayerAction } from "../types/player";
import { PlayerStatus, BettingAction } from "../types/player";
import type { Round, RoundResults, RoundWinner } from "../types/round";
import { RoundPhase } from "../types/round";
import type {
    GameEvent,
    GameEventType,
    EventHandler,
    GameCreatedData,
    GameStartedData,
    GameFinishedData,
    PlayerJoinedData,
    PlayerActionData,
    RoundStartedData,
} from "../types/events";
import type { User } from "../types/common";

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

    private getQuestion: GetQuestionFunction;
    private timers: Map<string, NodeJS.Timeout> = new Map();

    constructor(
        config: GameConfig,
        getQuestionFn: GetQuestionFunction,
        gameId?: string
    ) {
        super();

        this.id = gameId || this.generateId();
        this.config = {
            minPlayers: config.minPlayers ?? 2,
            maxPlayers: config.maxPlayers ?? 8,
            initialStack: config.initialStack ?? 1000,
            anteSize: config.anteSize ?? 50,
            ...config,
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

        this.emit("game_created", {
            game: this,
            creator: undefined,
        } as GameCreatedData);
    }

    /**
     * Добавить игрока в игру
     */
    public addPlayer(user: User): Player {
        if (this.status !== GameStatus.WAITING) {
            throw new Error("Нельзя добавить игрока - игра уже началась");
        }

        if (this.players.length >= this.config.maxPlayers) {
            throw new Error("Достигнуто максимальное количество игроков");
        }

        if (this.players.some((p) => p.user.id === user.id)) {
            throw new Error("Игрок уже в игре");
        }

        const player: Player = {
            id: this.generateId(),
            user,
            name: user.name,
            stack: this.config.initialStack,
            position: this.players.length,
            status: PlayerStatus.WAITING,
            currentBet: 0,
            totalBetInRound: 0,
            isAllIn: false,
            isDealer: this.players.length === 0, // Первый игрок становится дилером
            stats: {
                roundsPlayed: 0,
                roundsWon: 0,
                totalWinnings: 0,
                foldCount: 0,
                allInCount: 0,
                averageAccuracy: 0,
            },
        };

        this.players.push(player);

        this.emit("player_joined", {
            player,
            totalPlayers: this.players.length,
        } as PlayerJoinedData);

        return player;
    }

    /**
     * Удалить игрока из игры
     */
    public removePlayer(playerId: string): boolean {
        if (this.status === GameStatus.PLAYING) {
            throw new Error("Нельзя удалить игрока во время игры");
        }

        const playerIndex = this.players.findIndex((p) => p.id === playerId);
        if (playerIndex === -1) {
            return false;
        }

        this.players.splice(playerIndex, 1);

        // Пересчитываем позиции
        this.players.forEach((player, index) => {
            player.position = index;
        });

        return true;
    }

    /**
     * Начать игру
     */
    public async startGame(): Promise<void> {
        if (this.status !== GameStatus.WAITING) {
            throw new Error("Игра уже начата или завершена");
        }

        if (this.players.length < this.config.minPlayers) {
            throw new Error(
                `Недостаточно игроков. Минимум: ${this.config.minPlayers}`
            );
        }

        this.status = GameStatus.PLAYING;
        this.startedAt = new Date();

        // Устанавливаем случайного дилера
        this.dealerPosition = Math.floor(Math.random() * this.players.length);
        this.players.forEach((p) => (p.isDealer = false));
        this.players[this.dealerPosition].isDealer = true;

        this.emit("game_started", {
            game: this,
            startTime: this.startedAt,
        } as GameStartedData);

        await this.startNextRound();
    }

    /**
     * Обработать действие игрока
     */
    public async action(
        player: Player | string,
        actionType: BettingAction,
        amount?: number
    ): Promise<boolean> {
        if (this.status !== GameStatus.PLAYING) {
            throw new Error("Игра не активна");
        }

        const playerId = typeof player === "string" ? player : player.id;
        const gamePlayer = this.players.find((p) => p.id === playerId);

        if (!gamePlayer) {
            throw new Error("Игрок не найден");
        }

        const action: PlayerAction = {
            playerId,
            type: actionType,
            amount,
            timestamp: new Date(),
        };

        const isValid = this.validateAction(gamePlayer, action);

        if (isValid) {
            await this.processAction(gamePlayer, action);
        }

        this.emit("player_action", {
            player: gamePlayer,
            action,
            isValid,
            potBefore: this.currentRound?.pot.totalPot || 0,
            potAfter: this.currentRound?.pot.totalPot || 0,
        } as PlayerActionData);

        return isValid;
    }

    /**
     * Сериализация игры
     */
    public serialize(): SerializedGame {
        return {
            gameData: {
                id: this.id,
                config: this.config,
                status: this.status,
                players: this.players,
                currentRound: this.currentRound,
                roundNumber: this.roundNumber,
                dealerPosition: this.dealerPosition,
                roundHistory: this.roundHistory,
                createdAt: this.createdAt,
                startedAt: this.startedAt,
                finishedAt: this.finishedAt,
                totalPot: this.totalPot,
                gameStats: this.gameStats,
            },
            version: "1.0.0",
            serializedAt: new Date(),
        };
    }

    /**
     * Создать игру из сериализованных данных
     */
    public static createFromJSON(
        serializedData: SerializedGame,
        getQuestionFn: GetQuestionFunction
    ): Game {
        const game = new Game(
            serializedData.gameData.config,
            getQuestionFn,
            serializedData.gameData.id
        );

        // Восстанавливаем состояние
        game.status = serializedData.gameData.status;
        game.players = serializedData.gameData.players;
        game.currentRound = serializedData.gameData.currentRound;
        game.roundNumber = serializedData.gameData.roundNumber;
        game.dealerPosition = serializedData.gameData.dealerPosition;
        game.roundHistory = serializedData.gameData.roundHistory;
        game.startedAt = serializedData.gameData.startedAt;
        game.finishedAt = serializedData.gameData.finishedAt;
        game.totalPot = serializedData.gameData.totalPot;
        game.gameStats = serializedData.gameData.gameStats;

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
            activePlayers: this.getActivePlayers(),
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

        this.emit("round_started", {
            round,
            dealerPosition: this.dealerPosition,
            question: question.text,
        } as RoundStartedData);

        // Начинаем с фазы ANTE
        await this.processAntePhase();
    }

    /**
     * Обработка фазы ANTE
     */
    private async processAntePhase(): Promise<void> {
        if (!this.currentRound) return;

        const anteSize = this.currentRound.settings.anteSize;

        // Все активные игроки делают анте
        for (const player of this.currentRound.activePlayers) {
            const anteAmount = Math.min(player.stack, anteSize);
            player.stack -= anteAmount;
            player.currentBet = anteAmount;
            player.totalBetInRound = anteAmount;
            this.currentRound.pot.mainPot += anteAmount;
            this.currentRound.pot.totalPot += anteAmount;

            if (player.stack === 0) {
                player.isAllIn = true;
                player.status = PlayerStatus.ALL_IN;
            } else {
                player.status = PlayerStatus.ACTIVE;
            }
        }

        // Переходим к следующей фазе
        await this.nextPhase();
    }

    /**
     * Переход к следующей фазе
     */
    private async nextPhase(): Promise<void> {
        if (!this.currentRound) return;

        const phases = Object.values(RoundPhase);
        const currentIndex = phases.indexOf(this.currentRound.currentPhase);

        if (currentIndex < phases.length - 1) {
            const previousPhase = this.currentRound.currentPhase;
            this.currentRound.currentPhase = phases[currentIndex + 1];

            this.emit("phase_changed", {
                round: this.currentRound,
                previousPhase,
                newPhase: this.currentRound.currentPhase,
                reason: "automatic",
            });

            // Обрабатываем новую фазу
            await this.processCurrentPhase();
        }
    }

    /**
     * Обработка текущей фазы
     */
    private async processCurrentPhase(): Promise<void> {
        if (!this.currentRound) return;

        switch (this.currentRound.currentPhase) {
            case RoundPhase.QUESTION1:
                await this.processQuestionPhase();
                break;
            case RoundPhase.BETTING1:
            case RoundPhase.BETTING2:
            case RoundPhase.BETTING3:
                await this.processBettingPhase();
                break;
            case RoundPhase.QUESTION2:
                await this.processHintPhase();
                break;
            case RoundPhase.REVEAL:
                await this.processRevealPhase();
                break;
            case RoundPhase.SHOWDOWN:
                await this.processShowdownPhase();
                break;
            case RoundPhase.FINISHED:
                await this.finishRound();
                break;
        }
    }

    /**
     * Обработка фазы вопроса
     */
    private async processQuestionPhase(): Promise<void> {
        if (!this.currentRound?.question) return;

        this.emit("question_revealed", {
            round: this.currentRound,
            question: this.currentRound.question.text,
            timeToAnswer: 30,
        });

        // Автоматический переход через 30 секунд
        this.setTimer("question_timer", 30000, () => {
            this.nextPhase();
        });
    }

    /**
     * Обработка фазы подсказки
     */
    private async processHintPhase(): Promise<void> {
        // Показываем подсказку и автоматически переходим дальше
        setTimeout(() => {
            this.nextPhase();
        }, 5000); // 5 секунд на показ подсказки
    }

    /**
     * Обработка фазы раскрытия ответа
     */
    private async processRevealPhase(): Promise<void> {
        if (!this.currentRound?.question) return;

        this.emit("answer_revealed", {
            round: this.currentRound,
            correctAnswer: this.currentRound.question.correctAnswer,
            playerAnswers: this.currentRound.activePlayers
                .filter((p) => p.answer !== undefined)
                .map((p) => ({
                    playerId: p.id,
                    answer: p.answer!,
                    deviation: Math.abs(
                        this.currentRound!.question!.correctAnswer - p.answer!
                    ),
                })),
        });

        // Автоматический переход
        setTimeout(() => {
            this.nextPhase();
        }, 5000);
    }

    /**
     * Обработка фазы ставок
     */
    private async processBettingPhase(): Promise<void> {
        // Инициализируем betting round
        this.emit("betting_started", {
            round: this.currentRound!,
            phase: this.currentRound!.currentPhase,
            currentPlayer: this.getNextPlayerToAct()?.id || "",
            currentBet: this.getCurrentBet(),
            minRaise: this.config.anteSize,
        });

        // Betting логика будет обрабатываться через action() метод
    }

    /**
     * Обработка фазы showdown
     */
    private async processShowdownPhase(): Promise<void> {
        if (!this.currentRound) return;

        const winners = this.determineWinners();
        this.distributeWinnings(winners);

        this.emit("winners_determined", {
            round: this.currentRound,
            winners: winners.map((w) => ({
                playerId: w.playerId,
                winAmount: w.winAmount,
                accuracy: w.accuracy,
            })),
            totalDistributed: winners.reduce((sum, w) => sum + w.winAmount, 0),
        });

        setTimeout(() => {
            this.nextPhase();
        }, 3000);
    }

    /**
     * Завершение раунда
     */
    private async finishRound(): Promise<void> {
        if (!this.currentRound) return;

        this.currentRound.endTime = new Date();
        this.roundHistory.push(this.currentRound);

        // Обновляем статистику
        this.updateGameStats();

        // Проверяем условия завершения игры
        if (this.shouldEndGame()) {
            await this.endGame();
        } else {
            // Готовимся к следующему раунду
            this.prepareNextRound();
            setTimeout(() => {
                this.startNextRound();
            }, 5000);
        }
    }

    /**
     * Валидация действия игрока
     */
    private validateAction(player: Player, action: PlayerAction): boolean {
        if (!this.currentRound) return false;

        // Проверяем что это ход игрока
        const nextPlayer = this.getNextPlayerToAct();
        if (!nextPlayer || nextPlayer.id !== player.id) {
            return false;
        }

        // Проверяем что фаза подходящая для действия
        const bettingPhases = [
            RoundPhase.BETTING1,
            RoundPhase.BETTING2,
            RoundPhase.BETTING3,
        ];
        if (!bettingPhases.includes(this.currentRound.currentPhase)) {
            return false;
        }

        // Валидируем конкретное действие
        return this.validateSpecificAction(player, action);
    }

    /**
     * Валидация конкретного действия
     */
    private validateSpecificAction(
        player: Player,
        action: PlayerAction
    ): boolean {
        const currentBet = this.getCurrentBet();

        switch (action.type) {
            case BettingAction.CHECK:
                return player.currentBet === currentBet;

            case BettingAction.CALL:
                return player.currentBet < currentBet && player.stack > 0;

            case BettingAction.RAISE:
                return (
                    action.amount !== undefined &&
                    action.amount > currentBet &&
                    player.stack >= action.amount
                );

            case BettingAction.ALL_IN:
                return player.stack > 0;

            case BettingAction.FOLD:
                return true; // Всегда можно сбросить

            case BettingAction.ANSWER:
                return (
                    this.currentRound?.currentPhase === RoundPhase.QUESTION1 ||
                    this.currentRound?.currentPhase === RoundPhase.QUESTION2
                );

            default:
                return false;
        }
    }

    /**
     * Обработка действия игрока
     */
    private async processAction(
        player: Player,
        action: PlayerAction
    ): Promise<void> {
        if (!this.currentRound) return;

        switch (action.type) {
            case BettingAction.CHECK:
                // Ничего не делаем, просто переходим к следующему игроку
                break;

            case BettingAction.CALL:
                const callAmount = this.getCurrentBet() - player.currentBet;
                const actualCall = Math.min(callAmount, player.stack);
                player.stack -= actualCall;
                player.currentBet += actualCall;
                player.totalBetInRound += actualCall;
                this.currentRound.pot.mainPot += actualCall;
                this.currentRound.pot.totalPot += actualCall;

                if (player.stack === 0) {
                    player.isAllIn = true;
                    player.status = PlayerStatus.ALL_IN;
                }
                break;

            case BettingAction.RAISE:
                if (action.amount !== undefined) {
                    const raiseAmount = action.amount - player.currentBet;
                    player.stack -= raiseAmount;
                    player.currentBet = action.amount;
                    player.totalBetInRound += raiseAmount;
                    this.currentRound.pot.mainPot += raiseAmount;
                    this.currentRound.pot.totalPot += raiseAmount;
                }
                break;

            case BettingAction.ALL_IN:
                const allInAmount = player.stack;
                player.stack = 0;
                player.currentBet += allInAmount;
                player.totalBetInRound += allInAmount;
                this.currentRound.pot.mainPot += allInAmount;
                this.currentRound.pot.totalPot += allInAmount;
                player.isAllIn = true;
                player.status = PlayerStatus.ALL_IN;
                player.stats.allInCount++;
                break;

            case BettingAction.FOLD:
                player.status = PlayerStatus.FOLDED;
                player.stats.foldCount++;
                break;

            case BettingAction.ANSWER:
                if (action.answer !== undefined) {
                    player.answer = action.answer;
                }
                break;
        }

        // Добавляем действие в историю
        this.currentRound.actionHistory.push(action);

        // Проверяем завершена ли фаза ставок
        if (this.isBettingPhaseComplete()) {
            await this.nextPhase();
        }
    }

    /**
     * Определение победителей раунда
     */
    private determineWinners(): RoundWinner[] {
        if (!this.currentRound?.question) return [];

        const correctAnswer = this.currentRound.question.correctAnswer;
        const activePlayers = this.currentRound.activePlayers.filter(
            (p) => p.status !== PlayerStatus.FOLDED && p.answer !== undefined
        );

        if (activePlayers.length === 0) return [];

        // Вычисляем точность для каждого игрока
        const playersWithAccuracy = activePlayers.map((player) => ({
            player,
            deviation: Math.abs(correctAnswer - player.answer!),
            accuracy: Math.max(
                0,
                100 - Math.abs(correctAnswer - player.answer!)
            ),
        }));

        // Находим игрока(ов) с наименьшим отклонением
        const minDeviation = Math.min(
            ...playersWithAccuracy.map((p) => p.deviation)
        );
        const winners = playersWithAccuracy.filter(
            (p) => p.deviation === minDeviation
        );

        // Распределяем банк
        const totalPot = this.currentRound.pot.totalPot;
        const winAmountPerWinner = Math.floor(totalPot / winners.length);

        return winners.map((winner) => ({
            playerId: winner.player.id,
            winAmount: winAmountPerWinner,
            potType: "main" as const,
            accuracy: winner.accuracy,
            deviation: winner.deviation,
        }));
    }

    /**
     * Распределение выигрыша
     */
    private distributeWinnings(winners: RoundWinner[]): void {
        winners.forEach((winner) => {
            const player = this.players.find((p) => p.id === winner.playerId);
            if (player) {
                player.stack += winner.winAmount;
                player.stats.totalWinnings += winner.winAmount;
                player.stats.roundsWon++;
            }
        });
    }

    /**
     * Получить активных игроков
     */
    private getActivePlayers(): Player[] {
        return this.players.filter(
            (p) => p.stack > 0 || p.status !== PlayerStatus.ELIMINATED
        );
    }

    /**
     * Получить следующего игрока для действия
     */
    private getNextPlayerToAct(): Player | null {
        if (!this.currentRound) return null;

        // Находим активных игроков которые могут действовать
        const activePlayers = this.currentRound.activePlayers.filter(
            (p) => p.status === PlayerStatus.ACTIVE && !p.isAllIn
        );

        if (activePlayers.length === 0) return null;

        // Возвращаем первого активного игрока (можно усложнить логику)
        return activePlayers[0];
    }

    /**
     * Получить текущую ставку для уравнивания
     */
    private getCurrentBet(): number {
        if (!this.currentRound) return 0;
        return Math.max(
            ...this.currentRound.activePlayers.map((p) => p.currentBet)
        );
    }

    /**
     * Проверить завершена ли фаза ставок
     */
    private isBettingPhaseComplete(): boolean {
        if (!this.currentRound) return true;

        const activePlayers = this.currentRound.activePlayers.filter(
            (p) => p.status !== PlayerStatus.FOLDED
        );

        if (activePlayers.length <= 1) return true;

        const currentBet = this.getCurrentBet();
        const playersCanAct = activePlayers.filter(
            (p) => p.currentBet < currentBet && !p.isAllIn
        );

        return playersCanAct.length === 0;
    }

    /**
     * Вычислить размер анте для текущего раунда
     */
    private calculateAnteSize(): number {
        // Увеличиваем анте каждый раунд
        return this.config.anteSize * this.roundNumber;
    }

    /**
     * Проверить нужно ли завершать игру
     */
    private shouldEndGame(): boolean {
        const activePlayers = this.getActivePlayers();
        return activePlayers.length <= 1 || this.roundNumber >= 10; // Максимум 10 раундов
    }

    /**
     * Подготовка к следующему раунду
     */
    private prepareNextRound(): void {
        // Сдвигаем дилера
        this.dealerPosition = (this.dealerPosition + 1) % this.players.length;

        // Сбрасываем состояние игроков
        this.players.forEach((player) => {
            player.currentBet = 0;
            player.totalBetInRound = 0;
            player.answer = undefined;
            player.isAllIn = false;
            player.isDealer = false;

            if (player.stack <= 0) {
                player.status = PlayerStatus.ELIMINATED;
            } else {
                player.status = PlayerStatus.WAITING;
            }
        });

        // Устанавливаем нового дилера
        this.players[this.dealerPosition].isDealer = true;
    }

    /**
     * Завершение игры
     */
    private async endGame(): Promise<void> {
        this.status = GameStatus.FINISHED;
        this.finishedAt = new Date();

        // Определяем победителя
        const winner = this.players.reduce((prev, current) =>
            current.stack > prev.stack ? current : prev
        );

        this.emit("game_finished", {
            game: this,
            winner,
            finalStandings: [...this.players].sort((a, b) => b.stack - a.stack),
            duration:
                this.finishedAt.getTime() - (this.startedAt?.getTime() || 0),
        } as GameFinishedData);
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
        this.gameStats.totalBets += this.currentRound.actionHistory.filter(
            (a) =>
                [
                    BettingAction.CALL,
                    BettingAction.RAISE,
                    BettingAction.ALL_IN,
                ].includes(a.type)
        ).length;

        if (this.currentRound.pot.totalPot > this.gameStats.largestPot) {
            this.gameStats.largestPot = this.currentRound.pot.totalPot;
        }

        this.gameStats.totalFolds += this.currentRound.actionHistory.filter(
            (a) => a.type === BettingAction.FOLD
        ).length;
        this.gameStats.totalAllIns += this.currentRound.actionHistory.filter(
            (a) => a.type === BettingAction.ALL_IN
        ).length;
    }

    /**
     * Установить таймер
     */
    private setTimer(name: string, delay: number, callback: () => void): void {
        this.clearTimer(name);
        const timer = setTimeout(callback, delay);
        this.timers.set(name, timer);
    }

    /**
     * Очистить таймер
     */
    private clearTimer(name: string): void {
        const timer = this.timers.get(name);
        if (timer) {
            clearTimeout(timer);
            this.timers.delete(name);
        }
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
     * Очистка всех таймеров при уничтожении объекта
     */
    public destroy(): void {
        this.timers.forEach((timer) => clearTimeout(timer));
        this.timers.clear();
        this.removeAllListeners();
    }
}
