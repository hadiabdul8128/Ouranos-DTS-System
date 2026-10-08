# Inbox popup

The workspace and trip headers share `InboxLink`. A normal click opens the 21st.dev-inspired notification menu; the anchor still targets `/dashboard/inbox`, preserving Ctrl/Cmd-click, middle-click, and browser link menus. The popup includes an explicit **Open full inbox** link. Escape, outside clicks, and Close dismiss it; focus returns to the Inbox link.

`components/ui/notifications-menu.tsx` adapts the supplied card, avatar, tabs, and badge structure to All/Unread travel messages. It uses the project's existing shadcn primitives and Radix umbrella package. No additional dependency, provider, or avatar image is required. Popup styling is scoped to `components/inbox/inbox-popover.css`.

Messages and counts come from Dexie and are scoped by the existing `inboxMessages` organization/recipient filter. Opening the popup does not mark anything read. Clicking a message opens `/dashboard/inbox?message=...`; the full page selects it and uses the existing authenticated read command. Authorization confirmation links remain supported. Refresh uses the existing sync engine; offline and failure states are visible. The menu shows at most 20 messages per filter and keeps the full page available for earlier updates.

The UI preview uses labeled sample records without inserting them into the database. `platform/tests/inbox-focus.test.ts` verifies scoped selection, existing confirmation links, and safe query encoding.
