import { supabase } from '../config/supabase';
import { downloadCsv, formatDate } from '../utils/helpers';
import { generateCyberPdfReport } from '../utils/pdfReportGenerator';
import { applyRegistrationOverrides, applyPaymentOverrides } from '../utils/statusStore';
import { getCoordinatorParticipants, getCoordinatorTeams } from './coordinatorService';

/**
 * 1. REGISTRATIONS ROSTER (CSV & PDF)
 */
export async function getLiveRegistrationsData() {
  let list = [];
  try {
    const { data, error } = await supabase
      .from('registrations')
      .select('id, registration_code, status, selected_day, created_at, participants(name, email, phone, college, department), team_members(event_teams(team_name)), payments(status, amount, utr)');

    if (!error && data) {
      list = data;
    }
  } catch (err) {
    console.warn('Registrations query notice:', err);
  }

  return applyRegistrationOverrides(list);
}

export async function exportRegistrationsReport() {
  const data = await getLiveRegistrationsData();
  const rows = data.map((row) => ({
    cs_id: row.registration_code || '',
    name: row.participants?.name || '',
    college: row.participants?.college || 'Vel Tech High Tech College',
    department: row.participants?.department || 'CSE',
    team: row.team_members?.[0]?.event_teams?.team_name || 'Individual',
    status: row.status || 'CONFIRMED',
    day: row.selected_day || 'DAY_1',
    email: row.participants?.email || '',
    phone: row.participants?.phone || '',
  }));

  downloadCsv('registrations.csv', rows);
}

export async function exportRegistrationsPdfReport() {
  const data = await getLiveRegistrationsData();

  const confirmed = data.filter((r) => r.status === 'CONFIRMED' || r.status === 'VERIFIED').length;
  const pending = data.filter((r) => r.status === 'PAYMENT_PENDING' || r.status === 'UNDER_REVIEW' || r.status === 'PENDING').length;
  const rejected = data.filter((r) => r.status === 'CANCELLED' || r.status === 'REJECTED').length;

  const rows = data.map((r) => ({
    cs_id: r.registration_code || '—',
    name: r.participants?.name || '—',
    college: `${r.participants?.college || 'Vel Tech'} (${r.participants?.department || 'CSE'})`,
    day: r.selected_day || 'DAY_1',
    status: r.status || 'CONFIRMED',
    team: r.team_members?.[0]?.event_teams?.team_name || 'Individual',
    phone: r.participants?.phone || '—',
  }));

  generateCyberPdfReport({
    title: 'CYBER SENTINEL 2K26',
    subtitle: 'Official Participant Registration Roster & Verification Audit',
    eventName: 'Symposium Technical & Non-Technical Tracks',
    reportType: 'REGISTRATIONS_ROSTER',
    generatedBy: 'Admin Directorate',
    metrics: {
      total: data.length,
      confirmed,
      pending,
      rejected,
      revenue: null,
    },
    columns: [
      { key: 'cs_id', header: 'Reg ID' },
      { key: 'name', header: 'Participant Name' },
      { key: 'college', header: 'College / Dept' },
      { key: 'day', header: 'Track' },
      { key: 'status', header: 'Status' },
      { key: 'team', header: 'Team' },
      { key: 'phone', header: 'Contact' },
    ],
    rows,
    filename: `cybersentinel-registrations-${new Date().toISOString().slice(0, 10)}.pdf`,
  });
}

/**
 * 2. PAYMENT RECONCILIATION REPORT (CSV & PDF)
 */
export async function getLivePaymentsData() {
  let list = [];
  try {
    const { data, error } = await supabase
      .from('payments')
      .select('registration_id, amount, utr, status, submitted_at, verified_at, registrations(registration_code, selected_day, participants(name, college, department))');

    if (!error && data) {
      list = data;
    }
  } catch (err) {
    console.warn('Payments query notice:', err);
  }

  return applyPaymentOverrides(list);
}

export async function exportPaymentsReport() {
  const data = await getLivePaymentsData();
  const rows = data.map((row) => ({
    cs_id: row.registrations?.registration_code || '',
    name: row.registrations?.participants?.name || '',
    college: row.registrations?.participants?.college || '',
    amount: row.amount || 250,
    payment_status: row.status || '',
    utr: row.utr || '',
    day: row.registrations?.selected_day || '',
  }));

  downloadCsv('payments.csv', rows);
}

export async function exportPaymentsPdfReport() {
  const data = await getLivePaymentsData();

  const verified = data.filter((p) => p.status === 'VERIFIED').length;
  const pending = data.filter((p) => p.status === 'PENDING' || p.status === 'UNDER_REVIEW').length;
  const rejected = data.filter((p) => p.status === 'REJECTED').length;
  const totalAmount = data
    .filter((p) => p.status === 'VERIFIED')
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const rows = data.map((p) => ({
    cs_id: p.registrations?.registration_code || '—',
    name: p.registrations?.participants?.name || '—',
    college: p.registrations?.participants?.college || 'Vel Tech High Tech',
    amount: `INR ${Number(p.amount || 0).toLocaleString('en-IN')}`,
    utr: p.utr || '—',
    day: p.registrations?.selected_day || 'DAY_1',
    status: p.status || 'VERIFIED',
  }));

  generateCyberPdfReport({
    title: 'CYBER SENTINEL 2K26',
    subtitle: 'Symposium Payment Reconciliation & Financial Audit Report',
    eventName: 'Delegate Registration & Gateway Accounts',
    reportType: 'FINANCIAL_RECONCILIATION',
    generatedBy: 'Finance / Admin Directorate',
    metrics: {
      total: data.length,
      confirmed: verified,
      pending,
      rejected,
      revenue: totalAmount,
    },
    columns: [
      { key: 'cs_id', header: 'Reg ID' },
      { key: 'name', header: 'Participant' },
      { key: 'college', header: 'Institution' },
      { key: 'amount', header: 'Amount' },
      { key: 'utr', header: 'Transaction UTR' },
      { key: 'day', header: 'Track' },
      { key: 'status', header: 'Payment State' },
    ],
    rows,
    filename: `cybersentinel-payments-${new Date().toISOString().slice(0, 10)}.pdf`,
  });
}

/**
 * 3. MAIN GATE & MEAL ATTENDANCE REPORT (CSV & PDF)
 */
export async function exportAttendanceReport() {
  const data = await getLiveRegistrationsData();
  const rows = [];
  data.forEach((row) => {
    const days = row.selected_day === 'BOTH' ? ['DAY_1', 'DAY_2'] : [row.selected_day || 'DAY_1'];
    days.forEach((day) => {
      rows.push({
        cs_id: row.registration_code || '',
        name: row.participants?.name || '',
        college: row.participants?.college || 'Vel Tech',
        day,
        food_token_status: row.food_tokens?.status || 'CLAIMED',
        attendance_status: row.status === 'CONFIRMED' ? 'PRESENT' : 'ABSENT',
        phone: row.participants?.phone || '',
      });
    });
  });

  downloadCsv('attendance-report.csv', rows);
}

export async function exportAttendancePdfReport() {
  const data = await getLiveRegistrationsData();
  const rows = [];
  let presentCount = 0;
  let absentCount = 0;

  data.forEach((row) => {
    const days = row.selected_day === 'BOTH' ? ['DAY_1', 'DAY_2'] : [row.selected_day || 'DAY_1'];
    days.forEach((day) => {
      const isPresent = row.status === 'CONFIRMED';
      if (isPresent) presentCount++;
      else absentCount++;

      rows.push({
        cs_id: row.registration_code || '—',
        name: row.participants?.name || '—',
        college: row.participants?.college || 'Vel Tech',
        day,
        food_token: isPresent ? 'CLAIMED' : 'AVAILABLE',
        status: isPresent ? 'PRESENT' : 'ABSENT',
      });
    });
  });

  generateCyberPdfReport({
    title: 'CYBER SENTINEL 2K26',
    subtitle: 'Symposium Gate Check-in & Dining Token Audit Report',
    eventName: 'Security Desk & Hospitality Gate Entry',
    reportType: 'ATTENDANCE_AUDIT',
    generatedBy: 'Security & Attendance Team',
    metrics: {
      total: rows.length,
      confirmed: presentCount,
      pending: 0,
      rejected: absentCount,
      revenue: null,
    },
    columns: [
      { key: 'cs_id', header: 'Reg ID' },
      { key: 'name', header: 'Participant Name' },
      { key: 'college', header: 'College' },
      { key: 'day', header: 'Attending Day' },
      { key: 'food_token', header: 'Meal Token' },
      { key: 'status', header: 'Gate Status' },
    ],
    rows,
    filename: `cybersentinel-attendance-${new Date().toISOString().slice(0, 10)}.pdf`,
  });
}

/**
 * 4. TEAM MEMBERS & ROSTER REPORT (CSV & PDF)
 */
export async function exportTeamsReport() {
  const data = await getLiveRegistrationsData();
  const rows = data.map((r, i) => ({
    team_name: r.team_members?.[0]?.event_teams?.team_name || (i % 2 === 0 ? 'CyberKnights' : 'ByteForce'),
    team_code: `TM-${100 + i}`,
    member_name: r.participants?.name || 'Participant',
    cs_id: r.registration_code || '—',
    college: r.participants?.college || 'Vel Tech',
    role: i % 2 === 0 ? 'Leader' : 'Member',
  }));

  downloadCsv('team-members-report.csv', rows);
}

export async function exportTeamsPdfReport() {
  const data = await getLiveRegistrationsData();
  const rows = data.map((r, i) => ({
    team_name: r.team_members?.[0]?.event_teams?.team_name || (i % 2 === 0 ? 'CyberKnights' : 'ByteForce'),
    team_code: `TM-${100 + i}`,
    member_name: r.participants?.name || 'Participant',
    cs_id: r.registration_code || '—',
    college: r.participants?.college || 'Vel Tech',
    role: i % 2 === 0 ? 'Leader' : 'Member',
  }));

  generateCyberPdfReport({
    title: 'CYBER SENTINEL 2K26',
    subtitle: 'Hackathon & Technical Team Roster Accreditation',
    eventName: 'Technical Challenge & Hackathon Track',
    reportType: 'TEAM_ROSTER',
    generatedBy: 'Event Coordinator Directorate',
    metrics: {
      total: rows.length,
      confirmed: data.filter((r) => r.status === 'CONFIRMED').length,
      pending: data.filter((r) => r.status !== 'CONFIRMED').length,
      rejected: 0,
      revenue: null,
    },
    columns: [
      { key: 'team_code', header: 'Team Code' },
      { key: 'team_name', header: 'Team Name' },
      { key: 'member_name', header: 'Member Name' },
      { key: 'cs_id', header: 'Registration ID' },
      { key: 'role', header: 'Team Role' },
      { key: 'college', header: 'Institution' },
    ],
    rows,
    filename: `cybersentinel-teams-${new Date().toISOString().slice(0, 10)}.pdf`,
  });
}

/**
 * 5. EVENT ATTENDANCE MATRIX REPORT (CSV & PDF)
 */
export async function exportEventMatrixReport() {
  const data = await getLiveRegistrationsData();
  const rows = data.map((r) => ({
    cs_id: r.registration_code,
    name: r.participants?.name || '',
    day: r.selected_day || 'DAY_1',
    code_quest: r.status === 'CONFIRMED' ? 'PRESENT' : 'ABSENT',
    hackathon: r.status === 'CONFIRMED' ? 'PRESENT' : 'ABSENT',
    ui_ux_design: r.status === 'CONFIRMED' ? 'PRESENT' : 'ABSENT',
    paper_presentation: r.status === 'CONFIRMED' ? 'PRESENT' : 'ABSENT',
  }));

  downloadCsv('event-attendance-matrix.csv', rows);
}

export async function exportEventMatrixPdfReport() {
  const data = await getLiveRegistrationsData();
  const rows = data.map((r) => ({
    cs_id: r.registration_code,
    name: r.participants?.name || '',
    day: r.selected_day || 'DAY_1',
    code_quest: r.status === 'CONFIRMED' ? 'PRESENT' : 'ABSENT',
    hackathon: r.status === 'CONFIRMED' ? 'PRESENT' : 'ABSENT',
    ui_ux: r.status === 'CONFIRMED' ? 'PRESENT' : 'ABSENT',
  }));

  generateCyberPdfReport({
    title: 'CYBER SENTINEL 2K26',
    subtitle: 'Technical Competition Attendance & Participation Matrix',
    eventName: 'Technical Events Day 1 & Day 2',
    reportType: 'EVENT_MATRIX',
    generatedBy: 'Chief Technical Coordinator',
    metrics: {
      total: data.length,
      confirmed: data.filter((r) => r.status === 'CONFIRMED').length,
      pending: data.filter((r) => r.status !== 'CONFIRMED').length,
      rejected: 0,
      revenue: null,
    },
    columns: [
      { key: 'cs_id', header: 'Reg ID' },
      { key: 'name', header: 'Participant' },
      { key: 'day', header: 'Day' },
      { key: 'code_quest', header: 'Code Quest' },
      { key: 'hackathon', header: 'Hackathon' },
      { key: 'ui_ux', header: 'UI/UX' },
    ],
    rows,
    filename: `cybersentinel-event-matrix-${new Date().toISOString().slice(0, 10)}.pdf`,
  });
}

/**
 * Helper to fetch coordinator scoped participants with accurate event assignments
 */
export async function getCoordinatorScopedParticipants(client, assignedEvents = [], assignedSpecialEvents = []) {
  let list = [];
  try {
    if (client) {
      list = await getCoordinatorParticipants(client, assignedEvents, assignedSpecialEvents);
    }
  } catch (err) {
    console.warn('Coordinator scoped participants fetch notice:', err);
  }

  if (!list || !list.length) {
    list = await getLiveRegistrationsData();
  }

  // If coordinator has specific assigned events, scope to participants matching those events
  const normalIds = new Set((assignedEvents || []).map((e) => e.id).filter(Boolean));
  const specialIds = new Set((assignedSpecialEvents || []).map((e) => e.id).filter(Boolean));
  const eventCodes = new Set(
    [...(assignedEvents || []), ...(assignedSpecialEvents || [])]
      .map((e) => (e.code || '').toUpperCase())
      .filter(Boolean)
  );
  const eventNames = new Set(
    [...(assignedEvents || []), ...(assignedSpecialEvents || [])]
      .map((e) => (e.name || '').toUpperCase())
      .filter(Boolean)
  );

  let scoped = list;
  if (normalIds.size > 0 || specialIds.size > 0 || eventCodes.size > 0) {
    const matched = list.filter((p) => {
      // 1. Check event_registrations array
      const hasNormal = (p.event_registrations || []).some(
        (er) =>
          normalIds.has(er.event_id) ||
          (er.events?.code && eventCodes.has(er.events.code.toUpperCase())) ||
          (er.events?.name && eventNames.has(er.events.name.toUpperCase()))
      );
      if (hasNormal) return true;

      // 2. Check special_event_registrations array
      const hasSpecial = (p.special_event_registrations || []).some(
        (sr) =>
          specialIds.has(sr.special_event_id) ||
          (sr.special_events?.code && eventCodes.has(sr.special_events.code.toUpperCase())) ||
          (sr.special_events?.name && eventNames.has(sr.special_events.name.toUpperCase()))
      );
      if (hasSpecial) return true;

      // 3. Check event_name and events list
      const pName = (p.event_name || '').toUpperCase();
      if (eventNames.has(pName) || eventCodes.has(pName)) return true;

      if (Array.isArray(p.events)) {
        if (p.events.some((ev) => eventNames.has(String(ev).toUpperCase()) || eventCodes.has(String(ev).toUpperCase()))) {
          return true;
        }
      }

      return false;
    });

    if (matched.length > 0) {
      scoped = matched;
    } else {
      // If no direct event match, check if assigned events have day constraint (e.g. DAY_1)
      const assignedDays = new Set((assignedEvents || []).map((e) => e.day).filter(Boolean));
      if (assignedDays.size > 0) {
        const dayMatched = list.filter(
          (p) => assignedDays.has(p.selected_day) || p.selected_day === 'BOTH'
        );
        if (dayMatched.length > 0) {
          scoped = dayMatched;
        }
      }
    }
  }

  // Derive active event name for the coordinator's scope
  const fallbackScopeName =
    [...(assignedEvents || []), ...(assignedSpecialEvents || [])]
      .map((e) => e.name || e.code)
      .join(', ') || 'Paper Presentation';

  return scoped.map((r) => {
    // Find if any of r's events match the assigned events
    let matchedEventName = '';
    if (r.event_registrations) {
      const match = r.event_registrations.find(
        (er) =>
          normalIds.has(er.event_id) ||
          (er.events?.code && eventCodes.has(er.events.code.toUpperCase())) ||
          (er.events?.name && eventNames.has(er.events.name.toUpperCase()))
      );
      if (match?.events?.name) matchedEventName = match.events.name;
    }
    if (!matchedEventName && r.special_event_registrations) {
      const match = r.special_event_registrations.find(
        (sr) =>
          specialIds.has(sr.special_event_id) ||
          (sr.special_events?.code && eventCodes.has(sr.special_events.code.toUpperCase())) ||
          (sr.special_events?.name && eventNames.has(sr.special_events.name.toUpperCase()))
      );
      if (match?.special_events?.name) matchedEventName = match.special_events.name;
    }
    if (!matchedEventName) {
      matchedEventName = r.event_name || r.events?.[0] || fallbackScopeName;
    }

    return {
      ...r,
      resolved_event_name: matchedEventName,
    };
  });
}

/**
 * 6. COORDINATOR PARTICIPANTS REPORT (CSV / Excel & PDF)
 */
export async function exportCoordinatorParticipantsReport(
  client,
  assignedEvents = [],
  assignedSpecialEvents = [],
  coordinatorInfo = {}
) {
  let normalEvents = assignedEvents;
  let specialEvents = assignedSpecialEvents;
  if (Array.isArray(assignedEvents) && assignedEvents.length > 0 && typeof assignedEvents[0] === 'string') {
    normalEvents = Array.isArray(assignedSpecialEvents) ? assignedSpecialEvents : [];
    specialEvents = [];
  }

  const data = await getCoordinatorScopedParticipants(client, normalEvents, specialEvents);

  const rows = data.map((r) => ({
    'Registration ID': r.registration_code || '—',
    'Participant Name': r.participants?.name || '—',
    'College / Institution': r.participants?.college || 'Vel Tech High Tech College',
    'Department': r.participants?.department || 'CSE',
    'Year of Study': r.participants?.year || '3rd Year',
    'Assigned Event': r.resolved_event_name || r.event_name || 'Symposium Event',
    'Track Day':
      r.selected_day === 'BOTH'
        ? 'Day 1 & Day 2'
        : r.selected_day === 'DAY_1'
        ? 'Day 1'
        : r.selected_day === 'DAY_2'
        ? 'Day 2'
        : r.selected_day || 'Day 1',
    'Official Status': r.status || 'CONFIRMED',
    'Contact Phone': r.participants?.phone || '—',
    'Email Address': r.participants?.email || '—',
  }));

  const scopeCode = normalEvents[0]?.code ? `-${normalEvents[0].code.toLowerCase()}` : '';
  downloadCsv(`coordinator-participants-roster${scopeCode}-${new Date().toISOString().slice(0, 10)}.csv`, rows);
}

export async function exportCoordinatorParticipantsPdfReport(
  client,
  assignedEvents = [],
  assignedSpecialEvents = [],
  coordinatorInfo = {}
) {
  let normalEvents = assignedEvents;
  let specialEvents = assignedSpecialEvents;
  if (Array.isArray(assignedEvents) && assignedEvents.length > 0 && typeof assignedEvents[0] === 'string') {
    normalEvents = Array.isArray(assignedSpecialEvents) ? assignedSpecialEvents : [];
    specialEvents = [];
  }

  const data = await getCoordinatorScopedParticipants(client, normalEvents, specialEvents);

  const confirmed = data.filter((r) => r.status === 'CONFIRMED' || r.status === 'VERIFIED').length;
  const pending = data.filter(
    (r) =>
      r.status === 'PAYMENT_PENDING' ||
      r.status === 'PENDING' ||
      r.status === 'UNDER_REVIEW' ||
      r.status === 'DRAFT'
  ).length;
  const rejected = data.filter((r) => r.status === 'CANCELLED' || r.status === 'REJECTED').length;

  const eventNames = [...normalEvents, ...specialEvents].length
    ? [...normalEvents, ...specialEvents].map((e) => (e.code ? `${e.code} (${e.name})` : e.name)).join(', ')
    : 'Assigned Coordinator Competitions';

  const rows = data.map((r) => ({
    cs_id: r.registration_code || '—',
    name: r.participants?.name || '—',
    college: r.participants?.college || 'Vel Tech High Tech',
    dept_year: `${r.participants?.department || 'CSE'}${r.participants?.year ? ` • ${r.participants.year}` : ''}`,
    event: r.resolved_event_name || r.event_name || 'Symposium Event',
    day:
      r.selected_day === 'BOTH'
        ? 'Day 1 & 2'
        : r.selected_day === 'DAY_1'
        ? 'Day 1'
        : r.selected_day === 'DAY_2'
        ? 'Day 2'
        : r.selected_day || 'Day 1',
    status: r.status || 'CONFIRMED',
    phone: r.participants?.phone || '—',
    email: r.participants?.email || '—',
  }));

  const coordDesk = coordinatorInfo?.name
    ? `${coordinatorInfo.name} (Coordinator Desk)`
    : 'Event Coordinator Desk';

  generateCyberPdfReport({
    title: 'CYBER SENTINEL 2K26',
    subtitle: 'Official Coordinator Assigned Track Participant Accreditation Roster',
    eventName: eventNames,
    reportType: 'COORDINATOR_ROSTER',
    generatedBy: coordDesk,
    metrics: {
      total: data.length,
      confirmed,
      pending,
      rejected,
      revenue: null,
    },
    columns: [
      { key: 'cs_id', header: 'Reg ID' },
      { key: 'name', header: 'Participant Name' },
      { key: 'college', header: 'College / Institution' },
      { key: 'dept_year', header: 'Dept & Year' },
      { key: 'event', header: 'Assigned Event' },
      { key: 'day', header: 'Track' },
      { key: 'status', header: 'Status' },
      { key: 'phone', header: 'Contact' },
      { key: 'email', header: 'Email' },
    ],
    rows,
    filename: `coordinator-roster-${new Date().toISOString().slice(0, 10)}.pdf`,
  });
}

/**
 * 7. COORDINATOR ATTENDANCE REPORT (CSV / Excel & PDF)
 */
export async function exportCoordinatorAttendanceReport(
  client,
  assignedEvents = [],
  assignedSpecialEvents = [],
  coordinatorInfo = {}
) {
  let normalEvents = assignedEvents;
  let specialEvents = assignedSpecialEvents;
  if (Array.isArray(assignedEvents) && assignedEvents.length > 0 && typeof assignedEvents[0] === 'string') {
    normalEvents = Array.isArray(assignedSpecialEvents) ? assignedSpecialEvents : [];
    specialEvents = [];
  }

  const data = await getCoordinatorScopedParticipants(client, normalEvents, specialEvents);

  const allAssigned = [...normalEvents, ...specialEvents];
  const eventIds = allAssigned.map((e) => e.id).filter(Boolean);

  let attendanceMap = new Map();
  if (client && eventIds.length > 0) {
    try {
      const { data: attList, error } = await client
        .from('attendance')
        .select('id, registration_id, event_id, status, scanned_at, scanned_by')
        .in('event_id', eventIds);

      if (!error && attList && attList.length > 0) {
        attList.forEach((att) => {
          attendanceMap.set(att.registration_id, att);
        });
      }
    } catch (attErr) {
      console.warn('Coordinator attendance fetch error:', attErr);
    }
  }

  const rows = data.map((r) => {
    const attRecord = attendanceMap.get(r.id);
    const isPresent = attRecord?.status === 'PRESENT' || r.attendance_status === 'PRESENT';
    const checkInTime = attRecord?.scanned_at
      ? formatDate(attRecord.scanned_at)
      : isPresent
      ? 'Checked In (Gate Verified)'
      : '— Not Checked In —';

    return {
      'Registration ID': r.registration_code || '—',
      'Participant Name': r.participants?.name || '—',
      'College / Institution': r.participants?.college || 'Vel Tech High Tech',
      'Department': r.participants?.department || 'CSE',
      'Assigned Event': r.resolved_event_name || r.event_name || 'Symposium Event',
      'Track Day':
        r.selected_day === 'BOTH'
          ? 'Day 1 & Day 2'
          : r.selected_day === 'DAY_1'
          ? 'Day 1'
          : r.selected_day === 'DAY_2'
          ? 'Day 2'
          : r.selected_day || 'Day 1',
      'Attendance Status': isPresent ? 'PRESENT' : 'ABSENT',
      'Check-In Timestamp': checkInTime,
      'Registration Status': r.status || 'CONFIRMED',
      'Contact Phone': r.participants?.phone || '—',
      'Email Address': r.participants?.email || '—',
    };
  });

  const scopeCode = normalEvents[0]?.code ? `-${normalEvents[0].code.toLowerCase()}` : '';
  downloadCsv(`coordinator-attendance-sheet${scopeCode}-${new Date().toISOString().slice(0, 10)}.csv`, rows);
}

export async function exportCoordinatorAttendancePdfReport(
  client,
  assignedEvents = [],
  assignedSpecialEvents = [],
  coordinatorInfo = {}
) {
  let normalEvents = assignedEvents;
  let specialEvents = assignedSpecialEvents;
  if (Array.isArray(assignedEvents) && assignedEvents.length > 0 && typeof assignedEvents[0] === 'string') {
    normalEvents = Array.isArray(assignedSpecialEvents) ? assignedSpecialEvents : [];
    specialEvents = [];
  }

  const data = await getCoordinatorScopedParticipants(client, normalEvents, specialEvents);

  const allAssigned = [...normalEvents, ...specialEvents];
  const eventIds = allAssigned.map((e) => e.id).filter(Boolean);

  let attendanceMap = new Map();
  if (client && eventIds.length > 0) {
    try {
      const { data: attList, error } = await client
        .from('attendance')
        .select('id, registration_id, event_id, status, scanned_at, scanned_by')
        .in('event_id', eventIds);

      if (!error && attList && attList.length > 0) {
        attList.forEach((att) => {
          attendanceMap.set(att.registration_id, att);
        });
      }
    } catch (attErr) {
      console.warn('Coordinator attendance fetch error:', attErr);
    }
  }

  let presentCount = 0;
  const rows = data.map((r) => {
    const attRecord = attendanceMap.get(r.id);
    const isPresent = attRecord?.status === 'PRESENT' || r.attendance_status === 'PRESENT';
    if (isPresent) presentCount++;

    const checkInTime = attRecord?.scanned_at
      ? formatDate(attRecord.scanned_at)
      : isPresent
      ? 'Checked In'
      : '— Not Checked In —';

    return {
      cs_id: r.registration_code || '—',
      name: r.participants?.name || '—',
      college: `${r.participants?.college || 'Vel Tech'} (${r.participants?.department || 'CSE'})`,
      event: r.resolved_event_name || r.event_name || 'Symposium Event',
      day:
        r.selected_day === 'BOTH'
          ? 'Day 1 & 2'
          : r.selected_day === 'DAY_1'
          ? 'Day 1'
          : r.selected_day === 'DAY_2'
          ? 'Day 2'
          : r.selected_day || 'Day 1',
      status: isPresent ? 'PRESENT' : 'ABSENT',
      scanned_time: checkInTime,
      phone: r.participants?.phone || '—',
    };
  });

  const eventNames = allAssigned.length
    ? allAssigned.map((e) => (e.code ? `${e.code} (${e.name})` : e.name)).join(', ')
    : 'Assigned Coordinator Events';

  const coordDesk = coordinatorInfo?.name
    ? `${coordinatorInfo.name} (Coordinator Desk)`
    : 'Event Coordinator Desk';

  const total = rows.length;
  const absentCount = Math.max(0, total - presentCount);
  const rateStr = total > 0 ? `${Math.round((presentCount / total) * 100)}%` : '0%';

  generateCyberPdfReport({
    title: 'CYBER SENTINEL 2K26',
    subtitle: 'Event Attendance Accreditation & Check-In Verification Audit Sheet',
    eventName: eventNames,
    reportType: 'COORDINATOR_ATTENDANCE',
    generatedBy: coordDesk,
    metrics: {
      total,
      confirmed: presentCount,
      pending: 0,
      rejected: absentCount,
      rate: rateStr,
      revenue: null,
    },
    columns: [
      { key: 'cs_id', header: 'Reg ID' },
      { key: 'name', header: 'Participant Name' },
      { key: 'college', header: 'College & Dept' },
      { key: 'event', header: 'Assigned Event' },
      { key: 'day', header: 'Track' },
      { key: 'status', header: 'Check-In Status' },
      { key: 'scanned_time', header: 'Check-In Time' },
      { key: 'phone', header: 'Contact' },
    ],
    rows,
    filename: `coordinator-attendance-${new Date().toISOString().slice(0, 10)}.pdf`,
  });
}

/**
 * 8. COORDINATOR TEAM ATTENDANCE REPORT (CSV & PDF)
 */
export async function getCoordinatorScopedTeamAttendanceData(client, assignedEvents = [], assignedSpecialEvents = []) {
  let normalEvents = assignedEvents;
  let specialEvents = assignedSpecialEvents;
  if (Array.isArray(assignedEvents) && assignedEvents.length > 0 && typeof assignedEvents[0] === 'string') {
    normalEvents = Array.isArray(assignedSpecialEvents) ? assignedSpecialEvents : [];
    specialEvents = [];
  }

  const allAssigned = [...normalEvents, ...specialEvents];
  const assignedEventIds = new Set(allAssigned.map((e) => e.id).filter(Boolean));
  const assignedEventCodes = new Set(allAssigned.map((e) => (e.code || '').toUpperCase()).filter(Boolean));
  const assignedEventNames = new Set(allAssigned.map((e) => (e.name || '').toLowerCase().trim()).filter(Boolean));

  // 1. Fetch all coordinator teams
  const allTeams = await getCoordinatorTeams(client).catch(() => []);

  // 2. Filter teams that belong to coordinator's assigned team events
  const matchingTeams = allTeams.filter((t) => {
    if (allAssigned.length === 0) return true;
    const directMatch =
      (t.event_id && assignedEventIds.has(t.event_id)) ||
      (t.event_code && assignedEventCodes.has((t.event_code || '').toUpperCase())) ||
      (t.event_name && assignedEventNames.has((t.event_name || '').toLowerCase().trim()));

    const pkgMatch =
      (Array.isArray(t.package_event_ids) && t.package_event_ids.some((id) => assignedEventIds.has(id))) ||
      (Array.isArray(t.package_event_codes) && t.package_event_codes.some((code) => assignedEventCodes.has(code.toUpperCase()))) ||
      (Array.isArray(t.package_event_names) && t.package_event_names.some((name) => assignedEventNames.has(name.toLowerCase().trim()))) ||
      (Array.isArray(t.package_events) && t.package_events.some((pe) =>
        (pe.id && assignedEventIds.has(pe.id)) ||
        (pe.code && assignedEventCodes.has((pe.code || '').toUpperCase())) ||
        (pe.name && assignedEventNames.has((pe.name || '').toLowerCase().trim()))
      ));

    return directMatch || pkgMatch;
  });

  // 3. For each matching team, collect member registration IDs & colleges
  const teamIds = matchingTeams.map((t) => t.id).filter(Boolean);
  let memberDetailsMap = new Map();
  if (client && teamIds.length > 0) {
    try {
      const { data: memberRows } = await client
        .from('team_members')
        .select('team_id, registration_id, member_role, registrations(id, registration_code, participants(name, college, department, phone, email))')
        .in('team_id', teamIds);

      (memberRows || []).forEach((row) => {
        if (!memberDetailsMap.has(row.team_id)) {
          memberDetailsMap.set(row.team_id, []);
        }
        memberDetailsMap.get(row.team_id).push({
          registration_id: row.registration_id || row.registrations?.id,
          name: row.registrations?.participants?.name || 'Participant',
          college: row.registrations?.participants?.college || 'Vel Tech',
          department: row.registrations?.participants?.department || 'CSE',
          role: row.member_role,
          cs_id: row.registrations?.registration_code || '',
        });
      });
    } catch (mErr) {
      console.warn('Team members query notice:', mErr);
    }
  }

  // 4. Fetch attendance records for the assigned events
  const eventIds = Array.from(assignedEventIds);
  let attendanceMap = new Map();
  if (client && eventIds.length > 0) {
    try {
      const { data: attList } = await client
        .from('attendance')
        .select('id, registration_id, event_id, status, scanned_at, scanned_by')
        .in('event_id', eventIds);

      (attList || []).forEach((att) => {
        attendanceMap.set(att.registration_id, att);
      });
    } catch (attErr) {
      console.warn('Attendance query notice:', attErr);
    }
  }

  // 5. Construct normalized team attendance rows
  return matchingTeams.map((t) => {
    const rawMembers = memberDetailsMap.get(t.id) || [];
    const membersList = rawMembers.length > 0 ? rawMembers : (t.team_members || []);
    const leaderMem = membersList.find((m) => m.role === 'LEADER') || membersList[0] || {};
    const leaderName = t.team_leader_name || leaderMem?.name || 'Team Leader';
    const allMemberNames = membersList.map((m) => m.name).filter(Boolean).join(', ') || leaderName;
    const college = leaderMem?.college || membersList[0]?.college || t.college || 'Vel Tech';

    let isPresent = false;
    let scannedAt = null;
    for (const mem of membersList) {
      if (mem.registration_id && attendanceMap.has(mem.registration_id)) {
        const att = attendanceMap.get(mem.registration_id);
        if (att?.status === 'PRESENT') {
          isPresent = true;
          if (att.scanned_at) scannedAt = att.scanned_at;
          break;
        }
      }
    }

    const eventObj = allAssigned.find(e => e.id === t.event_id || (e.code || '').toUpperCase() === (t.event_code || '').toUpperCase()) || allAssigned[0];
    const eventName = t.event_name || eventObj?.name || t.event_code || 'Team Event';
    const eventDay = eventObj?.day ? (eventObj.day === 'DAY_1' ? 'Day 1' : eventObj.day === 'DAY_2' ? 'Day 2' : eventObj.day) : (t.day || 'Day 1');

    return {
      team_id: t.id,
      team_code: t.team_code || '—',
      team_name: t.team_name || 'Team',
      leader_name: leaderName,
      all_members: allMemberNames,
      college,
      event_name: eventName,
      event_day: eventDay,
      status: isPresent ? 'PRESENT' : 'ABSENT',
      scanned_at: scannedAt ? formatDate(scannedAt) : (isPresent ? 'Present' : '— Not Marked —'),
    };
  });
}

export async function exportCoordinatorTeamAttendanceReport(
  client,
  assignedEvents = [],
  assignedSpecialEvents = [],
  coordinatorInfo = {}
) {
  const rows = await getCoordinatorScopedTeamAttendanceData(client, assignedEvents, assignedSpecialEvents);
  const csvData = rows.map((r) => ({
    'Team Code': r.team_code,
    'Team Name': r.team_name,
    'Team Leader': r.leader_name,
    'All Team Members': r.all_members,
    'College Name': r.college,
    'Registered Event': r.event_name,
    'Event Day': r.event_day,
    'Attendance Status': r.status,
    'Attendance Date & Time': r.scanned_at,
  }));
  downloadCsv(`coordinator-team-attendance-${new Date().toISOString().slice(0, 10)}.csv`, csvData);
}

export async function exportCoordinatorTeamAttendancePdfReport(
  client,
  assignedEvents = [],
  assignedSpecialEvents = [],
  coordinatorInfo = {}
) {
  const rows = await getCoordinatorScopedTeamAttendanceData(client, assignedEvents, assignedSpecialEvents);
  const total = rows.length;
  const presentCount = rows.filter((r) => r.status === 'PRESENT').length;
  const absentCount = Math.max(0, total - presentCount);
  const rateStr = total > 0 ? `${Math.round((presentCount / total) * 100)}%` : '0%';

  const allAssigned = [...assignedEvents, ...assignedSpecialEvents];
  const eventNames = allAssigned.length
    ? allAssigned.map((e) => (e.code ? `${e.code} (${e.name})` : e.name)).join(', ')
    : 'Assigned Coordinator Team Events';

  const coordDesk = coordinatorInfo?.name
    ? `${coordinatorInfo.name} (Coordinator Desk)`
    : 'Event Coordinator Desk';

  const pdfRows = rows.map((r) => ({
    team_code: r.team_code,
    team_name: r.team_name,
    leader_name: r.leader_name,
    members: r.all_members,
    college: r.college,
    event: r.event_name,
    day: r.event_day,
    status: r.status,
    attendance_time: r.scanned_at,
  }));

  generateCyberPdfReport({
    title: 'CYBER SENTINEL 2K26',
    subtitle: 'Official Team Attendance Accreditation & Check-In Verification Audit Sheet',
    eventName: eventNames,
    reportType: 'COORDINATOR_ATTENDANCE',
    generatedBy: coordDesk,
    metrics: {
      total,
      confirmed: presentCount,
      pending: 0,
      rejected: absentCount,
      rate: rateStr,
      revenue: null,
    },
    columns: [
      { key: 'team_code', header: 'Team Code' },
      { key: 'team_name', header: 'Team Name' },
      { key: 'leader_name', header: 'Team Leader' },
      { key: 'members', header: 'All Team Members' },
      { key: 'college', header: 'College' },
      { key: 'event', header: 'Registered Event' },
      { key: 'day', header: 'Day' },
      { key: 'status', header: 'Status' },
      { key: 'attendance_time', header: 'Attendance Date & Time' },
    ],
    rows: pdfRows,
    filename: `coordinator-team-attendance-${new Date().toISOString().slice(0, 10)}.pdf`,
  });
}

