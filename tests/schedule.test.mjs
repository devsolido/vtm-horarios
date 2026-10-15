import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createSchedulePayload,
  normalizeScheduleRows,
  ScheduleValidationError,
} from '../api/schedule.mjs';

const weekdays = ['Segunda a Sexta'];

test('05:50 receives server-calculated passage and terminal estimates', () => {
  const { horarios } = createSchedulePayload([{
    destino: 'Terminal (chegada 07:20)',
    horario: '05:50:00',
    embarque: 'Bela Vista | C5 - Jardim União/Bela Vista',
    dias: weekdays,
  }]);

  assert.equal(horarios.length, 1);
  assert.equal(horarios[0].horario, '05:50');
  assert.equal(horarios[0].horario_parada, '06:03');
  assert.equal(horarios[0].horario_terminal, '06:22');
  assert.equal(horarios[0].parada_dia_offset, 0);
  assert.equal(horarios[0].terminal_dia_offset, 0);
  assert.equal(['06:30', '06:36', '06:39'].some(
    (time) => [horarios[0].horario, horarios[0].horario_parada, horarios[0].horario_terminal].includes(time),
  ), false);
});

test('server schedule estimates carry the service into the next day', () => {
  const { horarios } = createSchedulePayload([{
    destino: 'Terminal',
    horario: '23:50',
    embarque: 'Bela Vista',
    dias: ['Domingo'],
  }]);

  assert.equal(horarios[0].horario_parada, '00:03');
  assert.equal(horarios[0].parada_dia_offset, 1);
  assert.equal(horarios[0].horario_terminal, '00:22');
  assert.equal(horarios[0].terminal_dia_offset, 1);
});

test('schedule input rejects invalid times, days, duplicates, and empty replacement', () => {
  const validRow = {
    destino: 'Terminal',
    horario: '05:50',
    embarque: 'Bela Vista',
    dias: weekdays,
  };

  for (const horario of ['24:00', '05:5', '06:30:01', '12:60']) {
    assert.throws(
      () => normalizeScheduleRows([{ ...validRow, horario }]),
      ScheduleValidationError,
    );
  }
  assert.throws(
    () => normalizeScheduleRows([{ ...validRow, dias: ['Feriado'] }]),
    ScheduleValidationError,
  );
  assert.throws(
    () => normalizeScheduleRows([validRow, validRow]),
    ScheduleValidationError,
  );
  assert.throws(() => normalizeScheduleRows([]), ScheduleValidationError);
});

test('grade hash is independent of input ordering and changes with schedule data', () => {
  const rows = [
    { destino: 'Terminal B', horario: '07:00', embarque: 'Parada B', dias: ['Domingo'] },
    { destino: 'Terminal A', horario: '05:50', embarque: 'Parada A', dias: ['Sábado', 'Segunda a Sexta'] },
  ];

  assert.equal(
    createSchedulePayload(rows).grade_hash,
    createSchedulePayload([...rows].reverse()).grade_hash,
  );
  assert.notEqual(
    createSchedulePayload(rows).grade_hash,
    createSchedulePayload([{ ...rows[0], horario: '07:01' }, rows[1]]).grade_hash,
  );
});
