import React, { useState, useRef, useEffect, useMemo, useCallback } from "react"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
  ScrollView,
} from "react-native"
import { FlashList, type FlashListRef } from "@shopify/flash-list"
import { useNavigation, useRoute } from "@react-navigation/native"
import type { NativeStackNavigationProp } from "@react-navigation/native-stack"
import type { RouteProp } from "@react-navigation/native"
import { Ionicons } from "@expo/vector-icons"
import Markdown from "react-native-markdown-display"
import { useShallow } from "zustand/react/shallow"
import { useSessionStore } from "../store/sessionStore"
import type { ProjectsStackParamList } from "../navigation/ProjectsStack"
import type { Message, Part, ReasoningPart, TextPart, ToolPart } from "@opencode-ai/sdk/v2/client"
import { colors, palette } from "../constants/theme"
import { ErrorBanner } from "../components/ErrorBanner"
import { PressableScale } from "../components/PressableScale"
import * as Clipboard from "expo-clipboard"
import * as Haptics from "expo-haptics"

const emptyParts: Part[] = []

// --- CodeBlock with copy button ---

function extractTextFromNode(node: any): string {
  if (typeof node === "string") return node
  if (node?.content) return node.content
  if (node?.children) {
    return node.children.map(extractTextFromNode).join("")
  }
  return ""
}

function CodeBlockWithCopy({ node, styles: mdStyles }: { node: any; styles: any }) {
  const [copied, setCopied] = React.useState(false)
  const copiedTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const code = extractTextFromNode(node).replace(/\n$/, "")

  React.useEffect(() => {
    return () => { if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current) }
  }, [])

  const handleCopy = async () => {
    await Clipboard.setStringAsync(code)
    setCopied(true)
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current)
    copiedTimerRef.current = setTimeout(() => setCopied(false), 2000)
  }

  return (
    <View style={codeBlockStyles.wrapper}>
      <Pressable style={codeBlockStyles.copyButton} onPress={() => void handleCopy()} hitSlop={8}>
        <Ionicons name={copied ? "checkmark" : "copy-outline"} size={14} color={palette.smoke[7]} />
      </Pressable>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Text style={mdStyles.fence ?? mdStyles.code_block}>{code}</Text>
      </ScrollView>
    </View>
  )
}

const codeBlockStyles = StyleSheet.create({
  wrapper: {
    position: "relative",
    marginVertical: 4,
  },
  copyButton: {
    position: "absolute",
    top: 6,
    right: 6,
    zIndex: 1,
    padding: 4,
    borderRadius: 4,
    backgroundColor: palette.smoke[3],
  },
})

const markdownRules = {
  fence: (node: any, _children: any, _parent: any, styles: any) => (
    <CodeBlockWithCopy key={node.key} node={node} styles={styles} />
  ),
  code_block: (node: any, _children: any, _parent: any, styles: any) => (
    <CodeBlockWithCopy key={node.key} node={node} styles={styles} />
  ),
}

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

// --- groupParts helper ---

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

// --- MessageSkeleton ---

function MessageSkeleton() {
  return (
    <View style={skeletonStyles.container}>
      <View style={skeletonStyles.assistantBlock} />
      <View style={skeletonStyles.userRow}>
        <View style={skeletonStyles.userBlock} />
      </View>
      <View style={skeletonStyles.assistantBlock} />
      <View style={skeletonStyles.userRow}>
        <View style={skeletonStyles.userBlock} />
      </View>
    </View>
  )
}

const skeletonStyles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 12,
  },
  assistantBlock: {
    width: "70%",
    height: 60,
    borderRadius: 14,
    backgroundColor: palette.smoke[3],
  },
  userRow: {
    alignItems: "flex-end",
  },
  userBlock: {
    width: "50%",
    height: 40,
    borderRadius: 14,
    backgroundColor: palette.smoke[3],
  },
})

// --- ThinkingIndicator ---

const ThinkingIndicator = React.memo(function ThinkingIndicator() {
  return (
    <View style={styles.assistantRow}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <ActivityIndicator size="small" color={palette.smoke[7]} />
        <Text style={styles.thinkingText}>Thinking...</Text>
      </View>
    </View>
  )
})

// --- ToolCallRow ---

const ToolCallRow = React.memo(function ToolCallRow({ tool, onPress }: { tool: ToolPart; onPress: () => void }) {
  const status = tool.state?.status
  const isError = status === "error"
  const isRunning = status === "running"

  const statusColor = isError
    ? palette.ember[9]
    : status === "completed"
      ? palette.smoke[7]
      : isRunning
        ? palette.solaris[9]
        : palette.smoke[6]

  const title =
    "title" in tool.state && tool.state.title
      ? tool.state.title
      : isError && "error" in tool.state
        ? (tool.state as { error: string }).error
        : ""

  return (
    <PressableScale style={styles.toolRow} onPress={onPress}>
      <Ionicons name="chevron-forward" size={12} color={statusColor} />
      <Text
        style={[styles.toolName, isError && { color: palette.ember[11] }]}
        numberOfLines={1}
      >
        {tool.tool}
      </Text>
      {title ? (
        <Text style={styles.toolTitle} numberOfLines={1}>{title}</Text>
      ) : null}
      {isRunning && <ActivityIndicator size="small" color={palette.solaris[9]} style={{ marginLeft: 4 }} />}
    </PressableScale>
  )
})

// --- ToolCallGroup ---

const ToolCallGroup = React.memo(function ToolCallGroup({ tools }: { tools: ToolPart[] }) {
  const [selectedTool, setSelectedTool] = useState<ToolPart | null>(null)

  return (
    <>
      <View style={styles.toolGroup}>
        {tools.map((tool, i) => (
          <ToolCallRow key={`${tool.tool}-${i}`} tool={tool} onPress={() => setSelectedTool(tool)} />
        ))}
      </View>
      <Modal
        visible={selectedTool !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedTool(null)}
      >
        <View style={styles.toolOverlayBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSelectedTool(null)} />
          <View style={styles.toolOverlayCard}>
            <View style={styles.toolOverlayHeader}>
              <Text style={styles.toolOverlayTitle}>{selectedTool?.tool}</Text>
              <PressableScale onPress={() => setSelectedTool(null)} style={{ padding: 12 }}>
                <Ionicons name="close" size={20} color={palette.smoke[9]} />
              </PressableScale>
            </View>
            {selectedTool?.state && "input" in selectedTool.state && (
              <View style={styles.toolOverlaySection}>
                <Text style={styles.toolOverlaySectionTitle}>Input</Text>
                <ScrollView style={styles.toolOverlayScroll}>
                  <Text style={styles.toolOverlayCode}>
                    {typeof selectedTool.state.input === "string"
                      ? selectedTool.state.input
                      : JSON.stringify(selectedTool.state.input, null, 2)}
                  </Text>
                </ScrollView>
              </View>
            )}
            {selectedTool?.state?.status === "completed" && "output" in selectedTool.state && (
              <View style={styles.toolOverlaySection}>
                <Text style={styles.toolOverlaySectionTitle}>Output</Text>
                <ScrollView style={styles.toolOverlayScroll}>
                  <Text style={styles.toolOverlayCode}>{selectedTool.state.output}</Text>
                </ScrollView>
              </View>
            )}
            {selectedTool?.state?.status === "error" && "error" in selectedTool.state && (
              <View style={styles.toolOverlaySection}>
                <Text style={[styles.toolOverlaySectionTitle, { color: palette.ember[9] }]}>Error</Text>
                <Text style={[styles.toolOverlayCode, { color: palette.ember[11] }]}>
                  {(selectedTool.state as { error: string }).error}
                </Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </>
  )
})

// --- MessageRow ---

const MessageRow = React.memo(function MessageRow({
  message,
}: {
  message: Message
}) {
  const parts = useSessionStore((state) => state.messageParts[message.id] ?? emptyParts)
  const isUser = message.role === "user"
  const segments = useMemo(() => groupParts(parts), [parts])

  const timestamp = message.time?.created ? formatTimestamp(message.time.created) : null

  const handleLongPress = useCallback(() => {
    const fullText = segments
      .map((s) => (s.type === "text" ? s.text : ""))
      .join("\n")
      .trim()
    if (fullText) {
      void Clipboard.setStringAsync(fullText)
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    }
  }, [segments])

  if (isUser) {
    const text = segments.map((s) => (s.type === "text" ? s.text : "")).join("\n").trim()
    return (
      <Pressable style={styles.userRow} onLongPress={handleLongPress}>
        <View style={styles.userBubble}>
          <Text style={styles.userBubbleText}>{text}</Text>
        </View>
        {timestamp && <Text style={styles.timestampRight}>{timestamp}</Text>}
      </Pressable>
    )
  }

  return (
    <Pressable style={styles.assistantRow} onLongPress={handleLongPress}>
      {segments.map((seg, i) => {
        if (seg.type === "text") {
          return (
            <Markdown key={i} style={markdownStyles} rules={markdownRules}>
              {seg.text}
            </Markdown>
          )
        }
        return <ToolCallGroup key={i} tools={seg.tools} />
      })}
      {timestamp && <Text style={styles.timestampLeft}>{timestamp}</Text>}
    </Pressable>
  )
})

// --- ModelPicker ---

function ModelPicker({
  visible,
  onClose,
}: {
  visible: boolean
  onClose: () => void
}) {
  const providers = useSessionStore((state) => state.providers)
  const recentModels = useSessionStore((state) => state.recentModels)
  const selectedModel = useSessionStore((state) => state.selectedModel)
  const setSelectedModel = useSessionStore((state) => state.setSelectedModel)
  const [modelSearch, setModelSearch] = useState("")
  const [isModelSearchFocused, setIsModelSearchFocused] = useState(false)

  const providerOptions = useMemo(
    () =>
      providers.map((provider) => {
        const models = Object.entries(provider.models ?? {}).map(([modelID, model]) => ({
          providerID: provider.id,
          modelID,
          label: `${model.name ?? modelID}`,
        }))
        return { providerID: provider.id, providerName: provider.name, models }
      }),
    [providers]
  )

  const handleClose = () => {
    onClose()
    setModelSearch("")
  }

  const handleSelect = (providerID: string, modelID: string) => {
    setSelectedModel({ providerID, modelID })
    handleClose()
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.modalBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Select model</Text>
          <TextInput
            style={[styles.modalSearch, isModelSearchFocused && styles.modalSearchFocused]}
            value={modelSearch}
            onChangeText={setModelSearch}
            onFocus={() => setIsModelSearchFocused(true)}
            onBlur={() => setIsModelSearchFocused(false)}
            placeholder="Search models..."
            placeholderTextColor={colors.text.weaker}
            autoFocus
          />
          <View style={styles.modalList}>
            <ScrollView style={{ maxHeight: 300 }} keyboardShouldPersistTaps="handled">
              {!modelSearch && recentModels.length > 0 && (
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Recent</Text>
                  {recentModels.map((recent) => {
                    const provider = providers.find((p) => p.id === recent.providerID)
                    const model = provider?.models?.[recent.modelID]
                    if (!model) return null
                    const isSelected =
                      selectedModel?.providerID === recent.providerID && selectedModel?.modelID === recent.modelID
                    return (
                      <PressableScale
                        key={`recent-${recent.providerID}/${recent.modelID}`}
                        style={[styles.modalItem, isSelected && styles.modalItemActive]}
                        onPress={() => handleSelect(recent.providerID, recent.modelID)}
                      >
                        <Text style={styles.modalItemText}>{model.name ?? recent.modelID}</Text>
                        <Text style={styles.modalItemSubtext}>{provider?.name}</Text>
                      </PressableScale>
                    )
                  })}
                </View>
              )}
              {providerOptions.map((provider) => {
                const query = modelSearch.toLowerCase()
                const filtered = query
                  ? provider.models.filter(
                      (m) =>
                        m.label.toLowerCase().includes(query) ||
                        m.modelID.toLowerCase().includes(query) ||
                        provider.providerName.toLowerCase().includes(query)
                    )
                  : provider.models
                if (query && filtered.length === 0) return null
                return (
                  <View key={provider.providerID} style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>{provider.providerName}</Text>
                    {filtered.length === 0 ? (
                      <Text style={styles.modalEmpty}>No models available</Text>
                    ) : (
                      filtered.map((option) => {
                        const isSelected =
                          selectedModel?.providerID === option.providerID && selectedModel?.modelID === option.modelID
                        return (
                          <PressableScale
                            key={`${option.providerID}/${option.modelID}`}
                            style={[styles.modalItem, isSelected && styles.modalItemActive]}
                            onPress={() => handleSelect(option.providerID, option.modelID)}
                          >
                            <Text style={styles.modalItemText}>{option.label}</Text>
                          </PressableScale>
                        )
                      })
                    )}
                  </View>
                )
              })}
              {providers.length === 0 ? <Text style={styles.modalEmpty}>No providers available</Text> : null}
            </ScrollView>
          </View>
        </View>
      </View>
    </Modal>
  )
}

// --- Main Screen ---

// Stable action references — zustand actions are referentially stable, so
// grouping them into a single selector avoids 9 separate subscriptions without
// causing extra re-renders.
const useActions = () =>
  useSessionStore(
    useShallow((state) => ({
      sendPrompt: state.sendPrompt,
      fetchMessages: state.fetchMessages,
      abortSession: state.abortSession,
      revertSession: state.revertSession,
      unrevertSession: state.unrevertSession,
      subscribeToEvents: state.subscribeToEvents,
      closeEventSource: state.closeEventSource,
    }))
  )

export default function SessionDetailScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<ProjectsStackParamList>>()
  const route = useRoute<RouteProp<ProjectsStackParamList, "SessionDetail">>()

  // Actions (stable references, single subscription)
  const {
    sendPrompt,
    fetchMessages,
    abortSession,
    revertSession,
    unrevertSession,
    subscribeToEvents,
    closeEventSource,
  } = useActions()

  // Reactive state (individual selectors — each triggers re-render only when its value changes)
  const currentSession = useSessionStore((state) => state.currentSession)
  const currentProject = useSessionStore((state) => state.currentProject)
  const currentServer = useSessionStore((state) => state.currentServer)
  const messages = useSessionStore((state) => state.messages)
  const providers = useSessionStore((state) => state.providers)
  const selectedModel = useSessionStore((state) => state.selectedModel)
  const isAgentWorking = useSessionStore((state) => state.isAgentWorking)
  const insets = useSafeAreaInsets()
  const sessionId = currentSession?.id ?? route.params?.sessionId

  const [inputText, setInputText] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isAtBottom, setIsAtBottom] = useState(true)
  const [isModelPickerOpen, setIsModelPickerOpen] = useState(false)
  const [isComposerFocused, setIsComposerFocused] = useState(false)
  const flatListRef = useRef<FlashListRef<Message>>(null)
  const inputRef = useRef<TextInput>(null)
  const messageCountAtScrollRef = useRef(0)
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (sessionId) {
      setIsLoading(true)
      void fetchMessages(sessionId).finally(() => setIsLoading(false))
      void subscribeToEvents(sessionId)
    }
  }, [sessionId])

  useEffect(() => {
    if (!currentProject && !currentServer) {
      return
    }
    void useSessionStore.getState().fetchProviders()
  }, [currentProject, currentServer])

  // Cleanup EventSource on unmount
  useEffect(() => {
    return () => {
      closeEventSource()
    }
  }, [])

  // Auto-focus composer when arriving at an empty new session
  useEffect(() => {
    if (!isLoading && messages.length === 0) {
      inputRef.current?.focus()
    }
  }, [isLoading, messages.length])

  // Track unread messages when scrolled up
  useEffect(() => {
    if (!isAtBottom) {
      setUnreadCount(messages.length - messageCountAtScrollRef.current)
    } else {
      setUnreadCount(0)
      messageCountAtScrollRef.current = messages.length
    }
  }, [messages.length, isAtBottom])

  const handleSend = () => {
    if (!inputText.trim() || !sessionId || isAgentWorking) {
      return
    }

    const text = inputText.trim()
    setInputText("")
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    void sendPrompt(sessionId, text)
  }

  // Newest-first order: the list is visually inverted (scaleY: -1) so index 0
  // renders at the bottom of the viewport. This keeps the latest messages
  // pinned to the bottom without needing FlashList's `inverted` prop.
  const listData = React.useMemo(() => {
    const reversed = [...messages].reverse()
    if (isAgentWorking) {
      return [{ id: "__thinking__", role: "assistant" } as Message, ...reversed]
    }
    return reversed
  }, [messages, isAgentWorking])

  const modelDisplayName = useMemo(() => {
    if (!selectedModel) return "No model"
    const provider = providers.find((p) => p.id === selectedModel.providerID)
    const model = provider?.models?.[selectedModel.modelID]
    return model?.name ?? selectedModel.modelID
  }, [selectedModel, providers])

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 0}
    >
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <View style={styles.headerLeft}>
          <PressableScale style={styles.headerButton} onPress={() => { Keyboard.dismiss(); navigation.goBack() }} accessibilityLabel="Go back" accessibilityRole="button">
            <Ionicons name="chevron-back" size={22} color={colors.text.base} />
          </PressableScale>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {currentSession?.title || "New session"}
          </Text>
        </View>
        <View style={styles.headerRight}>
          {isAgentWorking && sessionId ? (
            <PressableScale
              style={styles.headerButton}
              onPress={() => void abortSession(sessionId)}
              accessibilityLabel="Stop agent"
              accessibilityRole="button"
            >
              <Ionicons name="stop" size={18} color={palette.ember[9]} />
            </PressableScale>
          ) : null}
          {sessionId ? (
            <PressableScale
              style={[styles.headerButton, !currentSession?.revert?.messageID && styles.headerButtonDisabled]}
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                void revertSession(
                  sessionId,
                  currentSession?.revert?.messageID,
                  currentSession?.revert?.partID
                )
              }}
              disabled={!currentSession?.revert?.messageID}
              accessibilityLabel="Undo"
              accessibilityRole="button"
            >
              <Ionicons name="arrow-undo" size={18} color={currentSession?.revert?.messageID ? colors.interactive.base : palette.smoke[4]} />
            </PressableScale>
          ) : null}
          {sessionId ? (
            <PressableScale
              style={[styles.headerButton, !currentSession?.revert?.messageID && styles.headerButtonDisabled]}
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                void unrevertSession(sessionId)
              }}
              disabled={!currentSession?.revert?.messageID}
              accessibilityLabel="Redo"
              accessibilityRole="button"
            >
              <Ionicons name="arrow-redo" size={18} color={currentSession?.revert?.messageID ? colors.interactive.base : palette.smoke[4]} />
            </PressableScale>
          ) : null}
          {sessionId ? (
            <PressableScale
              style={styles.headerButton}
              onPress={() => navigation.navigate("Review", { sessionId })}
              accessibilityLabel="Review changes"
              accessibilityRole="button"
            >
              <Ionicons name="git-pull-request" size={18} color={colors.interactive.base} />
            </PressableScale>
          ) : null}
          {sessionId ? (
            <PressableScale
              style={styles.headerButton}
              onPress={() => navigation.navigate("Share", { sessionId })}
              accessibilityLabel="Share session"
              accessibilityRole="button"
            >
              <Ionicons name="share-outline" size={18} color={colors.interactive.base} />
            </PressableScale>
          ) : null}
        </View>
      </View>

      <View style={styles.messagesContainer}>
        {isLoading ? (
          <View style={styles.loadingState}>
            <MessageSkeleton />
            <Text style={styles.loadingText}>Loading messages...</Text>
          </View>
        ) : messages.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="chatbox-outline" size={48} color={palette.smoke[5]} style={{ marginBottom: 12 }} />
            <Text style={styles.emptyStateText}>
              No messages yet
            </Text>
            <Text style={styles.emptyStateHint}>
              Type a message below to get started.
            </Text>
          </View>
        ) : (
          <>
            <FlashList
              ref={flatListRef}
              data={listData}
              keyExtractor={(item) => item.id}
              overScrollMode="never"
              keyboardDismissMode="on-drag"
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                const row =
                  item.id === "__thinking__" ? (
                    <ThinkingIndicator />
                  ) : (
                    <MessageRow message={item} />
                  )
                // Flip each row back upright (the list itself is flipped)
                return <View style={styles.invertedRow}>{row}</View>
              }}
              contentContainerStyle={styles.messagesList}
              // Visually invert: newest (index 0) renders at the bottom
              style={styles.invertedList}
              onScroll={(event) => {
                const offsetY = event.nativeEvent.contentOffset.y
                const wasAtBottom = isAtBottom
                const nowAtBottom = offsetY < 32
                // In an inverted list, offset 0 = bottom (newest messages)
                if (!wasAtBottom && nowAtBottom) {
                  setUnreadCount(0)
                  messageCountAtScrollRef.current = messages.length
                } else if (wasAtBottom && !nowAtBottom) {
                  messageCountAtScrollRef.current = messages.length
                }
                setIsAtBottom(nowAtBottom)
              }}
            />

            {!isAtBottom ? (
              <Pressable
                style={styles.jumpToLatest}
                onPress={() => {
                  flatListRef.current?.scrollToOffset({ offset: 0, animated: true })
                  setUnreadCount(0)
                  messageCountAtScrollRef.current = messages.length
                }}
              >
                <Text style={styles.jumpToLatestText}>
                  {unreadCount > 0 ? `↓ ${unreadCount} new` : "Jump to latest"}
                </Text>
              </Pressable>
            ) : null}
          </>
        )}
      </View>

      <ErrorBanner />

      {sessionId && (
        <View style={styles.composer}>
          {isComposerFocused && !inputText && currentSession?.title ? (
            <Text style={styles.composerSessionLabel} numberOfLines={1}>
              Session: {currentSession.title}
            </Text>
          ) : null}
          <View style={[styles.composerCard, isComposerFocused && styles.composerCardFocused]}>
            <TextInput
              ref={inputRef}
              style={styles.composerInput}
              value={inputText}
              onChangeText={setInputText}
              onSubmitEditing={handleSend}
              onFocus={() => setIsComposerFocused(true)}
              onBlur={() => setIsComposerFocused(false)}
              placeholder="Type a message..."
              placeholderTextColor={colors.text.weaker}
              selectionColor={colors.interactive.base}
              multiline
              maxLength={10000}
            />
            <View style={styles.composerBar}>
              <PressableScale
                style={styles.modelChip}
                onPress={() => {
                  void useSessionStore.getState().fetchProviders()
                  setIsModelPickerOpen(true)
                }}
              >
                <Text style={[styles.modelChipText, !selectedModel && styles.modelChipTextEmpty]}>
                  {modelDisplayName}
                </Text>
                <Ionicons name="chevron-down" size={10} color={palette.smoke[7]} />
              </PressableScale>
              {messages.length === 0 && (
                <Text style={styles.composerHint}>Tip: Use the send button</Text>
              )}
              <View style={{ flex: 1 }} />
              <PressableScale
                style={[
                  styles.sendButton,
                  (!inputText.trim() || isAgentWorking) && styles.sendButtonDisabled,
                ]}
                onPress={handleSend}
                disabled={!inputText.trim() && !isAgentWorking}
                accessibilityLabel="Send message"
                accessibilityRole="button"
              >
                {isAgentWorking ? (
                  <ActivityIndicator size="small" color={palette.smoke[1]} />
                ) : (
                  <Ionicons name="arrow-up" size={20} color={palette.smoke[1]} />
                )}
              </PressableScale>
            </View>
          </View>
        </View>
      )}

      <ModelPicker visible={isModelPickerOpen} onClose={() => setIsModelPickerOpen(false)} />
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.base,
  },
  // --- Header ---
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
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text.base,
    flexShrink: 1,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerButton: {
    padding: 10,
  },
  headerButtonDisabled: {
    opacity: 0.4,
  },
  // --- Messages ---
  messagesContainer: {
    flex: 1,
  },
  invertedList: {
    transform: [{ scaleY: -1 }],
  },
  invertedRow: {
    transform: [{ scaleY: -1 }],
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  loadingState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  loadingText: {
    fontSize: 14,
    color: colors.text.weak,
    marginTop: 12,
  },
  emptyStateText: {
    fontSize: 16,
    color: colors.text.weak,
    textAlign: "center",
  },
  emptyStateHint: {
    fontSize: 13,
    color: palette.smoke[6],
    textAlign: "center",
    marginTop: 4,
  },
  messagesList: {
    padding: 16,
  },
  jumpToLatest: {
    position: "absolute",
    right: 16,
    bottom: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: palette.smoke[3],
  },
  jumpToLatestText: {
    color: palette.smoke[10],
    fontSize: 12,
    fontWeight: "600",
  },
  // --- User messages (right-aligned bubbles) ---
  userRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingVertical: 6,
  },
  userBubble: {
    maxWidth: "80%",
    backgroundColor: palette.smoke[3],
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    borderBottomRightRadius: 4,
  },
  userBubbleText: {
    fontSize: 14,
    lineHeight: 20,
    color: palette.smoke[11],
  },
  // --- Timestamps ---
  timestampRight: {
    fontSize: 11,
    color: palette.smoke[6],
    alignSelf: "flex-end",
    marginTop: 2,
  },
  timestampLeft: {
    fontSize: 11,
    color: palette.smoke[6],
    marginTop: 2,
  },
  // --- Assistant messages (full width, no chrome) ---
  assistantRow: {
    paddingVertical: 8,
  },
  // --- ThinkingIndicator ---
  thinkingText: {
    fontSize: 13,
    color: palette.smoke[7],
  },
  // --- Tool calls (light, no border) ---
  toolGroup: {
    marginVertical: 4,
  },
  toolRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 3,
  },
  toolName: {
    fontSize: 12,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: palette.smoke[7],
  },
  toolTitle: {
    fontSize: 12,
    color: palette.smoke[6],
    flex: 1,
  },
  // --- Tool overlay ---
  toolOverlayBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  toolOverlayCard: {
    backgroundColor: colors.background.base,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: "80%",
    padding: 16,
    gap: 12,
  },
  toolOverlayHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  toolOverlayTitle: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: colors.text.base,
  },
  toolOverlaySection: {
    gap: 6,
  },
  toolOverlaySectionTitle: {
    fontSize: 11,
    fontWeight: "600",
    color: palette.smoke[7],
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  toolOverlayScroll: {
    maxHeight: 400,
    backgroundColor: palette.smoke[2],
    borderRadius: 8,
    padding: 10,
  },
  toolOverlayCode: {
    fontSize: 12,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: palette.smoke[10],
    lineHeight: 18,
  },
  // --- Composer ---
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
  composerCardFocused: {
    borderColor: palette.lilac[9],
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
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: palette.smoke[3],
    borderRadius: 6,
  },
  modelChipText: {
    fontSize: 11,
    color: palette.smoke[9],
  },
  modelChipTextEmpty: {
    color: palette.smoke[6],
  },
  composerAction: {
    padding: 6,
  },
  composerActionDisabled: {
    opacity: 0.4,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: palette.smoke[10],
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonDisabled: {
    opacity: 0.3,
  },
  composerSessionLabel: {
    fontSize: 11,
    color: palette.smoke[6],
    paddingHorizontal: 14,
    marginBottom: 2,
  },
  composerHint: {
    fontSize: 11,
    color: palette.smoke[5],
    marginLeft: 4,
  },
  // --- Modal ---
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    width: "100%",
    maxHeight: "70%",
    borderRadius: 12,
    backgroundColor: colors.background.base,
    borderWidth: 1,
    borderColor: colors.surface.highlight,
    padding: 16,
    gap: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text.base,
  },
  modalSearch: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.surface.highlight,
    borderRadius: 8,
    fontSize: 14,
    color: colors.text.base,
    backgroundColor: colors.surface.base,
  },
  modalSearchFocused: {
    borderColor: palette.lilac[9],
  },
  modalList: {
    gap: 8,
  },
  modalSection: {
    gap: 8,
  },
  modalSectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text.weak,
  },
  modalItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.surface.highlight,
    backgroundColor: colors.surface.base,
  },
  modalItemActive: {
    borderColor: colors.interactive.base,
    backgroundColor: palette.lilac[2],
  },
  modalItemText: {
    color: colors.text.base,
    fontSize: 14,
    fontWeight: "500",
  },
  modalItemSubtext: {
    color: colors.text.weak,
    fontSize: 11,
    marginTop: 2,
  },
  modalEmpty: {
    color: colors.text.weak,
    fontSize: 13,
  },
})

const markdownStyles = {
  body: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.text.base,
  },
  heading1: {
    fontSize: 20,
    fontWeight: "700" as const,
    marginTop: 12,
    marginBottom: 6,
    color: colors.text.base,
  },
  heading2: {
    fontSize: 17,
    fontWeight: "600" as const,
    marginTop: 10,
    marginBottom: 4,
    color: colors.text.base,
  },
  heading3: {
    fontSize: 14,
    fontWeight: "600" as const,
    marginTop: 8,
    marginBottom: 3,
    color: colors.text.base,
  },
  paragraph: {
    marginBottom: 8,
  },
  strong: {
    fontWeight: "700" as const,
  },
  em: {
    fontStyle: "italic" as const,
  },
  blockquote: {
    borderLeftWidth: 4,
    borderLeftColor: colors.surface.highlight,
    paddingLeft: 10,
    marginLeft: 0,
    color: colors.text.weak,
  },
  code_inline: {
    backgroundColor: colors.surface.highlight,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontSize: 12,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 3,
    color: colors.text.base,
  },
  code_block: {
    backgroundColor: colors.surface.strong,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontSize: 12,
    padding: 10,
    borderRadius: 6,
    color: colors.text.base,
  },
  fence: {
    backgroundColor: colors.surface.strong,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontSize: 12,
    padding: 10,
    borderRadius: 6,
    color: colors.text.base,
  },
  link: {
    color: colors.interactive.base,
    textDecorationLine: "underline" as const,
  },
  bullet_list: {
    marginBottom: 12,
  },
  ordered_list: {
    marginBottom: 12,
  },
  list_item: {
    flexDirection: "row" as const,
    alignItems: "flex-start" as const,
    marginBottom: 4,
  },
  bullet: {
    marginRight: 8,
    marginTop: 4,
  },
  table: {
    borderWidth: 1,
    borderColor: colors.surface.highlight,
    borderRadius: 8,
    marginVertical: 8,
  },
  thead: {
    backgroundColor: colors.surface.base,
  },
  tbody: {},
  th: {
    padding: 8,
    borderWidth: 1,
    borderColor: colors.surface.highlight,
    fontWeight: "600" as const,
  },
  td: {
    padding: 8,
    borderWidth: 1,
    borderColor: colors.surface.highlight,
  },
  horizontal_rule: {
    borderTopWidth: 1,
    borderTopColor: colors.surface.highlight,
    marginVertical: 16,
  },
}
