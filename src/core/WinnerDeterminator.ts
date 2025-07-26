/**
 * Менеджер для определения победителей и распределения банка
 */

import { EventEmitter } from "events";
import type { Player } from "../types/player";
import { PlayerStatus } from "../types/player";
import type { Round, RoundWinner, PlayerAnswer } from "../types/round";

export interface WinnerDistribution {
    winners: RoundWinner[];
    totalDistributed: number;
    remainingPot: number;
}

export class WinnerDeterminator extends EventEmitter {
    constructor() {
        super();
    }

    /**
     * Определить победителей раунда
     */
    public determineWinners(round: Round): RoundWinner[] {
        if (!round.question) return [];

        const correctAnswer = round.question.correctAnswer;
        const activePlayers = round.activePlayers.filter(
            (p) => p.status !== PlayerStatus.FOLDED && p.answer !== undefined
        );

        if (activePlayers.length === 0) return [];

        // Вычисляем точность для каждого игрока
        const playersWithAccuracy = activePlayers.map((player) => ({
            player,
            deviation: Math.abs(correctAnswer - player.answer!),
            accuracy: this.calculateAccuracy(correctAnswer, player.answer!),
        }));

        // Находим игрока(ов) с наименьшим отклонением
        const minDeviation = Math.min(
            ...playersWithAccuracy.map((p) => p.deviation)
        );
        const winners = playersWithAccuracy.filter(
            (p) => p.deviation === minDeviation
        );

        // Распределяем банк
        const totalPot = round.pot.totalPot;
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
     * Определить победителей с учетом боковых банков
     */
    public determineWinnersWithSidePots(round: Round): WinnerDistribution {
        const mainWinners = this.determineWinners(round);
        let totalDistributed = 0;

        // Обрабатываем основной банк
        totalDistributed += mainWinners.reduce(
            (sum, w) => sum + w.winAmount,
            0
        );

        // Обрабатываем боковые банки
        const sidePotWinners: RoundWinner[] = [];
        for (const sidePot of round.pot.sidePots) {
            const eligiblePlayers = round.activePlayers.filter(
                (p) =>
                    sidePot.eligiblePlayers.includes(p.id) &&
                    p.status !== PlayerStatus.FOLDED &&
                    p.answer !== undefined
            );

            if (eligiblePlayers.length > 0) {
                const sidePotWinner = this.determineSidePotWinner(
                    eligiblePlayers,
                    round.question?.correctAnswer || 0,
                    sidePot.amount
                );
                if (sidePotWinner) {
                    sidePotWinners.push(sidePotWinner);
                    totalDistributed += sidePotWinner.winAmount;
                }
            }
        }

        const allWinners = [...mainWinners, ...sidePotWinners];
        const remainingPot = round.pot.totalPot - totalDistributed;

        return {
            winners: allWinners,
            totalDistributed,
            remainingPot,
        };
    }

    /**
     * Определить победителя бокового банка
     */
    private determineSidePotWinner(
        eligiblePlayers: Player[],
        correctAnswer: number,
        potAmount: number
    ): RoundWinner | null {
        if (eligiblePlayers.length === 0) return null;

        // Находим игрока с наименьшим отклонением
        let bestPlayer = eligiblePlayers[0];
        if (!bestPlayer) return null;
        let minDeviation = Math.abs(correctAnswer - (bestPlayer.answer || 0));

        for (const player of eligiblePlayers.slice(1)) {
            const deviation = Math.abs(correctAnswer - (player.answer || 0));
            if (deviation < minDeviation) {
                minDeviation = deviation;
                bestPlayer = player;
            }
        }

        return {
            playerId: bestPlayer.id,
            winAmount: potAmount,
            potType: "side" as const,
            accuracy: this.calculateAccuracy(
                correctAnswer,
                bestPlayer.answer || 0
            ),
            deviation: minDeviation,
        };
    }

    /**
     * Распределить выигрыш игрокам
     */
    public distributeWinnings(players: Player[], winners: RoundWinner[]): void {
        for (const winner of winners) {
            const player = players.find((p) => p.id === winner.playerId);
            if (player) {
                player.stack += winner.winAmount;
                player.stats.totalWinnings += winner.winAmount;
                player.stats.roundsWon++;

                this.emit("winnings_distributed", {
                    playerId: player.id,
                    amount: winner.winAmount,
                    newStack: player.stack,
                    accuracy: winner.accuracy,
                });
            }
        }
    }

    /**
     * Создать результаты ответов игроков
     */
    public createPlayerAnswers(round: Round): PlayerAnswer[] {
        if (!round.question) return [];

        const correctAnswer = round.question.correctAnswer;
        return round.activePlayers
            .filter((p) => p.answer !== undefined)
            .map((player) => ({
                playerId: player.id,
                answer: player.answer!,
                answeredAt: new Date(), // TODO: использовать реальное время ответа
                accuracy: this.calculateAccuracy(correctAnswer, player.answer!),
                deviation: Math.abs(correctAnswer - player.answer!),
                inShowdown: player.status !== PlayerStatus.FOLDED,
            }));
    }

    /**
     * Вычислить точность ответа
     */
    public calculateAccuracy(
        correctAnswer: number,
        playerAnswer: number
    ): number {
        const deviation = Math.abs(correctAnswer - playerAnswer);

        // Простая формула точности: 100% - процент отклонения
        // Максимальное отклонение считается как correctAnswer (если ответ в 2 раза больше или 0)
        const maxDeviation = Math.max(correctAnswer, 100); // минимум 100 для нормализации
        const accuracy = Math.max(0, 100 - (deviation / maxDeviation) * 100);

        return Math.round(accuracy * 100) / 100; // округляем до 2 знаков
    }

    /**
     * Найти лучший ответ среди игроков
     */
    public findBestAnswer(
        players: Player[],
        correctAnswer: number
    ): Player | null {
        const playersWithAnswers = players.filter(
            (p) => p.answer !== undefined && p.status !== PlayerStatus.FOLDED
        );

        if (playersWithAnswers.length === 0) return null;

        let bestPlayer = playersWithAnswers[0];
        if (!bestPlayer) return null;
        let minDeviation = Math.abs(correctAnswer - (bestPlayer.answer || 0));

        for (const player of playersWithAnswers.slice(1)) {
            const deviation = Math.abs(correctAnswer - (player.answer || 0));
            if (deviation < minDeviation) {
                minDeviation = deviation;
                bestPlayer = player;
            }
        }

        return bestPlayer;
    }

    /**
     * Получить статистику точности для раунда
     */
    public getAccuracyStats(round: Round): any {
        if (!round.question) return null;

        const correctAnswer = round.question.correctAnswer;
        const playersWithAnswers = round.activePlayers.filter(
            (p) => p.answer !== undefined
        );

        if (playersWithAnswers.length === 0) return null;

        const accuracies = playersWithAnswers.map((p) =>
            this.calculateAccuracy(correctAnswer, p.answer!)
        );

        const averageAccuracy =
            accuracies.reduce((sum, acc) => sum + acc, 0) / accuracies.length;
        const maxAccuracy = Math.max(...accuracies);
        const minAccuracy = Math.min(...accuracies);

        return {
            correctAnswer,
            totalAnswers: playersWithAnswers.length,
            averageAccuracy: Math.round(averageAccuracy * 100) / 100,
            maxAccuracy,
            minAccuracy,
            answersRange: {
                min: Math.min(...playersWithAnswers.map((p) => p.answer!)),
                max: Math.max(...playersWithAnswers.map((p) => p.answer!)),
            },
        };
    }

    /**
     * Проверить есть ли ничья
     */
    public hasTie(round: Round): boolean {
        if (!round.question) return false;

        const winners = this.determineWinners(round);
        return winners.length > 1;
    }

    /**
     * Обновить статистику точности игрока
     */
    public updatePlayerAccuracyStats(player: Player, accuracy: number): void {
        const totalRoundsWithAnswers = player.stats.roundsPlayed;
        if (totalRoundsWithAnswers === 0) {
            player.stats.averageAccuracy = accuracy;
        } else {
            // Обновляем средневзвешенную точность
            const currentTotal =
                player.stats.averageAccuracy * totalRoundsWithAnswers;
            player.stats.averageAccuracy =
                (currentTotal + accuracy) / (totalRoundsWithAnswers + 1);
        }
    }

    /**
     * Уничтожить определитель
     */
    public destroy(): void {
        this.removeAllListeners();
    }
}
