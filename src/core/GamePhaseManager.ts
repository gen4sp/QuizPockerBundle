/**
 * Менеджер для управления фазами игры
 */

import { EventEmitter } from "events";
import type { Round } from "../types/round";
import { RoundPhase } from "../types/round";
import type { Player } from "../types/player";
import type { Question } from "../types/common";

export class GamePhaseManager extends EventEmitter {
    private currentRound: Round | null = null;

    constructor() {
        super();
    }

    /**
     * Установить текущий раунд
     */
    public setCurrentRound(round: Round | null): void {
        this.currentRound = round;
    }

    /**
     * Получить текущую фазу
     */
    public getCurrentPhase(): RoundPhase | null {
        return this.currentRound?.currentPhase || null;
    }

    /**
     * Переход к следующей фазе
     */
    public async nextPhase(): Promise<void> {
        if (!this.currentRound) return;

        const phases = Object.values(RoundPhase);
        const currentIndex = phases.indexOf(this.currentRound.currentPhase);

        if (currentIndex >= 0 && currentIndex < phases.length - 1) {
            const previousPhase = this.currentRound.currentPhase;
            const newPhase = phases[currentIndex + 1];
            if (newPhase) {
                this.currentRound.currentPhase = newPhase;

                this.emit("phase_changed", {
                    round: this.currentRound,
                    previousPhase,
                    newPhase,
                    reason: "automatic",
                });

                // Обрабатываем новую фазу
                await this.processCurrentPhase();
            }
        }
    }

    /**
     * Обработка текущей фазы
     */
    public async processCurrentPhase(): Promise<void> {
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
                this.emit("round_finish_requested");
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

        // Автоматический переход через 30 секунд (будет управляться GameTimerManager)
    }

    /**
     * Обработка фазы подсказки
     */
    private async processHintPhase(): Promise<void> {
        if (!this.currentRound?.question) return;

        this.emit("hint_revealed", {
            round: this.currentRound,
            hint: "Подсказка для вопроса", // TODO: добавить поле hint в Question
        });

        // Показываем подсказку и автоматически переходим дальше (управляется GameTimerManager)
    }

    /**
     * Обработка фазы раскрытия ответа
     */
    private async processRevealPhase(): Promise<void> {
        if (!this.currentRound?.question) return;

        const playerAnswers = this.currentRound.activePlayers
            .filter((p) => p.answer !== undefined)
            .map((p) => ({
                playerId: p.id,
                answer: p.answer!,
                deviation: Math.abs(
                    this.currentRound!.question!.correctAnswer - p.answer!
                ),
            }));

        this.emit("answer_revealed", {
            round: this.currentRound,
            correctAnswer: this.currentRound.question.correctAnswer,
            playerAnswers,
        });

        // Автоматический переход (управляется GameTimerManager)
    }

    /**
     * Обработка фазы ставок
     */
    private async processBettingPhase(): Promise<void> {
        if (!this.currentRound) return;

        this.emit("betting_started", {
            round: this.currentRound,
            phase: this.currentRound.currentPhase,
        });
    }

    /**
     * Обработка фазы showdown
     */
    private async processShowdownPhase(): Promise<void> {
        if (!this.currentRound) return;

        this.emit("showdown_started", {
            round: this.currentRound,
            remainingPlayers: this.currentRound.activePlayers.filter(
                (p) => p.status !== "folded"
            ),
            correctAnswer: this.currentRound.question?.correctAnswer || 0,
        });

        // Автоматический переход (управляется GameTimerManager)
    }

    /**
     * Проверить завершена ли фаза ставок
     */
    public isBettingPhaseComplete(): boolean {
        if (!this.currentRound) return true;

        const activePlayers = this.currentRound.activePlayers.filter(
            (p) => p.status !== "folded"
        );

        if (activePlayers.length <= 1) return true;

        const currentBet = Math.max(
            ...this.currentRound.activePlayers.map((p) => p.currentBet)
        );
        const playersCanAct = activePlayers.filter(
            (p) => p.currentBet < currentBet && !p.isAllIn
        );

        return playersCanAct.length === 0;
    }

    /**
     * Завершить текущую фазу ставок
     */
    public async completeBettingPhase(): Promise<void> {
        if (this.isBettingPhaseComplete()) {
            await this.nextPhase();
        }
    }

    /**
     * Уничтожить менеджер
     */
    public destroy(): void {
        this.removeAllListeners();
        this.currentRound = null;
    }
}
