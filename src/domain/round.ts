import { Player } from "./player";
import { Pot } from "./pot";

export class Round {
    readonly players: Player[];
    readonly pot: Pot;
    private activeIndex: number;
    phase: "betting" | "showdown" | "finished" = "betting";

    constructor(players: Player[]) {
        this.players = players;
        this.pot = new Pot();
        this.activeIndex = 0;
    }

    start(): void {
        this.players.forEach((p) => p.resetForNextRound());
        this.activeIndex = 0;
    }

    get activePlayer(): Player {
        const player = this.players[this.activeIndex];
        if (!player) {
            throw new Error(`No player found at index ${this.activeIndex}`);
        }
        return player;
    }

    private ensurePlayerTurn(player: Player): void {
        if (this.activePlayer !== player) {
            throw new Error("Not this player's turn");
        }
    }

    bet(player: Player, amount: number): void {
        this.ensurePlayerTurn(player);
        const contributed = player.bet(amount);
        this.pot.add(contributed);
        this.nextPlayer();
    }

    fold(player: Player): void {
        this.ensurePlayerTurn(player);
        player.fold();
        this.nextPlayer();
    }

    award(winner: Player): void {
        this.pot.distribute(winner);
    }

    private nextPlayer(): void {
        const length = this.players.length;
        let next = (this.activeIndex + 1) % length;
        let attempts = 0;

        while (attempts < length) {
            const player = this.players[next];
            if (!player) {
                throw new Error(`No player found at index ${next}`);
            }

            if (!player.folded) {
                break;
            }

            next = (next + 1) % length;
            attempts++;

            if (next === this.activeIndex) {
                break;
            }
        }
        this.activeIndex = next;
    }
}
