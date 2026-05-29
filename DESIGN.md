---
name: OpenCode Touch Client
description: A calm, native review-and-approve surface for an AI coding agent, on the phone.
colors:
  # Neutral ramp ("smoke") — warm-tinted, never pure black
  surface-base: "#0a0706"      # app background, the deepest warm char
  surface-raised: "#100c0c"    # cards, composer, raised surfaces
  surface-overlay: "#191514"   # inputs, chips, bubbles, nested rows
  border: "#221e1d"            # hairline borders, strongest tonal step
  text-primary: "#c8c3c1"      # body text
  text-strong: "#f6f0ef"       # headings and emphasis (warm paper)
  text-muted: "#7e7978"        # secondary and meta text
  text-faint: "#4b4646"        # placeholders, faint labels, disabled
  interactive: "#969190"       # neutral action surface (buttons, FAB, send)
  # Accent ("lilac") — the single distinctive note
  accent: "#edb2f1"            # focus rings, active/selected state
  accent-muted: "#8f6192"      # muted accent
  accent-bg: "#160e17"         # subtle tinted active background
  # Status
  success: "#12c905"           # online / active dots
  warning: "#fcd53a"           # reconnecting / running tool
  danger: "#fc533a"            # errors, stop, delete, offline
  # Diff
  diff-add: "#8ebc8a"          # added line + stat (muted sage)
  diff-remove: "#ff785f"       # removed line + stat (soft ember)
  diff-add-bg: "#192918"       # added line background
  diff-remove-bg: "#440e07"    # removed line background
typography:
  headline:
    fontFamily: "System"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.2
  title:
    fontFamily: "System"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "System"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "System"
    fontSize: "12px"
    fontWeight: 500
    letterSpacing: "1px"
  mono:
    fontFamily: "Menlo, monospace"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.4
rounded:
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "12px"
  "2xl": "14px"
  bubble: "18px"
  full: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  xxl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.interactive}"
    textColor: "{colors.surface-base}"
    rounded: "{rounded.lg}"
    padding: "12px 16px"
    typography: "{typography.body}"
  input:
    backgroundColor: "{colors.surface-overlay}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.lg}"
    padding: "10px 12px"
    typography: "{typography.body}"
  card:
    backgroundColor: "{colors.surface-raised}"
    rounded: "{rounded.xl}"
    padding: "14px"
  list-item:
    backgroundColor: "{colors.surface-raised}"
    rounded: "{rounded.xl}"
    padding: "12px"
  chip:
    backgroundColor: "{colors.surface-overlay}"
    textColor: "{colors.text-muted}"
    rounded: "{rounded.sm}"
    padding: "6px 10px"
  bubble-user:
    backgroundColor: "{colors.surface-overlay}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.bubble}"
    padding: "10px 14px"
    typography: "{typography.body}"
  send-button:
    backgroundColor: "{colors.interactive}"
    rounded: "{rounded.full}"
    size: "44px"
  fab:
    backgroundColor: "{colors.interactive}"
    rounded: "{rounded.full}"
    size: "56px"
---

# Design System: OpenCode Touch Client

## 1. Overview

**Creative North Star: "The Reading Room"**

A quiet, warm, low-lit room where you go to read and judge work that was done elsewhere. The agent's output is the hero on the page; the application is the lamp and the desk, not the subject. Everything is rendered with native-iOS precision (the lineage is Things and Ivory), so the calm never reads as unfinished. The single soft lilac in the system is the reading lamp: it appears only where your attention currently rests.

The surface is warm-dark and never black. The neutral ramp ("smoke") is tinted toward warm char, so the screen feels like dim room-light rather than a cold terminal. Depth is built from four tonal steps, not shadows. Typography is system-native and quiet; monospace is reserved strictly for literal machine text (code, diffs, tool names, server addresses) so that "this is the machine talking" is legible at a glance. Color beyond the neutrals is rationed: lilac for state, and three status hues (green, amber, ember) that always travel with an icon or label so meaning never rides on hue alone.

This system explicitly rejects the generic developer-tool look. No default dev-tool blue (cobalt was deliberately retired in favor of lilac). No neon hacker green-on-black. No enterprise-SaaS chrome: no nested cards, no dense dashboards, no busy toolbars. When a screen feels heavy, the answer is to remove chrome, not to add an accent.

**Key Characteristics:**
- Warm-dark, never black: a four-step tonal system anchored at warm char (#0a0706).
- One accent, rationed: Lamplight Lilac (#edb2f1) for focus and active state only.
- Flat by design: depth comes from tone, never from shadow.
- The work unboxed: assistant output and diffs get the full canvas; only the user's own messages are contained.
- Tactile but quiet motion: a single press-scale spring, no bounce.
- Native posture: system type, platform gestures (swipe-to-delete, bottom sheets), safe-area aware, ≥44px touch targets.

## 2. Colors: The Lamplight Palette

A warm near-black canvas, a single lilac for focus, and a tightly rationed status set. The neutrals carry every surface; color is the exception, not the rule.

### Primary
- **Lamplight Lilac** (#edb2f1): the one distinctive note. Focus rings on inputs, the active tab tint, selected rows, the caret/selection color. It marks where attention is, never decoration. Muted form **Twilight Lilac** (#8f6192) and a near-black tint **Lilac Veil** (#160e17) back a selected row.

### Neutral
- **Warm Char** (#0a0706): the app background and the deepest step. Also the dark icon/label on top of the interactive gray.
- **Raised Char** (#100c0c): cards, the composer, and any surface lifted one step off the base.
- **Overlay Char** (#191514): inputs, chips, message bubbles, and nested list rows.
- **Hairline** (#221e1d): 1px borders and dividers, the strongest tonal step.
- **Interactive Gray** (#969190): the neutral action surface for primary buttons, the send button, and the FAB.
- **Ash** (#c8c3c1): primary body text on dark surfaces.
- **Warm Paper** (#f6f0ef): headings and emphasis. This is the lightest value in the system; it stands in for white.
- **Smoke** (#7e7978) / **Faint Smoke** (#4b4646): secondary/meta text and placeholders.

### Status (always paired with an icon or label, never color-only)
- **Signal Green** (#12c905): online and active-session dots.
- **Amber** (#fcd53a): reconnecting state and running tool calls.
- **Alert Ember** (#fc533a): errors, the stop action, destructive delete, offline banner.

### Diff
- **Muted Sage** (#8ebc8a) on **Sage Wash** (#192918): additions. Line text uses the lighter sage tint (#d2f2cf).
- **Soft Ember** (#ff785f) on **Ember Wash** (#440e07): deletions. Line text uses the lighter ember tint (#ffc8b4).

### Named Rules
**The One Lamp Rule.** Lamplight Lilac is reserved for focus and active/selected state. It is never a button fill, never a heading color, never decoration. If more than a few elements glow lilac on one screen, you have overused the lamp.

**The Warm Char Rule.** Never `#000` or `#fff`. The floor is Warm Char (#0a0706) and the ceiling is Warm Paper (#f6f0ef). Every neutral is tinted warm; a cold gray will look broken next to the rest.

## 3. Typography

**UI Font:** System (San Francisco on iOS, Roboto on Android)
**Machine Font:** Menlo on iOS, monospace on Android

**Character:** Quiet and native. The interface speaks in the platform's own voice so it never calls attention to itself; the monospace voice is reserved for the machine, which makes code and output instantly recognizable as "not chrome."

### Hierarchy
- **Headline** (600, 20px, line-height 1.2): screen titles ("Review Changes") and the top heading inside rendered markdown.
- **Title** (600, 16px, line-height 1.3): navigation header titles, modal/sheet titles, the connection server name.
- **Body** (400, 14px, line-height ~1.45): the default. Message text, input text, list titles, rendered markdown body.
- **Label** (500, 12px, letter-spacing 1px, uppercase): section headers above cards ("CONNECTION", "SAVED SERVERS") and sheet section titles.
- **Mono** (400, 12px, line-height 1.4): code blocks, inline code, diff lines, tool names, server addresses. The line-height stays tight so dense output reads as a block.
- **Caption** (400, 11px): timestamps, hints, sublabels. The quietest text; always Smoke or fainter.

### Named Rules
**The Mono-for-Truth Rule.** Monospace means "this is literal machine text": code, diffs, tool names, addresses. Never use it for UI chrome, labels, or prose. Never use System sans for code.

## 4. Elevation

Flat by design. There are no drop shadows anywhere in the system. Navigation headers explicitly null out their shadow (`shadowColor: transparent`, `elevation: 0`), and every other surface follows. Depth is communicated entirely through warm tonal layering and hairline borders.

The depth ladder, base to top:
1. **Warm Char** (#0a0706): the screen.
2. **Raised Char** (#100c0c): a card or the composer sitting on the screen.
3. **Overlay Char** (#191514): an input, chip, or bubble sitting inside a card.
4. **Hairline** (#221e1d): a 1px border drawing the edge where tone alone is not enough.

Modals and bottom sheets sit over a `rgba(0,0,0,0.5)` scrim; the scrim, not a shadow, conveys that the sheet floats.

### Named Rules
**The Flat, Tonal Rule.** Never add a shadow to create depth. Move one step up the tonal ladder instead. If two stacked surfaces are hard to tell apart, the fix is a hairline border, not elevation.

## 5. Components

Components are quiet at rest and tactile on touch. The shared press feedback is a single spring scaling to 0.97 with zero bounce; that, not color or shadow, is how the UI feels alive. Every interactive element carries a touch target of at least 44px.

### Buttons
- **Shape:** gently rounded (10px), pill for icon-only actions (the 44px send button and 56px FAB are full-radius circles).
- **Primary:** Interactive Gray (#969190) fill with dark Warm Char (#0a0706) text/icon. Quiet and neutral, never the accent.
- **Disabled:** drop to 0.3–0.5 opacity; no color change.
- **Ghost / text:** Smoke text, no fill (the "Cancel Edit", "Expand all", "Jump to latest" actions).

### Inputs
- **Style:** Overlay Char (#191514) fill, 1px transparent border, 10px radius, comfortable 10–12px padding.
- **Focus:** the border becomes Lamplight Lilac (#edb2f1). No glow, no shadow, just the lamp. Selection/caret color is also the accent.
- **Placeholder:** Faint Smoke.

### Chips
- **Model chip / sort chip:** Overlay Char fill, small radius (6px), tight padding. Carries a value plus a chevron. Quiet; it is a control, not an accent.

### Cards and List Items
- **Cards:** Raised Char (#100c0c) fill, 12px radius, ~14px internal padding, grouped under an uppercase Label. No border, no shadow.
- **List items:** Raised Char fill, 12px radius, 12px padding. Active/selected is shown with a tonal step up to Overlay Char plus a status dot. (See the Don'ts: the current active state also paints a left stripe, which should be removed.)
- **Never nest a card inside a card.**

### Navigation
- **Tab bar:** Warm Char background, a single 1px top hairline, 88px tall. Active tab tint is Lamplight Lilac; inactive is Faint Smoke; labels are 11px. Pending-permission count rides as an Alert Ember badge.
- **Stack headers:** Warm Char background, 1px bottom hairline, Ash title, flat.

### Signature: the message stream
- **The Unboxed Assistant.** Assistant output renders full-width with no bubble and no container: rendered markdown, mono code blocks with a copy affordance, and quiet tappable tool rows (a chevron, a mono tool name, a status color). The agent's work owns the canvas.
- **The user bubble.** Only the user's own messages are contained: an Overlay Char bubble, 18px radius with a 4px bottom-right tail corner, right-aligned, max 80% width.
- **Order and motion:** newest pinned to the bottom via an inverted list (no long scroll on open). A pill-shaped "Jump to latest" / "↓ N new" affordance appears only when scrolled away from the bottom.

### Signature: the diff viewer
- File accordion: Raised Char surface, hairline border, 8px radius, filename plus `+adds` (Muted Sage) / `-dels` (Soft Ember) stats. Expanded lines are mono with a `+`/`-`/` ` prefix gutter and a washed background. Long lines scroll horizontally rather than wrap.

### Empty, loading, and error states
- **Loading:** tonal skeleton blocks (Overlay Char) plus a quiet caption. Never a bare spinner on an empty screen.
- **Empty:** a faint outline icon, a one-line statement ("No changes"), and a calm hint ("Changes made by the agent will appear here.").
- **Status banners:** a status-tinted wash (e.g. Ember Wash) with the status color text and a matching icon, centered. Errors use the exact strings from `spec.expo-client.md` (`ERR OFFLINE`, etc.).

## 6. Do's and Don'ts

### Do:
- **Do** reserve Lamplight Lilac (#edb2f1) for focus rings and active/selected state. A handful of lit elements per screen, no more (the One Lamp Rule).
- **Do** render assistant output and diffs unboxed and full-width; contain only the user's own messages (the Unboxed Assistant Rule).
- **Do** build depth from the four warm tonal steps (#0a0706 → #100c0c → #191514 → #221e1d), reaching for a hairline border before anything heavier (the Flat, Tonal Rule).
- **Do** use monospace strictly for literal machine text: code, diffs, tool names, server addresses (the Mono-for-Truth Rule).
- **Do** give every interactive element the press-scale spring (to 0.97, no bounce) and a ≥44px touch target.
- **Do** keep status meaning multi-channel: pair every status color with an icon or label (offline icon + "No connection", `+`/`-` diff prefixes), per WCAG AA.
- **Do** keep body text at Ash (#c8c3c1) or lighter on dark surfaces so it clears 4.5:1 contrast.

### Don't:
- **Don't** use a `border-left` or `border-right` thicker than 1px as a colored accent stripe on list items or cards. The active server and session rows currently do this (3px stripe); replace it with a background tonal step plus the status dot.
- **Don't** fill primary buttons with the accent. Lilac is state, not a button color; primary actions are Interactive Gray with dark text (the Quiet Button Rule).
- **Don't** use `#fff` or `#000`. Use Warm Paper (#f6f0ef) and Warm Char (#0a0706). The notification badge text and swipe-to-delete icon currently hardcode `#fff` and should move to Warm Paper.
- **Don't** put light text (#f6f0ef) on Interactive Gray (#969190); it fails AA. The Review "Retry" button does this today and should use dark Warm Char text like every other primary button.
- **Don't** reach for default dev-tool blue (VS Code / GitHub). Cobalt was retired on purpose; do not reintroduce it.
- **Don't** use neon hacker green-on-black. Greens are Muted Sage and Signal Green, never `#00ff00`.
- **Don't** build enterprise-SaaS chrome: no nested cards, no dense dashboards, no busy toolbars. When a screen feels heavy, remove chrome.
- **Don't** add drop shadows to fake elevation; move up the tonal ladder instead.
- **Don't** default to a Modal. Prefer a bottom sheet or inline disclosure; if a modal is unavoidable (model picker, tool detail), present it as a sheet over the scrim.
