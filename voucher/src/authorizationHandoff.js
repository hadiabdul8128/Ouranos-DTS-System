import { normalizeAuthorization } from './authorization.js';
import { suggestAssignment } from './matching.js';

/** One entry point for API, page event, route, or JSON-imported authorizations. */
export function loadAuthorization(current, authorization, { source = 'handoff', replaceTrip = false } = {}) {
  const trip = normalizeAuthorization(authorization);
  const previousTripId = current.trip?.id || current.trip?.tripId;
  const changingTrip = Boolean(previousTripId && previousTripId !== trip.id);
  const changedApproval = Boolean(previousTripId === trip.id && current.trip && JSON.stringify(current.trip.authorizedItems) !== JSON.stringify(trip.authorizedItems));
  if (changingTrip && current.expenses?.length && !replaceTrip) throw new Error('Replacing a trip with expenses requires an explicit confirmation.');
  const keptExpenses = changingTrip ? [] : current.expenses || [];
  const expenses = keptExpenses.map(expense => {
    const suggestion = suggestAssignment(trip, expense, expense.purpose, []);
    const existingItem = trip.authorizedItems.find(item => item.id === expense.authorizationItemId && item.category === expense.category);
    const authorizationItemId = existingItem ? existingItem.id : suggestion.authorizationItemId;
    return {
      ...expense, tripId: trip.id, authorizationItemId,
      assignmentSource: existingItem ? expense.assignmentSource : authorizationItemId ? 'auto' : undefined,
      matching: existingItem ? expense.matching : authorizationItemId
        ? { confidence: suggestion.confidence, score: suggestion.score, signals: suggestion.signals }
        : { confidence: 'review', signals: [] }
    };
  });
  let pending = changingTrip ? null : current.pending || null;
  if (pending?.extracted) {
    const suggestion = suggestAssignment(trip, pending.extraction?.fields || pending.expense, pending.expense?.purpose, expenses);
    pending = {
      ...pending, suggestion, existingExpenseId: suggestion.existingExpenseId,
      expense: { ...pending.expense, category: suggestion.category, authorizationItemId: suggestion.authorizationItemId }
    };
  }
  return {
    ...current, trip, source, intakeComplete: changingTrip || changedApproval ? false : Boolean(current.intakeComplete && previousTripId),
    expenses, pending, resolutions: changingTrip || changedApproval ? {} : current.resolutions || {},
    audit: [...(changingTrip ? [] : current.audit || []), { label: `Loaded approved authorization ${trip.authorizationId}`, at: new Date().toISOString() }]
  };
}
