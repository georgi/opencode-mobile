# 📄 spec.expo-client.md

**Project:** Expo Touch Client for OpenCode
**Version:** 0.1.0
**Target Audience:** LLMs acting as Senior Mobile Engineers (React Native/Expo)
**Primary Objective:** Build a touch-first Expo client with parity to core web session flows.

## 1. 🛑 The "Iron Laws" (Meta-Invariants)
- Packaging Law: The app must be a single Expo project with no native modules outside Expo-managed dependencies.
- I/O Law: All network calls must go through `createOpencodeClient`; direct fetch calls to API endpoints are forbidden.
- Runtime Law: The app must run on Expo SDK 50+ and React Native 0.73+ with no Node.js-only APIs in UI code.
- Architecture Law: Session state is owned by a single store module; UI components must not mutate state directly.
- Verification Law: A smoke test must verify session create → prompt → diff flow against a mocked client.

### Exact Strings
- `ERR OFFLINE`
- `ERR SERVER UNAVAILABLE`
- `ERR PERMISSION REQUIRED`
- `ERR INVALID ATTACHMENT`
- `ERR INVALID COMMAND`
- `ERR UNKNOWN`

## 2. 🏗️ Structural Components

### 2.1 Header Metadata
- **Project Name:** expo-client
- **Architecture Style:** React Native + Expo, unidirectional state store
- **Primary Objective:** Build a fast, touch-first session client aligned with web UI flows

### 2.2 System Invariants
1. The client must never send prompts while offline; it must surface `ERR OFFLINE`.
2. The client must never bypass the SDK client for API calls.

### Expo/Metro Note
- Metro must resolve `package.json#exports` for `@opencode-ai/sdk/v2/client`; enable this via `metro.config.js` (`resolver.unstable_enablePackageExports = true`).
3. The UI must never block token streaming on slow renders.
4. The client must never mutate session state outside the store module.
5. The app must never attempt local file editing or on-device repository changes.

### 2.3 Tech Stack
- **Runtime:** Expo SDK 50+ (React Native 0.73+)
- **Libraries:** `expo`, `react-native`, `@react-navigation/*`, `@opencode-ai/sdk`
- **External Deps:** NONE beyond Expo-managed packages and the OpenCode SDK

### 2.4 Data Architecture
**Schema Definition:**
```ts
import type {
  Event,
  FileDiff,
  Message,
  OpencodeClient,
  PermissionRequest,
  Project,
  Session,
  SessionStatus,
} from "@opencode-ai/sdk/v2/client"

type ServerConfig = {
  id: string
  label: string
  baseUrl: `${string}://${string}`
  directory: string
  basicAuth: string
}

type SessionState = {
  currentServer?: ServerConfig
  currentProject?: Project
  currentSession?: Session
  messages: Message[]
  pendingPermissions: PermissionRequest[]
  isOffline: boolean
  lastError?: string
}
```

State Management:
- State lives in a single store module and is mutated only via store actions.
- SDK types must be imported from `@opencode-ai/sdk/v2/client`. Avoid deep imports into `dist/*` or `gen/*` paths.

Mutation Rules:
- All writes occur via store actions that wrap SDK calls.
- If multiple async calls race, the latest successful response wins; errors set `lastError` without discarding prior state.

Deletion Semantics:
- Session deletion is not supported in v0.1; no tombstones or rollback semantics apply.

### 2.5 Core Algorithms

I. Session Flow Orchestration:
- Inputs: `ServerConfig`, `Project`, `worktreeId?`
- Outputs: `Session`, updated `SessionState`
- Steps:
  1. Validate server selection and auth.
  2. Call `client.session.create` with directory/worktree.
  3. Update store with new session and clear errors.
  4. Begin message stream subscription.
- Edge Cases:
  - Server unreachable → set `ERR SERVER UNAVAILABLE`.
  - Offline → set `ERR OFFLINE` and abort.
- Complexity: O(1) per session creation, excluding network latency.

II. Prompt Dispatch + Streaming:
- Inputs: `sessionId`, `promptText`, `attachments?`
- Outputs: Updated message list, stream tokens to UI
- Steps:
  1. Validate attachments (type/size).
  2. Send prompt via `client.session.prompt`.
  3. Stream tokens into a temporary message buffer.
  4. Commit message into store on completion.
- Edge Cases:
  - Invalid attachment → `ERR INVALID ATTACHMENT`.
  - Permission required → `ERR PERMISSION REQUIRED` and surface banner.
- Complexity: O(n) where n is streamed token count.

### 2.6 Interface Specification

Inputs:
- `server.select(serverId)` -> Output: No Output; Side effect: updates current server; Error: `ERR SERVER UNAVAILABLE`
- `project.open(projectId)` -> Output: No Output; Side effect: loads sessions list
- `session.start(projectId, worktreeId?)` -> Output: No Output; Side effect: creates session
- `session.prompt(text, attachments?)` -> Output: stream tokens; Side effect: message appended
- `session.abort()` -> Output: No Output; Side effect: stops stream
- `session.undo()` -> Output: No Output; Side effect: reverts last change
- `session.redo()` -> Output: No Output; Side effect: unreverts last change
- `session.diff()` -> Output: unified diff text; Side effect: none
- `permission.respond(id, decision)` -> Output: No Output; Side effect: updates permission state
- `share.toggle(enabled, expiresAt?)` -> Output: share link or No Output; Side effect: updates share state

Parsing Rules (Strict):
1. UI actions are dispatched only from typed handlers; raw string commands are forbidden.
2. Inputs are validated for required fields before SDK calls.
3. Unknown action types are rejected with `ERR INVALID COMMAND`.
4. Blank or empty prompt text is a no-op with no error.
5. Attachment lists must be arrays; otherwise `ERR INVALID ATTACHMENT`.

Error Messages (Exact):
- `ERR OFFLINE` when device is offline.
- `ERR SERVER UNAVAILABLE` when health check fails or request times out.
- `ERR PERMISSION REQUIRED` when permission events are pending for the session.
- `ERR INVALID ATTACHMENT` on non-image/file or size violations.
- `ERR INVALID COMMAND` for unknown UI action dispatch.
- `ERR UNKNOWN` for uncaught runtime errors.

Example Session:

> Select server "prod-us"
... server badge updates
> Open project "opencode"
... sessions list loads
> Start session
... session detail opens
> Prompt "Summarize changes"
... tokens stream into assistant message

### 2.7 Verification & Implementation

Self-Test Checklist:
1. Start session, prompt, undo, then redo and confirm message list is restored.
2. Open project → sessions list → session detail → review screen without losing state.
3. Trigger permission banner, respond, then verify prompt resumes correctly.

Phasing:
1. Navigation skeleton and core screens; complete when tab/stack routes render.
2. SDK integration for sessions and prompts; complete when prompt streams and diffs show.
3. Permissions, sharing, and notifications; complete when banners and sheets reflect events.

### 2.8 Required Public API (For Tests)
1. `createOpencodeClient(config: { baseUrl: string; directory?: string; headers?: Record<string, string> }): OpencodeClient`
2. `OpencodeClient.session.create({ directory?: string; title?: string; parentID?: string }): Promise<{ data?: Session }>`
3. `OpencodeClient.session.prompt({ sessionID: string; directory?: string; parts?: PartInput[] }): Promise<{ data?: unknown }>`
4. `OpencodeClient.session.diff({ sessionID: string; directory?: string }): Promise<{ data?: FileDiff[] }>`
5. `OpencodeClient.permission.reply({ requestID: string; directory?: string; reply: "once" | "always" | "reject" }): Promise<{ data?: boolean }>`

### 2.9 Verification Gates (Mandatory)
1. `npm test -- --watch=false`
2. `npm run lint`
3. `npm run typecheck`

### 2.10 Test Suites (Required)
1. Unit: `tests/unit` for store actions and validation rules.
2. Integration: `tests/integration` for mocked SDK flows.
3. Coverage: streaming prompt flow, permission banner handling, offline state, and share toggling.

---

# Minimal Parameter Schema (YAML)
```yaml
project_name: "Expo Touch Client"
project_slug: "expo-client"
version: "0.1.0"
persona: "LLMs acting as Senior Mobile Engineers (React Native/Expo)"
language: "typescript"
runtime: "Expo SDK 50+"
interface_type: "GUI"
objective: "Build a touch-first Expo client aligned with web session workflows."
constraints:
  - "No local file editing on device"
  - "SDK client required for all API calls"
  - "Exact error strings for offline/permission states"
exact_strings:
  - "ERR OFFLINE"
  - "ERR SERVER UNAVAILABLE"
  - "ERR PERMISSION REQUIRED"
  - "ERR INVALID ATTACHMENT"
  - "ERR INVALID COMMAND"
  - "ERR UNKNOWN"
core_features:
  - "Server/project/worktree selection"
  - "Session create/prompt/abort/undo/redo"
  - "Diffs, share, permissions"
error_model:
  offline: "ERR OFFLINE"
  unavailable: "ERR SERVER UNAVAILABLE"
  permission: "ERR PERMISSION REQUIRED"
  invalid_attachment: "ERR INVALID ATTACHMENT"
  invalid_command: "ERR INVALID COMMAND"
  unknown: "ERR UNKNOWN"
public_api:
  - name: "createOpencodeClient"
    signature: "createOpencodeClient({ baseUrl, directory?, headers? }) -> OpencodeClient"
  - name: "OpencodeClient.session.create"
    signature: "({ directory?, title?, parentID? }) -> { data?: Session }"
  - name: "OpencodeClient.session.prompt"
    signature: "({ sessionID, directory?, parts? }) -> { data?: unknown }"
  - name: "OpencodeClient.session.diff"
    signature: "({ sessionID, directory?, messageID? }) -> { data?: FileDiff[] }"
verification_gates:
  - "npm test -- --watch=false"
  - "npm run lint"
  - "npm run typecheck"
tests:
  unit_dir: "tests/unit"
  integration_dir: "tests/integration"
  integration_method: "mocked_sdk"
coverage:
  - "Session create/prompt/stream"
  - "Permission banners"
  - "Offline and server unavailable handling"
  - "Share toggle and expiry"
```
