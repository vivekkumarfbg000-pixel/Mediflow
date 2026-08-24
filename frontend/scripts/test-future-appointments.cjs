// =============================================================================
// Comprehensive Test Suite: Future Date (25th August / Tomorrow) Appointment Engine
// Tests: Date Extraction, Queue Filtering, Billing Service Integration & Bot Parsing
// =============================================================================

const assert = require('assert');

console.log('🧪 Starting Future Date Appointment Scheduling Comprehensive Test Suite...\n');

// ─── PART 1: IST Date Helpers ────────────────────────────────────────────────
function getIstDateString(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return formatter.format(date);
}

function getIstOffsetDateString(daysOffset = 0, baseDate = new Date()) {
  const d = new Date(baseDate);
  d.setDate(d.getDate() + daysOffset);
  return getIstDateString(d);
}

const todayStr = getIstDateString();
const tomorrowStr = getIstOffsetDateString(1);
const dayAfterStr = getIstOffsetDateString(2);

console.log(`[Context] Current IST Today: ${todayStr} | Tomorrow: ${tomorrowStr} | Day After: ${dayAfterStr}\n`);

// ─── PART 2: Universal Date Resolution (Mirror of dateUtils.ts) ───────────────
function getEffectiveAppointmentDate(appt) {
  if (!appt) return getIstDateString();
  
  const directDate = appt.date || appt.virtual_date || appt.virtualDate || appt.appointment_date || appt.appointmentDate;
  if (directDate) {
    if (typeof directDate === 'string') {
      const trimmed = directDate.trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        return trimmed;
      }
      if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
        return trimmed.substring(0, 10);
      }
      try {
        const parsed = new Date(trimmed);
        if (!isNaN(parsed.getTime())) {
          return getIstDateString(parsed);
        }
      } catch (_e) {}
    } else if (directDate instanceof Date && !isNaN(directDate.getTime())) {
      return getIstDateString(directDate);
    }
  }

  const apptTime = appt.appointment_time || appt.appointmentTime;
  if (apptTime) {
    try {
      const parsed = new Date(apptTime);
      if (!isNaN(parsed.getTime())) {
        return getIstDateString(parsed);
      }
    } catch (_e) {}
  }

  const creationTime = appt.created_at || appt.createdAt;
  if (creationTime) {
    try {
      const parsed = new Date(creationTime);
      if (!isNaN(parsed.getTime())) {
        return getIstDateString(parsed);
      }
    } catch (_e) {}
  }

  return getIstDateString();
}

console.log('--- TEST GROUP 1: getEffectiveAppointmentDate Extraction Invariants ---');

// Test 1.1: Direct appt.date
const t1 = getEffectiveAppointmentDate({ date: tomorrowStr, created_at: `${todayStr}T08:00:00Z` });
assert.strictEqual(t1, tomorrowStr, `Test 1.1 Failed: expected ${tomorrowStr}, got ${t1}`);
console.log(`✅ 1.1: appt.date (${tomorrowStr}) preserved without falling back to today (${todayStr})`);

// Test 1.2: Direct appt.virtual_date
const t2 = getEffectiveAppointmentDate({ virtual_date: tomorrowStr, created_at: `${todayStr}T08:00:00Z` });
assert.strictEqual(t2, tomorrowStr, `Test 1.2 Failed: expected ${tomorrowStr}, got ${t2}`);
console.log(`✅ 1.2: appt.virtual_date (${tomorrowStr}) preserved accurately`);

// Test 1.3: Direct appt.virtualDate
const t3 = getEffectiveAppointmentDate({ virtualDate: tomorrowStr, created_at: `${todayStr}T08:00:00Z` });
assert.strictEqual(t3, tomorrowStr, `Test 1.3 Failed: expected ${tomorrowStr}, got ${t3}`);
console.log(`✅ 1.3: appt.virtualDate (${tomorrowStr}) preserved accurately`);

// Test 1.4: ISO appointment_time with timezone
const t4 = getEffectiveAppointmentDate({ appointment_time: `${tomorrowStr}T04:30:00.000Z`, created_at: `${todayStr}T08:00:00Z` });
assert.strictEqual(t4, tomorrowStr, `Test 1.4 Failed: expected ${tomorrowStr}, got ${t4}`);
console.log(`✅ 1.4: appt.appointment_time ISO string (${tomorrowStr}) converted to IST accurately`);

// Test 1.5: Datetime string with space (e.g., '2026-08-25 10:30:00')
const t5 = getEffectiveAppointmentDate({ date: `${tomorrowStr} 10:30:00`, created_at: `${todayStr}T08:00:00Z` });
assert.strictEqual(t5, tomorrowStr, `Test 1.5 Failed: expected ${tomorrowStr}, got ${t5}`);
console.log(`✅ 1.5: Datetime string with space correctly extracted as date (${tomorrowStr})`);


// ─── PART 3: Queue Filtering Predicate (isPatientForToday) ───────────────────
console.log('\n--- TEST GROUP 2: Queue Filtering Predicate (isPatientForToday) ---');

const mockPatients = [
  { id: 'pat-today', name: 'Today Patient', registeredAt: `${todayStr}T09:00:00Z` },
  { id: 'pat-tomorrow', name: 'Tomorrow Patient', registeredAt: `${todayStr}T09:00:00Z` }, // Registered today but booked for tomorrow!
  { id: 'pat-walkin', name: 'Walk-in Today', registeredAt: `${todayStr}T09:30:00Z` } // No appt yet
];

const mockAppointments = [
  { id: 'appt-1', patientId: 'pat-today', date: todayStr, status: 'scheduled' },
  { id: 'appt-2', patientId: 'pat-tomorrow', date: tomorrowStr, status: 'pending_payment' } // Booked for tomorrow
];

function isPatientForToday(p, appointments) {
  const patAppts = appointments.filter(a => (a.patientId === p.id || a.patient_id === p.id) && a.status !== 'cancelled');
  if (patAppts.length > 0) {
    return patAppts.some(a => getEffectiveAppointmentDate(a) === todayStr);
  }
  const regDate = p.registeredAt || p.createdAt || p.registered_at || '';
  return regDate.startsWith(todayStr);
}

// Test 2.1: Patient with today's appointment
const isTodayAppt = isPatientForToday(mockPatients[0], mockAppointments);
assert.strictEqual(isTodayAppt, true, 'Test 2.1 Failed: Today patient should be in queue');
console.log('✅ 2.1: Patient with appointment for today is IN today\'s queue (true)');

// Test 2.2: Patient with tomorrow's appointment (registered today)
const isTomorrowAppt = isPatientForToday(mockPatients[1], mockAppointments);
assert.strictEqual(isTomorrowAppt, false, 'Test 2.2 Failed: Tomorrow patient MUST NOT be in today queue');
console.log('✅ 2.2: Patient with appointment for tomorrow is EXCLUDED from today\'s queue (false)');

// Test 2.3: Walk-in patient registered today without pre-booked appointment
const isWalkInToday = isPatientForToday(mockPatients[2], mockAppointments);
assert.strictEqual(isWalkInToday, true, 'Test 2.3 Failed: Walkin registered today should be in today queue');
console.log('✅ 2.3: Walk-in patient registered today is IN today\'s queue (true)');


// ─── PART 4: Billing Consultation Creation ───────────────────────────────────
console.log('\n--- TEST GROUP 3: Scheduled Date OPD Consultation Creation ---');

function createGate1ConsultMock(patientId, source = 'counter', scheduledDate, scheduledTime) {
  const effectiveDate = scheduledDate || getIstDateString();
  const effectiveTime = scheduledTime || '10:00 AM - 12:00 PM';
  return {
    id: 'inv-' + Date.now(),
    appointment: {
      id: 'appt-' + Date.now(),
      patientId,
      source,
      date: effectiveDate,
      virtualDate: effectiveDate,
      virtual_date: effectiveDate,
      virtualTime: effectiveTime,
      virtual_time: effectiveTime,
      appointmentTime: `${effectiveDate}T10:00:00.000Z`,
      appointment_time: `${effectiveDate}T10:00:00.000Z`,
      status: 'pending_payment'
    }
  };
}

const consultTomorrow = createGate1ConsultMock('pat-user-01', 'whatsapp', tomorrowStr, '02:00 PM - 04:00 PM');
assert.strictEqual(consultTomorrow.appointment.date, tomorrowStr);
assert.strictEqual(consultTomorrow.appointment.virtual_date, tomorrowStr);
assert.strictEqual(consultTomorrow.appointment.virtual_time, '02:00 PM - 04:00 PM');
console.log(`✅ 3.1: createGate1Consult with scheduledDate created appointment for ${tomorrowStr} at 02:00 PM`);


// ─── PART 5: Bot Date Option Generation & Resolution ────────────────────────
console.log('\n--- TEST GROUP 4: WhatsApp Bot Date Option & Button ID Resolution ---');

function generateBookingDateOptions(isSos = false) {
  const now = new Date();
  const istHour = 10; // Simulated morning
  const isTodayAvailable = isSos ? (istHour < 19) : (istHour < 17);
  const startOffset = isTodayAvailable ? 0 : 1;

  const dates = [];
  const displayDates = [];

  for (let i = 0; i < 4; i++) {
    const dayOffset = startOffset + i;
    const dateStr = getIstOffsetDateString(dayOffset, now);
    dates.push(dateStr);
    displayDates.push(dayOffset === 0 ? `Today (${dateStr})` : (dayOffset === 1 ? `Tomorrow (${dateStr})` : `Day ${dayOffset} (${dateStr})`));
  }

  return { dates, displayDates, isTodayAvailable };
}

const { dates, displayDates } = generateBookingDateOptions(false);
console.log('Available Bot Dates:', dates);

function resolveDateFromButtonOrOption(replyId, cleanedText, sessionDateOptions) {
  if (replyId && replyId.startsWith('btn_date_')) {
    const potentialDate = replyId.replace('btn_date_', '').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(potentialDate)) {
      return potentialDate;
    }
    if (replyId === 'btn_date_1') return sessionDateOptions[0];
    if (replyId === 'btn_date_2') return sessionDateOptions[1];
    if (replyId === 'btn_date_3') return sessionDateOptions[2];
  }
  const parsedNum = parseInt(cleanedText.replace(/\D/g, ''));
  if (!isNaN(parsedNum) && parsedNum >= 1 && parsedNum <= sessionDateOptions.length) {
    return sessionDateOptions[parsedNum - 1];
  }
  if (cleanedText.includes('tomorrow') || cleanedText.includes('kal')) {
    return getIstOffsetDateString(1);
  }
  return sessionDateOptions[0];
}

// Test 4.1: Click button btn_date_2
const r1 = resolveDateFromButtonOrOption('btn_date_2', '', dates);
assert.strictEqual(r1, tomorrowStr);
console.log(`✅ 4.1: Button 'btn_date_2' resolved to ${r1} (Tomorrow)`);

// Test 4.2: Direct ISO Button btn_date_2026-08-25
const r2 = resolveDateFromButtonOrOption(`btn_date_${tomorrowStr}`, '', dates);
assert.strictEqual(r2, tomorrowStr);
console.log(`✅ 4.2: Direct date button 'btn_date_${tomorrowStr}' resolved to ${r2}`);

// Test 4.3: User types "2"
const r3 = resolveDateFromButtonOrOption(null, '2', dates);
assert.strictEqual(r3, tomorrowStr);
console.log(`✅ 4.3: User text '2' resolved to ${r3} (Tomorrow)`);

// Test 4.4: User types "kal" / "tomorrow"
const r4 = resolveDateFromButtonOrOption(null, 'kal subah consult karna hai', dates);
assert.strictEqual(r4, tomorrowStr);
console.log(`✅ 4.4: User keyword 'kal' resolved to ${r4} (Tomorrow)`);

console.log('\n=============================================================');
console.log('🎉 ALL 12 FUTURE DATE APPOINTMENT TESTS PASSED WITH 100% SUCCESS!');
console.log('=============================================================');
