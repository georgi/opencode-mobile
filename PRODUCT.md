# Product

## Register

product

## Users

Developers who work with OpenCode (an AI coding agent) and need to stay in the loop while away from their desk. Three core contexts:

- **Reviewing on the move:** checking an agent session's progress, diffs, and summaries from a phone (commute, couch, between meetings).
- **Resuming work:** starting or picking up a session from mobile, sending a prompt, attaching a file or image, switching model or agent.
- **Approving quickly:** responding to permission and question prompts in one tap so the agent stays unblocked.

The shared thread: short, high-trust sessions on a small screen, often interrupted. The user is rarely doing deep work here; they are steering, checking, and unblocking. Speed and clarity matter more than density.

## Product Purpose

A touch-first companion to OpenCode that mirrors the core web and CLI flows (projects, sessions, diffs, sharing, permissions) for mobile. It exists so the human in the loop is never tethered to a desk: review what the agent did, approve or undo it, and keep momentum from anywhere.

Success looks like:

- A prompt sent within two minutes of opening the app.
- Permission and question prompts resolved in a single tap.
- Diffs and summaries that stay legible and trustworthy on a phone.
- Almost no sessions lost to server, auth, or permission confusion.

This is explicitly not an IDE, not a file editor, and not a server-management console. It is the calm review-and-approve surface for work happening elsewhere.

## Brand Personality

Three words: **calm, native, restrained.**

It should feel like a well-made native iOS app (in the lineage of Things and Ivory), not a terminal ported to a phone. The agent's work is the hero; the app's chrome recedes. Because the user is approving real code changes and answering permission prompts, the emotional target is low-anxiety confidence: nothing should feel risky, cluttered, or alarming. Personality comes from restraint and one distinctive note (warm-dark surfaces with a single lilac accent), never from noise.

## Anti-references

- **Default dev-tool blue** (VS Code, GitHub generic dark): the cobalt-to-lilac accent switch was a deliberate move away from this. Do not drift back.
- **Neon hacker green-on-black** (Matrix, "l33t terminal"): harsh, high-strain, cliché.
- **Enterprise SaaS** (Material component soup, heavy nested cards, cluttered dashboards, busy chrome): the opposite of calm and native.

Net: avoid anything that reads as a generic developer tool or a dense admin dashboard. When in doubt, remove chrome rather than add it.

## Design Principles

1. **The work is the hero.** Sessions, diffs, and messages are the content; navigation and controls stay quiet and recede. Favor breathing room over density.
2. **Calm under pressure.** This is a review-and-approve surface for real code changes. Clarity beats cleverness; never alarm, never make an action feel risky or ambiguous.
3. **Native, not ported.** Respect the platform: platform gestures, native-feeling motion, system conventions. It should feel at home beside Things, not beside a web dashboard.
4. **One distinctive note.** Identity comes from the warm-dark palette and a single lilac accent used sparingly. Restraint is the brand; resist adding color or chrome to "liven things up."
5. **Fast and certain.** Touch-first speed and one-tap actions. Every primary task (send, approve, undo, share) is reachable and reversible without hunting.

## Accessibility & Inclusion

- **Target: WCAG AA.** Hold at least 4.5:1 contrast for body text and meaningful UI against the dark surfaces. Verify the lilac accent and the muted diff colors clear AA in their actual context.
- Reduced-motion and Dynamic Type accommodations were not mandated, but the calm and native direction makes them low-cost to honor; treat them as natural extensions whenever touching motion or type.
- Diff and status meaning should not rely on color alone where pairing with an icon or label is cheap (the muted mint and ember tones sit close in luminance).
