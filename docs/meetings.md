# Meetings

Meetings lives at `/dashboard/meetings`, with a camera icon in the home header. Requests such as “Schedule a meeting”, “Start a video call”, and “Join my meeting” open this workflow without creating a meeting.

## Behavior

Meet now creates a named 30-minute meeting by default; scheduling supports 15–120 minutes in the browser’s local timezone. Times are stored as UTC instants. Each meeting supports an organizer plus up to 15 invited workspace members. Invitations appear in the attendee’s Meetings and Upcoming views; this version does not send email or push alerts. Links are navigational, not bearer access grants.

Only an active workspace member who organizes or is invited can list or join a meeting. The organizer can cancel it. Admission opens 15 minutes before start and closes at its scheduled end. Meetings are not automatically terminated at that time; existing participants may stay connected. Previously issued tokens remain usable until their five-minute expiry. Cancellation also attempts to disconnect the room, with an explicit warning if that operation fails. Video/audio start disabled on the pre-join screen. The LiveKit conference provides camera, microphone, screen sharing, device selection, participant layout and ephemeral meeting chat. No recording, transcription, persistent channels, guests or recurring meetings.

## Enable calling

1. Apply `supabase/migrations/20261008000000_meetings.sql` through the project’s normal database migration process. The API uses the existing Supabase authentication and `ouranos_api` row-level security role.
2. Create a LiveKit Cloud project on its free Build tier. Alternatively run a properly configured self-hosted LiveKit service.
3. Set **server-only** `LIVEKIT_URL=wss://your-project.livekit.cloud`, `LIVEKIT_API_KEY`, and `LIVEKIT_API_SECRET` in `.env.platform` or the API deployment’s environment. Never use `NEXT_PUBLIC_` for the key or secret.
4. Restart/redeploy the platform API. Connect two signed-in members of the same workspace, create a meeting and invite the other member’s email address, then join from two browsers.

LiveKit tokens expire after five minutes and grant access to one server-derived workspace/meeting room with the authenticated user as identity. The client never supplies room names, identities, or grants. Room creation limits concurrency to 16 participants. SDK token expiry limits initial connection, not the lifetime of an established call. Existing application rate limiting covers endpoints.

The provider is optional: without credentials, scheduling still works and Join remains disabled with a setup message. A failed list request is surfaced with Retry rather than silently replaced with sample data. In the unconfigured local app, meetings are explicitly saved only on this device, separately from production data; invitations and media calls are unavailable. No synthetic attendees or fake connected calls are shown.

## Validation

Run `npm run platform:test`, `npx next typegen && npx tsc --noEmit`, and `npm run build`. Verify account/workspace isolation, canceled/early/expired admission, organizer-only cancellation, invalid or nonmember invite addresses, deep links, local timezone conversion, mobile layout, denied camera/microphone permissions, room disconnect/rejoin and screen share. Provider and PostgreSQL checks require the configured deployment; unit tests alone do not establish end-to-end media or row-level security behavior.

## Design direction

An extension of the existing olive workspace: familiar serif identity, readable Nunito controls, olive reserved for actions, and hairline-separated agenda rows rather than decorative dashboard cards. The initial view pairs a concise Meetings heading with Schedule and Meet now; empty states explain the next action. Scheduling is an inline form with visible labels. Joining uses a dedicated pre-call surface and a spacious conference view. Preserve the original home typography and all unrelated travel layouts.
