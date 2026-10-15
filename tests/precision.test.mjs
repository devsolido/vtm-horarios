import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateBacktest,
  calculatePassageEstimate,
  createObservationSnapshot,
  getServiceDate,
  getServiceDateTime,
  MIN_OBSERVATIONS,
} from '../api/precision.mjs';

const departure = getServiceDateTime('2026-10-15', '06:00');
const recentObservations = Array.from({ length: MIN_OBSERVATIONS }, (_, index) => ({
  observed_at: new Date(departure - (index + 1) * 86_400_000 + 18 * 60_000).toISOString(),
  scheduled_departure: new Date(departure - (index + 1) * 86_400_000).toISOString(),
  travel_minutes: 17,
  structural_prediction_minutes: 16,
}));

test('service dates and schedule times use the Marabá service timezone', () => {
  const instant = new Date('2026-10-15T02:30:00.000Z');
  assert.equal(getServiceDate(instant), '2026-10-14');
  assert.equal(getServiceDateTime('2026-10-15', '06:00'), Date.parse('2026-10-15T09:00:00.000Z'));
});

test('adaptive long layer waits for N_min, then uses robust passage observations', () => {
  const prior = calculatePassageEstimate(recentObservations.slice(0, MIN_OBSERVATIONS - 1), departure);
  assert.equal(prior.ready, false);
  assert.equal(prior.p50_minutes, 13);

  const learned = calculatePassageEstimate(recentObservations, departure);
  assert.equal(learned.ready, true);
  assert.equal(learned.n, MIN_OBSERVATIONS);
  assert.equal(learned.structural_minutes, 17);
});

test('short layer carries a recent delay and fades it over 45 minutes', () => {
  const recent = [
    ...recentObservations,
    {
      observed_at: new Date(departure - 5 * 60_000).toISOString(),
      scheduled_departure: new Date(departure - 23 * 60_000).toISOString(),
      travel_minutes: 21,
      structural_prediction_minutes: 17,
    },
  ];
  const estimate = calculatePassageEstimate(recent, departure);
  assert.ok(estimate.short_adjustment_minutes > 0);
  assert.ok(estimate.short_adjustment_minutes < 4);
});

test('shadow gate requires 30 evaluations and 10 percent lower MAE', () => {
  const rows = Array.from({ length: 30 }, (_, index) => ({
    observed_at: new Date(departure + index * 60_000).toISOString(),
    scheduled_departure: new Date(departure + index * 60_000).toISOString(),
    travel_minutes: 17,
    adaptive_ready: true,
    prior_prediction_minutes: 13,
    adaptive_prediction_minutes: 17,
  }));

  const result = calculateBacktest(rows);
  assert.equal(result.evaluated, 30);
  assert.equal(result.prior_mae, 4);
  assert.equal(result.adaptive_mae, 0);
  assert.equal(result.released, true);
  assert.equal(calculateBacktest(rows.slice(0, 29)).released, false);
});

test('observation snapshots retain predictions calculated before the actual is recorded', () => {
  const snapshot = createObservationSnapshot(recentObservations, departure);
  assert.equal(snapshot.adaptive_ready, true);
  assert.equal(snapshot.adaptive_prediction_minutes, 17);
  assert.equal(snapshot.travel_minutes, null);
});
