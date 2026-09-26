# Ouranos Transition

## What ships in this branch

`/dashboard/transition` offers a two-step intake, three explained routes (employment,
training, education), and three starting actions for a chosen route. Progress is
saved to the signed-in account and survives reload. The Dashboard has one small
link plus intent routing; the Travel, Authorization, and Voucher pages are unchanged.
Housing support is available immediately without completing the intake.

The first version uses **guided rules**, not a hosted AI model. It requires no AI
API key and makes no network calls to generate recommendations. Suggestions are
starting points, not verified career matches, job offers, wage estimates, or
benefit eligibility decisions. All links come from an allowlisted resource catalog.

## Recommendation rules

`packages/domain/transition/recommend.ts` consumes the validated profile and
returns `TransitionRecommendation` (`transition-v1`).

- Urgent income puts employment first, retaining the other alternatives.
- Otherwise the user's employment, training, or education preference comes first.
- Skills, occupation, interests, and location tailor explanations and action text.
- Military role translation is delegated to My Next Move's official lookup.
  Ouranos does not invent a role-to-job mapping or live local opportunities.
- Branch and separation stage do not establish eligibility or restrict options.
- Benefit questions point to VA criteria and counselors.

A future recommendation provider can implement this same output contract. Keep
resource IDs allowlisted, validate output, obtain appropriate consent before
sending personal answers externally, and retain explicit uncertainty. Do not let
an AI service decide employment, education, housing, or VA benefit eligibility.

## API and persistence

Runtime schemas are in `packages/contracts/transition.ts`. The existing bearer
identity is required; callers do not supply a user ID.

```ts
const {plan} = await client.transitionPlan(organizationId);
const saved = await client.saveTransitionPlan({
  organizationId,
  requestId: crypto.randomUUID(),
  expectedVersion: plan?.version ?? 0,
  profile: {
    stage: 'recently_separated',
    branch: 'prefer_not_to_say',
    militaryRole: '',
    location: 'Raleigh, NC',
    skills: ['operations'],
    interests: 'Supply chain',
    goal: 'training',
    incomeTiming: 'soon',
    housingSupport: false,
  },
  selectedPath: null,
  completedActionIds: [],
});
```

This example is documentation only; no example profile is loaded into the UI.

- `GET /v1/transition/plan?organizationId=…` returns `{plan: null | TransitionPlan}`.
- `PUT /v1/transition/plan` generates recommendations on the server and returns
  `{plan: TransitionPlan}`. Clients cannot submit their own recommendation content.
- `requestId` retries must reuse identical input. A retry returns the original
  committed result without adding another version or audit event.
- `expectedVersion` detects concurrent edits. A 409 conflict requires reloading;
  the UI never overwrites a newer plan silently.
- Completed actions must belong to the selected route. Changed profile answers
  reset progress and regenerate recommendations. Switching routes resets progress.
- Successful writes return the confirmed version. Failed or uncertain writes are
  visibly unsaved; an uncertain request can be retried with its original ID.
- This feature needs a connection to save. It does not join the Travel offline
  queue or persist personal answers in the shared browser travel database.

`ouranos.transition_plans` contains one plan per user per workspace. Row-level
security permits only the owner with active membership; peers and organization
administrators cannot read it. Browser database roles have no direct table grant.
Writes use the existing actor-scoped API transaction. Personal answers are excluded
from shared travel synchronization and audit-event details. The existing private
`processed_commands` history retains original save responses for idempotency,
including older answers. Database operators and backups are privileged systems;
account deletion/retention policy is not implemented by this feature.

## Resources

The catalog in `packages/domain/transition/resources.ts` was reviewed on
2026-09-25. Review these links and descriptions periodically; local availability
and eligibility must be checked by the user or a qualified counselor.

- [My Next Move for Veterans](https://www.mynextmove.org/vets/)
- [American Job Center locator](https://www.careeronestop.org/LocalHelp/AmericanJobCenters/find-american-job-centers.aspx)
- [Registered apprenticeships](https://www.apprenticeship.gov/career-seekers)
- [VA personalized career planning and guidance](https://www.va.gov/careers-employment/education-and-career-counseling/)
- [GI Bill Comparison Tool](https://www.va.gov/education/gi-bill-comparison-tool/)
- [Choosing a school](https://www.va.gov/resources/choosing-a-gi-bill-approved-school/)
- [VA housing support](https://www.va.gov/homeless/nationalcallcenter.asp)

## Verification and merge handoff

The migration `20260926020000_transition_plans.sql` has been applied **locally only**.
Apply pending migrations to the target database through the team's normal release
process before deploying an API/frontend that uses these routes. Do not reset a
shared database. No provider keys, sample production plans, or repository settings
are changed. Branch: `codex/transition-copilot`; main remains unchanged.

Verified for this iteration:

- 66 platform unit tests, including 9 Transition rule/validation tests and
  14 workspace intent cases.
- 42 local database/API integration tests, including 7 Transition journey,
  replay, version conflict, malformed progress, RLS, and inactive-membership tests.
- All 54 existing Voucher tests.
- TypeScript, generated OpenAPI consistency, both Next and Vinext production builds.
- Lint on the new Transition files.
- Browser smoke test with a separate local test account: Dashboard link → intake
  → three options → choose training → complete a step → reload preserves progress.
  Housing help and the 390px mobile layout were checked. Test profile data is not
  part of the application seed or production UI.
