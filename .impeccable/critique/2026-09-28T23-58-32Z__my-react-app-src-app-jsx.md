---
target: the whole app (solo + multiplayer)
total_score: 22
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 2
target_identity: "file:C:\\Users\\jacob\\Quiz-app\\Quiz-App\\my-react-app\\src\\App.jsx"
target_fingerprint: "sha256:ca9321ba61f053b0fe62cb3d18aa0982aa6f0e36085e1594e363f5fa2631fd80"
target_path: "C:\\Users\\jacob\\Quiz-app\\Quiz-App\\my-react-app\\src\\App.jsx"
timestamp: 2026-09-28T23-58-32Z
slug: my-react-app-src-app-jsx
---
# Critique: Quiz App (my-react-app/src/App.jsx: solo + multiplayer)
Method: dual-agent

## Design Health Score: 22/40 (Acceptable)
| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 2 | No aria-live; mobile question renders off-screen after Generate; "Score: 0/10" on Q1 |
| 2 | Match System / Real World | 3 | "Generate Questions" is developer language |
| 3 | User Control and Freedom | 2 | Solo dead-ends at the last question; regenerate wipes the quiz without asking |
| 4 | Consistency and Standards | 2 | Solo has no results screen but multiplayer does; incomplete ARIA tabs; h2 vs span titles |
| 5 | Error Prevention | 2 | Question-count field has no validation; destructive regenerate sits above the quiz |
| 6 | Recognition Rather Than Recall | 3 | Labelled settings; room code stays visible |
| 7 | Flexibility and Efficiency | 1 | A–D chips suggest shortcuts that don't exist; Enter doesn't submit the name |
| 8 | Aesthetic and Minimalist Design | 2 | Generic; settings card sits above every question |
| 9 | Error Recovery | 3 | Good copy, but not announced and focus doesn't move |
| 10 | Help and Documentation | 2 | Self-paced multiplayer and tie rules unexplained |

## Design Specificity Verdict
Category-interchangeable AI-template look: violet→sky gradient (App.css:17,197,411), radial glows (index.css:62), Inter, white 18px cards, 🧠 empty state. Detector: gradient-text App.css:18, overused-font index.css:1, layout-transition App.css:241 (minor), plus ai-color-palette, hairline+wide shadow, violet glow and low-contrast flags in the browser.

## Priority Issues
- [P0] Solo quiz has no ending (Solo.jsx:99, App.jsx:11 TODO). Fix: results panel with score, missed questions, Play again / Change settings, shared with the multiplayer results. /impeccable shape → delight
- [P1] WCAG AA failures: no live regions; focus goes to body after answering; --muted 3.5:1 (light) / 4.2:1 (dark); white on cyan gradient 2.1–2.8:1; green 3.3:1; incomplete tabs pattern. /impeccable harden → audit
- [P1] Generic look undercuts the portfolio pitch. Choose a trivia-specific world, display type, one accent. /impeccable bolder → typeset
- [P2] Slow path to first question: 4 settings / ~35 options; question below the fold on mobile; settings persist above play. One-tap Play plus Customize; scroll/focus to question. /impeccable distill → onboard
- [P3] Multiplayer results crowded (Multiplayer.jsx:243); lone host "wins"; Create and Join room equally weighted. /impeccable layout → clarify

## Persona Red Flags
Jordan: form-first, 25-option select, Generate seems to do nothing on mobile, dead end at Q10.
Sam: focus lost after answering, silent errors, fake tabs, colour-only answer buttons, weak focus ring (App.css:89), unlabeled code field.
Casey: off-screen question, a scroll per question, no reconnect (Multiplayer.jsx:73), easy to wipe the quiz.
Recruiter: template look, unfinished solo ending, Lighthouse contrast failures, multiplayer hidden, cold start shows only "Loading…".

## Minor Observations
useMemo deps (Solo.jsx:20); key={option} collisions; score denominator; shared settings state; code input accepts O/0/I/1; clipboard fallback; placeholder favicon/title; dark-mode repaint flash.

## Questions to Consider
- Why are a reviewer's first 20 seconds spent on a form?
- What if the question were the stage?
- Should multiplayer lead, with solo sharing its results flow?
