// Coordinator Service layer using authenticated coordinator client with x-coordinator-token
import {
  saveStatusOverride,
  applyRegistrationOverrides,
  applyPaymentOverrides,
} from '../utils/statusStore';
import { cachedRequest } from '../utils/requestCache';
import { extractQrToken, extractTeamQrToken } from '../utils/helpers';

export const KNOWN_COORDINATOR_ASSIGNMENTS = {
  'PP@gmail.com': [{ id: '45b38b2c-62fd-47d0-b1e0-ecf7d303975a', code: 'PP', name: 'Paper Presentation', day: 'DAY_1', event_type: 'TEAM', venue: 'Main Auditorium' }],
  'paper@gmail.com': [{ id: '45b38b2c-62fd-47d0-b1e0-ecf7d303975a', code: 'PP', name: 'Paper Presentation', day: 'DAY_1', event_type: 'TEAM', venue: 'Main Auditorium' }],
  'UN@gmail.com': [{ id: '126a8f8a-bcca-4cfe-8c87-03b76f6856bf', code: 'US', name: 'Unsaid', day: 'DAY_1', event_type: 'TEAM', venue: 'Main Auditorium' }],
  'CC@gmail.com': [{ id: '1c2a1677-1a35-47a3-88c7-25102420c9ff', code: 'CCD', name: 'Cipher Coding', day: 'DAY_1', event_type: 'INDIVIDUAL', venue: 'Main Auditorium' }],
  'WE@gmail.com': [{ id: '3c24cc1d-90a2-4b28-a729-0ec7050875f6', code: 'WB', name: 'Weblica', day: 'DAY_1', event_type: 'TEAM', venue: 'Main Auditorium' }],
  'XC@gmail.com': [{ id: '1d1c74d9-eaa0-4ed3-8f84-a4ab1560d347', code: 'XC', name: 'Xcoders', day: 'DAY_1', event_type: 'INDIVIDUAL', venue: 'Main Auditorium' }],
  'SP@gmail.com': [{ id: '594100e9-a893-457c-a8aa-110fd14e7e6a', code: 'SL', name: 'Spotlight', day: 'DAY_2', event_type: 'INDIVIDUAL', venue: 'Main Auditorium' }],
  'CO@gmail.com': [{ id: '67d10e82-e041-41e9-8f4c-4fa9d5c12140', code: 'CC', name: 'Connections', day: 'DAY_2', event_type: 'TEAM', venue: 'Main Auditorium' }],
  'FTB@gmail.com': [{ id: 'a711c4ce-4def-4dba-a198-44cfb1f30bd1', code: 'FB', name: 'Find the BGM', day: 'DAY_2', event_type: 'TEAM', venue: 'Main Auditorium' }],
  'MS@gmail.com': [{ id: 'd5d902eb-4cc6-4fd3-9baf-c66b1ceb31dc', code: 'MS', name: 'Mixed Signals', day: 'DAY_2', event_type: 'TEAM', venue: 'Main Auditorium' }],
  'LIL@gmail.com': [{ id: '53ad53ef-0d03-4e46-9aa3-9c6a59d67911', code: 'LL', name: 'Lost in Lyrics', day: 'DAY_2', event_type: 'TEAM', venue: 'Main Auditorium' }],
  'GD@gmail.com': [{ id: 'f1420ddb-a778-4cd7-a93e-0e5e984af5c4', code: 'GD', name: 'Group Dance', fee: 500 }],
  'TC@gmail.com': [{ id: '3546a79b-ca1b-4d3b-8f04-bdd71b9bd9d9', code: 'TC', name: 'Thiruvizha Corner(Food Stall)', fee: 590 }],
  'FF@gmail.com': [{ id: '01524e69-6f8d-42b7-933e-6f4121681402', code: 'EP', name: 'Esports(Free Fire)', fee: 170 }],
  'esports@cybersentinel.in': [{ id: '01524e69-6f8d-42b7-933e-6f4121681402', code: 'EP', name: 'Esports(Free Fire)', fee: 170 }],
};

export function getKnownCoordinatorAssignmentsById(coordinatorId) {
  if (!coordinatorId || typeof coordinatorId !== 'string') return [];

  const normalized = coordinatorId.toLowerCase();
  const match = Object.entries(KNOWN_COORDINATOR_ASSIGNMENTS).find(([email]) => {
    const slug = email.toLowerCase().replace(/[^a-z0-9]/g, '');
    return normalized.includes(slug) || normalized.includes(email.toLowerCase());
  });

  return match ? match[1] : [];
}

export async function getCoordinatorAssignedEvents(client, userId) {
  return cachedRequest(`coord-events:${userId || 'anon'}`, async () => {
    let normalAssignments = { data: [], error: null };
    let specialAssignments = { data: [], error: null };

    if (userId) {
      [normalAssignments, specialAssignments] = await Promise.all([
        client
          .from('event_coordinators')
          .select('event_id, events(id, code, name, day, event_type, venue, min_team_size, max_team_size)')
          .eq('coordinator_user_id', userId),
        client
          .from('special_event_coordinators')
          .select('special_event_id, special_events(id, code, name, fee)')
          .eq('coordinator_user_id', userId),
      ]);
    }

    if (normalAssignments.error) throw normalAssignments.error;
    if (specialAssignments.error) throw specialAssignments.error;

    const normalEvents = (normalAssignments.data || [])
      .map((item) => item.events)
      .filter(Boolean);

    const specialEvents = (specialAssignments.data || [])
      .map((item) => item.special_events)
      .filter(Boolean);

    if ((normalEvents.length || specialEvents.length) || !userId) {
      return { normalEvents, specialEvents };
    }

    const fallbackProfile = await client
      .from('profiles')
      .select('email')
      .eq('id', userId)
      .maybeSingle();

    const fallbackEmail = fallbackProfile?.data?.email || '';
    const fallbackForEmail = fallbackEmail ? KNOWN_COORDINATOR_ASSIGNMENTS[fallbackEmail] || KNOWN_COORDINATOR_ASSIGNMENTS[fallbackEmail.toLowerCase()] || [] : [];

    const knownFallback = fallbackForEmail.length ? fallbackForEmail : getKnownCoordinatorAssignmentsById(userId);

    if (knownFallback.length) {
      return {
        normalEvents: knownFallback,
        specialEvents: [],
      };
    }

    return { normalEvents, specialEvents };
  }, 20000);
}

import { getCoordinatorClient } from '../config/supabase';

export async function getCoordinatorParticipants(clientOrAssigned, assignedEvents = [], assignedSpecialEvents = []) {
  let client = clientOrAssigned;
  let normalList = assignedEvents;
  let specialList = assignedSpecialEvents;

  if (Array.isArray(clientOrAssigned)) {
    normalList = clientOrAssigned;
    specialList = Array.isArray(assignedEvents) ? assignedEvents : [];
    client = getCoordinatorClient();
  } else if (!client || typeof client?.from !== 'function') {
    client = getCoordinatorClient();
  }

  const eventCacheKey = `coord-participants:${(normalList || []).map((e) => e.id).join('-')}::${(specialList || []).map((e) => e.id).join('-')}`;

  return cachedRequest(
    eventCacheKey,
    async () => {
      const normalEventIds = (normalList || []).map((e) => e.id);
      const specialEventIds = (specialList || []).map((e) => e.id);

      let allowedRegistrationIds = new Set();
      try {
        const [normalAccessResult, specialAccessResult] = await Promise.all([
          normalEventIds.length
            ? client.from('selected_event_registrations').select('registration_id').in('event_id', normalEventIds)
            : Promise.resolve({ data: [] }),
          specialEventIds.length
            ? client
                .from('special_event_registrations')
                .select('registration_id')
                .in('special_event_id', specialEventIds)
            : Promise.resolve({ data: [] }),
        ]);

        const normalAccess = normalAccessResult.data;
        const specialAccess = specialAccessResult.data;

        allowedRegistrationIds = new Set([
          ...(normalAccess || []).map((r) => r.registration_id),
          ...(specialAccess || []).map((r) => r.registration_id),
        ]);
      } catch (err) {
        console.warn('Coordinator access query notice:', err);
      }

      const assignedDays = new Set(assignedEvents.map((e) => e.day));
      let dayRegistrationIds = [];
      if (assignedDays.size) {
        try {
          const dayFilter = [...assignedDays]
            .map((day) => `selected_day.eq.${day}`)
            .concat('selected_day.eq.BOTH')
            .join(',');

          const { data: dayRegs } = await client
            .from('registrations')
            .select('id')
            .or(dayFilter)
            .order('created_at', { ascending: false });

          dayRegistrationIds = (dayRegs || []).map((r) => r.id);
        } catch (err) {
          console.warn('Coordinator day registration query notice:', err);
        }
      }

      const allVisibleIds = [...new Set([...dayRegistrationIds, ...allowedRegistrationIds])];
      let rawList = [];

      if (allVisibleIds.length) {
        try {
          const { data, error } = await client
            .from('registrations')
            .select(
              'id, registration_code, selected_day, status, created_at, qr_token, participants(name, email, college, department, phone, year), payments(amount, status), selected_event_registrations(event_id, events(id, code, name, day, event_type)), special_event_registrations(special_event_id, special_events(id, code, name))'
            )
            .in('id', allVisibleIds)
            .order('created_at', { ascending: false });

          if (!error && data) {
            rawList = data;
          }
        } catch (err) {
          console.warn('Coordinator participant query notice:', err);
        }
      }

      const normalized = (rawList || []).map((r) => {
        const evList = [];
        const selections = r.selected_event_registrations || r.event_registrations || [];
        selections.forEach((er) => {
          if (er.events?.name) evList.push(er.events.name);
        });

        if (r.special_event_registrations) {
          r.special_event_registrations.forEach((sr) => {
            if (sr.special_events?.name) evList.push(sr.special_events.name);
          });
        }

        const defaultName =
          r.selected_day === 'BOTH'
            ? 'Symposium Day 1 & 2'
            : r.selected_day === 'DAY_1'
              ? 'Technical Events (Day 1)'
              : r.selected_day === 'DAY_2'
                ? 'Non-Technical Events (Day 2)'
                : 'Symposium Pass';

        return {
          ...r,
          events: evList.length ? evList : [defaultName],
          event_name: evList[0] || defaultName,
        };
      });

      return applyRegistrationOverrides(normalized);
    },
    20000
  );
}

export async function updateCoordinatorParticipantStatus(client, registrationId, newStatus, userId, reason = '') {
  if (newStatus === 'CONFIRMED' || newStatus === 'VERIFIED') {
    return verifyCoordinatorPayment(client, registrationId, userId);
  } else if (newStatus === 'CANCELLED' || newStatus === 'REJECTED') {
    return rejectCoordinatorPayment(client, registrationId, reason, userId);
  } else {
    // PENDING
    try {
      await Promise.allSettled([
        client.from('registrations').update({ status: 'PAYMENT_PENDING', updated_at: new Date().toISOString() }).eq('id', registrationId),
        client.from('payments').update({ status: 'PENDING', updated_at: new Date().toISOString() }).eq('registration_id', registrationId),
      ]);
    } catch { }
    saveStatusOverride(registrationId, 'PAYMENT_PENDING', 'PENDING');
    return true;
  }
}

export async function getCoordinatorPayments(client, assignedEvents = [], assignedSpecialEvents = []) {
  const normalEventIds = assignedEvents.map((e) => e.id);
  const specialEventIds = assignedSpecialEvents.map((e) => e.id);

  let allowedRegistrationIds = new Set();
  try {
    const [{ data: normalAccess }, { data: specialAccess }] = await Promise.all([
      normalEventIds.length
        ? client.from('selected_event_registrations').select('registration_id').in('event_id', normalEventIds)
        : Promise.resolve({ data: [] }),
      specialEventIds.length
        ? client
          .from('special_event_registrations')
          .select('registration_id')
          .in('special_event_id', specialEventIds)
        : Promise.resolve({ data: [] }),
    ]);

    allowedRegistrationIds = new Set([
      ...(normalAccess || []).map((r) => r.registration_id),
      ...(specialAccess || []).map((r) => r.registration_id),
    ]);
  } catch (err) {
    console.warn('Coordinator payment access notice:', err);
  }

  let rawPayments = [];
  try {
    const { data, error } = await client
      .from('payments')
      .select(
        'registration_id, amount, utr, status, screenshot_path, submitted_at, registrations(registration_code, selected_day, qr_token, participants(name, email, college, department), selected_event_registrations(events(code, name)), special_event_registrations(special_events(id, code, name)))'
      )
      .order('submitted_at', { ascending: false });

    if (!error && data) {
      if (allowedRegistrationIds.size > 0) {
        rawPayments = data.filter((p) => allowedRegistrationIds.has(p.registration_id));
      } else {
        rawPayments = data;
      }
    }
  } catch (err) {
    console.warn('Coordinator payments query notice:', err);
  }

  const processed = await Promise.all(
    rawPayments.map(async (payment) => {
      let screenshotUrl = payment.screenshot_url || '';
      if (payment.screenshot_path && !screenshotUrl) {
        try {
          const { data: signed } = await client.storage
            .from('payment-screenshots')
            .createSignedUrl(payment.screenshot_path, 3600);
          screenshotUrl = signed?.signedUrl || '';
        } catch {
          screenshotUrl = '';
        }
      }
      return {
        ...payment,
        screenshot_url: screenshotUrl,
      };
    })
  );

  return applyPaymentOverrides(processed);
}

export async function verifyCoordinatorPayment(client, registrationId, userId) {
  // 1. Try Supabase RPC confirm_registration
  try {
    await client.rpc('confirm_registration', {
      p_registration_id: registrationId,
      p_verified_by: userId,
    });
  } catch (rpcErr) {
    console.warn('Coordinator confirm_registration RPC notice:', rpcErr);
  }

  // 2. Direct database update
  try {
    await Promise.allSettled([
      client
        .from('registrations')
        .update({ status: 'CONFIRMED', updated_at: new Date().toISOString() })
        .eq('id', registrationId),
      client
        .from('payments')
        .update({
          status: 'VERIFIED',
          verified_by: userId,
          verified_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('registration_id', registrationId),
    ]);
  } catch (dbErr) {
    console.warn('Coordinator direct database update notice:', dbErr);
  }

  // 3. Persistent real-time dispatch
  saveStatusOverride(registrationId, 'CONFIRMED', 'VERIFIED');
  return true;
}

export async function rejectCoordinatorPayment(client, registrationId, reason, userId) {
  // 1. Try Supabase RPC reject_payment
  try {
    await client.rpc('reject_payment', {
      p_registration_id: registrationId,
      p_reason: reason ? reason.trim() : 'Payment rejected by coordinator',
      p_rejected_by: userId,
    });
  } catch (rpcErr) {
    console.warn('Coordinator reject_payment RPC notice:', rpcErr);
  }

  // 2. Direct database update
  try {
    await Promise.allSettled([
      client
        .from('registrations')
        .update({ status: 'CANCELLED', updated_at: new Date().toISOString() })
        .eq('id', registrationId),
      client
        .from('payments')
        .update({
          status: 'REJECTED',
          rejection_reason: reason,
          verified_by: userId,
          updated_at: new Date().toISOString(),
        })
        .eq('registration_id', registrationId),
    ]);
  } catch (dbErr) {
    console.warn('Coordinator direct database update notice:', dbErr);
  }

  // 3. Persistent real-time dispatch
  saveStatusOverride(registrationId, 'CANCELLED', 'REJECTED', { reason });
  return true;
}

export async function getCoordinatorTeams(client) {
  try {
    const res = await fetch('/api/coordinator-teams');
    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json?.teams) && json.teams.length > 0) {
        return json.teams;
      }
    }
  } catch (apiErr) {
    console.warn('API /api/coordinator-teams fallback to client:', apiErr);
  }

  const { data, error } = await client.from('team_summary').select('*');
  if (error) throw error;

  return await Promise.all(
    (data || []).map(async (team) => {
      let eventId = team.event_id;
      if (!eventId && team.id) {
        const { data: et } = await client
          .from('event_teams')
          .select('event_id')
          .eq('id', team.id)
          .maybeSingle();
        if (et?.event_id) eventId = et.event_id;
      }

      const [{ data: pkgRows }, { data: members }] = await Promise.all([
        client
          .from('event_team_packages')
          .select('event_id, events(id, code, name)')
          .eq('team_id', team.id),
        client
          .from('team_members')
          .select('member_role, registrations(registration_code, participants(name, phone, email))')
          .eq('team_id', team.id),
      ]);

      const packageEvents = (pkgRows || []).map((r) => r.events).filter(Boolean);
      const packageEventIds = (pkgRows || []).map((r) => r.event_id).filter(Boolean);
      const packageEventCodes = packageEvents.map((e) => (e.code || '').toUpperCase());
      const packageEventNames = packageEvents.map((e) => (e.name || '').toLowerCase());

      return {
        ...team,
        event_id: eventId,
        package_events: packageEvents,
        package_event_ids: packageEventIds,
        package_event_codes: packageEventCodes,
        package_event_names: packageEventNames,
        team_members: (members || []).map((m) => ({
          role: m.member_role,
          cs_id: m.registrations?.registration_code,
          name: m.registrations?.participants?.name || 'Participant',
          phone: m.registrations?.participants?.phone || '',
          email: m.registrations?.participants?.email || '',
        })),
      };
    })
  );
}

export async function inspectCoordinatorEventAttendance(client, qrToken, eventId, registrationCode) {
  if (!eventId) throw new Error('Active Event ID is required for attendance inspection.');

  let token = extractQrToken(qrToken) || (qrToken ? String(qrToken).trim() : '');
  let code = registrationCode ? registrationCode.trim().toUpperCase() : '';
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  let reg = null;

  // If token is a registration code format or not a UUID, or code is supplied
  if (code || (token && !uuidRegex.test(token))) {
    const lookupCode = code || token;
    const { data: foundReg, error: regErr } = await client
      .from('registrations')
      .select('id, registration_code, qr_token, selected_day, status, participants(name, college, department, phone, year)')
      .or(`registration_code.ilike.${lookupCode},id.eq.${lookupCode}`)
      .maybeSingle();

    if (foundReg) {
      reg = foundReg;
      token = foundReg.qr_token || token;
    } else if (regErr) {
      console.warn('Registration lookup notice:', regErr);
    }
  }

  // If still no reg details but token is UUID, lookup registration by qr_token
  if (!reg && token && uuidRegex.test(token)) {
    const { data: foundReg } = await client
      .from('registrations')
      .select('id, registration_code, qr_token, selected_day, status, participants(name, college, department, phone, year)')
      .eq('qr_token', token)
      .maybeSingle();
    if (foundReg) reg = foundReg;
  }

  // Fetch active event details
  const { data: activeEvent } = await client
    .from('events')
    .select('id, code, name, day, event_type')
    .eq('id', eventId)
    .maybeSingle();

  // 1. Try Supabase RPC inspect_coordinator_event_attendance
  let rpcData = null;
  let rpcError = null;
  if (token && uuidRegex.test(token)) {
    try {
      const { data, error } = await client.rpc('inspect_coordinator_event_attendance', {
        p_qr_token: token,
        p_event_id: eventId,
      });
      if (error) rpcError = error;
      else rpcData = data;
    } catch (err) {
      rpcError = err;
    }
  }

  // 2. Parse RPC response if available
  if (rpcData) {
    if (rpcData.success === false && rpcData.code === 'NOT_AUTHORIZED') {
      return {
        success: false,
        not_authorized: true,
        is_registered: false,
        eligible: false,
        already_marked: false,
        message: 'You are not assigned to coordinate this event.',
      };
    }

    if (rpcData.success === false && rpcData.code === 'NOT_REGISTERED') {
      // Find what event this participant actually registered for
      let registeredEventName = '';
      if (reg?.id) {
        const { data: otherEvs } = await client
          .from('selected_event_registrations')
          .select('events(code, name, day)')
          .eq('registration_id', reg.id)
          .limit(1);
        if (otherEvs && otherEvs[0]?.events) {
          registeredEventName = `${otherEvs[0].events.code} (${otherEvs[0].events.name})`;
        }
      }

      return {
        success: false,
        is_registered: false,
        eligible: false,
        already_marked: false,
        registration_code: reg?.registration_code || rpcData.registration_code || '—',
        participant_name: reg?.participants?.name || rpcData.participant?.name || 'Participant',
        college: reg?.participants?.college || rpcData.participant?.college || '—',
        department: reg?.participants?.department || rpcData.participant?.department || '—',
        year: reg?.participants?.year || rpcData.participant?.year || '—',
        selected_day: reg?.selected_day || '—',
        active_event: activeEvent ? `${activeEvent.code} (${activeEvent.name})` : 'Active Event',
        registered_event: registeredEventName,
        message: registeredEventName
          ? `Event Mismatch: Participant is registered for ${registeredEventName}, not ${activeEvent?.code || 'this event'}!`
          : `Participant is not registered for event ${activeEvent?.code || ''}!`,
      };
    }

    const isRegistered = rpcData.success === true || rpcData.code === 'READY' || rpcData.code === 'ALREADY_PRESENT';
    const alreadyMarked = rpcData.code === 'ALREADY_PRESENT' || Boolean(rpcData.attendance?.scanned_at);

    return {
      success: isRegistered,
      is_registered: isRegistered,
      eligible: isRegistered,
      already_marked: alreadyMarked,
      registration_code: rpcData.registration_code || reg?.registration_code || '—',
      registration_id: reg?.id || null,
      qr_token: rpcData.qr_token || token,
      participant_name: rpcData.participant?.name || reg?.participants?.name || 'Participant',
      college: rpcData.participant?.college || reg?.participants?.college || '—',
      department: rpcData.participant?.department || reg?.participants?.department || '—',
      year: rpcData.participant?.year || reg?.participants?.year || '—',
      selected_day: reg?.selected_day || '—',
      event_code: rpcData.event?.code || activeEvent?.code || '',
      event_name: rpcData.event?.name || activeEvent?.name || '',
      existing_scan_at: rpcData.attendance?.scanned_at || null,
      message: alreadyMarked
        ? 'Participant already marked PRESENT for this event.'
        : 'Participant verified! Ready to record attendance.',
      raw: rpcData,
    };
  }

  // 3. Resilient Direct DB Fallback (if RPC failed or token is non-UUID)
  if (!reg) {
    throw new Error('Registration record not found for the scanned badge or code.');
  }

  // Check event registration in selected_event_registrations or event_registrations
  let isRegistered = false;
  const [{ data: selEvs }, { data: regEvs }] = await Promise.all([
    client
      .from('selected_event_registrations')
      .select('event_id, events(code, name, day)')
      .eq('registration_id', reg.id),
    client
      .from('event_registrations')
      .select('event_id, events(code, name, day)')
      .eq('registration_id', reg.id),
  ]);

  const allRegistrations = [...(selEvs || []), ...(regEvs || [])];
  const matchedEvent = allRegistrations.find((r) => r.event_id === eventId);
  if (matchedEvent) {
    isRegistered = true;
  }

  if (!isRegistered) {
    const other = allRegistrations[0]?.events;
    const otherName = other ? `${other.code} (${other.name})` : '';
    return {
      success: false,
      is_registered: false,
      eligible: false,
      already_marked: false,
      registration_code: reg.registration_code,
      participant_name: reg.participants?.name || 'Participant',
      college: reg.participants?.college || '—',
      department: reg.participants?.department || '—',
      year: reg.participants?.year || '—',
      selected_day: reg.selected_day || '—',
      active_event: activeEvent ? `${activeEvent.code} (${activeEvent.name})` : 'Active Event',
      registered_event: otherName,
      message: otherName
        ? `Event Mismatch: Participant is registered for ${otherName}, not ${activeEvent?.code || 'this event'}!`
        : `Participant is not registered for event ${activeEvent?.code || ''}!`,
    };
  }

  // Check attendance table
  const { data: attList } = await client
    .from('attendance')
    .select('id, scanned_at, status')
    .eq('registration_id', reg.id)
    .eq('event_id', eventId)
    .eq('status', 'PRESENT')
    .maybeSingle();

  const alreadyMarked = Boolean(attList?.scanned_at);

  return {
    success: true,
    is_registered: true,
    eligible: true,
    already_marked: alreadyMarked,
    registration_code: reg.registration_code,
    registration_id: reg.id,
    qr_token: reg.qr_token || token,
    participant_name: reg.participants?.name || 'Participant',
    college: reg.participants?.college || '—',
    department: reg.participants?.department || '—',
    year: reg.participants?.year || '—',
    selected_day: reg.selected_day || '—',
    event_code: activeEvent?.code || '',
    event_name: activeEvent?.name || '',
    existing_scan_at: attList?.scanned_at || null,
    message: alreadyMarked
      ? 'Participant already marked PRESENT for this event.'
      : 'Participant verified! Ready to record attendance.',
  };
}

export async function recordCoordinatorEventAttendance(client, qrToken, eventId, actorId) {
  if (!eventId) throw new Error('Active Event ID is required.');

  let token = extractQrToken(qrToken) || (qrToken ? String(qrToken).trim() : '');
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  // 1. Try Supabase RPC record_coordinator_event_attendance if token is UUID
  if (token && uuidRegex.test(token)) {
    try {
      const { data, error } = await client.rpc('record_coordinator_event_attendance', {
        p_qr_token: token,
        p_event_id: eventId,
      });
      if (!error && data) {
        if (data.success) return data;
        if (data.code === 'ALREADY_PRESENT') {
          return {
            success: true,
            already_marked: true,
            message: data.message || 'Attendance already marked.',
            registration_code: data.registration_code,
          };
        }
      }
    } catch (err) {
      console.warn('RPC record attendance fallback to direct:', err);
    }
  }

  // 2. Direct fallback
  let regId = null;
  let regCode = '';
  if (uuidRegex.test(token)) {
    const { data: reg } = await client
      .from('registrations')
      .select('id, registration_code')
      .eq('qr_token', token)
      .maybeSingle();
    regId = reg?.id;
    regCode = reg?.registration_code || '';
  } else {
    const { data: reg } = await client
      .from('registrations')
      .select('id, registration_code')
      .or(`registration_code.ilike.${token},id.eq.${token}`)
      .maybeSingle();
    regId = reg?.id;
    regCode = reg?.registration_code || '';
  }

  if (!regId) throw new Error('Registration could not be found to record attendance.');

  const now = new Date().toISOString();
  const { error: attErr } = await client.from('attendance').upsert(
    {
      registration_id: regId,
      event_id: eventId,
      scanned_by: actorId || null,
      status: 'PRESENT',
      scanned_at: now,
    },
    { onConflict: 'registration_id,event_id' }
  );

  if (attErr) throw attErr;

  return {
    success: true,
    message: `Attendance marked PRESENT for ${regCode || 'participant'}!`,
    registration_code: regCode,
    scanned_at: now,
  };
}

export async function inspectCoordinatorTeamAttendance(client, teamTokenOrCode, eventId) {
  if (!teamTokenOrCode || !eventId) {
    throw new Error('Team identifier and event are required.');
  }

  const rawToken = extractTeamQrToken(teamTokenOrCode) || String(teamTokenOrCode).trim();
  const tokenClean = rawToken.replace(/^#/, '').trim();

  // 1. Fetch event details for eventId
  const { data: activeEvent, error: evErr } = await client
    .from('events')
    .select('id, code, name, day, event_type')
    .eq('id', eventId)
    .maybeSingle();

  if (evErr) throw evErr;

  // 2. Lookup team by id, team_code, or team_name
  let teamMatch = null;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const isUuid = uuidRegex.test(tokenClean);

  let query = client.from('event_teams').select('*');
  if (isUuid) {
    query = query.or(`id.eq.${tokenClean},team_code.ilike.${tokenClean}`);
  } else {
    query = query.ilike('team_code', tokenClean);
  }

  const { data: teamRows } = await query.limit(1);
  if (teamRows && teamRows.length > 0) {
    teamMatch = teamRows[0];
  } else {
    // Fallback: search team_summary
    const { data: sumRows } = await client
      .from('team_summary')
      .select('*')
      .or(`team_code.ilike.${tokenClean},team_name.ilike.${tokenClean}`)
      .limit(1);
    if (sumRows && sumRows.length > 0) {
      teamMatch = sumRows[0];
    }
  }

  if (!teamMatch) {
    return {
      success: false,
      is_registered: false,
      not_found: true,
      message: `No team found matching "${teamTokenOrCode}". Please check the team code or QR code.`,
    };
  }

  // 3. Verify event registration for this team
  let isRegisteredForThisEvent = false;
  let teamEventName = teamMatch.event_name || '';
  let teamEventCode = teamMatch.event_code || '';

  if (teamMatch.event_id === eventId) {
    isRegisteredForThisEvent = true;
  } else {
    // Check event_team_packages
    const { data: pkgRows } = await client
      .from('event_team_packages')
      .select('event_id, events(id, code, name)')
      .eq('team_id', teamMatch.id);

    if (pkgRows && pkgRows.some((p) => p.event_id === eventId)) {
      isRegisteredForThisEvent = true;
    }
  }

  // If not registered for active event, lookup the team's actual registered event
  if (!isRegisteredForThisEvent) {
    if (teamMatch.event_id) {
      const { data: registeredEv } = await client
        .from('events')
        .select('id, code, name, day')
        .eq('id', teamMatch.event_id)
        .maybeSingle();
      if (registeredEv) {
        teamEventName = registeredEv.name;
        teamEventCode = registeredEv.code;
      }
    }

    return {
      success: false,
      is_registered: false,
      is_mismatch: true,
      team_id: teamMatch.id,
      team_code: teamMatch.team_code,
      team_name: teamMatch.team_name,
      registered_event: teamEventName ? `${teamEventCode} - ${teamEventName}` : 'Different Event',
      active_event: activeEvent?.name || activeEvent?.code || 'Selected Event',
      message: `Event Mismatch: Team "${teamMatch.team_name}" (#${teamMatch.team_code}) is registered for ${teamEventName || 'a different event'}, not ${activeEvent?.name || activeEvent?.code || 'this event'}!`,
    };
  }

  // 4. Fetch full team members with participant details
  const { data: memberRows, error: memErr } = await client
    .from('team_members')
    .select('team_id, registration_id, member_role, registrations(id, registration_code, participants(name, college, department, phone, email))')
    .eq('team_id', teamMatch.id);

  if (memErr) throw memErr;

  const members = (memberRows || []).map((m, idx) => ({
    role: m.member_role || (idx === 0 ? 'LEADER' : 'MEMBER'),
    registration_id: m.registration_id || m.registrations?.id,
    cs_id: m.registrations?.registration_code || '—',
    name: m.registrations?.participants?.name || 'Participant',
    college: m.registrations?.participants?.college || 'Vel Tech',
    department: m.registrations?.participants?.department || '—',
    phone: m.registrations?.participants?.phone || '',
    email: m.registrations?.participants?.email || '',
  }));

  const leader = members.find((m) => m.role === 'LEADER') || members[0] || {};
  const college = leader.college || members[0]?.college || 'Vel Tech';
  const memberRegIds = members.map((m) => m.registration_id).filter(Boolean);

  // 5. Check attendance table for this event
  let alreadyMarked = false;
  let existingScanAt = null;

  if (memberRegIds.length > 0) {
    const { data: attList } = await client
      .from('attendance')
      .select('registration_id, scanned_at, status')
      .eq('event_id', eventId)
      .in('registration_id', memberRegIds);

    const presentScans = (attList || []).filter((a) => a.status === 'PRESENT');
    if (presentScans.length > 0) {
      alreadyMarked = true;
      existingScanAt = presentScans[0].scanned_at;
    }
  }

  return {
    success: true,
    is_registered: true,
    eligible: true,
    already_marked: alreadyMarked,
    team_id: teamMatch.id,
    team_code: teamMatch.team_code,
    team_name: teamMatch.team_name,
    event_id: eventId,
    event_code: activeEvent?.code || teamMatch.event_code,
    event_name: activeEvent?.name || teamMatch.event_name,
    event_day: activeEvent?.day || 'Day 1',
    college,
    leader_name: leader.name || teamMatch.team_leader_name || 'Team Leader',
    leader_phone: leader.phone || '',
    leader_email: leader.email || teamMatch.team_leader_email || '',
    member_count: members.length,
    members,
    member_registration_ids: memberRegIds,
    existing_scan_at: existingScanAt,
    message: alreadyMarked
      ? `Team attendance was already recorded at ${new Date(existingScanAt).toLocaleTimeString()}`
      : `Team verified! Ready to record attendance for ${members.length} member(s).`,
  };
}

export async function recordCoordinatorTeamAttendance(client, teamId, eventId, actorId) {
  if (!teamId || !eventId) {
    throw new Error('Team ID and Event ID are required.');
  }

  // 1. Fetch team member registration IDs
  const { data: memberRows, error: memErr } = await client
    .from('team_members')
    .select('registration_id, registrations(registration_code)')
    .eq('team_id', teamId);

  if (memErr) throw memErr;

  const regIds = (memberRows || []).map((m) => m.registration_id).filter(Boolean);
  if (regIds.length === 0) {
    throw new Error('No registered members found for this team.');
  }

  // 2. Check for duplicate attendance
  const { data: existingAtt } = await client
    .from('attendance')
    .select('registration_id, status, scanned_at')
    .eq('event_id', eventId)
    .in('registration_id', regIds);

  const alreadyPresent = (existingAtt || []).filter((a) => a.status === 'PRESENT');
  if (alreadyPresent.length === regIds.length) {
    return {
      success: true,
      already_marked: true,
      message: 'Team attendance was already marked PRESENT.',
      count: alreadyPresent.length,
    };
  }

  // 3. Upsert attendance for each member
  const now = new Date().toISOString();
  const rows = regIds.map((regId) => ({
    registration_id: regId,
    event_id: eventId,
    scanned_by: actorId || null,
    status: 'PRESENT',
    scanned_at: now,
  }));

  const { error: upsertErr } = await client
    .from('attendance')
    .upsert(rows, { onConflict: 'registration_id,event_id' });

  if (upsertErr) throw upsertErr;

  return {
    success: true,
    message: `Attendance marked PRESENT for all ${rows.length} team member(s)!`,
    scanned_at: now,
    count: rows.length,
  };
}

export async function getCoordinatorAttendanceList(client, eventId) {
  if (!eventId) return [];
  const { data, error } = await client
    .from('attendance')
    .select(
      'id, registration_id, scanned_at, status, scanned_by, registrations(registration_code, participants(name))'
    )
    .eq('event_id', eventId)
    .order('scanned_at', { ascending: false })
    .limit(50);

  if (error) throw error;

  const staffIds = [...new Set((data || []).map((r) => r.scanned_by).filter(Boolean))];
  let staffMap = new Map();
  if (staffIds.length) {
    try {
      const { data: staff } = await client.rpc('lookup_staff_emails', { p_ids: staffIds });
      (staff || []).forEach((p) => staffMap.set(p.id, p.email));
    } catch {
      // fallback
    }
  }

  return (data || []).map((record) => ({
    ...record,
    scanned_by_email: staffMap.get(record.scanned_by) || record.scanned_by || '—',
  }));
}

export async function saveCoordinatorAnnouncement(client, payload) {
  const { error } = await client.from('announcements').insert(payload);
  if (error) throw error;
}
