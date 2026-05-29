# OpenCode Touch Client

A touch-first Expo / React Native client for OpenCode (an AI coding agent). The calm, native review-and-approve surface for work happening elsewhere: review sessions, approve permissions, accept or undo diffs, and share, from a phone.

## Design Context

Three documents define intent before you touch UI. Read the relevant one first.

- **PRODUCT.md** — strategic: register, users, purpose, brand personality, anti-references, design principles. Register is `product`.
- **DESIGN.md** — visual system: color tokens, typography, elevation, components, and forceful Do's/Don'ts. Tokens live in `src/constants/theme.ts` (`palette`, `colors`, `spacing`, `fonts`) and `colors.json`. The live-panel sidecar is `.impeccable/design.json`.
- **ARCHITECTURE.md** — technical: modules, data model, SDK flows, error strings, verification gates.

### North Star: "The Reading Room"

Calm, warm-dark, native iOS (Things / Ivory lineage). The agent's work is the hero; chrome recedes. Personality: calm, native, restrained.

### Hard guardrails (from DESIGN.md)

- **One accent.** Lamplight Lilac (`#edb2f1`) is for focus and active/selected state only. Never a button fill, never decoration.
- **Warm, never pure.** No `#000`/`#fff`. Floor is Warm Char (`#0a0706`), ceiling is Warm Paper (`#f6f0ef`).
- **Flat, tonal depth.** No shadows. Stack the four warm tonal steps (`#0a0706 → #100c0c → #191514 → #221e1d`) and use 1px hairline borders.
- **No side-stripe borders.** Never a `border-left`/`border-right` > 1px as a colored accent on rows or cards. Active = tonal step + status dot.
- **Mono for truth only.** Monospace (Menlo/monospace) is for code, diffs, tool names, addresses. System sans for all chrome.
- **Avoid:** default dev-tool blue, neon hacker green-on-black, enterprise-SaaS chrome (nested cards, dense dashboards).
- **Accessibility:** WCAG AA contrast (4.5:1 body text); pair status color with an icon or label.

## Verification

```bash
npm run typecheck
npm run lint
npm test -- --watch=false
```
