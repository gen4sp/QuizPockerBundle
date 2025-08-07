import { Player } from './player';
import { Pot } from './pot';

export class Round {
  readonly players: Player[];
  readonly pot: Pot;
  private activeIndex: number;

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
    return this.players[this.activeIndex];
  }

  private ensurePlayerTurn(player: Player): void {
    if (this.activePlayer !== player) {
      throw new Error('Not this player\'s turn');
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
    while (this.players[next].folded) {
      next = (next + 1) % length;
      if (next === this.activeIndex) {
        break;
      }
    }
    this.activeIndex = next;
  }
}
