import { Player } from './player';

export class Pot {
  total: number;

  constructor() {
    this.total = 0;
  }

  add(amount: number): void {
    this.total += amount;
  }

  distribute(winner: Player): void {
    winner.win(this.total);
    this.total = 0;
  }
}
