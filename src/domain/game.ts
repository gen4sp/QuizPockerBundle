import { Player } from './player';
import { Round } from './round';

export class Game {
  readonly players: Player[] = [];
  currentRound?: Round;

  addPlayer(id: string, name: string, stack: number): Player {
    const player = new Player(id, name, stack);
    this.players.push(player);
    return player;
  }

  startRound(): Round {
    const round = new Round(this.players);
    round.start();
    this.currentRound = round;
    return round;
  }
}
