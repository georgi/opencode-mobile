import React, { useState, useRef, useEffect } from "react"
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native"
import { useNavigation, useRoute } from "@react-navigation/native"
import type { NativeStackNavigationProp } from "@react-navigation/native-stack"
import type { RouteProp } from "@react-navigation/native"
import { useSessionStore } from "../store/sessionStore"
import type { ProjectsStackParamList } from "../navigation/ProjectsStack"
import type { Message, Part, ReasoningPart, ToolPart, TextPart } from "../../types.gen"

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
  const hasReasoning = parts.some((p) => p.type === "reasoning")
  const hasTool = parts.some((p) => p.type === "tool")

  return (
    <View
      style={[
        styles.messageBubble,
        isUser ? styles.userBubble : styles.assistantBubble,
      ]}
    >
      <View style={styles.messageHeader}>
        <Text
          style={[
            styles.messageRole,
            isUser ? styles.userRoleText : styles.assistantRoleText,
          ]}
        >
          {isUser ? "You" : "Assistant"}
        </Text>
        {hasReasoning && !isUser && (
          <View style={styles.reasoningBadge}>
            <Text style={styles.reasoningBadgeText}>Thinking</Text>
          </View>
        )}
        {hasTool && !isUser && (
          <View style={styles.toolBadge}>
            <Text style={styles.toolBadgeText}>Tool</Text>
          </View>
        )}
      </View>
      <Text
        style={[
          styles.messageText,
          isUser ? styles.userMessageText : styles.assistantMessageText,
        ]}
      >
        {text}
      </Text>
      <Text
        style={[
          styles.messageTime,
          isUser ? styles.userTimeText : styles.assistantTimeText,
        ]}
      >
        {formatTimestamp(message.time.created)}
      </Text>
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
  const sessionId = currentSession?.id ?? route.params?.sessionId

  const [inputText, setInputText] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const flatListRef = useRef<FlatList>(null)

  useEffect(() => {
    if (sessionId) {
      setIsLoading(true)
      void fetchMessages(sessionId).finally(() => setIsLoading(false))
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
    if (messages.length > 0 && flatListRef.current) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true })
      }, 100)
    }
  }, [messages.length])

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      <View style={styles.header}>
        <Text style={styles.title}>{currentSession?.title ?? "Session"}</Text>
        <View style={styles.headerActions}>
          {sessionId && (
            <Pressable
              style={styles.headerButton}
              onPress={() => navigation.navigate("Review", { sessionId })}
            >
              <Text style={styles.headerButtonText}>Review</Text>
            </Pressable>
          )}
          {sessionId && (
            <Pressable
              style={styles.headerButton}
              onPress={() => navigation.navigate("Share", { sessionId })}
            >
              <Text style={styles.headerButtonText}>Share</Text>
            </Pressable>
          )}
        </View>
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
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <MessageBubble message={item} parts={messageParts[item.id] ?? []} />
            )}
            contentContainerStyle={styles.messagesList}
            onContentSizeChange={() =>
              flatListRef.current?.scrollToEnd({ animated: true })
            }
          />
        )}
      </View>

      {sessionId && (
        <View style={styles.sessionBar}>
          <Pressable
            style={styles.sessionButton}
            onPress={() => void abortSession(sessionId)}
          >
            <Text style={styles.sessionButtonText}>Stop</Text>
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
            <Text style={styles.sessionButtonText}>Undo</Text>
          </Pressable>
          <Pressable
            style={styles.sessionButton}
            onPress={() => void unrevertSession(sessionId)}
          >
            <Text style={styles.sessionButtonText}>Redo</Text>
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
  headerActions: {
    flexDirection: "row",
    gap: 8,
  },
  headerButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#F4F4F5",
    borderRadius: 6,
  },
  headerButtonText: {
    fontSize: 14,
    color: "#52525B",
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
    gap: 12,
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
  sessionBar: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#E4E4E7",
    backgroundColor: "white",
  },
  sessionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  sessionButtonText: {
    fontSize: 14,
    color: "#2563EB",
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
