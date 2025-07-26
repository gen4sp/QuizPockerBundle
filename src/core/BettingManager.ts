/**
 * Менеджер для обработки ставок в игре
 */

import { EventEmitter } from "events";
import type { Player, PlayerAction } from "../types/player";
import { BettingAction, PlayerStatus } from "../types/player";
import type { Round, RoundPot } from "../types/round";

export class BettingManager extends EventEmitter {
    private currentRound: Round | null = null;
    private anteSize: number = 50;

    constructor(anteSize: number = 50) {
        super();
        this.anteSize = anteSize;
    }

    /**
     * Установить текущий раунд
     */
    public setCurrentRound(round: Round | null): void {
        this.currentRound = round;
    }

    /**
     * Обработка фазы ANTE
     */
    public async processAntePhase(): Promise<void> {
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

        this.emit("ante_collected", {
            round: this.currentRound,
            totalAnte: this.currentRound.pot.totalPot,
            playersCount: this.currentRound.activePlayers.length,
        });
    }

    /**
     * Валидация действия игрока
     */
    public validateAction(player: Player, action: PlayerAction): boolean {
        if (!this.currentRound) return false;

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
                    player.stack >= action.amount - player.currentBet
                );

            case BettingAction.ALL_IN:
                return player.stack > 0;

            case BettingAction.FOLD:
                return true; // Всегда можно сбросить

            case BettingAction.ANSWER:
                // Ответы на вопросы обрабатываются не здесь
                return false;

            default:
                return false;
        }
    }

    /**
     * Обработка действия игрока
     */
    public async processAction(
        player: Player,
        action: PlayerAction
    ): Promise<boolean> {
        if (!this.currentRound) return false;

        const isValid = this.validateAction(player, action);
        if (!isValid) return false;

        const potBefore = this.currentRound.pot.totalPot;

        switch (action.type) {
            case BettingAction.CHECK:
                // Ничего не делаем, просто переходим к следующему игроку
                break;

            case BettingAction.CALL:
                this.processCall(player);
                break;

            case BettingAction.RAISE:
                if (action.amount !== undefined) {
                    this.processRaise(player, action.amount);
                }
                break;

            case BettingAction.ALL_IN:
                this.processAllIn(player);
                break;

            case BettingAction.FOLD:
                this.processFold(player);
                break;
        }

        // Добавляем действие в историю
        this.currentRound.actionHistory.push(action);

        this.emit("player_action_processed", {
            player,
            action,
            potBefore,
            potAfter: this.currentRound.pot.totalPot,
            isValid,
        });

        return true;
    }

    /**
     * Обработка уравнивания ставки
     */
    private processCall(player: Player): void {
        if (!this.currentRound) return;

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
    }

    /**
     * Обработка повышения ставки
     */
    private processRaise(player: Player, raiseAmount: number): void {
        if (!this.currentRound) return;

        const totalBetAmount = raiseAmount - player.currentBet;
        player.stack -= totalBetAmount;
        player.currentBet = raiseAmount;
        player.totalBetInRound += totalBetAmount;
        this.currentRound.pot.mainPot += totalBetAmount;
        this.currentRound.pot.totalPot += totalBetAmount;

        if (player.stack === 0) {
            player.isAllIn = true;
            player.status = PlayerStatus.ALL_IN;
        }
    }

    /**
     * Обработка all-in
     */
    private processAllIn(player: Player): void {
        if (!this.currentRound) return;

        const allInAmount = player.stack;
        player.stack = 0;
        player.currentBet += allInAmount;
        player.totalBetInRound += allInAmount;
        this.currentRound.pot.mainPot += allInAmount;
        this.currentRound.pot.totalPot += allInAmount;
        player.isAllIn = true;
        player.status = PlayerStatus.ALL_IN;
        player.stats.allInCount++;
    }

    /**
     * Обработка фолда
     */
    private processFold(player: Player): void {
        player.status = PlayerStatus.FOLDED;
        player.stats.foldCount++;
    }

    /**
     * Получить текущую ставку для уравнивания
     */
    public getCurrentBet(): number {
        if (!this.currentRound) return 0;
        return Math.max(
            ...this.currentRound.activePlayers.map((p) => p.currentBet)
        );
    }

    /**
     * Получить следующего игрока для действия
     */
    public getNextPlayerToAct(): Player | null {
        if (!this.currentRound) return null;

        // Находим активных игроков которые могут действовать
        const activePlayers = this.currentRound.activePlayers.filter(
            (p) => p.status === PlayerStatus.ACTIVE && !p.isAllIn
        );

        if (activePlayers.length === 0) return null;

        // Простая логика - возвращаем первого активного игрока
        // TODO: Можно усложнить с учетом позиций и порядка ходов
        return activePlayers[0] || null;
    }

    /**
     * Проверить завершена ли фаза ставок
     */
    public isBettingComplete(): boolean {
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
     * Сбросить ставки для нового раунда
     */
    public resetBetsForNewRound(players: Player[]): void {
        players.forEach((player) => {
            player.currentBet = 0;
            player.totalBetInRound = 0;
            player.isAllIn = false;

            if (player.stack <= 0) {
                player.status = PlayerStatus.ELIMINATED;
            } else if (player.status !== PlayerStatus.FOLDED) {
                player.status = PlayerStatus.WAITING;
            }
        });
    }

    /**
     * Создать боковой банк для all-in ситуаций
     */
    public createSidePot(allInPlayer: Player): void {
        if (!this.currentRound) return;

        // Упрощенная логика создания боковых банков
        // TODO: Реализовать полную логику боковых банков
        const eligiblePlayers = this.currentRound.activePlayers
            .filter((p) => p.status !== PlayerStatus.FOLDED)
            .map((p) => p.id);

        const sidePot = {
            amount: allInPlayer.currentBet * eligiblePlayers.length,
            eligiblePlayers,
            createdBy: allInPlayer.id,
        };

        this.currentRound.pot.sidePots.push(sidePot);

        this.emit("side_pot_created", {
            round: this.currentRound,
            sidePot,
            allInPlayer: allInPlayer.id,
        });
    }

    /**
     * Получить статистику ставок для раунда
     */
    public getBettingStats(): any {
        if (!this.currentRound) return null;

        return {
            totalPot: this.currentRound.pot.totalPot,
            mainPot: this.currentRound.pot.mainPot,
            sidePots: this.currentRound.pot.sidePots.length,
            currentBet: this.getCurrentBet(),
            activePlayers: this.currentRound.activePlayers.filter(
                (p) => p.status === PlayerStatus.ACTIVE
            ).length,
            allInPlayers: this.currentRound.activePlayers.filter(
                (p) => p.isAllIn
            ).length,
            foldedPlayers: this.currentRound.activePlayers.filter(
                (p) => p.status === PlayerStatus.FOLDED
            ).length,
        };
    }

    /**
     * Уничтожить менеджер
     */
    public destroy(): void {
        this.removeAllListeners();
        this.currentRound = null;
    }
}
