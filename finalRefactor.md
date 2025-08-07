# Final Refactoring Plan

## 1. Overview
This document summarizes the review of the current QuizPoker Bundle codebase and outlines the steps required to reach a fully working game server. The repository currently provides ~90% of the functionality but contains duplication, missing features and architectural inconsistencies.

## 2. Identified Problems
- **Manager-based architecture** leads to an anemic domain model. Logic is scattered across `Game`, `BettingManager`, `GamePhaseManager`, `PlayerManager` and `WinnerDeterminator`, causing tight coupling and complex state flow.
- **Duplicate validation and betting logic** exist in both `BettingManager` and `GameValidator` (`validateAction`, `getCurrentBet`, reset routines).
- **Player reset duplication** is present in `BettingManager.resetBetsForNewRound` and `PlayerManager.resetPlayersForNewRound`.
- **GameConfig gaps**: documentation expects options such as `maxRounds` and different ante growth formulas, but the type lacks these fields. Current ante calculation (`Math.max(1, Math.floor(roundNumber/3))`) deviates from docs.
- **Side pot handling** is incomplete (`BettingManager.createSidePot` has TODO and simplistic logic).
- **Timer integration** is partial: `Game` uses `setTimeout` to start the next round instead of `GameTimerManager`; question, betting and reveal phases lack automatic timer start/stop.
- **Phase management** duplicates responsibility between `GamePhaseManager` and `Game` (manual phase advance in Game vs. automatic in manager).
- **Game lifecycle methods** (`finishGame` vs `endGame`) duplicate functionality.
- **Placeholder code** for hint phase, player answer timestamps and question fields leads to inconsistent data.
- **Lack of domain classes**: Player and Round are plain data objects; pot logic and round transitions live outside, reducing cohesion.

## 3. Refactoring Plan
1. **Introduce Rich Domain Classes**
   - Implement `Player`, `Round` and `Pot` classes with encapsulated state and behavior (betting, answering, side pot distribution, phase transitions).
   - Move logic from managers into these classes; managers become thin or removed entirely.

2. **Consolidate Validation & Betting Logic**
   - Merge `GameValidator` and `BettingManager` responsibilities into domain methods (`Player.bet`, `Round.playAction`).
   - Remove duplicate `getCurrentBet` and reset functions.

3. **Rework Phase Handling**
   - Implement a state machine inside `Round` for all nine phases.
   - Remove `GamePhaseManager`; `Round` should start timers for each phase and emit events itself.

4. **Implement Pot and Side-Pot Mechanics**
   - Create a dedicated `Pot` class managing main/side pots and distributions.
   - Replace `BettingManager.createSidePot` placeholder with complete logic.

5. **Integrate Timers Properly**
   - Use `GameTimerManager` (or a simpler timer module) directly within `Round` to control question, betting and reveal timers.
   - Replace `setTimeout` in `Game` with timer-based round scheduling; ensure timers stop when the game ends.

6. **Expand & Align GameConfig**
   - Add `maxRounds`, `winCondition`, and ante progression settings consistent with docs.
   - Provide validation for new config fields and ensure `calculateAnteSize` respects the chosen formula.

7. **Simplify Game Class**
   - Delegate round flow to `Round` objects; `Game` focuses on lifecycle (start/nextRound/end).
   - Merge `finishGame` and `endGame` into one method.

8. **Improve Question & Answer Handling**
   - Extend `Question` type with optional `hint`/`hints` fields.
   - Record exact timestamps for answers; ensure `WinnerDeterminator` uses them if needed.

9. **Update Serialization & Tests**
   - Adapt `GameSerializer` to new domain classes and options.
   - Refactor unit tests to cover new behavior and remove obsolete manager tests.

10. **Clean Up Utilities**
   - Centralize ID generation and logger usage.
   - Ensure all `destroy` methods release resources and listeners.

## 4. Expected Outcome
Following this plan will eliminate duplicated code, align implementation with documentation, and yield a cohesive object-oriented game server ready for production use.
