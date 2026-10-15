import assert from 'node:assert/strict';
import test from 'node:test';
import handler from '../api/horarios.js';

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
const originalKey = process.env.SUPABASE_ANON_KEY;

test.after(() => {
  globalThis.fetch = originalFetch;
  if (originalUrl === undefined) delete process.env.SUPABASE_URL;
  else process.env.SUPABASE_URL = originalUrl;
  if (originalKey === undefined) delete process.env.SUPABASE_ANON_KEY;
  else process.env.SUPABASE_ANON_KEY = originalKey;
});

test('PUT validates and calls one atomic replacement RPC', async () => {
  process.env.SUPABASE_URL = 'https://supabase.example';
  process.env.SUPABASE_ANON_KEY = 'test-key';
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return new Response(JSON.stringify([{
      id: 1,
      destino: 'Terminal',
      horario: '05:50:00',
      embarque: 'Bela Vista',
      dias: ['Segunda a Sexta'],
    }]), { status: 200 });
  };

  const res = responseMock();
  await handler({
    method: 'PUT',
    headers: {},
    body: [{
      destino: 'Terminal',
      horario: '05:50',
      embarque: 'Bela Vista',
      dias: ['Segunda a Sexta'],
    }],
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://supabase.example/rest/v1/rpc/replace_horarios');
  assert.equal(calls[0].options.method, 'POST');
  assert.deepEqual(JSON.parse(calls[0].options.body).novos[0], {
    destino: 'Terminal',
    horario: '05:50',
    embarque: 'Bela Vista',
    dias: ['Segunda a Sexta'],
  });
  assert.equal(res.body.horarios[0].horario_parada, '06:03');
  assert.equal(res.body.horarios[0].horario_terminal, '06:22');
  assert.match(res.body.grade_hash, /^[a-f0-9]{64}$/);
});

test('PUT rejects an empty or invalid grade without contacting Supabase', async () => {
  process.env.SUPABASE_URL = 'https://supabase.example';
  process.env.SUPABASE_ANON_KEY = 'test-key';
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    throw new Error('Unexpected request');
  };

  for (const body of [[], [{
    destino: 'Terminal',
    horario: '06:30',
    embarque: 'Bela Vista',
    dias: ['Feriado'],
  }]]) {
    const res = responseMock();
    await handler({ method: 'PUT', headers: {}, body }, res);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.error, /grade|horário|dias/i);
  }
  assert.equal(calls, 0);
});
