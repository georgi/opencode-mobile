# Design: Expo Touch Client for OpenCode

## Overview

This document defines the technical design for the Expo touch-first client described in `expo-prd.mdx`. The client mirrors core web flows for sessions, diffs, and sharing while focusing on mobile-first navigation and responsiveness. All backend interactions are mediated through `@opencode-ai/sdk` and its generated client types.

## Goals

- Provide fast touch-first session creation and prompting.
- Offer quick access to server selection, projects, and session review.
- Keep model/agent changes, permissions, and sharing within one tap.
- Stream assistant responses with minimal UI latency.

## Non-Goals

- Local file editing or full IDE workflows on device.
- Server installation or CLI management from the app.
- Offline session creation or cached writes.

## Architecture

### High-Level Modules

- **Navigation Shell**: bottom tabs (Projects, Sessions, Notifications, Settings) plus stack flows for Project → Sessions → Session Detail.
- **Session Store**: single state store managing server, project, session, and message data.
- **SDK Client Layer**: wrapper around `createOpencodeClient` to enforce consistent authentication and error handling.
- **UI Screens**: views for project list, session list, session detail, review diffs, permissions, and share.
- **Event Stream Handler**: subscribes to SDK events and routes updates into store.

### Dependency Rules

- UI components may only read state via selectors/hooks.
- All mutations must go through store actions that call the SDK client.
- Use the public v2 entrypoint `@opencode-ai/sdk/v2/client` for SDK methods and types. Avoid deep imports like `@opencode-ai/sdk/dist/*` or `@opencode-ai/sdk/*/gen/*`.

## Data Model

Import SDK types and wrap locally owned state:

```ts
import type {
  Project,
  Session,
  SessionStatus,
  Message,
  FileDiff,
  PermissionRequest,
  Event,
} from "@opencode-ai/sdk/v2/client"

type ServerConfig = {
  id: string
  label: string
  baseUrl: `${string}://${string}`
  directory: string
  basicAuth: string
}

type SessionState = {
  servers: ServerConfig[]
  currentServerId?: string
  currentServer?: ServerConfig

  projects: Project[]
  isProjectsLoading: boolean
  projectsError?: string

  currentProject?: Project

  sessions: Session[]
  isSessionsLoading: boolean
  sessionsError?: string

  currentSession?: Session

  messages: Message[]
  isMessagesLoading: boolean
  messagesError?: string

  diffs: FileDiff[]
  isDiffsLoading: boolean
  diffsError?: string

  pendingPermissions: PermissionRequest[]
  isOffline: boolean
  lastError?: string
}
```

State lives in the store and is updated only by store actions. UI components subscribe to selectors for derived data (e.g., unread counts, session status, diff counts).

## Persistence

- Persist `ServerConfig[]` and the `currentServerId` selection.
- Store `basicAuth` using platform secure storage if possible (iOS Keychain / Android Keystore). If not available, fall back to encrypted storage and document tradeoffs.
- On app startup: load persisted server configs, restore `currentServerId`, derive `currentServer`, and initialize the SDK client.

## SDK Integration

All API calls must use the SDK client created by:

```ts
createOpencodeClient({ baseUrl, directory, headers })
```

### Focus-Driven Auto-Load

- Projects screen: if `currentServer` exists, auto-run `client.project.list` on focus.
- Sessions screen: if `currentProject` exists, auto-run `client.session.list({ directory: currentProject.directory })` on focus.
- Session detail: auto-run `client.session.messages` on focus / session change.
- Review panel: auto-run `client.session.diff` on focus / session change.

### Core Flows

- **Session create**: `client.session.create` → store updates current session.
- **Prompt**: `client.session.prompt` → stream tokens into a temporary message buffer, commit on completion.
- **Abort/Undo/Redo**: `client.session.abort`, `client.session.revert`, `client.session.unrevert`.
- **Diff/Summary**: `client.session.diff`, `client.session.summarize`.
- **Share**: `client.session.share` and `client.session.messages`.
- **Worktrees**: `client.worktree.create` and directory selection per session.
- **Permissions/Questions**: `client.permission.respond`, `client.question.reply`.
- **Events**: `client.event.subscribe` for status, permissions, and session updates.

## Navigation and Screens

- **Home/Projects**: server dropdown backed by persisted Settings; projects auto-load when a server is selected; project list is virtualized.
- **Sessions List**: sessions auto-load on focus; list is scoped to selected project and virtualized.
- **Session Detail**: message stream uses a virtualized list and opens at the latest messages without long scroll animation; includes prompt input, attachments strip, stop/undo bar.
- **Review/Changes**: diffs auto-load on focus and show explicit loading/empty/error states; unified diffs, jump-to-file, apply action.
- **Settings/Server**: manage server configs (add/edit/remove), status, environment, recents.
- **Model/Agent**: sheet with providers, current model, agent descriptions.
- **Permissions**: pending requests with once/always/reject.
- **Share**: toggle, copy link, expiration controls.

## State Handling

- **Offline**: disable send actions and show `ERR OFFLINE`.
- **Server unavailable**: show health badge and `ERR SERVER UNAVAILABLE` with retry.
- **Permission required**: show notification banner and `ERR PERMISSION REQUIRED`.
- **Long responses**: stream tokens; provide stop/collapse/jump controls.
- **Attachments**: validate MIME and size; surface `ERR INVALID ATTACHMENT`.

## Error Model

Exact error strings used in UI and tests:

- `ERR OFFLINE`
- `ERR SERVER UNAVAILABLE`
- `ERR PERMISSION REQUIRED`
- `ERR INVALID ATTACHMENT`
- `ERR INVALID COMMAND`
- `ERR UNKNOWN`

## Implementation Notes

- Use a lightweight store (e.g., Zustand) with action-based mutation.
- Treat SDK events as authoritative: update session/message state on `session.updated`, `message.updated`, and permission events.
- Apply optimistic UI only for local UI state (e.g., input clearing), not for server state.
- Prefer virtualized lists for any potentially large collection:
  - Projects: `FlashList`/`FlatList`.
  - Sessions: `FlashList`/`FlatList`.
  - Messages: `FlashList`/`FlatList`.

### Conversation: No Long Scroll On Open

Goal: show the newest messages immediately.

- Use an inverted list (newest at bottom visually) so initial render naturally starts at latest.
- Alternative: compute an initial scroll index and use `initialScrollIndex` + `getItemLayout` to jump near the end.
- Add a "jump to latest" affordance when the user scrolls away from bottom.

### Review: Diff Auto-Load and Visibility

- Store maintains `isDiffsLoading`/`diffsError` to prevent "blank" review UI.
- Trigger diff loads on screen focus and on `currentSession` changes.
- Revalidate diffs on relevant events (session updated / file change events).

## Verification

Recommended gates (adjust to repo scripts):

- `npm test -- --watch=false`
- `npm run lint`
- `npm run typecheck`

## Open Questions

- Basic Auth credential storage and rotation UX.
- Whether session update notifications include diffs or status only.
- Whether share links require re-auth on open.
