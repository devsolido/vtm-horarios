import assert from 'node:assert/strict';
import test from 'node:test';
import handler from '../api/time.js';

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

test('GET returns an uncached server timestamp and the service timezone', () => {
  const before = Date.now();
  const res = responseMock();

  handler({ method: 'GET' }, res);

  const after = Date.now();
  const timestamp = Date.parse(res.body.server_time);
  assert.equal(res.statusCode, 200);
  assert.ok(timestamp >= before && timestamp <= after);
  assert.equal(res.body.time_zone, 'America/Belem');
  assert.equal(res.headers['Cache-Control'], 'no-store, max-age=0');
});

test('unsupported methods are rejected', () => {
  const res = responseMock();

  handler({ method: 'POST' }, res);

  assert.equal(res.statusCode, 405);
  assert.equal(res.headers.Allow, 'GET, OPTIONS');
});
