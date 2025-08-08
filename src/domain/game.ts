import { Player } from "./player";
import { Round } from "./round";

export class Game {
    readonly players: Player[] = [];
    currentRound?: Round;
    status: "waiting" | "playing" | "finished" = "waiting";
    createdAt: Date = new Date();

    addPlayer(player: Player): void;
    addPlayer(id: string, name: string, stack?: number): Player;
    addPlayer(
        playerOrId: Player | string,
        name?: string,
        stack: number = 1000
    ): Player | void {
        if (playerOrId instanceof Player) {
            this.players.push(playerOrId);
            return;
        }

        const player = new Player(playerOrId, name!, stack);
        this.players.push(player);
        return player;
    }

    startGame(): void {
        if (this.players.length < 2) {
            throw new Error("Need at least 2 players to start game");
        }
        this.status = "playing";
        this.startRound();
    }

    startRound(): Round {
        const round = new Round(this.players);
        round.start();
        this.currentRound = round;
        return round;
    }

    handlePlayerAction(player: Player, action: any): void {
        if (!this.currentRound) {
            throw new Error("No active round");
        }

        // Базовая обработка действий - можно расширить
        switch (action.type) {
            case "bet":
                this.currentRound.bet(player, action.amount);
                break;
            case "fold":
                this.currentRound.fold(player);
                break;
            case "call":
                // Логика call
                break;
            case "check":
                // Логика check
                break;
            default:
                throw new Error(`Unknown action type: ${action.type}`);
        }
    }

    serialize(): any {
        return {
            players: this.players.map((p) => ({
                id: p.id,
                name: p.name,
                stack: p.stack,
                currentBet: p.currentBet,
                folded: p.folded,
            })),
            status: this.status,
            createdAt: this.createdAt,
            currentRound: this.currentRound
                ? {
                      phase: this.currentRound.phase,
                      pot: this.currentRound.pot.total,
                  }
                : null,
        };
    }
}
