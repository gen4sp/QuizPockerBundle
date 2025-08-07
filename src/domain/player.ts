export class Player {
  readonly id: string;
  name: string;
  stack: number;
  currentBet: number;
  folded: boolean;

  constructor(id: string, name: string, stack: number) {
    this.id = id;
    this.name = name;
    this.stack = stack;
    this.currentBet = 0;
    this.folded = false;
  }

  bet(amount: number): number {
    if (this.folded) {
      throw new Error('Player has folded');
    }
    if (amount < 0) {
      throw new Error('Bet must be positive');
    }
    if (amount > this.stack) {
      throw new Error('Not enough chips');
    }
    this.stack -= amount;
    this.currentBet += amount;
    return amount;
  }

  fold(): void {
    this.folded = true;
  }

  win(amount: number): void {
    this.stack += amount;
  }

  resetForNextRound(): void {
    this.currentBet = 0;
    this.folded = false;
  }
}
