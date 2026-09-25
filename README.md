# Ouranos

A minimal operational workspace. Ouranos can grow to cover many workflows; this prototype implements only travel.

## Experience

1. Magic UI Hyper Text resolves into the Ouranos wordmark.
2. A simple email form appears, with a restrained Border Beam.
3. Continue to a single prompt: “What do you want to do?”
4. Enter “travel” or a related request to open the trip form.
5. Review and save a draft locally.

There are no workflow cards, overview metrics, trip tables, or sidebar on the home screen.

## Run

```sh
npm install
npm run dev
```

## Prototype boundaries

Email format is validated in the browser. Email is not verified, transmitted, or stored; no real Ouranos authentication is connected. The private hosted-site gate is separate. DTS is not connected. Drafts remain in localStorage on the device. No documents, approvals, or requests are submitted externally.

Animation respects reduced-motion preferences. The homepage optionally exposes the `open_travel_workspace` WebMCP navigation tool.

## Checks

```sh
npx tsc --noEmit
npm run build
```
