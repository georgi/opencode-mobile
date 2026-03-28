# Chat Screen Redesign & Global Theme Refresh

## Summary

Redesign the SessionDetailScreen chat experience and refresh the global theme to create a polished, content-forward mobile client. The chat adopts a Slack/Discord-style message layout with a unified composer input, grouped tool call blocks, and a warm neutral color system where color is reserved exclusively for status indicators.

## Goals

- Make the chat screen feel like a premium, purpose-built tool — not a generic chat wrapper
- Maximize vertical space for message content on mobile
- Make tool calls scannable without overwhelming the conversation
- Establish a cohesive visual identity through the theme (warm neutral, muted chrome)

## Non-Goals

- Redesigning other screen layouts (projects list, sessions list, settings, etc.) — they inherit theme changes only
- Adding new features (file upload, pull-to-refresh, pagination)
- Changing navigation structure or state management
- Permission request UI in the chat screen (handled by NotificationsScreen)

---

## Design Decisions

### 1. Message Layout — Slack/Discord Hybrid

**Current**: Flat rows with "You"/"Assistant" role label and timestamp. No visual distinction between roles. Markdown body at 12px.

**New**: Full-width messages with:
- **Avatar badge**: 22px circle. User = filled dark (`smoke[4]`) with `smoke[10]` initial "Y". Assistant = bordered circle (`smoke[3]` bg, `smoke[5]` border) with initial "A". Both need `accessibilityLabel` ("You" / "Assistant").
- **Header row**: Avatar + bold name + timestamp inline. User name in `smoke[11]`, assistant name in `smoke[10]`.
- **Content**: Indented 28px (aligned past avatar). Body text at 14px, line-height 1.5.
- **No bubbles**: Messages are full-width. No background color per message. Clean separation via vertical spacing (20px gap).

### 2. Unified Composer Input

**Current**: 3 stacked bars at bottom — session controls bar, model picker bar, text input bar (~140px total).

**New**: Single input card:
- **Top area**: Multiline `TextInput` with placeholder "Type a message..."
- **Bottom row** (inside the card): Model picker chip (left), undo/redo icons (right of center), send button (far right)
- **Send button**: 30x26px rounded rect, `smoke[10]` background, dark arrow icon (`smoke[1]`). Disabled state at `opacity: 0.5` (matches current behavior). Disabled when `!inputText.trim() || isSending || isAgentWorking`.
- **Model chip**: Small pill showing current model name, `smoke[3]` background, tappable to open picker modal. Shows "No model" in `smoke[7]` if empty.
- **Stop/Review/Share**: Move to the screen header as icon buttons (right side).
- **Total height**: ~80px idle, expands with multiline input (max 120px).
- **Keyboard offset**: Recalibrate `keyboardVerticalOffset` from 90 to ~60 for the shorter layout. Test on device.

### 3. Tool Call Rendering — Grouped Block

**Current**: Tool calls render as plain text ("tool_name..." or "tool_name\noutput").

**New**: Tool call parts within a message's `Part[]` array are grouped into collapsible blocks.

**Grouping algorithm**: Iterate through the parts array. Collect consecutive `part.type === "tool"` parts into a group. A non-tool part (text, reasoning, etc.) breaks the group. Multiple groups per message are possible if tool calls are interspersed with text.

**Each group renders as**:
- **Header**: "N TOOL CALLS" label (left), expand/collapse chevron (right). `smoke[7]` text, `smoke[1]` background.
- **Body**: List of tool calls, each showing:
  - Status icon: `apple[9]` green checkmark (completed), `solaris[9]` yellow dot (running), `ember[9]` red X (error), `smoke[7]` gray dot (pending)
  - Tool name from `toolPart.tool` in monospace (`smoke[9]`). On error state, tool name renders in `ember[11]`.
  - Secondary label in `smoke[7]`: Use `toolPart.state.title` when present (completed always has it; running has it optionally). For pending, error, or running-without-title, show tool name only — no secondary label.
- **Collapsed by default** when all tools in the group are completed. Auto-expanded if any tool is running/pending.
- **Container**: `smoke[2]` background, `smoke[4]` border, 8px border-radius.
- **No animation on expand/collapse** — use simple conditional rendering (height toggle) to avoid FlashList measurement invalidation bugs with `LayoutAnimation`.
- **Accessibility**: Container has `accessibilityRole="summary"`, expanded state announced via `accessibilityState={{ expanded }}`.

### 4. Thinking/Working Indicator

**Current**: Positioned above the message list (top of screen).

**New**: Inline at the visual bottom of the message list (nearest to the composer), styled as a partial assistant message:
- Shows avatar badge + "Assistant" header
- `ActivityIndicator` (small, `smoke[7]` color) + "Thinking..." text in `smoke[7]`
- Appears where the next message would be, so the user's eye is already there

**Implementation**: Since the list is inverted, prepend a sentinel item to the data array when `isAgentWorking` is true (e.g., `{ id: "__thinking__", role: "assistant" }` at index 0). The inverted list renders index 0 at the visual bottom, placing the indicator right after the last real message. The `renderItem` function checks for the sentinel ID and renders the thinking indicator instead of a normal message row.

### 5. FlashList Configuration

**Current**: `data={[...messages].reverse()}` — creates a new reversed array on every render, scroll-to-end uses `setTimeout` hack.

**New**: Use FlashList's `inverted` prop:
- `inverted={true}`
- **Data order**: The store's `sortMessages` sorts newest-first (`b.time - a.time`). This is the correct order for an inverted FlashList — the first array element (newest) renders at the visual bottom. **Do not change `sortMessages`.** Remove the `.reverse()` call.
- **`estimatedItemSize`**: Set to `120` (avatar row + ~2 lines of text content).
- **Scroll behavior**: Remove the `setTimeout` scroll hack. Inverted lists auto-anchor to the newest content.
- **`isAtBottom` detection**: With inverted lists, `contentOffset.y` near 0 means the user is at the bottom (newest). Current check `offsetY < 32` remains correct.
- **"Jump to latest"**: Change from `scrollToEnd({ animated: false })` to `scrollToOffset({ offset: 0, animated: true })`.
- **`contentContainerStyle` padding**: Note that with `inverted`, top padding becomes visual bottom padding. Test on both iOS and Android. May need to swap `paddingTop`/`paddingBottom` values.
- **Few messages**: When the list has only 1-2 messages, they appear at the visual bottom (anchored). This is correct behavior — no spacer needed. The empty space above is natural.
- **`extraData`**: Pass `messageParts` as `extraData` so FlashList re-renders items when streaming parts update (since the `messages` array reference may not change during part-only updates).
- **`overScrollMode`**: Set `overScrollMode="never"` on Android to prevent distracting overscroll glow at the wrong edge (known inverted-list quirk).
- **Memoization**: Wrap `MessageRow` and `ToolCallGroup` in `React.memo` with default shallow comparison. This prevents re-rendering every row on each streaming part update — only the row whose parts changed (via `messageParts[item.id]`) will re-render.

### 6. Header Redesign

**Current**: Just session title with border-bottom.

**New**: Custom header rendered within the component (not via `navigation.setOptions`, to avoid stale-closure issues with reactive state):
- Remove the React Navigation header for this screen (`headerShown: false` in stack screen options)
- Render a custom `View` header at the top of the component
- **Left**: Back button (Ionicons `chevron-back`, calls `navigation.goBack()`) + session title (truncated with `numberOfLines={1}` ellipsis, `maxWidth: 60%`)
- **Right**: Stop button (only when `isAgentWorking`, `ember[9]` red), Review icon (`git-pull-request`), Share icon. All wrapped in `Pressable` with `padding: 8` hit targets.

### 7. Error Display

**Current**: Error text below input bar with `ember[2]` background.

**New**: Error renders as a small banner between the message list and the composer. Same styling (`ember[2]` bg, `ember[9]` text, centered), but positioned above the unified composer card, not below it.

---

## Global Theme Changes

All changes in `src/constants/theme.ts`:

| Token | Current | New | Rationale |
|-------|---------|-----|-----------|
| `interactive.base` | `smoke[8]` (#6d6867) | `smoke[10]` (#969190) | More visible, still muted |
| `interactive.hover` | `smoke[9]` (#7e7978) | `smoke[11]` (#c8c3c1) | Clear hover/press state |
| `interactive.active` | `cobalt[12]` (#afe6ff) | `smoke[12]` (#f6f0ef) | Monochrome — no accent color |

Markdown style updates in SessionDetailScreen:

| Token | Current | New |
|-------|---------|-----|
| `body.fontSize` | 12px | 14px |
| `body.lineHeight` | 18 | 21 |
| `code_inline.fontSize` | 10px | 12px |
| `code_block.fontSize` | 10px | 12px |
| `fence.fontSize` | 10px | 12px |
| `heading1.fontSize` | 18px | 20px |
| `heading2.fontSize` | 15px | 17px |

---

## Component Breakdown

### Modified Files

1. **`src/constants/theme.ts`** — Update 3 interactive color tokens
2. **`src/screens/SessionDetailScreen.tsx`** — Full chat screen redesign:
   - Rename `MessageBubble` → `MessageRow` with avatar layout
   - New local `ToolCallGroup` component for grouped tool blocks
   - New local `UnifiedComposer` component for the input area
   - New custom header replacing the built-in one
   - FlashList `inverted` prop, remove `.reverse()`, add `estimatedItemSize` and `extraData`
   - Updated markdown styles (font sizes)
   - Updated `StyleSheet` for all new layouts
   - Error banner repositioned
3. **`src/navigation/ProjectsStack.tsx`** — Add `headerShown: false` for SessionDetail screen

### No New Files

All changes fit within existing files. The composer and tool group are local components within `SessionDetailScreen.tsx` — they're only used here.

---

## Edge Cases

- **Empty session**: Show centered empty state with subtle prompt (unchanged)
- **Long tool output**: Grouped block shows tool names/titles only; full output visible in Review screen
- **Model picker empty**: Chip shows "No model" in `smoke[7]`, still tappable to refresh
- **Agent working + user at bottom**: Thinking indicator visible at bottom. If user scrolls up, "Jump to latest" pill appears.
- **Very long session title**: Truncate with `numberOfLines={1}` ellipsis in header, `maxWidth: 60%`
- **Send while agent working**: Send button disabled during `isAgentWorking` to prevent overlapping prompts
- **Tool error state**: Show `ember[9]` red X icon, tool name in `ember[11]` (#ff785f), error message from `toolPart.state.error` as secondary label
- **Mixed parts**: Text between tool groups renders normally; only consecutive tool parts group together

---

## What This Does NOT Change

- Navigation structure (tabs, stack) — except `headerShown: false` for this one screen
- State management (Zustand store, sort order, message upsert logic)
- API integration (SDK client calls)
- Other screens' layouts (they inherit theme color changes only)
- Server storage or persistence
- EventSource/SSE subscription logic
