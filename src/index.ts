/**
 * QuizPoker Bundle - Main API Export
 */
import { Game, Player, Pot, Round } from './domain';

export { Game, Player, Pot, Round };

export function createGame(): Game {
  return new Game();
}

const QuizPoker = { createGame };

export default QuizPoker;
