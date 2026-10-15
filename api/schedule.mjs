import { createHash } from 'node:crypto';

export const SERVICE_DAYS = ['Segunda a Sexta', 'Sábado', 'Domingo'];

const MAX_SCHEDULE_ROWS = 500;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d)(?:\.(\d+))?)?$/;

export class ScheduleValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ScheduleValidationError';
  }
}

export function getScheduleKey(row) {
  const canonicalScheduleRow = {
    destino: row.destino,
    horario: row.horario,
    embarque: row.embarque,
    dias: row.dias,
  };
  return createHash('sha256')
    .update(JSON.stringify(canonicalScheduleRow))
    .digest('hex');
}

function normalizeTime(value, index) {
  if (typeof value !== 'string') {
    throw new ScheduleValidationError(`Horário inválido na linha ${index + 1}.`);
  }

  const match = value.match(TIME_PATTERN);
  if (!match || (match[3] !== undefined && (match[3] !== '00' || Number(match[4] || 0) !== 0))) {
    throw new ScheduleValidationError(`Horário inválido na linha ${index + 1}; use HH:mm.`);
  }

  return `${match[1]}:${match[2]}`;
}

function compareSchedules(a, b) {
  return a.horario.localeCompare(b.horario)
    || a.destino.localeCompare(b.destino)
    || a.embarque.localeCompare(b.embarque)
    || a.dias.join(',').localeCompare(b.dias.join(','));
}

export function normalizeScheduleRows(rows, { allowEmpty = false } = {}) {
  if (!Array.isArray(rows)) {
    throw new ScheduleValidationError('A grade deve ser uma lista de horários.');
  }
  if (!allowEmpty && rows.length === 0) {
    throw new ScheduleValidationError('A grade não pode ficar vazia.');
  }
  if (rows.length > MAX_SCHEDULE_ROWS) {
    throw new ScheduleValidationError(`A grade não pode exceder ${MAX_SCHEDULE_ROWS} horários.`);
  }

  const normalized = rows.map((row, index) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      throw new ScheduleValidationError(`Registro inválido na linha ${index + 1}.`);
    }

    const destino = typeof row.destino === 'string' ? row.destino.trim() : '';
    const embarque = typeof row.embarque === 'string' ? row.embarque.trim() : '';
    if (!destino || destino.length > 200 || !embarque || embarque.length > 200) {
      throw new ScheduleValidationError(`Destino e embarque são obrigatórios (máximo de 200 caracteres) na linha ${index + 1}.`);
    }

    if (!Array.isArray(row.dias) || row.dias.length === 0) {
      throw new ScheduleValidationError(`Selecione ao menos um dia válido na linha ${index + 1}.`);
    }

    const dias = [...new Set(row.dias)];
    if (dias.length !== row.dias.length || dias.some((dia) => !SERVICE_DAYS.includes(dia))) {
      throw new ScheduleValidationError(`Dias inválidos ou repetidos na linha ${index + 1}.`);
    }
    dias.sort((a, b) => SERVICE_DAYS.indexOf(a) - SERVICE_DAYS.indexOf(b));

    return {
      ...(row.id !== undefined ? { id: row.id } : {}),
      ...(row.created_at !== undefined ? { created_at: row.created_at } : {}),
      destino,
      horario: normalizeTime(row.horario, index),
      embarque,
      dias,
    };
  });

  const duplicateKeys = new Set();
  for (const row of normalized) {
    const key = JSON.stringify([row.horario, row.destino, row.embarque, row.dias]);
    if (duplicateKeys.has(key)) {
      throw new ScheduleValidationError(`Horário duplicado: ${row.horario} para ${row.destino}.`);
    }
    duplicateKeys.add(key);
  }

  return normalized.sort(compareSchedules);
}

function addMinutes(horario, minutes) {
  const [hours, mins] = horario.split(':').map(Number);
  const total = (hours * 60 + mins + minutes) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export function createSchedulePayload(rows) {
  const horarios = normalizeScheduleRows(rows, { allowEmpty: true }).map((row) => ({
    ...row,
    schedule_key: getScheduleKey(row),
    horario_parada: addMinutes(row.horario, 13),
    horario_terminal: addMinutes(row.horario, 32),
    parada_dia_offset: Number(addMinutes(row.horario, 13) < row.horario),
    terminal_dia_offset: Number(addMinutes(row.horario, 32) < row.horario),
  }));
  const canonicalSchedule = horarios.map(({ destino, horario, embarque, dias }) => ({
    destino,
    horario,
    embarque,
    dias,
  }));
  const grade_hash = createHash('sha256')
    .update(JSON.stringify(canonicalSchedule))
    .digest('hex');

  return { grade_hash, horarios };
}
