# Tasks: Expo Touch Client for OpenCode

## Phase 1: Foundation and Navigation

**Acceptance Criteria**
- Bottom tab navigation and stack flows render all screens listed in the PRD.
- Server picker, project list, session list, and session detail shells load with placeholder data.
- State store is wired and accessible from screens without direct mutation.

**Tasks**
- [x] Scaffold Expo project structure and navigation shells.
- [x] Implement tab + stack navigation routes and screen placeholders.
- [x] Add centralized session store with selectors and actions.
- [x] Wire screen shells to store selectors (read-only).

## Phase 2: SDK Integration and Session Flow

**Acceptance Criteria**
- Server selection initializes SDK client using `createOpencodeClient`.
- Session creation and prompt streaming update the message list.
- Diff view renders SDK-provided diffs.
- Offline/server-unavailable states surface correct error strings.

**Tasks**
- [x] Implement SDK client factory and auth handling.
- [x] Add session create, prompt, abort, undo, redo actions.
- [x] Add diff and summary retrieval actions.
- [x] Implement streaming message handling and UI updates.
- [x] Add offline and server-unavailable error handling.

## Phase 3: Permissions, Sharing, and Notifications

**Acceptance Criteria**
- Permission banners render and actions call `client.permission.respond`.
- Share screen toggles sharing and exposes share link when enabled.
- Notifications route users to the correct session and screen.

**Tasks**
- [x] Implement permission request UI and responses.
- [x] Add share toggle, link copy, and expiration controls.
- [x] Subscribe to SDK events and route session updates.
- [x] Handle notification deep-links into session views.

## Phase 4: Persisted Servers and Project Auto-Load

**Acceptance Criteria**
- Settings owns a persistent server list (add/edit/remove).
- ProjectsHome shows a server dropdown driven by Settings.
- Selecting a server persists the selection and restores it on app launch.

**Tasks**
- [x] Define persistent `ServerConfig` storage (e.g., SecureStore/AsyncStorage) with migration.
- [x] Implement Settings UI for server CRUD and validation.
- [x] Wire ProjectsHome server dropdown to stored servers + current selection.
- [x] Ensure server selection re-initializes the SDK client and resets dependent state.

## Phase 5: Projects List Auto-Load + Virtualization

**Acceptance Criteria**
- If a server is selected, projects auto-load on ProjectsHome.
- Project list is scrollable and virtualized (no full render for large repos).
- Loading/error/empty states are visible and actionable.

**Tasks**
- [x] Add `project.list` store action that runs on screen focus when server is set.
- [x] Render projects via `FlashList`/`FlatList` with stable keys, `getItemLayout` if feasible, and minimal row re-render.
- [ ] Add pull-to-refresh and retry affordances.

## Phase 6: Sessions Auto-Load + Project-Scoped Virtualization

**Acceptance Criteria**
- Sessions auto-load when the Sessions screen opens.
- Sessions screen only shows sessions for the currently selected project (via `client.session.list({ directory: currentProject.directory })`).
- Session list is scrollable and virtualized.

**Tasks**
- [x] Add `session.list` store action keyed by `currentProject` and triggered on focus.
- [x] Gate Sessions screen: require selected project (otherwise CTA to Projects).
- [x] Render sessions via `FlashList`/`FlatList` with stable keys, row memoization, and optional `limit`/pagination.

## Phase 7: Conversation Jump-To-Bottom (No Long Scroll)

**Acceptance Criteria**
- Opening a long conversation lands near the latest messages without long scroll animation.
- User can still scroll up to history smoothly.
- Behavior works for both initial load and subsequent message streaming.

**Tasks**
- [x] Switch message stream to a virtualized list (`FlashList`/`FlatList`) with `inverted` (preferred) or explicit `initialScrollIndex`.
- [x] Implement "jump to latest" control when user is not at bottom.
- [x] Prevent scroll-jank during streaming (batch updates, keep item heights stable where possible).

## Phase 8: Review Auto-Load Diffs + Visible Loading State

**Acceptance Criteria**
- Review panel auto-loads diffs when opened (and when session changes).
- Diff loading state is visible (spinner/skeleton) and errors are actionable.
- Empty diff state is explicit ("No changes").

**Tasks**
- [x] Trigger `client.session.diff` on Review screen focus and on `currentSession` change.
- [x] Add `isDiffsLoading` / `diffsError` state and surface it in UI.
- [x] Ensure diffs update on relevant events (e.g., `session.diff`, `file.watcher.updated`, `session.updated`).

## Phase 9: QA and Performance Gates

**Acceptance Criteria**
- Project/session/message lists remain responsive with large datasets.
- Persisted server selection survives reinstall/update scenarios (migration covered).
- Tests and lint/typecheck gates pass.

**Tasks**
- [x] Add tests for server persistence + selection restore.
- [x] Add tests for auto-load triggers (focus-driven) and list scoping.
- [x] Run verification gates and resolve failures.
