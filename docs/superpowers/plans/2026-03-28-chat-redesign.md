# Chat Screen Redesign & Global Theme Refresh — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign SessionDetailScreen with Slack-style messages, unified composer, grouped tool blocks, and refresh the global theme to warm neutral.

**Architecture:** All changes land in 3 existing files — `theme.ts` (3 token updates), `SessionDetailScreen.tsx` (full rewrite of the render tree and styles), and `ProjectsStack.tsx` (1 line to disable header). No new files. Local components (`MessageRow`, `ToolCallGroup`, `UnifiedComposer`) live inside SessionDetailScreen.

**Tech Stack:** React Native, Expo, FlashList (inverted), Zustand, react-native-markdown-display, Ionicons

**Spec:** `docs/superpowers/specs/2026-03-28-chat-redesign-design.md`

---

## Chunk 1: Theme + Navigation Prep

### Task 1: Update global theme tokens

**Files:**
- Modify: `src/constants/theme.ts:143-148`

- [ ] **Step 1: Update interactive color tokens**

Change 3 values in the `colors.interactive` object:

```typescript
interactive: {
  base: palette.smoke[10],    // was smoke[8]
  hover: palette.smoke[11],   // was smoke[9]
  active: palette.smoke[12],  // was cobalt[12]
  text: palette.smoke[12],    // unchanged
},
```

- [ ] **Step 2: Verify the app still builds**

Run: `npx expo start` — confirm no errors, spot-check that other screens (Settings, Projects) now use the lighter interactive color.

- [ ] **Step 3: Commit**

```bash
git add src/constants/theme.ts
git commit -m "style: update interactive colors to warm neutral (smoke[10/11/12])"
```

---

### Task 2: Disable React Navigation header for SessionDetail

**Files:**
- Modify: `src/navigation/ProjectsStack.tsx:47-51`

- [ ] **Step 1: Add headerShown: false to SessionDetail screen**

```tsx
<Stack.Screen
  name="SessionDetail"
  component={SessionDetailScreen}
  options={{ title: "Session", headerShown: false }}
/>
```

- [ ] **Step 2: Verify navigation still works**

Run app, navigate to a session. The native header should be gone — the screen will look broken (no header) until Task 3. Back gesture should still work on iOS.

- [ ] **Step 3: Commit**

```bash
git add src/navigation/ProjectsStack.tsx
git commit -m "chore: disable native header for SessionDetail screen"
```

---

## Chunk 2: Message Row Redesign + Custom Header

### Task 3: Rewrite MessageBubble → MessageRow with Slack-style layout

**Files:**
- Modify: `src/screens/SessionDetailScreen.tsx`

This task comes BEFORE the FlashList changes so that `MessageRow` and `ThinkingIndicator` exist when Task 4 references them.

- [ ] **Step 1: Add the groupParts helper function**

Add above the components (after the imports):

```typescript
type TextSegment = { type: "text"; text: string }
type ToolSegment = { type: "tools"; tools: ToolPart[] }
type PartSegment = TextSegment | ToolSegment

function groupParts(parts: Part[]): PartSegment[] {
  if (!parts || parts.length === 0) return []

  const segments: PartSegment[] = []
  let currentTools: ToolPart[] = []

  const flushTools = () => {
    if (currentTools.length > 0) {
      segments.push({ type: "tools", tools: [...currentTools] })
      currentTools = []
    }
  }

  for (const part of parts) {
    if (part.type === "tool") {
      currentTools.push(part as ToolPart)
    } else {
      flushTools()
      let text = ""
      if (part.type === "text" && (part as TextPart).text) {
        text = (part as TextPart).text
      } else if (part.type === "reasoning" && (part as ReasoningPart).text) {
        text = (part as ReasoningPart).text
      }
      if (text) {
        segments.push({ type: "text", text })
      }
    }
  }
  flushTools()

  return segments
}
```

- [ ] **Step 2: Create ThinkingIndicator component**

Add above the main component:

```tsx
const ThinkingIndicator = React.memo(function ThinkingIndicator() {
  return (
    <View style={styles.messageRow}>
      <View style={[styles.avatar, styles.assistantAvatar]}>
        <Text style={styles.avatarTextAssistant}>A</Text>
      </View>
      <View style={styles.messageBody}>
        <View style={styles.messageHeader}>
          <Text style={styles.assistantName}>Assistant</Text>
        </View>
        <View style={styles.thinkingRow}>
          <ActivityIndicator size="small" color={palette.smoke[7]} />
          <Text style={styles.thinkingText}>Thinking...</Text>
        </View>
      </View>
    </View>
  )
})
```

- [ ] **Step 3: Create ToolCallGroup and ToolCallRow components**

Add above the main component (after ThinkingIndicator):

```tsx
const ToolCallGroup = React.memo(function ToolCallGroup({
  tools,
}: {
  tools: ToolPart[]
}) {
  const allCompleted = tools.every((t) => t.state.status === "completed")
  const [expanded, setExpanded] = React.useState(!allCompleted)

  React.useEffect(() => {
    if (!allCompleted) setExpanded(true)
  }, [allCompleted])

  return (
    <View
      style={styles.toolGroup}
      accessibilityRole="summary"
      accessibilityState={{ expanded }}
    >
      <Pressable
        style={styles.toolGroupHeader}
        onPress={() => setExpanded((prev) => !prev)}
      >
        <Text style={styles.toolGroupLabel}>
          {tools.length} TOOL CALL{tools.length !== 1 ? "S" : ""}
        </Text>
        <Ionicons
          name={expanded ? "chevron-down" : "chevron-forward"}
          size={12}
          color={palette.smoke[7]}
        />
      </Pressable>
      {expanded && (
        <View style={styles.toolGroupBody}>
          {tools.map((tool) => (
            <ToolCallRow key={tool.id} tool={tool} />
          ))}
        </View>
      )}
    </View>
  )
})

function ToolCallRow({ tool }: { tool: ToolPart }) {
  const status = tool.state.status
  const isError = status === "error"
  const isRunning = status === "running"

  const statusIcon = isError ? "close" : status === "completed" ? "checkmark" : "ellipse"
  const statusColor = isError
    ? palette.ember[9]
    : status === "completed"
      ? palette.apple[9]
      : isRunning
        ? palette.solaris[9]
        : palette.smoke[7]

  const title =
    "title" in tool.state && tool.state.title
      ? tool.state.title
      : isError && "error" in tool.state
        ? tool.state.error
        : undefined

  return (
    <View style={styles.toolRow}>
      <Ionicons name={statusIcon} size={10} color={statusColor} />
      <Text style={[styles.toolName, isError && styles.toolNameError]}>
        {tool.tool}
      </Text>
      {title ? <Text style={styles.toolTitle} numberOfLines={1}>{title}</Text> : null}
    </View>
  )
}
```

- [ ] **Step 4: Rewrite MessageBubble as MessageRow**

Replace the `MessageBubble` component with `MessageRow`:

```tsx
const MessageRow = React.memo(function MessageRow({
  message,
  parts,
}: {
  message: Message
  parts: Part[]
}) {
  const isUser = message.role === "user"
  const segments = React.useMemo(() => groupParts(parts), [parts])

  return (
    <View style={styles.messageRow}>
      <View
        style={[styles.avatar, isUser ? styles.userAvatar : styles.assistantAvatar]}
        accessibilityLabel={isUser ? "You" : "Assistant"}
      >
        <Text style={isUser ? styles.avatarTextUser : styles.avatarTextAssistant}>
          {isUser ? "Y" : "A"}
        </Text>
      </View>
      <View style={styles.messageBody}>
        <View style={styles.messageHeader}>
          <Text style={isUser ? styles.userName : styles.assistantName}>
            {isUser ? "You" : "Assistant"}
          </Text>
          <Text style={styles.timestamp}>{formatTimestamp(message.time.created)}</Text>
        </View>
        {segments.map((segment, i) => {
          if (segment.type === "tools") {
            return <ToolCallGroup key={i} tools={segment.tools} />
          }
          return (
            <View key={i} style={styles.messageContent}>
              <Markdown style={markdownStyles}>{segment.text}</Markdown>
            </View>
          )
        })}
      </View>
    </View>
  )
})
```

- [ ] **Step 5: Remove old getPartText function**

Delete the `getPartText` function — it's replaced by `groupParts`.

- [ ] **Step 6: Replace old message + tool styles with new ones**

Remove old styles: `messageContainer`, `userMessage`, `assistantMessage`, `messageMeta`, `roleLabel`, `messageContent`, `messageBubble`, `userBubble`, `assistantBubble`, `messageRole`, `messageHeader`, `reasoningBadge`, `reasoningBadgeText`, `toolBadge`, `toolBadgeText`, `messageText`, `userMessageText`, `assistantMessageText`, `messageTime`, `userTimeText`, `assistantTimeText`, `userRoleText`, `assistantRoleText`, `thinkingIndicator`, `thinkingText`.

Add new styles:

```typescript
messageRow: {
  flexDirection: "row",
  gap: 6,
  paddingVertical: 10,
},
avatar: {
  width: 22,
  height: 22,
  borderRadius: 11,
  alignItems: "center",
  justifyContent: "center",
  marginTop: 2,
},
userAvatar: {
  backgroundColor: palette.smoke[4],
},
assistantAvatar: {
  backgroundColor: palette.smoke[3],
  borderWidth: 1,
  borderColor: palette.smoke[5],
},
avatarTextUser: {
  fontSize: 10,
  fontWeight: "700",
  color: palette.smoke[10],
},
avatarTextAssistant: {
  fontSize: 10,
  fontWeight: "700",
  color: palette.smoke[10],
},
messageBody: {
  flex: 1,
},
messageHeader: {
  flexDirection: "row",
  alignItems: "center",
  gap: 8,
  marginBottom: 4,
},
userName: {
  fontSize: 13,
  fontWeight: "700",
  color: palette.smoke[11],
},
assistantName: {
  fontSize: 13,
  fontWeight: "700",
  color: palette.smoke[10],
},
timestamp: {
  fontSize: 11,
  color: palette.smoke[7],
},
messageContent: {
  flex: 1,
},
thinkingRow: {
  flexDirection: "row",
  alignItems: "center",
  gap: 8,
  paddingVertical: 4,
},
thinkingText: {
  fontSize: 13,
  color: palette.smoke[7],
},
toolGroup: {
  backgroundColor: palette.smoke[2],
  borderWidth: 1,
  borderColor: palette.smoke[4],
  borderRadius: 8,
  overflow: "hidden",
  marginVertical: 6,
},
toolGroupHeader: {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  paddingHorizontal: 10,
  paddingVertical: 6,
  borderBottomWidth: 1,
  borderBottomColor: palette.smoke[3],
  backgroundColor: palette.smoke[1],
},
toolGroupLabel: {
  fontSize: 10,
  fontWeight: "600",
  color: palette.smoke[7],
  letterSpacing: 0.5,
},
toolGroupBody: {
  paddingHorizontal: 10,
  paddingVertical: 6,
  gap: 5,
},
toolRow: {
  flexDirection: "row",
  alignItems: "center",
  gap: 6,
},
toolName: {
  fontSize: 11,
  fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  color: palette.smoke[9],
},
toolNameError: {
  color: palette.ember[11],
},
toolTitle: {
  fontSize: 11,
  color: palette.smoke[7],
  flex: 1,
},
```

- [ ] **Step 7: Update messagesList style — remove gap**

The `messageRow` style uses `paddingVertical: 10` which creates 20px between adjacent rows. Remove the `gap: 24` from `messagesList` to avoid double-spacing:

```typescript
messagesList: {
  padding: 16,
},
```

Note: With `inverted` FlashList (coming in Task 4), uniform `padding: 16` works correctly — no swap needed.

- [ ] **Step 8: Update markdown styles**

Update font sizes in the `markdownStyles` object:

```typescript
body: { fontSize: 14, lineHeight: 21, color: colors.text.base },
heading1: { fontSize: 20, /* rest unchanged */ },
heading2: { fontSize: 17, /* rest unchanged */ },
code_inline: { /* ... */ fontSize: 12, /* rest unchanged */ },
code_block: { /* ... */ fontSize: 12, /* rest unchanged */ },
fence: { /* ... */ fontSize: 12, /* rest unchanged */ },
```

- [ ] **Step 9: Update FlashList renderItem to use MessageRow**

In the FlashList, change the `renderItem` from `MessageBubble` to `MessageRow`:

```tsx
renderItem={({ item }) => (
  <MessageRow message={item} parts={messageParts[item.id] ?? []} />
)}
```

(The ThinkingIndicator sentinel will be added in Task 4.)

- [ ] **Step 10: Verify messages render correctly**

Run app, open a session. Messages should show avatars, bold names, timestamps. Tool calls should render as grouped blocks. Text should be 14px.

- [ ] **Step 11: Commit**

```bash
git add src/screens/SessionDetailScreen.tsx
git commit -m "feat: redesign messages to Slack-style with avatars and tool groups"
```

---

### Task 4: Add custom header with back/stop/review/share

**Files:**
- Modify: `src/screens/SessionDetailScreen.tsx`

- [ ] **Step 1: Replace the existing header View**

Remove the current header block (the `<View style={styles.header}>` with just the title). Replace with:

```tsx
<View style={styles.header}>
  <View style={styles.headerLeft}>
    <Pressable onPress={() => navigation.goBack()} style={styles.headerButton}>
      <Ionicons name="chevron-back" size={24} color={colors.text.base} />
    </Pressable>
    <Text style={styles.headerTitle} numberOfLines={1}>
      {currentSession?.title ?? "Session"}
    </Text>
  </View>
  <View style={styles.headerRight}>
    {isAgentWorking && (
      <Pressable
        style={styles.headerButton}
        onPress={() => void abortSession(sessionId!)}
      >
        <Ionicons name="stop-circle" size={20} color={palette.ember[9]} />
      </Pressable>
    )}
    {sessionId && (
      <>
        <Pressable
          style={styles.headerButton}
          onPress={() => navigation.navigate("Review", { sessionId })}
        >
          <Ionicons name="git-pull-request" size={20} color={colors.interactive.base} />
        </Pressable>
        <Pressable
          style={styles.headerButton}
          onPress={() => navigation.navigate("Share", { sessionId })}
        >
          <Ionicons name="share-outline" size={20} color={colors.interactive.base} />
        </Pressable>
      </>
    )}
  </View>
</View>
```

- [ ] **Step 2: Add header styles**

Replace the existing `header`, `title` styles and add new ones:

```typescript
header: {
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
  paddingHorizontal: 8,
  paddingVertical: 10,
  borderBottomWidth: 1,
  borderBottomColor: colors.surface.highlight,
  backgroundColor: colors.background.base,
},
headerLeft: {
  flexDirection: "row",
  alignItems: "center",
  flex: 1,
  gap: 4,
},
headerTitle: {
  fontSize: 17,
  fontWeight: "600",
  color: colors.text.base,
  maxWidth: "60%",
},
headerRight: {
  flexDirection: "row",
  alignItems: "center",
  gap: 4,
},
headerButton: {
  padding: 8,
},
```

- [ ] **Step 3: Remove the old sessionBar**

Delete the entire `{sessionId && (<View style={styles.sessionBar}>...</View>)}` block (the stop/undo/redo/review/share bar). Delete the associated styles: `sessionBar`, `sessionDivider`, `sessionButton`. Undo/redo move to the composer in Task 6.

- [ ] **Step 4: Verify header renders correctly**

Run app, navigate to a session. Custom header should show back arrow + title on left, review + share on right. Back button should navigate back. Stop button should only appear when agent is working.

- [ ] **Step 5: Commit**

```bash
git add src/screens/SessionDetailScreen.tsx
git commit -m "feat: add custom header with stop/review/share actions"
```

---

### Task 5: Fix FlashList to use inverted prop

**Files:**
- Modify: `src/screens/SessionDetailScreen.tsx`

- [ ] **Step 1: Update FlashList props**

Replace the current FlashList block with:

```tsx
<FlashList
  ref={flatListRef}
  data={listData}
  keyExtractor={(item) => item.id}
  renderItem={({ item }) => {
    if (item.id === "__thinking__") {
      return <ThinkingIndicator />
    }
    return <MessageRow message={item} parts={messageParts[item.id] ?? []} />
  }}
  contentContainerStyle={styles.messagesList}
  estimatedItemSize={120}
  inverted
  extraData={messageParts}
  overScrollMode="never"
  onScroll={(event) => {
    const offsetY = event.nativeEvent.contentOffset.y
    setIsAtBottom(offsetY < 32)
  }}
/>
```

- [ ] **Step 2: Compute listData with thinking sentinel**

Add above the return statement:

```typescript
const listData = React.useMemo(() => {
  if (isAgentWorking) {
    return [{ id: "__thinking__", role: "assistant" } as Message, ...messages]
  }
  return messages
}, [messages, isAgentWorking])
```

- [ ] **Step 3: Remove .reverse() and setTimeout scroll hack**

Remove the `data={[...messages].reverse()}` — now just `data={listData}`.

Remove the `useEffect` that does `setTimeout(() => flatListRef.current?.scrollToEnd(...))`.

- [ ] **Step 4: Fix "Jump to latest" button**

Change the `onPress` from `scrollToEnd({ animated: false })` to:

```tsx
onPress={() => flatListRef.current?.scrollToOffset({ offset: 0, animated: true })}
```

- [ ] **Step 5: Remove old thinkingIndicator block**

Delete the `{isAgentWorking && (<View style={styles.thinkingIndicator}>...)}` block that was above the FlashList. The thinking indicator is now a list item.

- [ ] **Step 6: Verify scroll behavior**

Run app, open a session with messages. Messages should appear anchored to bottom. Scrolling up should show "Jump to latest". Tapping it should scroll back.

- [ ] **Step 7: Commit**

```bash
git add src/screens/SessionDetailScreen.tsx
git commit -m "fix: use inverted FlashList, remove .reverse() and scroll hacks"
```

---

## Chunk 3: Unified Composer

### Task 6: Replace 3-bar bottom with unified composer

**Files:**
- Modify: `src/screens/SessionDetailScreen.tsx`

- [ ] **Step 1: Remove old modelBar, inputContainer, and sessionBar markup**

Delete the `<View style={styles.modelBar}>...</View>` block, the `<View style={styles.inputContainer}>...</View>` block, and the error `<Text>` below it. These are replaced by the unified composer.

- [ ] **Step 2: Add error banner + UnifiedComposer in their place**

After the `</View>` that closes `messagesContainer`, add:

```tsx
{lastError ? (
  <View style={styles.errorBanner}>
    <Text style={styles.errorText}>{lastError}</Text>
  </View>
) : null}

{sessionId && (
  <View style={styles.composer}>
    <View style={styles.composerCard}>
      <TextInput
        style={styles.composerInput}
        value={inputText}
        onChangeText={setInputText}
        onSubmitEditing={handleSend}
        placeholder="Type a message..."
        placeholderTextColor={colors.text.weaker}
        selectionColor={colors.interactive.base}
        multiline
        maxLength={10000}
      />
      <View style={styles.composerBar}>
        <Pressable
          style={styles.modelChip}
          onPress={() => {
            void fetchProviders()
            setIsModelPickerOpen(true)
          }}
        >
          <Text style={[styles.modelChipText, !selectedModel && styles.modelChipTextEmpty]}>
            {selectedModel
              ? (() => {
                  const provider = providers.find((p) => p.id === selectedModel.providerID)
                  const model = provider?.models?.[selectedModel.modelID]
                  return model?.name ?? selectedModel.modelID
                })()
              : "No model"}
          </Text>
          <Ionicons name="chevron-down" size={10} color={palette.smoke[7]} />
        </Pressable>
        <View style={{ flex: 1 }} />
        <Pressable
          style={styles.composerAction}
          onPress={() =>
            void revertSession(
              sessionId,
              currentSession?.revert?.messageID,
              currentSession?.revert?.partID
            )
          }
        >
          <Ionicons name="arrow-undo" size={16} color={palette.smoke[7]} />
        </Pressable>
        <Pressable
          style={styles.composerAction}
          onPress={() => void unrevertSession(sessionId)}
        >
          <Ionicons name="arrow-redo" size={16} color={palette.smoke[7]} />
        </Pressable>
        <Pressable
          style={[
            styles.sendButton,
            (!inputText.trim() || isSending || isAgentWorking) && styles.sendButtonDisabled,
          ]}
          onPress={handleSend}
          disabled={!inputText.trim() || isSending || isAgentWorking}
        >
          {isSending ? (
            <ActivityIndicator size="small" color={palette.smoke[1]} />
          ) : (
            <Ionicons name="arrow-up" size={16} color={palette.smoke[1]} />
          )}
        </Pressable>
      </View>
    </View>
  </View>
)}
```

- [ ] **Step 3: Update handleSend to guard against isAgentWorking**

The `onSubmitEditing` on the TextInput calls `handleSend` directly, bypassing the button's `disabled` prop. Add the `isAgentWorking` check:

```typescript
const handleSend = async () => {
  if (!inputText.trim() || !sessionId || isSending || isAgentWorking) {
    return
  }
  // ... rest unchanged
}
```

- [ ] **Step 4: Update KeyboardAvoidingView offset**

Change `keyboardVerticalOffset` from `90` to `60`:

```tsx
keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 0}
```

- [ ] **Step 5: Add composer styles**

Remove old styles: `modelBar`, `modelLabel`, `modelButton`, `modelButtonDisabled`, `modelButtonText`, `inputContainer`, `input`, `sendButton`, `sendButtonDisabled`, `sendButtonText`, `error`.

Add new styles:

```typescript
errorBanner: {
  paddingVertical: 8,
  paddingHorizontal: 16,
  backgroundColor: palette.ember[2],
},
errorText: {
  color: palette.ember[9],
  fontSize: 13,
  textAlign: "center",
},
composer: {
  paddingHorizontal: 12,
  paddingTop: 8,
  paddingBottom: 12,
  borderTopWidth: 1,
  borderTopColor: colors.surface.highlight,
  backgroundColor: colors.background.base,
},
composerCard: {
  backgroundColor: palette.smoke[2],
  borderWidth: 1,
  borderColor: palette.smoke[4],
  borderRadius: 14,
  overflow: "hidden",
},
composerInput: {
  paddingHorizontal: 14,
  paddingTop: 12,
  paddingBottom: 8,
  fontSize: 14,
  color: colors.text.base,
  minHeight: 36,
  maxHeight: 120,
},
composerBar: {
  flexDirection: "row",
  alignItems: "center",
  paddingHorizontal: 8,
  paddingBottom: 8,
  gap: 4,
},
modelChip: {
  flexDirection: "row",
  alignItems: "center",
  gap: 4,
  paddingHorizontal: 8,
  paddingVertical: 3,
  backgroundColor: palette.smoke[3],
  borderRadius: 6,
},
modelChipText: {
  fontSize: 11,
  color: palette.smoke[9],
},
modelChipTextEmpty: {
  color: palette.smoke[7],
},
composerAction: {
  padding: 6,
},
sendButton: {
  width: 30,
  height: 26,
  borderRadius: 8,
  backgroundColor: palette.smoke[10],
  alignItems: "center",
  justifyContent: "center",
},
sendButtonDisabled: {
  opacity: 0.5,
},
```

- [ ] **Step 6: Verify composer renders and works**

Run app, open a session. Should see single input card with model chip, undo/redo, send button. Type text, send it. Model chip should open picker modal. Undo/redo should work.

- [ ] **Step 7: Remove the selectedModelLabel computed value**

Delete the `selectedModelLabel` variable and its IIFE — the model name is now computed inline in the composer.

- [ ] **Step 8: Clean up unused style definitions**

Remove any remaining orphaned styles from the old layout that are no longer referenced: `reasoningBadge`, `reasoningBadgeText`, `toolBadge`, `toolBadgeText`, `messageBubble`, `userBubble`, `assistantBubble`, `messageRole`, `messageText`, `userMessageText`, `assistantMessageText`, `messageTime`, `userTimeText`, `assistantTimeText`, `userRoleText`, `assistantRoleText`.

- [ ] **Step 9: Commit**

```bash
git add src/screens/SessionDetailScreen.tsx
git commit -m "feat: replace 3-bar bottom with unified composer input"
```

---

## Chunk 4: Final Polish

### Task 7: Final cleanup and verification

**Files:**
- Modify: `src/screens/SessionDetailScreen.tsx` (minor)

- [ ] **Step 1: Verify empty state still works**

Open a new/empty session. Should show centered "No messages yet" prompt. The composer should still be visible below.

- [ ] **Step 2: Verify model picker modal still works**

Tap model chip → modal opens → select a model → modal closes → chip updates.

- [ ] **Step 3: Verify streaming messages**

Send a prompt, watch the response stream in. Thinking indicator should appear at bottom, then be replaced by the actual message. Tool calls should group into blocks.

- [ ] **Step 4: Verify Jump to Latest**

Scroll up in a long session. "Jump to latest" pill should appear. Tap it → scrolls to bottom.

- [ ] **Step 5: Verify error banner**

Trigger an error (e.g., disconnect server). Error should appear as a banner between messages and composer.

- [ ] **Step 6: Final commit if any cleanup was needed**

```bash
git add src/screens/SessionDetailScreen.tsx
git commit -m "chore: final polish and cleanup for chat redesign"
```
