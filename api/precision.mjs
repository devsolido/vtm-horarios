export const PRIOR_MINUTES = 13;
export const MIN_OBSERVATIONS = 20;
export const MIN_BACKTEST_EVALUATIONS = 30;
export const SHORT_LAYER_MINUTES = 45;
export const BACKTEST_IMPROVEMENT_RATIO = 0.9;
export const PRIOR_P10_MINUTES = 8;
export const PRIOR_P90_MINUTES = 18;

const OBSERVATION_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;
const SERVICE_TIME_ZONE = 'America/Belem';
const BAND_HOURS = 3;

const serviceDateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: SERVICE_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  weekday: 'short',
  hourCycle: 'h23',
});

function serviceParts(date) {
  return Object.fromEntries(serviceDateTimeFormatter.formatToParts(date)
    .filter(({ type }) => type !== 'literal')
    .map(({ type, value }) => [type, type === 'weekday' ? value : Number(value)]));
}

function dayName(weekday) {
  const index = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekday);
  return [
    'Domingo',
    'Segunda a Sexta',
    'Segunda a Sexta',
    'Segunda a Sexta',
    'Segunda a Sexta',
    'Segunda a Sexta',
    'Sábado',
  ][index];
}

export function getServiceDate(date = new Date()) {
  const { year, month, day } = serviceParts(date);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function getServiceDay(date = new Date()) {
  return dayName(serviceParts(date).weekday);
}

export function getServiceDateTime(date, time) {
  const [hour, minute] = time.split(':').map(Number);
  const [year, month, day] = date.split('-').map(Number);
  const targetUtc = Date.UTC(year, month - 1, day, hour, minute);
  const actual = serviceParts(new Date(targetUtc));
  const actualUtc = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute);
  return targetUtc + (targetUtc - actualUtc);
}

function timeBand(timestamp) {
  const hour = serviceParts(new Date(timestamp)).hour;
  return Math.floor(hour / BAND_HOURS);
}

function validObservations(observations) {
  const cutoff = Date.now() - OBSERVATION_WINDOW_MS;
  return observations.filter((observation) => {
    const observedAt = Date.parse(observation.observed_at);
    const scheduledDeparture = Date.parse(observation.scheduled_departure);
    return Number.isFinite(observedAt)
      && Number.isFinite(scheduledDeparture)
      && observedAt >= cutoff
      && Number.isFinite(observation.travel_minutes)
      && observation.travel_minutes >= 1
      && observation.travel_minutes <= 120;
  });
}

function quantile(sortedValues, percentile) {
  if (sortedValues.length === 0) return PRIOR_MINUTES;
  const position = (sortedValues.length - 1) * percentile;
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.ceil(position);
  if (lowerIndex === upperIndex) return sortedValues[lowerIndex];
  const fraction = position - lowerIndex;
  return sortedValues[lowerIndex] * (1 - fraction) + sortedValues[upperIndex] * fraction;
}

function averageAbsoluteError(rows, field) {
  if (rows.length === 0) return null;
  return rows.reduce((sum, row) => sum + Math.abs(row.travel_minutes - row[field]), 0) / rows.length;
}

export function calculateBacktest(observations) {
  const evaluated = validObservations(observations)
    .filter((observation) => observation.adaptive_ready === true
      && Number.isFinite(observation.prior_prediction_minutes)
      && Number.isFinite(observation.adaptive_prediction_minutes))
    .sort((a, b) => Date.parse(a.observed_at) - Date.parse(b.observed_at))
    .slice(-MIN_BACKTEST_EVALUATIONS);
  const priorMae = averageAbsoluteError(evaluated, 'prior_prediction_minutes');
  const adaptiveMae = averageAbsoluteError(evaluated, 'adaptive_prediction_minutes');
  const released = evaluated.length >= MIN_BACKTEST_EVALUATIONS
    && priorMae > 0
    && adaptiveMae <= priorMae * BACKTEST_IMPROVEMENT_RATIO;

  return {
    evaluated: evaluated.length,
    required: MIN_BACKTEST_EVALUATIONS,
    prior_mae: priorMae === null ? null : Number(priorMae.toFixed(2)),
    adaptive_mae: adaptiveMae === null ? null : Number(adaptiveMae.toFixed(2)),
    required_improvement: 1 - BACKTEST_IMPROVEMENT_RATIO,
    released,
  };
}

export function calculatePassageEstimate(observations, departureTimestamp) {
  const usable = validObservations(observations);
  const band = timeBand(departureTimestamp);
  const bandObservations = usable.filter(
    (observation) => timeBand(Date.parse(observation.scheduled_departure)) === band,
  );
  const durations = bandObservations
    .map((observation) => observation.travel_minutes)
    .sort((a, b) => a - b);
  const ready = durations.length >= MIN_OBSERVATIONS;
  const structural = ready ? quantile(durations, 0.5) : PRIOR_MINUTES;
  const p10 = ready ? quantile(durations, 0.1) : PRIOR_P10_MINUTES;
  const p90 = ready ? quantile(durations, 0.9) : PRIOR_P90_MINUTES;

  let shortAdjustment = 0;
  if (ready) {
    const latestObservation = usable
      .filter((observation) => Number.isFinite(observation.structural_prediction_minutes))
      .sort((a, b) => Date.parse(b.observed_at) - Date.parse(a.observed_at))[0];

    if (latestObservation) {
      const targetPassageTimestamp = departureTimestamp + structural * 60_000;
      const ageMinutes = (targetPassageTimestamp - Date.parse(latestObservation.observed_at)) / 60_000;
      if (ageMinutes >= 0 && ageMinutes < SHORT_LAYER_MINUTES) {
        const residual = latestObservation.travel_minutes - latestObservation.structural_prediction_minutes;
        shortAdjustment = residual * (1 - ageMinutes / SHORT_LAYER_MINUTES);
      }
    }
  }

  return {
    n: durations.length,
    ready,
    structural_minutes: Number(structural.toFixed(2)),
    short_adjustment_minutes: Number(shortAdjustment.toFixed(2)),
    p10_minutes: Number(Math.max(1, p10 + shortAdjustment).toFixed(2)),
    p50_minutes: Number(Math.max(1, structural + shortAdjustment).toFixed(2)),
    p90_minutes: Number(Math.max(1, p90 + shortAdjustment).toFixed(2)),
  };
}

export function createObservationSnapshot(observations, departureTimestamp) {
  const estimate = calculatePassageEstimate(observations, departureTimestamp);
  return {
    travel_minutes: null,
    observed_at: null,
    scheduled_departure: new Date(departureTimestamp).toISOString(),
    structural_prediction_minutes: estimate.structural_minutes,
    prior_prediction_minutes: PRIOR_MINUTES,
    adaptive_prediction_minutes: estimate.p50_minutes,
    adaptive_ready: estimate.ready,
  };
}
