import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  getCoordinatorAssignedEvents,
  getCoordinatorTeams,
} from '../../services/coordinatorService';
import StatusBadge from '../../components/ui/StatusBadge';
import DetailsModal from '../../components/common/DetailsModal';
import { buildTeamConfirmationGmailLink } from '../../utils/helpers';
import {
  generateTeamQrDataUrl,
  generateAndDownloadTeamQrBadge,
} from '../../utils/qrBadge';
import {
  Users,
  Search,
  Filter,
  RefreshCw,
  Eye,
  Crown,
  Layers,
  ShieldCheck,
  Phone,
  Mail,
  User,
  QrCode,
  Download,
  Camera,
  ExternalLink,
  CheckCircle2,
} from 'lucide-react';

export default function CoordinatorTeams() {
  const { user, coordinatorProfile, getCoordinatorClientInstance } = useAuth();
  const { addToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [teams, setTeams] = useState([]);
  const [assignedEvents, setAssignedEvents] = useState([]);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [eventFilter, setEventFilter] = useState('ALL');
  const [selectedTeam, setSelectedTeam] = useState(null);

  // Team QR Preview Modal State
  const [qrModalTeam, setQrModalTeam] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [downloadingBadge, setDownloadingBadge] = useState(false);

  const client = getCoordinatorClientInstance();

  const loadData = async () => {
    try {
      setRefreshing(true);
      const coordId = coordinatorProfile?.id || user?.id || coordinatorProfile?.email || user?.email;
      let assigned = [];
      if (coordId) {
        try {
          const eventsData = await getCoordinatorAssignedEvents(client, coordId);
          assigned = [
            ...(eventsData.normalEvents || []),
            ...(eventsData.specialEvents || []),
          ];
        } catch (evErr) {
          console.warn('Coordinator teams events error:', evErr);
        }
      }

      if (assigned.length === 0 && coordinatorProfile) {
        if (Array.isArray(coordinatorProfile.assigned_events) && coordinatorProfile.assigned_events.length > 0) {
          assigned = coordinatorProfile.assigned_events;
        } else if (coordinatorProfile.event_code) {
          assigned = [
            {
              id: coordinatorProfile.event_id || null,
              code: coordinatorProfile.event_code,
              name: coordinatorProfile.event_name || coordinatorProfile.event_code,
            },
          ];
        }
      }

      setAssignedEvents(assigned);

      const allTeams = await getCoordinatorTeams(client).catch(() => []);
      setTeams(allTeams || []);
    } catch (err) {
      console.warn('Coordinator teams error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // When a team is selected for QR preview, generate data URL
  useEffect(() => {
    if (qrModalTeam) {
      setQrDataUrl('');
      generateTeamQrDataUrl(qrModalTeam, { width: 320 })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.error('Failed to generate preview QR:', err));
    }
  }, [qrModalTeam]);

  const assignedEventIds = useMemo(() => {
    return new Set(assignedEvents.map((e) => e.id).filter(Boolean));
  }, [assignedEvents]);

  const assignedEventCodes = useMemo(() => {
    return new Set(assignedEvents.map((e) => (e.code || '').toUpperCase()).filter(Boolean));
  }, [assignedEvents]);

  const assignedEventNames = useMemo(() => {
    return new Set(assignedEvents.map((e) => (e.name || '').toLowerCase().trim()).filter(Boolean));
  }, [assignedEvents]);

  const getDisplayEventName = (team) => {
    if (!team) return '—';

    if (eventFilter !== 'ALL') {
      const selectedEv = assignedEvents.find(
        (e) => e.id === eventFilter || (e.code || '').toUpperCase() === eventFilter.toUpperCase()
      );
      if (selectedEv) return selectedEv.name || selectedEv.code;
    }

    if (assignedEvents.length > 0) {
      if (Array.isArray(team.package_events) && team.package_events.length > 0) {
        const pkgMatch = team.package_events.find(
          (pe) =>
            (pe.id && assignedEventIds.has(pe.id)) ||
            (pe.code && assignedEventCodes.has((pe.code || '').toUpperCase())) ||
            (pe.name && assignedEventNames.has((pe.name || '').toLowerCase().trim()))
        );
        if (pkgMatch?.name) return pkgMatch.name;
      }

      if (
        (team.event_id && assignedEventIds.has(team.event_id)) ||
        (team.event_code && assignedEventCodes.has((team.event_code || '').toUpperCase())) ||
        (team.event_name && assignedEventNames.has((team.event_name || '').toLowerCase().trim()))
      ) {
        return team.event_name || team.event_code;
      }
    }

    return team.event_name || team.event_code || team.event_id || '—';
  };

  const filtered = useMemo(() => {
    return teams.filter((t) => {
      // Must belong to one of the coordinator's assigned events unless coordinator has no specific event filter
      if (assignedEvents.length > 0) {
        const primaryMatch =
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

        if (!primaryMatch && !pkgMatch) return false;
      }

      const q = search.toLowerCase().trim();
      const membersMatch = (t.team_members || []).some((m) =>
        (m.name || '').toLowerCase().includes(q) ||
        (m.cs_id || '').toLowerCase().includes(q) ||
        (m.phone || '').includes(q) ||
        (m.email || '').toLowerCase().includes(q)
      );

      const matchesSearch =
        !q ||
        (t.team_name || '').toLowerCase().includes(q) ||
        (t.team_code || '').toLowerCase().includes(q) ||
        (t.team_leader_registration_code || '').toLowerCase().includes(q) ||
        (t.team_leader_name || '').toLowerCase().includes(q) ||
        membersMatch;

      const matchesStatus =
        statusFilter === 'ALL' || (t.status || '').toUpperCase() === statusFilter.toUpperCase();

      const matchesEvent =
        eventFilter === 'ALL' ||
        t.event_id === eventFilter ||
        (t.event_code || '').toUpperCase() === (eventFilter || '').toUpperCase() ||
        (Array.isArray(t.package_event_ids) && t.package_event_ids.includes(eventFilter)) ||
        (Array.isArray(t.package_event_codes) && t.package_event_codes.includes((eventFilter || '').toUpperCase()));

      return matchesSearch && matchesStatus && matchesEvent;
    });
  }, [teams, assignedEvents, assignedEventIds, assignedEventCodes, assignedEventNames, search, statusFilter, eventFilter]);

  const handleDownloadBadge = async (team) => {
    try {
      setDownloadingBadge(true);
      addToast(`Generating high-res PNG pass for "${team.team_name}"...`, 'info');
      await generateAndDownloadTeamQrBadge(team);
      addToast(`Downloaded PNG Pass for "${team.team_name}"!`, 'success');
    } catch (err) {
      console.error(err);
      addToast('Failed to download team pass badge', 'error');
    } finally {
      setDownloadingBadge(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/60 border border-cyan-500/30 text-xs font-mono text-cyan-300 mb-2">
            <ShieldCheck className="w-3.5 h-3.5 text-[#00f0ff]" />
            <span>TEAM EVENT DIRECTORY & QR MANAGEMENT</span>
          </div>
          <h1 className="text-2xl font-bold font-heading text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-brand-cyan" />
            Assigned Event Teams
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Registered team rosters, verified leaders, and official downloadable Team QR Code entry passes.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/coordinator/attendance?tab=team"
            className="py-2.5 px-4 rounded-xl border border-purple-500/60 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold text-xs tracking-wide shadow-[0_0_15px_rgba(168,85,247,0.35)] hover:brightness-110 flex items-center gap-2 transition-all"
          >
            <Camera className="w-4 h-4 text-purple-200" />
            <span>Team QR Scanner</span>
          </Link>

          <button
            onClick={loadData}
            disabled={refreshing}
            className="btn-secondary flex items-center gap-2 text-xs py-2.5 px-3.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="glass-card p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search team code, name, leader..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="cyber-input pl-10 text-sm w-full"
            />
          </div>

          {/* Status */}
          <div className="relative">
            <Filter className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="cyber-input pl-10 text-sm w-full"
            >
              <option value="ALL">All Statuses</option>
              <option value="FORMING">Forming</option>
              <option value="LOCKED">Locked</option>
              <option value="COMPLETED">Completed</option>
            </select>
          </div>

          {/* Event Filter */}
          <div className="relative">
            <Layers className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <select
              value={eventFilter}
              onChange={(e) => setEventFilter(e.target.value)}
              className="cyber-input pl-10 text-sm w-full"
            >
              <option value="ALL">All Assigned Events</option>
              {assignedEvents.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.code} · {ev.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
          <span>Showing {filtered.length} of {teams.length} teams</span>
          {(search || statusFilter !== 'ALL' || eventFilter !== 'ALL') && (
            <button
              onClick={() => {
                setSearch('');
                setStatusFilter('ALL');
                setEventFilter('ALL');
              }}
              className="text-brand-cyan hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Teams Grid / Table */}
      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-6 h-6 animate-spin text-brand-cyan" />
            <span>Loading teams...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No teams found for the selected events.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="cyber-table">
              <thead>
                <tr>
                  <th style={{ minWidth: '150px' }}>Team Info</th>
                  <th style={{ minWidth: '140px' }}>Event</th>
                  <th style={{ minWidth: '120px' }}>Team QR Pass</th>
                  <th style={{ minWidth: '320px' }}>Team Participants (Phone & Email)</th>
                  <th style={{ minWidth: '100px' }}>Members</th>
                  <th style={{ minWidth: '110px' }}>Status</th>
                  <th className="text-right" style={{ minWidth: '140px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((team) => {
                  const memberCount = team.member_count || team.current_members || (team.team_members || []).length;
                  const maxMembers = team.max_members || '—';

                  return (
                    <tr key={team.id}>
                      <td>
                        <div className="font-semibold text-white text-base">{team.team_name}</div>
                        <div className="font-mono text-xs text-brand-cyan mt-0.5">
                          #{team.team_code}
                        </div>
                      </td>
                      <td>
                        <span className="badge-outline text-xs">
                          {getDisplayEventName(team)}
                        </span>
                      </td>

                      {/* Team QR Pass Column */}
                      <td>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setQrModalTeam(team)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-cyan-950/60 border border-cyan-500/30 text-xs font-mono text-brand-cyan hover:bg-cyan-900/60 hover:border-cyan-400 transition-all group"
                            title="Preview Team QR Code Pass"
                          >
                            <QrCode className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                            <span>Preview</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDownloadBadge(team)}
                            disabled={downloadingBadge}
                            className="p-1.5 rounded-lg bg-purple-950/50 border border-purple-500/30 text-purple-300 hover:bg-purple-900/50 hover:text-white transition-all"
                            title="Download PNG Pass Badge"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                      <td>
                        <div className="flex flex-col gap-2">
                          {team.team_members && team.team_members.length > 0 ? (
                            team.team_members.map((m, idx) => (
                              <div
                                key={idx}
                                className={`p-2 rounded-lg ${
                                  m.role === 'LEADER'
                                    ? 'bg-cyan-950/40 border border-cyan-500/30'
                                    : 'bg-white/5 border border-white/10'
                                }`}
                              >
                                <div className="flex items-center gap-2 mb-1">
                                  {m.role === 'LEADER' ? (
                                    <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                  ) : (
                                    <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                  )}
                                  <strong className="text-white text-sm">{m.name || 'Participant'}</strong>
                                  <span
                                    className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${
                                      m.role === 'LEADER'
                                        ? 'bg-amber-500/20 text-amber-300'
                                        : 'bg-slate-700/40 text-slate-300'
                                    }`}
                                  >
                                    {m.role || 'MEMBER'}
                                  </span>
                                  {m.cs_id && (
                                    <span className="font-mono text-xs text-[#00f0ff]">
                                      ({m.cs_id})
                                    </span>
                                  )}
                                </div>
                                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-300">
                                  {m.phone && (
                                    <a
                                      href={`tel:${m.phone}`}
                                      className="inline-flex items-center gap-1 text-sky-400 hover:underline"
                                      title="Call phone"
                                    >
                                      <Phone className="w-3 h-3" />
                                      <span>{m.phone}</span>
                                    </a>
                                  )}
                                  {m.email && (
                                    <a
                                      href={`mailto:${m.email}`}
                                      className="inline-flex items-center gap-1 text-purple-300 hover:underline"
                                      title="Send email"
                                    >
                                      <Mail className="w-3 h-3" />
                                      <span>{m.email}</span>
                                    </a>
                                  )}
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="text-xs text-slate-400">
                              {team.team_leader_registration_code
                                ? `Leader ID: ${team.team_leader_registration_code}`
                                : 'No participants registered yet'}
                            </div>
                          )}
                        </div>
                      </td>

                      <td>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-semibold text-slate-200">
                            {memberCount}/{maxMembers}
                          </span>
                          <div className="w-16 bg-cyber-dark/80 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-brand-cyan h-full rounded-full transition-all"
                              style={{
                                width: `${Math.min(100, (memberCount / (team.max_members || 4)) * 100)}%`,
                              }}
                            />
                          </div>
                        </div>
                      </td>

                      <td>
                        <StatusBadge status={team.status} />
                      </td>

                      <td className="text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <a
                            href={buildTeamConfirmationGmailLink(team)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-ghost text-xs inline-flex items-center gap-1.5 py-1 px-2.5 text-brand-cyan hover:bg-brand-cyan/10"
                            title="Email Team Leader QR Passes"
                          >
                            <Mail className="w-3.5 h-3.5 text-brand-cyan" />
                            Email
                          </a>
                          <button
                            onClick={() => setSelectedTeam(team)}
                            className="btn-ghost text-xs inline-flex items-center gap-1.5 py-1 px-2.5"
                          >
                            <Eye className="w-3.5 h-3.5 text-brand-cyan" />
                            View
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Team Details Modal */}
      {selectedTeam && (
        <DetailsModal
          isOpen={!!selectedTeam}
          onClose={() => setSelectedTeam(null)}
          title={`Team: ${selectedTeam.team_name} (#${selectedTeam.team_code})`}
          data={{
            team_code: selectedTeam.team_code,
            team_name: selectedTeam.team_name,
            event: getDisplayEventName(selectedTeam),
            status: selectedTeam.status,
            leader_cs_id: selectedTeam.team_leader_registration_code,
            leader_name: selectedTeam.team_leader_name || 'N/A',
            members_count: `${(selectedTeam.team_members || []).length} / ${selectedTeam.max_members || '—'}`,
            members_roster: (selectedTeam.team_members || [])
              .map((m) => `${m.role === 'LEADER' ? '👑 ' : ''}${m.name || 'Member'} (${m.cs_id || 'ID missing'})`)
              .join('; ') || 'No members joined yet',
          }}
        />
      )}

      {/* Team QR Code Preview & Download Modal */}
      {qrModalTeam && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
          onClick={(e) => {
            if (e.target === e.currentTarget) setQrModalTeam(null);
          }}
        >
          <div className="bg-[#0b1021] border border-cyan-500/40 rounded-2xl w-full max-w-md shadow-2xl p-6 text-white relative">
            <div className="flex items-center justify-between border-b border-cyan-500/20 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <QrCode className="w-5 h-5 text-brand-cyan" />
                <h2 className="text-lg font-bold font-heading">Official Team QR Pass</h2>
              </div>
              <button
                onClick={() => setQrModalTeam(null)}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-all"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-center">
              {/* QR Image Box */}
              <div className="p-4 bg-white rounded-2xl inline-block mx-auto shadow-[0_0_25px_rgba(0,240,255,0.3)]">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt={`Team QR for ${qrModalTeam.team_name}`}
                    className="w-56 h-56 mx-auto object-contain"
                  />
                ) : (
                  <div className="w-56 h-56 flex items-center justify-center text-slate-800">
                    <RefreshCw className="w-6 h-6 animate-spin" />
                  </div>
                )}
              </div>

              {/* Team Information */}
              <div className="space-y-1">
                <div className="text-xl font-bold font-heading text-white">
                  {qrModalTeam.team_name}
                </div>
                <div className="font-mono text-sm text-brand-cyan">
                  #{qrModalTeam.team_code}
                </div>
                <div className="text-xs text-slate-300">
                  Registered Event: <strong className="text-cyan-300">{getDisplayEventName(qrModalTeam)}</strong>
                </div>
                <div className="text-xs text-slate-400">
                  Team Leader: {qrModalTeam.team_leader_name || 'Leader'} · {(qrModalTeam.team_members || []).length} Members
                </div>
              </div>

              {/* Actions */}
              <div className="pt-2 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => handleDownloadBadge(qrModalTeam)}
                  disabled={downloadingBadge}
                  className="w-full py-2.5 px-4 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 text-white bg-gradient-to-r from-cyan-500 to-blue-600 hover:brightness-110 shadow-[0_0_15px_rgba(0,240,255,0.3)] transition-all"
                >
                  <Download className="w-4 h-4" />
                  <span>Download PNG Pass Badge</span>
                </button>

                <div className="flex gap-2">
                  <a
                    href={buildTeamConfirmationGmailLink(qrModalTeam)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-2 px-3 rounded-xl border border-cyan-500/30 bg-cyan-950/40 text-brand-cyan text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-cyan-900/40 transition-all"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>Email Passes</span>
                  </a>

                  <Link
                    to={`/coordinator/attendance?tab=team&team=${encodeURIComponent(qrModalTeam.team_code || qrModalTeam.id)}`}
                    onClick={() => setQrModalTeam(null)}
                    className="flex-1 py-2 px-3 rounded-xl border border-purple-500/30 bg-purple-950/40 text-purple-300 text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-purple-900/40 transition-all"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Scan In</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
