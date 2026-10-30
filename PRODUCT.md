# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Casual strategy-game players looking for quick solo matches or a 1v1 match with a friend.

## Product Purpose

Grid Race is a quick-to-learn tactical race where each move or wall can change the route to victory. Success is a satisfying, readable match that rewards planning without making the rules hard to pick up.

## Positioning

Players race across a shared grid while spending a limited supply of walls to shape routes and outmaneuver an opponent. Every wall changes the strategic path without removing the requirement that both players retain a route to their goal.

## Operating Context

Players choose a solo CPU difficulty or create/join an online room to play a friend. During a match, they move a token toward the opposite edge or place a wall to redirect the race. The game supports desktop and touch devices.

## Capabilities and Constraints

- Preserve the existing 9x9 board, movement and wall-placement rules, and win conditions.
- Preserve solo Easy, Medium, and Hard CPU choices.
- Preserve online friend rooms and the existing turn-based match flow.
- Support desktop and touch-device play.

## Evidence on Hand

- Current game scenes and interactions: `src/scenes/IntroScene.ts`, `src/scenes/MenuScene.ts`, and `src/scenes/GameScene.ts`.
- Current board rules and configuration: `src/logic/Board.ts` and `src/config/Constants.ts`.
- Existing play modes and descriptions: `src/scenes/MenuScene.ts`.
- No separately supplied brand assets or external product proof.

## Product Principles

- Make the goal and next useful action easy to understand.
- Keep tactical choices consequential and fair.
- Let players start a quick match while keeping friend play easy to find.
- Preserve clear, usable controls across desktop and touch devices.
