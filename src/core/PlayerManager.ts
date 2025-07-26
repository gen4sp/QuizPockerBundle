/**
 * Менеджер для управления игроками
 */

import { EventEmitter } from "events";
import type { Player } from "../types/player";
import { PlayerStatus } from "../types/player";
import type { User } from "../types/common";
import type { GameConfig } from "../types/game";

export class PlayerManager extends EventEmitter {
    private players: Player[] = [];
    private config: GameConfig;

    constructor(config: GameConfig) {
        super();
        this.config = config;
    }

    /**
     * Добавить игрока в игру
     */
    public addPlayer(user: User): Player {
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

        this.emit("player_added", {
            player,
            totalPlayers: this.players.length,
        });

        return player;
    }

    /**
     * Удалить игрока из игры
     */
    public removePlayer(playerId: string): boolean {
        const playerIndex = this.players.findIndex((p) => p.id === playerId);
        if (playerIndex === -1) {
            return false;
        }

        const removedPlayer = this.players[playerIndex];
        if (!removedPlayer) return false;

        this.players.splice(playerIndex, 1);

        // Пересчитываем позиции
        this.players.forEach((player, index) => {
            player.position = index;
        });

        // Если удаленный игрок был дилером, назначаем нового
        if (removedPlayer.isDealer && this.players.length > 0) {
            const firstPlayer = this.players[0];
            if (firstPlayer) {
                firstPlayer.isDealer = true;
            }
        }

        this.emit("player_removed", {
            playerId,
            player: removedPlayer,
        });

        return true;
    }

    /**
     * Получить игрока по ID
     */
    public getPlayer(playerId: string): Player | null {
        return this.players.find((p) => p.id === playerId) || null;
    }

    /**
     * Получить всех игроков
     */
    public getAllPlayers(): Player[] {
        return [...this.players];
    }

    /**
     * Получить активных игроков (не исключенных и не сбросивших)
     */
    public getActivePlayers(): Player[] {
        return this.players.filter(
            (p) =>
                p.status !== PlayerStatus.ELIMINATED &&
                p.status !== PlayerStatus.FOLDED &&
                p.stack > 0
        );
    }

    /**
     * Получить игроков в раунде (не сбросивших)
     */
    public getPlayersInRound(): Player[] {
        return this.players.filter(
            (p) =>
                p.status !== PlayerStatus.FOLDED &&
                p.status !== PlayerStatus.ELIMINATED
        );
    }

    /**
     * Обновить статус игрока
     */
    public updatePlayerStatus(
        playerId: string,
        newStatus: PlayerStatus
    ): boolean {
        const player = this.getPlayer(playerId);
        if (!player) return false;

        const previousStatus = player.status;
        player.status = newStatus;

        this.emit("player_status_changed", {
            playerId,
            previousStatus,
            newStatus,
        });

        return true;
    }

    /**
     * Установить ответ игрока
     */
    public setPlayerAnswer(playerId: string, answer: number): boolean {
        const player = this.getPlayer(playerId);
        if (!player) return false;

        (player as any).answer = answer;
        (player as any).lastActionTime = new Date();

        this.emit("player_answered", {
            playerId,
            answer,
        });

        return true;
    }

    /**
     * Установить дилера
     */
    public setDealer(playerId: string): boolean {
        // Убираем дилера у всех
        this.players.forEach((p) => (p.isDealer = false));

        // Устанавливаем нового дилера
        const dealer = this.players.find((p) => p.id === playerId);
        if (dealer) {
            dealer.isDealer = true;
            return true;
        }

        return false;
    }

    /**
     * Получить текущего дилера
     */
    public getDealer(): Player | null {
        return this.players.find((p) => p.isDealer) || null;
    }

    /**
     * Сдвинуть дилера к следующему игроку
     */
    public moveDealer(): Player | null {
        const currentDealer = this.getDealer();
        if (!currentDealer) {
            // Если дилера нет, назначаем первого игрока
            if (this.players.length > 0) {
                const firstPlayer = this.players[0];
                if (firstPlayer) {
                    firstPlayer.isDealer = true;
                    return firstPlayer;
                }
            }
            return null;
        }

        // Находим следующего активного игрока
        const activePlayers = this.getActivePlayers();
        if (activePlayers.length <= 1) return currentDealer;

        const currentIndex = activePlayers.findIndex(
            (p) => p.id === currentDealer.id
        );
        const nextIndex = (currentIndex + 1) % activePlayers.length;
        const nextDealer = activePlayers[nextIndex] || null;

        if (nextDealer) {
            // Убираем дилера у текущего
            currentDealer.isDealer = false;
            // Назначаем нового
            nextDealer.isDealer = true;

            this.emit("dealer_moved", {
                previousDealer: currentDealer.id,
                newDealer: nextDealer.id,
            });

            return nextDealer;
        }

        return currentDealer;
    }

    /**
     * Обновить статистику игрока
     */
    public updatePlayerStats(
        playerId: string,
        updates: Partial<Player["stats"]>
    ): boolean {
        const player = this.getPlayer(playerId);
        if (!player) return false;

        Object.assign(player.stats, updates);

        this.emit("player_stats_updated", {
            playerId,
            stats: player.stats,
        });

        return true;
    }

    /**
     * Сбросить состояние игроков для нового раунда
     */
    public resetPlayersForNewRound(): void {
        this.players.forEach((player) => {
            player.currentBet = 0;
            player.totalBetInRound = 0;
            player.isAllIn = false;

            // Проверяем статус игрока
            if (player.stack <= 0) {
                player.status = PlayerStatus.ELIMINATED;
            } else if (player.status === PlayerStatus.FOLDED) {
                player.status = PlayerStatus.WAITING;
            } else if (player.status !== PlayerStatus.ELIMINATED) {
                player.status = PlayerStatus.WAITING;
            }

            // Сбрасываем ответ (если есть поле)
            if ("answer" in player) {
                delete (player as any).answer;
            }
        });

        this.emit("players_reset_for_round", {
            totalPlayers: this.players.length,
            activePlayers: this.getActivePlayers().length,
        });
    }

    /**
     * Исключить игроков с нулевым стеком
     */
    public eliminatePlayersWithZeroStack(): Player[] {
        const eliminatedPlayers: Player[] = [];

        this.players.forEach((player) => {
            if (
                player.stack <= 0 &&
                player.status !== PlayerStatus.ELIMINATED
            ) {
                player.status = PlayerStatus.ELIMINATED;
                eliminatedPlayers.push(player);
            }
        });

        if (eliminatedPlayers.length > 0) {
            this.emit("players_eliminated", {
                eliminatedPlayers: eliminatedPlayers.map((p) => p.id),
                remainingPlayers: this.getActivePlayers().length,
            });
        }

        return eliminatedPlayers;
    }

    /**
     * Проверить достаточно ли игроков для начала игры
     */
    public hasEnoughPlayersToStart(): boolean {
        return this.getActivePlayers().length >= this.config.minPlayers;
    }

    /**
     * Проверить достаточно ли игроков для продолжения игры
     */
    public hasEnoughPlayersToContinue(): boolean {
        return this.getActivePlayers().length > 1;
    }

    /**
     * Получить рейтинг игроков по стеку
     */
    public getPlayerRankings(): Player[] {
        return [...this.players].sort((a, b) => b.stack - a.stack);
    }

    /**
     * Получить статистику по игрокам
     */
    public getPlayersStats(): any {
        const activePlayers = this.getActivePlayers();
        const eliminatedPlayers = this.players.filter(
            (p) => p.status === PlayerStatus.ELIMINATED
        );

        return {
            totalPlayers: this.players.length,
            activePlayers: activePlayers.length,
            eliminatedPlayers: eliminatedPlayers.length,
            averageStack:
                activePlayers.length > 0
                    ? Math.round(
                          activePlayers.reduce((sum, p) => sum + p.stack, 0) /
                              activePlayers.length
                      )
                    : 0,
            totalPot: this.players.reduce(
                (sum, p) => sum + p.totalBetInRound,
                0
            ),
            maxStack: Math.max(...this.players.map((p) => p.stack)),
            minStack: Math.min(...activePlayers.map((p) => p.stack)),
        };
    }

    /**
     * Получить игрока по пользователю
     */
    public getPlayerByUser(userId: string): Player | null {
        return this.players.find((p) => p.user.id === userId) || null;
    }

    /**
     * Проверить существует ли игрок
     */
    public hasPlayer(playerId: string): boolean {
        return this.players.some((p) => p.id === playerId);
    }

    /**
     * Получить следующего игрока по позиции
     */
    public getNextPlayer(currentPlayer: Player): Player | null {
        const activePlayers = this.getActivePlayers();
        if (activePlayers.length <= 1) return null;

        const currentIndex = activePlayers.findIndex(
            (p) => p.id === currentPlayer.id
        );
        if (currentIndex === -1) return null;

        const nextIndex = (currentIndex + 1) % activePlayers.length;
        return activePlayers[nextIndex] || null;
    }

    /**
     * Обновить конфигурацию
     */
    public updateConfig(newConfig: Partial<GameConfig>): void {
        this.config = { ...this.config, ...newConfig };
    }

    /**
     * Генерация ID
     */
    private generateId(): string {
        return (
            Math.random().toString(36).substring(2) + Date.now().toString(36)
        );
    }

    /**
     * Уничтожить менеджер
     */
    public destroy(): void {
        this.removeAllListeners();
        this.players = [];
    }
}
