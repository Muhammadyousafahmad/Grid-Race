# Grid Race

## Scope and visitor mode

The full browser game: intro, match selection, online-room flow, and live match. Experience: the playable tactical race leads.

## Audience and task

Casual strategy-game players want to start a quick solo match or play a friend. The opening must demonstrate the shared grid, runners, route choice, and wall detour; players then choose Easy, Medium, Hard, or an online room.

## Constraints

Preserve the 9x9 grid, movement and wall rules, turn timer, win conditions, all three CPU difficulties, peer-to-peer friend rooms, desktop and touch controls, the persistent light/dark theme control, and the 800x800 Phaser reference coordinate system. Expand the visible scene responsively around the square board; do not distort the board or introduce letterboxing. Do not make the intro a gate to play.

## Direction contract

THESIS: A route card becomes a race you can read at a glance: the runners share a real grid, and every wall changes the route to the far edge. Refuse the default neon tactical HUD and the generic menu of equal feature cards.

OWN-WORLD: The chosen direction is the printed orienteering checkpoint card. Use warm map paper, dark forest-green cartography, compass blue for one runner and route, vermilion for the rival and checkpoints, and restrained yellow for action. Use self-hosted Space Grotesk for route-scale headlines and DM Sans for readable controls and explanations. Make labels comfortably legible on phones as well as desktops. The board is an actual 9x9 map grid; labels and marks carry meaning without depending on color.

STORY: Players immediately understand that two runners race in opposite directions and that one move or wall can redraw the shortest route. They choose solo difficulty or a friend room without leaving the race world, then use the same legible route vocabulary in the match.

FIRST VIEWPORT: Keep the game name and a single two-line promise prominent. On wide screens, put four clearly named match choices to the left of a large square 9x9 route map, with distinctly shaped runners, a visible route, and one wall. Use a compact two-row choice grid beside a simplified map on short wide screens. On portrait screens, stack the match choices and map, simplifying the map when vertical space is short. Expand the scene into the available viewport without leaving empty side gutters, stretching the board, or shrinking text below a readable size.

FORM: Experience, code-led. Build candidate 2, the Orienteering Checkpoint Card (IMPECCABLE'S PICK), from the user's confirmed quick-match and tactical-clarity requirements. The user chose it over the assigned Velodrome Lap Board. SEED REFERENCE seed:e6265b4b08cbacf4. The interface and game rules are real; any route in a decorative preview is illustrative.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
