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

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

function getPartText(parts: Part[]): string {
  if (!parts || parts.length === 0) {
    return ""
  }

  const texts: string[] = []

  for (const part of parts) {
    if (part.type === "text" && (part as TextPart).text) {
      texts.push((part as TextPart).text)
    } else if (part.type === "reasoning" && (part as ReasoningPart).text) {
      texts.push((part as ReasoningPart).text)
    } else if (part.type === "tool" && (part as ToolPart).state) {
      const toolPart = part as ToolPart
      if (toolPart.state.status === "completed") {
        texts.push(`${toolPart.tool}\n${toolPart.state.output}`)
      } else if (toolPart.state.status === "running") {
        texts.push(`${toolPart.tool}...`)
      } else if (toolPart.state.status === "pending") {
        texts.push(`${toolPart.tool}`)
      }
    }
  }

  return texts.join("\n\n")
}

function MessageBubble({
  message,
  parts,
}: {
  message: Message
  parts: Part[]
}) {
  const isUser = message.role === "user"
  const text = getPartText(parts)

  return (
    <View style={[styles.messageContainer, isUser ? styles.userMessage : styles.assistantMessage]}>
      <View style={styles.messageMeta}>
        <Text style={styles.roleLabel}>{isUser ? "You" : "Assistant"}</Text>
        <Text style={styles.timestamp}>{formatTimestamp(message.time.created)}</Text>
      </View>
      <View style={styles.messageContent}>
        <Markdown style={markdownStyles}>{text}</Markdown>
      </View>
    </View>
  )
}

export default function SessionDetailScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<ProjectsStackParamList>>()
  const route = useRoute<RouteProp<ProjectsStackParamList, "SessionDetail">>()
  const currentSession = useSessionStore((state) => state.currentSession)
  const messages = useSessionStore((state) => state.messages)
  const messageParts = useSessionStore((state) => state.messageParts)
  const sendPrompt = useSessionStore((state) => state.sendPrompt)
  const fetchMessages = useSessionStore((state) => state.fetchMessages)
  const lastError = useSessionStore((state) => state.lastError)
  const abortSession = useSessionStore((state) => state.abortSession)
  const revertSession = useSessionStore((state) => state.revertSession)
  const unrevertSession = useSessionStore((state) => state.unrevertSession)
  const isAgentWorking = useSessionStore((state) => state.isAgentWorking)
  const setAgentWorking = useSessionStore((state) => state.setAgentWorking)
  const subscribeToEvents = useSessionStore((state) => state.subscribeToEvents)
  const sessionId = currentSession?.id ?? route.params?.sessionId

  const [inputText, setInputText] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isAtBottom, setIsAtBottom] = useState(true)
  const flatListRef = useRef<FlashListRef<Message>>(null)

  useEffect(() => {
    if (sessionId) {
      setIsLoading(true)
      void fetchMessages(sessionId).finally(() => setIsLoading(false))
      void subscribeToEvents()
    }
  }, [sessionId])

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

  useEffect(() => {
    if (messages.length > 0 && flatListRef.current && isAtBottom) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true })
      }, 100)
    }
  }, [messages.length, isAtBottom])

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      <View style={styles.header}>
        <Text style={styles.title}>{currentSession?.title ?? "Session"}</Text>
      </View>

      <View style={styles.messagesContainer}>
        {isLoading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator size="large" color="#2563EB" />
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
            {isAgentWorking && (
              <View style={styles.thinkingIndicator}>
                <ActivityIndicator size="small" color="#2563EB" />
                <Text style={styles.thinkingText}>Agent is thinking...</Text>
              </View>
            )}
            <FlashList
              ref={flatListRef}
              data={[...messages].reverse()}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <MessageBubble message={item} parts={messageParts[item.id] ?? []} />
              )}
              contentContainerStyle={styles.messagesList}
              onScroll={(event) => {
                const offsetY = event.nativeEvent.contentOffset.y
                setIsAtBottom(offsetY < 32)
              }}
            />

            {!isAtBottom ? (
              <Pressable
                style={styles.jumpToLatest}
                onPress={() => flatListRef.current?.scrollToEnd({ animated: false })}
              >
                <Text style={styles.jumpToLatestText}>Jump to latest</Text>
              </Pressable>
            ) : null}
          </>
        )}
      </View>

      {sessionId && (
        <View style={styles.sessionBar}>
          <Pressable
            style={styles.sessionButton}
            onPress={() => void abortSession(sessionId)}
          >
            <Ionicons name="stop" size={18} color="#DC2626" />
          </Pressable>
          <Pressable
            style={styles.sessionButton}
            onPress={() =>
              void revertSession(
                sessionId,
                currentSession?.revert?.messageID,
                currentSession?.revert?.partID
              )
            }
          >
            <Ionicons name="arrow-undo" size={18} color="#2563EB" />
          </Pressable>
          <Pressable
            style={styles.sessionButton}
            onPress={() => void unrevertSession(sessionId)}
          >
            <Ionicons name="arrow-redo" size={18} color="#2563EB" />
          </Pressable>
          <View style={styles.sessionDivider} />
          <Pressable
            style={styles.sessionButton}
            onPress={() => navigation.navigate("Review", { sessionId })}
          >
            <Ionicons name="git-pull-request" size={18} color="#2563EB" />
          </Pressable>
          <Pressable
            style={styles.sessionButton}
            onPress={() => navigation.navigate("Share", { sessionId })}
          >
            <Ionicons name="share" size={18} color="#2563EB" />
          </Pressable>
        </View>
      )}

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={setInputText}
          onSubmitEditing={handleSend}
          placeholder="Type a message..."
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
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAFAFA",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E4E4E7",
    backgroundColor: "white",
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
  },
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
    color: "#71717A",
    marginTop: 12,
  },
  emptyStateText: {
    fontSize: 16,
    color: "#71717A",
    textAlign: "center",
  },
  messagesList: {
    padding: 16,
    gap: 24,
  },
  jumpToLatest: {
    position: "absolute",
    right: 16,
    bottom: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#2563EB",
  },
  jumpToLatestText: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
  },
  messageBubble: {
    maxWidth: "85%",
    padding: 12,
    borderRadius: 16,
  },
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: "#2563EB",
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    alignSelf: "flex-start",
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#E4E4E7",
    borderBottomLeftRadius: 4,
  },
  messageRole: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 4,
  },
  messageHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  reasoningBadge: {
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  reasoningBadgeText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#D97706",
  },
  toolBadge: {
    backgroundColor: "#DBEAFE",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  toolBadgeText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#2563EB",
  },
  userRoleText: {
    color: "rgba(255, 255, 255, 0.8)",
  },
  assistantRoleText: {
    color: "#52525B",
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  userMessageText: {
    color: "white",
  },
  assistantMessageText: {
    color: "#18181B",
  },
  messageTime: {
    fontSize: 11,
    marginTop: 4,
  },
  userTimeText: {
    color: "rgba(255, 255, 255, 0.6)",
  },
  assistantTimeText: {
    color: "#A1A1AA",
  },
  messageContainer: {
    width: "100%",
    paddingVertical: 12,
  },
  userMessage: {
    backgroundColor: "#EFF6FF",
  },
  assistantMessage: {
    backgroundColor: "transparent",
  },
  messageMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  roleLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#71717A",
  },
  timestamp: {
    fontSize: 12,
    color: "#A1A1AA",
  },
  messageContent: {
    flex: 1,
  },
  sessionBar: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#E4E4E7",
    backgroundColor: "white",
  },
  sessionDivider: {
    width: 1,
    height: 24,
    backgroundColor: "#E4E4E7",
  },
  sessionButton: {
    padding: 8,
  },
  thinkingIndicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
  },
  thinkingText: {
    fontSize: 14,
    color: "#71717A",
    fontWeight: "500",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 12,
    gap: 8,
    backgroundColor: "white",
    borderTopWidth: 1,
    borderTopColor: "#E4E4E7",
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#E4E4E7",
    borderRadius: 20,
    fontSize: 15,
  },
  sendButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#2563EB",
    borderRadius: 20,
    minWidth: 70,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonDisabled: {
    backgroundColor: "#94A3B8",
  },
  sendButtonText: {
    color: "white",
    fontSize: 15,
    fontWeight: "600",
  },
  error: {
    color: "#D92D20",
    padding: 12,
    textAlign: "center",
    backgroundColor: "#FEF2F2",
  },
})

const markdownStyles = {
  body: {
    fontSize: 12,
    lineHeight: 18,
    color: "#18181B",
  },
  heading1: {
    fontSize: 18,
    fontWeight: "700" as const,
    marginTop: 12,
    marginBottom: 6,
    color: "#18181B",
  },
  heading2: {
    fontSize: 15,
    fontWeight: "600" as const,
    marginTop: 10,
    marginBottom: 4,
    color: "#18181B",
  },
  heading3: {
    fontSize: 14,
    fontWeight: "600" as const,
    marginTop: 8,
    marginBottom: 3,
    color: "#18181B",
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
    borderLeftColor: "#E4E4E7",
    paddingLeft: 10,
    marginLeft: 0,
    color: "#52525B",
  },
  code: {
    backgroundColor: "#F4F4F5",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontSize: 10,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 3,
  },
  fence: {
    backgroundColor: "#1E1E1E",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontSize: 10,
    padding: 10,
    borderRadius: 6,
    color: "#D4D4D4",
  },
  link: {
    color: "#2563EB",
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
    borderColor: "#E4E4E7",
    borderRadius: 8,
    marginVertical: 8,
  },
  thead: {
    backgroundColor: "#F4F4F5",
  },
  tbody: {},
  th: {
    padding: 8,
    borderWidth: 1,
    borderColor: "#E4E4E7",
    fontWeight: "600" as const,
  },
  td: {
    padding: 8,
    borderWidth: 1,
    borderColor: "#E4E4E7",
  },
  horizontal_rule: {
    borderTopWidth: 1,
    borderTopColor: "#E4E4E7",
    marginVertical: 16,
  },
}
