import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://rkmzrgektehctcozagnk.supabase.co';
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrbXpyZ2VrdGVoY3Rjb3phZ25rIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTQzNDkzMSwiZXhwIjoyMTA1MDEwOTMxfQ.Ck6er3J5k7W7oJk-SfxUsFIWN4RPZxE7P8jgvdQI0L0';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const [{ data: teams, error: teamsErr }, { data: serRows }] = await Promise.all([
      supabase.from('team_summary').select('*'),
      supabase
        .from('special_event_registrations')
        .select(
          'id, registration_id, special_event_id, registrations(id, registration_code, status, participants(name, phone, email)), special_events(id, code, name, fee)'
        ),
    ]);

    if (teamsErr) {
      return res.status(500).json({ error: teamsErr.message });
    }

    let formattedTeams = [];
    if (teams && teams.length > 0) {
      const teamIds = teams.map((t) => t.id);
      const [{ data: pkgRows }, { data: members }, { data: etRows }] = await Promise.all([
        supabase
          .from('event_team_packages')
          .select('team_id, event_id, events(id, code, name)')
          .in('team_id', teamIds),
        supabase
          .from('team_members')
          .select(
            'team_id, member_role, registrations(registration_code, participants(name, phone, email))'
          )
          .in('team_id', teamIds),
        supabase.from('event_teams').select('id, event_id').in('id', teamIds),
      ]);

      const etMap = new Map((etRows || []).map((r) => [r.id, r.event_id]));

      formattedTeams = teams.map((t) => {
        const pkgs = (pkgRows || []).filter((p) => p.team_id === t.id);
        const mems = (members || []).filter((m) => m.team_id === t.id);
        const leaderMem = mems.find((m) => m.member_role === 'LEADER') || mems[0];

        return {
          ...t,
          event_id: t.event_id || etMap.get(t.id),
          team_leader_registration_code:
            t.team_leader_registration_code || leaderMem?.registrations?.registration_code || null,
          team_leader_name: leaderMem?.registrations?.participants?.name || null,
          package_events: pkgs.map((p) => p.events).filter(Boolean),
          package_event_ids: pkgs.map((p) => p.event_id).filter(Boolean),
          package_event_codes: pkgs.map((p) => (p.events?.code || '').toUpperCase()),
          package_event_names: pkgs.map((p) => (p.events?.name || '').toLowerCase()),
          team_members: mems.map((m) => ({
            role: m.member_role,
            cs_id: m.registrations?.registration_code,
            name: m.registrations?.participants?.name || 'Participant',
            phone: m.registrations?.participants?.phone || '',
            email: m.registrations?.participants?.email || '',
          })),
        };
      });
    }

    const specialTeams = (serRows || [])
      .filter((r) => r.special_events && ['EP', 'GD'].includes(r.special_events.code))
      .map((r) => {
        const reg = r.registrations || {};
        const part = reg.participants || {};
        const isFF = r.special_events.code === 'EP';
        const teamCode = reg.registration_code || `SPEC-${r.id.slice(0, 8).toUpperCase()}`;
        const teamName = part.name
          ? isFF
            ? `${part.name}'s Squad`
            : `${part.name}'s Crew`
          : `${r.special_events.name} Team`;

        return {
          id: r.id,
          team_code: teamCode,
          team_name: teamName,
          event_id: r.special_events.id,
          event_code: r.special_events.code,
          event_name: r.special_events.name,
          day: 'SPECIAL',
          team_leader_registration_code: reg.registration_code || null,
          team_leader_name: part.name || 'Team Leader',
          max_members: isFF ? 4 : 10,
          current_members: 1,
          status: reg.status || 'OPEN',
          package_events: [r.special_events],
          package_event_ids: [r.special_events.id],
          package_event_codes: [r.special_events.code],
          package_event_names: [(r.special_events.name || '').toLowerCase()],
          team_members: [
            {
              role: 'LEADER',
              cs_id: reg.registration_code,
              name: part.name || 'Team Leader',
              phone: part.phone || '',
              email: part.email || '',
            },
          ],
        };
      });

    return res.status(200).json({ teams: [...formattedTeams, ...specialTeams] });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
