# Grid Race

An abstract turn-based strategy game built in Phaser 3 with Vite and TypeScript.

## Architecture

- **17x17 Grid Matrix**:
  - Even indices `(0, 2, ..., 16)` represent the 9x9 walkable board cells.
  - Odd indices `(1, 3, ..., 15)` represent wall slots and intersections.
- **Player 1**: Starts at `(16, 8)` with goal row `0`. Inventory: 5 walls.
- **Player 2 (CPU)**: Starts at `(0, 8)` with goal row `16`. Inventory: 5 walls.
- **Core Logic**:
  - `src/config/Constants.ts`: Grid dimensions, coordinate identifiers, start positions, and goal rows.
  - `src/logic/Board.ts`: 17x17 grid state representation, token movement validation (`canMoveToken`, `moveToken`), wall slot availability validation (`isWallSlotAvailable`), path validation, and jump move handling.

## Scripts

- `npm run dev`: Launch local Vite development server
- `npm run build`: Compile TypeScript and build for production
- `npm test`: Run unit test suite using Vitest

