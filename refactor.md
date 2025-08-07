# Refactoring Plan for QuizPoker Bundle

## 1. Introduction

This document outlines a plan to refactor the QuizPoker Bundle codebase. The goal of this refactoring is to improve the overall architecture of the project by moving from the current procedural, "manager"-based approach to a more object-oriented, rich domain model. This will result in a more maintainable, testable, and understandable codebase.

## 2. Problems with the Current Architecture

The current architecture is based on a set of "manager" classes (`PlayerManager`, `BettingManager`, etc.) that operate on simple data structures. This approach has led to several issues:

*   **Anemic Domain Model**: The core concepts of the game (`Player`, `Round`) are just data containers with no behavior. All the logic is in the manager classes, which leads to a procedural style of code.
*   **Low Cohesion**: Logic related to a single entity is scattered across multiple manager classes. For example, player-related logic is in `PlayerManager`, `BettingManager`, and the main `Game` class.
*   **High Coupling**: The `Game` class is a "god object" that knows about all the managers and is tightly coupled to them. The managers themselves are also coupled through the shared state they manipulate.
*   **Complex State Management**: It's difficult to track how the game state is modified because it is passed around and mutated by different managers.
*   **Poor Testability**: While individual managers can be unit tested, testing the interactions between them is complex due to their reliance on shared, mutable state.

## 3. Proposed New Architecture: Rich Domain Model

We will refactor the codebase to use a rich domain model, where data and the logic that operates on that data are encapsulated together in the same objects.

### 3.1. Core Domain Classes

The new architecture will be centered around the following core classes:

*   **`Player`**: Represents a single player in the game.
    *   **State**: `id`, `name`, `stack`, `status`, `hand`, `currentBet`, etc.
    *   **Behavior**: `bet()`, `call()`, `raise()`, `fold()`, `answer()`, `collectWinnings()`.
*   **`Round`**: Manages the logic and state for a single round of the game.
    *   **State**: `players`, `pot`, `phase`, `question`, `dealer`, `history`.
    *   **Behavior**: `start()`, `nextPhase()`, `playAction()`, `determineWinner()`, `distributeWinnings()`.
*   **`Pot`**: Encapsulates the logic for managing the pot, including main and side pots.
    *   **State**: `total`, `mainPot`, `sidePots`.
    *   **Behavior**: `addBet()`, `distribute()`, `createSidePot()`.
*   **`Game`**: The main class that orchestrates the overall game.
    *   **State**: `players` (a collection of `Player` objects), `currentRound`, `config`.
    *   **Behavior**: `start()`, `end()`, `nextRound()`.

### 3.2. Responsibilities of the New Classes

*   The **`Game`** class will be simplified. Its main role will be to manage the game's lifecycle (e.g., starting the game, creating new rounds) and hold the top-level state.
*   The **`Round`** class will contain most of the game's core logic. It will manage the sequence of phases within a round, handle player actions by delegating to the `Player` objects, and manage the `Pot`.
*   The **`Player`** class will be responsible for its own state and actions. For example, the `bet()` method on a `Player` object will contain the logic for reducing the player's stack and updating their bet.
*   The **`Pot`** class will handle all pot-related calculations, making it easier to implement complex logic like side pots correctly.

### 3.3. Elimination of Manager Classes

Most of the existing manager classes will be eliminated, and their logic will be moved into the new domain classes:

*   **`PlayerManager`**: Logic moved to `Game` (for managing the list of players) and `Player` (for player-specific logic).
*   **`BettingManager`**: Logic moved to `Round` (for managing the betting sequence) and `Player` (for executing bets).
*   **`GamePhaseManager`**: Logic moved to the `Round` class, which will have its own internal phase state machine.
*   **`WinnerDeterminator`**: This can be a stateless service or a method on the `Round` class.
*   **`GameValidator`**: Validation logic will be moved into the domain objects themselves (e.g., the `Player` class will validate if it can make a certain bet).

The `GameTimerManager` and `GameSerializer` can be kept but will be adapted to work with the new domain model.

## 4. Step-by-Step Refactoring Guide

Here is a suggested plan for carrying out the refactoring:

1.  **Create the new domain classes**: Start by creating the new `Player`, `Round`, and `Pot` classes with their state properties but no logic yet.
2.  **Migrate `Player` logic**:
    *   Start with the `Player` class. Move logic from `PlayerManager` into the `Player` class.
    *   For example, add methods like `increaseStack`, `decreaseStack`, `updateStatus` to the `Player` class.
3.  **Migrate `Pot` logic**:
    *   Create the `Pot` class and move all pot-related logic from `BettingManager` and `Game` into it.
4.  **Migrate `Round` logic**:
    *   This is the biggest step. Incrementally move logic from `Game`, `GamePhaseManager`, and `BettingManager` into the `Round` class.
    *   The `Round` class should be able to run a complete round of the game.
5.  **Simplify the `Game` class**:
    *   Once the `Round` class is functional, refactor the `Game` class to use it. The `Game` class will now delegate all round-related logic to the `Round` object.
6.  **Replace managers with new domain objects**:
    *   Go through the `Game` class and replace all usages of the old manager classes with the new domain objects.
7.  **Delete old manager classes**: Once the old manager classes are no longer used, delete them.
8.  **Refactor tests**: Update the unit tests to reflect the new architecture. Add new tests for the new domain classes.

## 5. Benefits of the New Architecture

*   **Improved Maintainability**: The code will be easier to understand and modify because related data and logic will be in the same place.
*   **Increased Cohesion and Reduced Coupling**: The new classes will be highly cohesive and loosely coupled, making the system more modular.
*   **Better Testability**: The new domain objects can be tested in isolation, which will simplify the testing process.
*   **Clearer Abstractions**: The new architecture will provide a more intuitive and powerful set of abstractions for representing the game's domain.
