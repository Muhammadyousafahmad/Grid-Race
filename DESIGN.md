# Grid Race Design System

## Direction

Grid Race is an orienteering checkpoint card made playable: two runners race
across one shared grid, and each wall redraws the route. The map and the match
choices lead; the interface stays quick to scan so players can start a game
without an intro or tutorial gate.

## Palette

| Token | Value | Use |
|---|---|---|
| `bg` | `#f4f0e4` | Warm map paper |
| `bgDeep` | `#e7e3d6` | Pressed paper and active controls |
| `surface` | `#faf8f0` | Route cards and board mount |
| `surfaceRaised` | `#e3e9dc` | Hovered cards and control surfaces |
| `border` | `#174a3f` | Forest-green cartography and strong structure |
| `borderSoft` | `#9cae9c` | Fine map and panel lines |
| `accent` | `#315ea8` | Blue runner and route |
| `danger` | `#b83d2d` | Vermilion runner, finish, and warnings |
| `success` | `#28724d` | Confirmed progress and success |
| `textPrimary` | `#173e37` | Main labels |
| `textSecondary` | `#405b4e` | Supporting copy |
| `textMuted` | `#587060` | Quiet but readable metadata |

Use shape and labels alongside color: the blue runner is round, the vermilion
runner is a diamond, and the finish is explicitly labeled.

## Dark mode

The menu's theme control switches between the paper palette and a persistent
night palette. The board, map, cards, browser selection, and page chrome all
follow the same setting.

| Token | Dark value |
|---|---|
| `bg` | `#14241f` |
| `surface` | `#192d26` |
| `surfaceRaised` | `#294338` |
| `map` | `#263e34` |
| `border` | `#c3d3c3` |
| `accent` | `#83b5ff` |
| `danger` | `#ff8875` |
| `success` | `#8dd7a0` |
| `textPrimary` | `#f3f5ed` |
| `textSecondary` | `#d4e0d6` |
| `textMuted` | `#b8cbbd` |

## Typography

- **Display and controls:** Space Grotesk, locally hosted as a variable font
  from weights 500–700.
- **Body and supporting text:** DM Sans, locally hosted as a variable font from
  weights 400–700.
- Keep the game name and match choices prominent; use concise supporting copy
  and avoid technical implementation language in player-facing text. Keep
  gameplay labels legible at phone size, not just at the desktop reference size.

The font files and their OFL notices live in `public/fonts/`. They are loaded
before Phaser starts because canvas text is rasterized.

## Surfaces and composition

- Keep the square 9 × 9 game board and its 800 × 800 reference coordinate
  system. Expand the visible scene around the board to use the available
  viewport without stretching or letterboxing the canvas.
- On wide screens, lead with four explicit match choices on the left and a
  literal route map on the right. On short wide screens, use a compact two-row
  choice grid beside the map. On portrait screens, stack choices and map
  vertically; compact the map decoration when vertical space is limited.
  Keep rules and keyboard shortcuts in the footer whenever they fit.
- Use square corners for map plates, cells, and primary selection rows.
- Reserve rounded corners for compact in-game controls.
- Keep the online-room flow and match HUD in the same paper-and-cartography
  palette.

## Interaction

- Preserve Easy, Medium, and Hard solo matches, online friend rooms, turn
  timing, movement, wall placement, and win conditions.
- Keep existing keyboard shortcuts and touch interactions.
- Use blue and vermilion as player identities, never as the only indication
  of an action or state.
- Make active, invalid, loading, and game-over states explicit in copy and
  shape as well as color.
