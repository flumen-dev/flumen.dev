# CLI Bridge — Flumen <-> flumli

Flumen communicates with the local `flumli` CLI via HTTP (`localhost:31420`).
The CLI wraps `gh` (GitHub CLI) and provides push/PR operations from the browser.

## Connection

### POST /connect

Authenticate with a one-time token (displayed in CLI as text + QR code).

```json
// Request
{ "token": "abc123" }

// 200
{ "success": true }

// 401
{ "success": false, "error": "Invalid token" }
```

### GET /state

Check if CLI is connected.

```json
// 200
{ "connected": true }
```

### POST /disconnect

```json
// 200
{ "success": true }
```

## Push & PR

### GET /push

Query current push state.

```json
// 200
{ "state": "first_push" | "has_commits" | "nothing" }
```

| State | Website behavior |
|---|---|
| `first_push` | Show title input (suggestion from branch name, e.g. `fix/login-bug` -> `fix: login-bug`) + "Push & Create PR" button |
| `has_commits` | Show "Push" button (no title needed) |
| `nothing` | Button disabled / "Everything up to date" |

### POST /push

Execute push (and optionally create draft PR on first push).

```json
// Request — first_push (title required for PR)
{ "title": "fix: login-bug" }

// Request — has_commits (no title needed)
{}
```

```json
// 200 — first push, PR created
{ "status": "pushed_with_pr", "pr": "https://github.com/owner/repo/pull/42" }

// 200 — pushed
{ "status": "pushed" }

// 200 — nothing to do
{ "status": "nothing" }

// 500 — error (offer retry)
{ "status": "error", "message": "Push failed: ..." }
```

## Website flow

1. User connects (`POST /connect` with token from CLI)
2. Flumen polls/checks `GET /push`
3. Based on state:
   - `first_push` -> title input + "Push & Create PR" -> `POST /push { title }`
   - `has_commits` -> "Push" button -> `POST /push {}`
   - `nothing` -> disabled / "Everything up to date"
4. On error -> retry button (same `POST /push`)
