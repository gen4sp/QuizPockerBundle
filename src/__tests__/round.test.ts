import { describe, it, expect } from 'vitest';
import { createGame } from '../index';

describe('round flow', () => {
  it('handles betting and pot distribution', () => {
    const game = createGame();
    const alice = game.addPlayer('1', 'Alice', 100);
    const bob = game.addPlayer('2', 'Bob', 100);
    const carol = game.addPlayer('3', 'Carol', 100);

    const round = game.startRound();

    round.bet(alice, 10);
    round.bet(bob, 10);
    round.fold(carol);

    expect(round.pot.total).toBe(20);

    round.award(alice);

    expect(alice.stack).toBe(110);
    expect(bob.stack).toBe(90);
    expect(carol.stack).toBe(100);
    expect(round.pot.total).toBe(0);
  });
});
