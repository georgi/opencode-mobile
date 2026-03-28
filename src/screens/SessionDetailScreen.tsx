import React, { useState, useRef, useEffect } from "react"
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
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
import { useSessionStore } from "../store/sessionStore"
import type { ProjectsStackParamList } from "../navigation/ProjectsStack"
import type { Message, Part, ReasoningPart, TextPart, ToolPart } from "@opencode-ai/sdk/v2/client"
import { colors, palette } from "../constants/theme"

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

// --- ThinkingIndicator ---

const ThinkingIndicator = React.memo(function ThinkingIndicator() {
  return (
    <View style={styles.messageRow}>
      <View style={[styles.avatar, styles.assistantAvatar]}>
        <Ionicons name="sparkles" size={12} color={palette.smoke[9]} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.messageHeader}>
          <Text style={[styles.messageName, styles.assistantName]}>Assistant</Text>
        </View>
        <View style={[styles.messageBody, { flexDirection: "row", alignItems: "center", gap: 6 }]}>
          <ActivityIndicator size="small" color={colors.interactive.base} />
          <Text style={styles.thinkingText}>Thinking...</Text>
        </View>
      </View>
    </View>
  )
})

// --- ToolCallRow ---

function ToolCallRow({ tool }: { tool: ToolPart }) {
  const status = tool.state?.status
  const isError = status === "error"
  const isCompleted = status === "completed"
  const isRunning = status === "running" || status === "pending"

  let iconName: keyof typeof Ionicons.glyphMap = "ellipse"
  let iconColor = palette.smoke[7]
  if (isCompleted) {
    iconName = "checkmark-circle"
    iconColor = palette.apple[9]
  } else if (isError) {
    iconName = "close-circle"
    iconColor = palette.ember[9]
  } else if (isRunning) {
    iconName = "ellipse"
    iconColor = palette.solaris[9]
  }

  const title = tool.state?.title || ""

  return (
    <View style={styles.toolRow}>
      <Ionicons name={iconName} size={14} color={iconColor} />
      <Text
        style={[
          styles.toolName,
          isError && { color: palette.ember[11] },
        ]}
        numberOfLines={1}
      >
        {tool.tool}
      </Text>
      {title ? (
        <Text style={styles.toolTitle} numberOfLines={1}>
          {title}
        </Text>
      ) : null}
    </View>
  )
}

// --- ToolCallGroup ---

const ToolCallGroup = React.memo(function ToolCallGroup({ tools }: { tools: ToolPart[] }) {
  const allCompleted = tools.every((t) => t.state?.status === "completed")
  const [collapsed, setCollapsed] = useState(allCompleted)

  // Auto-expand when any tool is running/pending
  useEffect(() => {
    const anyActive = tools.some(
      (t) => t.state?.status === "running" || t.state?.status === "pending"
    )
    if (anyActive) setCollapsed(false)
  }, [tools])

  return (
    <View style={styles.toolGroup}>
      <Pressable style={styles.toolGroupHeader} onPress={() => setCollapsed((c) => !c)}>
        <Ionicons
          name={collapsed ? "chevron-forward" : "chevron-down"}
          size={12}
          color={palette.smoke[9]}
        />
        <Text style={styles.toolGroupHeaderText}>
          {tools.length} TOOL CALL{tools.length !== 1 ? "S" : ""}
        </Text>
      </Pressable>
      {!collapsed && (
        <View style={styles.toolGroupBody}>
          {tools.map((tool, i) => (
            <ToolCallRow key={`${tool.tool}-${i}`} tool={tool} />
          ))}
        </View>
      )}
    </View>
  )
})

// --- MessageRow ---

const MessageRow = React.memo(function MessageRow({
  message,
  parts,
}: {
  message: Message
  parts: Part[]
}) {
  const isUser = message.role === "user"
  const segments = groupParts(parts)

  return (
    <View style={styles.messageRow}>
      <View style={[styles.avatar, isUser ? styles.userAvatar : styles.assistantAvatar]}>
        {isUser ? (
          <Ionicons name="person" size={12} color={palette.smoke[9]} />
        ) : (
          <Ionicons name="sparkles" size={12} color={palette.smoke[9]} />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.messageHeader}>
          <Text style={[styles.messageName, isUser ? styles.userName : styles.assistantName]}>
            {isUser ? "You" : "Assistant"}
          </Text>
          <Text style={styles.messageTimestamp}>{formatTimestamp(message.time.created)}</Text>
        </View>
        <View style={styles.messageBody}>
          {segments.map((seg, i) => {
            if (seg.type === "text") {
              return (
                <Markdown key={i} style={markdownStyles}>
                  {seg.text}
                </Markdown>
              )
            }
            return <ToolCallGroup key={i} tools={seg.tools} />
          })}
        </View>
      </View>
    </View>
  )
})

// --- Main Screen ---

export default function SessionDetailScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<ProjectsStackParamList>>()
  const route = useRoute<RouteProp<ProjectsStackParamList, "SessionDetail">>()
  const currentSession = useSessionStore((state) => state.currentSession)
  const currentProject = useSessionStore((state) => state.currentProject)
  const currentServer = useSessionStore((state) => state.currentServer)
  const messages = useSessionStore((state) => state.messages)
  const messageParts = useSessionStore((state) => state.messageParts)
  const sendPrompt = useSessionStore((state) => state.sendPrompt)
  const fetchMessages = useSessionStore((state) => state.fetchMessages)
  const fetchProviders = useSessionStore((state) => state.fetchProviders)
  const providers = useSessionStore((state) => state.providers)
  const selectedModel = useSessionStore((state) => state.selectedModel)
  const setSelectedModel = useSessionStore((state) => state.setSelectedModel)
  const lastError = useSessionStore((state) => state.lastError)
  const abortSession = useSessionStore((state) => state.abortSession)
  const isAgentWorking = useSessionStore((state) => state.isAgentWorking)
  const subscribeToEvents = useSessionStore((state) => state.subscribeToEvents)
  const closeEventSource = useSessionStore((state) => state.closeEventSource)
  const sessionId = currentSession?.id ?? route.params?.sessionId

  const [inputText, setInputText] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isAtBottom, setIsAtBottom] = useState(true)
  const [isModelPickerOpen, setIsModelPickerOpen] = useState(false)
  const flatListRef = useRef<FlashListRef<Message>>(null)

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
    void fetchProviders()
  }, [currentProject, currentServer, fetchProviders])

  // Cleanup EventSource on unmount
  useEffect(() => {
    return () => {
      console.log("SessionDetailScreen unmounting, closing EventSource")
      closeEventSource()
    }
  }, [])

  const handleSend = async () => {
    if (!inputText.trim() || !sessionId || isSending) {
      return
    }

    const text = inputText.trim()
    setInputText("")
    setIsSending(true)

    try {
      await sendPrompt(sessionId, text)
    } finally {
      setIsSending(false)
    }
  }

  const listData = React.useMemo(() => {
    if (isAgentWorking) {
      return [{ id: "__thinking__", role: "assistant" } as Message, ...messages]
    }
    return messages
  }, [messages, isAgentWorking])

  const providerOptions = providers.map((provider) => {
    const models = Object.entries(provider.models ?? {}).map(([modelID, model]) => ({
      providerID: provider.id,
      modelID,
      label: `${model.name ?? modelID}`,
    }))
    return { providerID: provider.id, providerName: provider.name, models }
  })

  const modelOptions = providerOptions.flatMap((provider) => provider.models)

  const selectedModelLabel = (() => {
    if (!selectedModel) return "Select model"
    const provider = providers.find((item) => item.id === selectedModel.providerID)
    const model = provider?.models?.[selectedModel.modelID]
    if (!provider || !model) return "Select model"
    return `${provider.name} / ${model.name ?? selectedModel.modelID}`
  })()

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable style={styles.headerButton} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={22} color={colors.text.base} />
          </Pressable>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {currentSession?.title ?? "Session"}
          </Text>
        </View>
        <View style={styles.headerRight}>
          {isAgentWorking && sessionId ? (
            <Pressable
              style={styles.headerButton}
              onPress={() => void abortSession(sessionId)}
            >
              <Ionicons name="stop" size={18} color={palette.ember[9]} />
            </Pressable>
          ) : null}
          {sessionId ? (
            <Pressable
              style={styles.headerButton}
              onPress={() => navigation.navigate("Review", { sessionId })}
            >
              <Ionicons name="git-pull-request" size={18} color={colors.interactive.base} />
            </Pressable>
          ) : null}
          {sessionId ? (
            <Pressable
              style={styles.headerButton}
              onPress={() => navigation.navigate("Share", { sessionId })}
            >
              <Ionicons name="share-outline" size={18} color={colors.interactive.base} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={styles.messagesContainer}>
        {isLoading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator size="large" color={colors.interactive.base} />
            <Text style={styles.loadingText}>Loading messages...</Text>
          </View>
        ) : messages.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              No messages yet. Start a conversation!
            </Text>
          </View>
        ) : (
          <>
            <FlashList
              ref={flatListRef}
              data={listData}
              inverted
              keyExtractor={(item) => item.id}
              estimatedItemSize={120}
              extraData={messageParts}
              overScrollMode="never"
              renderItem={({ item }) => {
                if (item.id === "__thinking__") {
                  return <ThinkingIndicator />
                }
                return (
                  <MessageRow message={item} parts={messageParts[item.id] ?? []} />
                )
              }}
              contentContainerStyle={styles.messagesList}
              onScroll={(event) => {
                const offsetY = event.nativeEvent.contentOffset.y
                setIsAtBottom(offsetY < 32)
              }}
            />

            {!isAtBottom ? (
              <Pressable
                style={styles.jumpToLatest}
                onPress={() => flatListRef.current?.scrollToOffset({ offset: 0, animated: true })}
              >
                <Text style={styles.jumpToLatestText}>Jump to latest</Text>
              </Pressable>
            ) : null}
          </>
        )}
      </View>

      <View style={styles.modelBar}>
        <Text style={styles.modelLabel}>Model</Text>
        <Pressable
          style={[styles.modelButton, modelOptions.length === 0 && styles.modelButtonDisabled]}
          onPress={() => {
            void fetchProviders()
            setIsModelPickerOpen(true)
          }}
        >
          <Text style={styles.modelButtonText}>{selectedModelLabel}</Text>
          <Ionicons name="chevron-down" size={14} color={colors.text.weak} />
        </Pressable>
      </View>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={setInputText}
          onSubmitEditing={handleSend}
          placeholder="Type a message..."
          placeholderTextColor={colors.text.weaker}
          selectionColor={colors.interactive.base}
          multiline
          maxLength={10000}
        />
        <Pressable
          style={[
            styles.sendButton,
            (!inputText.trim() || isSending) && styles.sendButtonDisabled,
          ]}
          onPress={handleSend}
          disabled={!inputText.trim() || isSending}
        >
          {isSending ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text style={styles.sendButtonText}>Send</Text>
          )}
        </Pressable>
      </View>

      {lastError ? <Text style={styles.error}>{lastError}</Text> : null}

      <Modal
        visible={isModelPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsModelPickerOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setIsModelPickerOpen(false)} />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select model</Text>
            <View style={styles.modalList}>
              <ScrollView style={{ maxHeight: 300 }}>
                {providerOptions.map((provider) => (
                <View key={provider.providerID} style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>{provider.providerName}</Text>
                  {provider.models.length === 0 ? (
                    <Text style={styles.modalEmpty}>No models available</Text>
                  ) : (
                    provider.models.map((option) => {
                      const isSelected =
                        selectedModel?.providerID === option.providerID && selectedModel?.modelID === option.modelID
                      return (
                        <Pressable
                          key={`${option.providerID}/${option.modelID}`}
                          style={[styles.modalItem, isSelected && styles.modalItemActive]}
                          onPress={() => {
                            setSelectedModel({ providerID: option.providerID, modelID: option.modelID })
                            setIsModelPickerOpen(false)
                          }}
                        >
                          <Text style={styles.modalItemText}>{option.label}</Text>
                        </Pressable>
                      )
                    })
                  )}
                </View>
              ))}
              {providers.length === 0 ? <Text style={styles.modalEmpty}>No providers available</Text> : null}
              </ScrollView>
            </View>
          </View>
        </View>
      </Modal>
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
    maxWidth: "60%",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerButton: {
    padding: 8,
  },
  // --- Model bar ---
  modelBar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.surface.highlight,
    backgroundColor: colors.surface.base,
    gap: 8,
  },
  modelLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.text.weak,
  },
  modelButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.surface.highlight,
    backgroundColor: colors.background.base,
  },
  modelButtonDisabled: {
    opacity: 0.6,
  },
  modelButtonText: {
    color: colors.text.base,
    fontSize: 13,
    fontWeight: "600",
  },
  // --- Messages ---
  messagesContainer: {
    flex: 1,
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
    backgroundColor: colors.interactive.base,
  },
  jumpToLatestText: {
    color: colors.text.invert,
    fontSize: 12,
    fontWeight: "600",
  },
  // --- MessageRow ---
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
  },
  userAvatar: {
    backgroundColor: palette.smoke[4],
  },
  assistantAvatar: {
    backgroundColor: palette.smoke[3],
    borderWidth: 1,
    borderColor: palette.smoke[5],
  },
  messageHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  messageName: {
    fontSize: 13,
    fontWeight: "700",
  },
  userName: {
    color: palette.smoke[11],
  },
  assistantName: {
    color: palette.smoke[10],
  },
  messageTimestamp: {
    fontSize: 11,
    color: palette.smoke[7],
  },
  messageBody: {
    marginLeft: 0, // content is already indented by avatar (22) + gap (6) = 28
  },
  // --- ThinkingIndicator ---
  thinkingText: {
    fontSize: 13,
    color: colors.text.weak,
    fontWeight: "500",
  },
  // --- Tool groups ---
  toolGroup: {
    backgroundColor: palette.smoke[2],
    borderWidth: 1,
    borderColor: palette.smoke[4],
    borderRadius: 8,
    marginTop: 6,
    overflow: "hidden",
  },
  toolGroupHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: palette.smoke[1],
  },
  toolGroupHeaderText: {
    fontSize: 11,
    fontWeight: "700",
    color: palette.smoke[9],
    letterSpacing: 0.5,
  },
  toolGroupBody: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  toolRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 4,
  },
  toolName: {
    fontSize: 12,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: palette.smoke[11],
  },
  toolTitle: {
    fontSize: 12,
    color: palette.smoke[7],
    flex: 1,
  },
  // --- Input ---
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 12,
    gap: 8,
    backgroundColor: colors.background.base,
    borderTopWidth: 1,
    borderTopColor: colors.surface.highlight,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.input.border,
    borderRadius: 20,
    fontSize: 15,
    backgroundColor: colors.input.bg,
    color: colors.text.base,
  },
  sendButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.interactive.base,
    borderRadius: 20,
    minWidth: 70,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonDisabled: {
    backgroundColor: colors.interactive.hover,
    opacity: 0.5,
  },
  sendButtonText: {
    color: colors.text.invert,
    fontSize: 15,
    fontWeight: "600",
  },
  error: {
    color: colors.status.error,
    padding: 12,
    textAlign: "center",
    backgroundColor: palette.ember[2],
  },
  // --- Modal ---
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
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
    backgroundColor: palette.cobalt[1],
  },
  modalItemText: {
    color: colors.text.base,
    fontSize: 14,
    fontWeight: "500",
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
