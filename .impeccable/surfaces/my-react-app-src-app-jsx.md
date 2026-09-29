---
version: 1
slug: "my-react-app-src-app-jsx"
primary_target: "my-react-app/src/App.jsx"
related_targets: ["my-react-app/src/Solo.jsx","my-react-app/src/Multiplayer.jsx"]
---

# Surface brief: Quiz App (whole app: solo + multiplayer, every state)

Scope: replace the visual world across the entire app (shell, settings, question card, feedback, multiplayer menu, lobby, loading, leaderboard, results; light and dark). Behavior and copy are preserved; flow fixes (one-tap start, solo results) come later via distill/shape.
Mode: Operate. The visitor plays a round of trivia; reading a question and tapping an answer must never slow down.
Audience: recruiters and reviewers on a laptop or phone for about 90 seconds; secondary: friends on a call.
Must not feel: childish or cartoony; hard to read or play.
Constraints: WCAG 2.2 AA; correct and wrong never shown by colour alone; motion respects prefers-reduced-motion.

## Direction contract

THESIS: Every quiz is a timetable. Questions, room codes and scores arrive on a split-flap departure board hung on a station-hall wall. It refuses the category default of a gradient card with coloured answer tiles.

OWN-WORLD: The board is always matte black (#141413) with flap tiles (split top and bottom, a hairline seam) in off-white ink. Signal yellow #f7c21a appears only on "now": the current question, your row, and the one primary key. The status column uses green and red plus a glyph and a word. The hall wall is pale enamel grey in light mode and a night concourse in dark mode. Type is a condensed grotesk in caps for signage and flaps, and a readable grotesk for question text. There are no gradients, no glows, and no rounded SaaS cards.

STORY: The visitor understands at a glance that this is a quiz. The board makes it feel mechanical and alive, so they believe it was carefully made. Then they set up a quiz and play a round.

FIRST VIEWPORT: An enamel sign strip carries the name and the SOLO / MULTIPLAYER platform switch. Below it, the settings board: segmented flap selectors for difficulty and type, a flap counter for the number of questions, a category display, and a yellow Generate key at the bottom right of the board. Once playing, the question board shows a platform column (big flap "03 / 10"), a step row of cells (lit "now", ✓/✕ marks), the question in large type, answers as departure rows (letter tile · text · status column), and Prev/Next keys.

FORM: Split-flap departure board, #5 on my ordered list, seed e85806ac. Raises: yellow rationed to "now" (monochrome); every setting is a labeled switch (cassette); state carried by glyph and form (emission rail); a step-row progress navigator (drum machine); a strict numbered platform column (orizuru); boards as separate modules with gaps between them (cloud quarry). Signature interaction: the flap cascade. Codes, numbers and short labels flip character by character with a staggered tick. Question text never flips.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
