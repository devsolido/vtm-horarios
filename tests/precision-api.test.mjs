import assert from 'node:assert/strict';
import test from 'node:test';
import handler from '../api/precision.js';
import { createSchedulePayload } from '../api/schedule.mjs';
import { getServiceDate, getServiceDateTime } from '../api/precision.mjs';

function responseMock() {
  return {
    headers: {},
    statusCode: 200,
    body: undefined,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
    end() {
      return this;
    },
  };
}

const originalFetch = globalThis.fetch;
const originalUrl = process.env.SUPABASE_URL;
const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

test.after(() => {
  globalThis.fetch = originalFetch;
  if (originalUrl === undefined) delete process.env.SUPABASE_URL;
  else process.env.SUPABASE_URL = originalUrl;
  if (originalKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  else process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
});

test('GET uses server-side grade and returns the prior interval until data is ready', async () => {
  process.env.SUPABASE_URL = 'https://supabase.example';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-test-key';
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(url);
    if (url.includes('/horarios?')) {
      return new Response(JSON.stringify([{
        destino: 'Terminal',
        horario: '05:50:00',
        embarque: 'Bela Vista',
        dias: ['Segunda a Sexta', 'Sábado', 'Domingo'],
      }]), { status: 200 });
    }
    return new Response('[]', { status: 200 });
  };

  const res = responseMock();
  await handler({ method: 'GET' }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.time_zone, 'America/Belem');
  assert.equal(res.body.estimates[0].mode, 'prior');
  assert.equal(res.body.estimates[0].n, 0);
  assert.equal(res.body.estimates[0].horario_parada_p10, '05:58');
  assert.equal(res.body.estimates[0].horario_parada, '06:03');
  assert.equal(res.body.estimates[0].horario_parada_p90, '06:08');
  assert.equal(res.headers['Cache-Control'], 'public, s-maxage=60, stale-while-revalidate=60');
  assert.equal(calls.length, 2);
});

test('POST rejects malformed confirmation data before contacting Supabase', async () => {
  process.env.SUPABASE_URL = 'https://supabase.example';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-test-key';
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    throw new Error('Unexpected request');
  };

  const res = responseMock();
  await handler({ method: 'POST', body: { schedule_key: 'not-a-hash' } }, res);

  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /viagem|grade/i);
  assert.equal(calls, 0);
});

test('POST measures passage with server time and stores a pre-observation shadow forecast', async (context) => {
  process.env.SUPABASE_URL = 'https://supabase.example';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-test-key';
  const now = new Date();
  const serviceDate = getServiceDate(now);
  const serviceHour = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Belem',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const parts = Object.fromEntries(serviceHour
    .filter(({ type }) => type !== 'literal')
    .map(({ type, value }) => [type, Number(value)]));
  const departureMinute = parts.hour * 60 + parts.minute - 10;
  if (departureMinute < 0) {
    context.skip('Current service time is too close to midnight for this request-window test.');
    return;
  }
  const departureTime = `${String(Math.floor(departureMinute / 60)).padStart(2, '0')}:${String(departureMinute % 60).padStart(2, '0')}`;
  const observedTime = `${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`;
  const rows = [{
    destino: 'Terminal',
    horario: departureTime,
    embarque: 'Bela Vista',
    dias: ['Segunda a Sexta', 'Sábado', 'Domingo'],
  }];
  const schedule = createSchedulePayload(rows);
  const requests = [];
  globalThis.fetch = async (url, options = {}) => {
    requests.push({ url, options });
    if (url.includes('/rest/v1/horarios?')) {
      return new Response(JSON.stringify(rows), { status: 200 });
    }
    if (url.includes('/rest/v1/passage_observations?')) {
      return new Response('[]', { status: 200 });
    }
    if (url.endsWith('/rest/v1/passage_observations') && options.method === 'POST') {
      return new Response(null, { status: 201 });
    }
    throw new Error(`Unexpected Supabase request: ${url}`);
  };

  const res = responseMock();
  await handler({
    method: 'POST',
    body: {
      grade_hash: schedule.grade_hash,
      schedule_key: schedule.horarios[0].schedule_key,
      service_date: serviceDate,
      observed_time: observedTime,
    },
  }, res);

  assert.equal(res.statusCode, 201);
  const insert = requests.find(({ options }) => options.method === 'POST');
  const observation = JSON.parse(insert.options.body);
  assert.equal(observation.grade_hash, schedule.grade_hash);
  assert.equal(observation.schedule_key, schedule.horarios[0].schedule_key);
  assert.equal(observation.adaptive_ready, false);
  assert.equal(observation.prior_prediction_minutes, 13);
  assert.equal(observation.travel_minutes, Number((
    (getServiceDateTime(serviceDate, observedTime) - getServiceDateTime(serviceDate, departureTime)) / 60_000
  ).toFixed(2)));
  assert.equal(observation.observed_at, new Date(getServiceDateTime(serviceDate, observedTime)).toISOString());
  assert.ok(Date.parse(observation.confirmed_at) >= Date.parse(observation.observed_at));
});
