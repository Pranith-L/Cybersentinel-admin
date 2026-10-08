import React, { useState, useEffect, useMemo } from 'react';
import { getTeams, createTeam, getEvents } from '../../services/adminService';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Modal } from '../../components/common/Modal';
import { DetailsModal } from '../../components/common/DetailsModal';
import { useToast } from '../../context/ToastContext';
import { buildTeamConfirmationGmailLink } from '../../utils/helpers';
import {
  Users2,
  Plus,
  Eye,
  RefreshCw,
  ShieldCheck,
  Phone,
  Mail,
  Crown,
  User,
  Search,
  Filter,
  Layers,
} from 'lucide-react';

export function AdminTeams() {
  const { addToast } = useToast();

  const [teams, setTeams] = useState([]);
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [eventFilter, setEventFilter] = useState('ALL');

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [activeDetails, setActiveDetails] = useState(null);

  const [form, setForm] = useState({
    eventId: '',
    teamName: '',
    leaderRegistrationCode: '',
    maxMembers: 2,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function load() {
    setIsLoading(true);
    try {
      const [teamData, evtData] = await Promise.all([
        getTeams(),
        getEvents().catch(() => []),
      ]);
      setTeams(teamData);
      setEvents(evtData);
    } catch (err) {
      addToast({
        title: 'Teams Error',
        message: err.message,
        type: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleAddTeam(e) {
    e.preventDefault();
    if (!form.eventId || !form.teamName.trim()) {
      addToast({ title: 'Validation', message: 'Event and team name are required.', type: 'error' });
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await createTeam({
        eventId: form.eventId,
        teamName: form.teamName,
        maxMembers: form.maxMembers,
        leaderRegistrationCode: form.leaderRegistrationCode,
      });

      addToast({
        title: 'Team Created',
        message: `Team "${form.teamName}" added. Code: ${created.team_code}`,
        type: 'success',
      });
      setIsAddModalOpen(false);
      setForm({ eventId: '', teamName: '', leaderRegistrationCode: '', maxMembers: 2 });
      load();
    } catch (err) {
      addToast({
        title: 'Failed to Create Team',
        message: err.message,
        type: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const filteredTeams = useMemo(() => {
    return teams.filter((t) => {
      const q = search.trim().toLowerCase();
      const code = (t.team_code || '').toLowerCase();
      const name = (t.team_name || '').toLowerCase();
      const leaderCode = (t.team_leader_registration_code || '').toLowerCase();
      const leaderName = (t.team_leader_name || '').toLowerCase();

      const memberMatch = (t.team_members || []).some(
        (m) =>
          (m.name || '').toLowerCase().includes(q) ||
          (m.cs_id || '').toLowerCase().includes(q) ||
          (m.phone || '').toLowerCase().includes(q) ||
          (m.email || '').toLowerCase().includes(q)
      );

      const matchesSearch =
        !q ||
        code.includes(q) ||
        name.includes(q) ||
        leaderCode.includes(q) ||
        leaderName.includes(q) ||
        memberMatch;

      const matchesStatus = statusFilter === 'ALL' || t.status === statusFilter;

      const matchesEvent =
        eventFilter === 'ALL' ||
        t.event_id === eventFilter ||
        (t.event_code || '').toUpperCase() === (eventFilter || '').toUpperCase() ||
        (Array.isArray(t.package_event_ids) && t.package_event_ids.includes(eventFilter)) ||
        (Array.isArray(t.package_event_codes) && t.package_event_codes.includes((eventFilter || '').toUpperCase())) ||
        (Array.isArray(t.package_events) &&
          t.package_events.some(
            (e) => e.id === eventFilter || (e.code || '').toUpperCase() === (eventFilter || '').toUpperCase()
          ));

      return matchesSearch && matchesStatus && matchesEvent;
    });
  }, [teams, search, statusFilter, eventFilter]);

  function getEventBadge(t) {
    if (!t) return '—';
    if (Array.isArray(t.package_events) && t.package_events.length > 0) {
      return t.package_events.map((e) => e.name || e.code).join(' & ');
    }
    return t.event_name || t.event_code || t.event_id || '—';
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.9rem', marginBottom: '6px' }}>Event Teams</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Monitor symposium team rosters, assigned leaders, member capacities, and event assignments.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button type="button" onClick={load} disabled={isLoading} className="btn btn-secondary">
            <RefreshCw size={16} className={isLoading ? 'spin' : ''} />
          </button>
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="btn btn-primary"
            style={{ fontSize: '0.88rem' }}
          >
            <Plus size={16} /> Add Team
          </button>
        </div>
      </div>

      {/* Toolbar / Filters */}
      <div className="glass-card p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search team code, name, leader, phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="cyber-input pl-10 text-sm w-full"
            />
          </div>

          {/* Status Filter */}
          <div className="relative">
            <Filter className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="cyber-input pl-10 text-sm w-full"
            >
              <option value="ALL">All Statuses</option>
              <option value="OPEN">Open</option>
              <option value="FORMING">Forming</option>
              <option value="LOCKED">Locked</option>
              <option value="CONFIRMED">Confirmed</option>
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
              <option value="ALL">All Events & Tracks</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.code} · {ev.name}
                </option>
              ))}
              <option value="01524e69-6f8d-42b7-933e-6f4121681402">EP · Esports(Free Fire)</option>
              <option value="f1420ddb-a778-4cd7-a93e-0e5e984af5c4">GD · Group Dance</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
          <span>Showing {filteredTeams.length} of {teams.length} total event teams</span>
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

      {/* Teams Table */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th style={{ minWidth: '140px' }}>Team Info</th>
              <th style={{ minWidth: '160px' }}>Event</th>
              <th style={{ minWidth: '320px' }}>Team Participants (Phone & Email)</th>
              <th style={{ minWidth: '100px' }}>Members</th>
              <th style={{ minWidth: '110px' }}>Status</th>
              <th style={{ minWidth: '90px', textAlign: 'right' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                  Loading teams...
                </td>
              </tr>
            ) : filteredTeams.length ? (
              filteredTeams.map((t) => (
                <tr key={t.id || t.team_code}>
                  <td>
                    <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '1rem', color: 'var(--accent-cyan)' }}>
                      #{t.team_code}
                    </div>
                    <strong style={{ color: '#ffffff', fontSize: '1.05rem', display: 'block', marginTop: '2px' }}>
                      {t.team_name}
                    </strong>
                  </td>

                  <td>
                    <span className="badge-outline" style={{ fontSize: '0.8rem', color: '#93c5fd' }}>
                      {getEventBadge(t)}
                    </span>
                  </td>

                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {t.team_members && t.team_members.length > 0 ? (
                        t.team_members.map((m, idx) => (
                          <div
                            key={idx}
                            style={{
                              padding: '8px 12px',
                              borderRadius: '8px',
                              background: m.role === 'LEADER' ? 'rgba(0, 240, 255, 0.08)' : 'rgba(255, 255, 255, 0.04)',
                              border: m.role === 'LEADER' ? '1px solid rgba(0, 240, 255, 0.3)' : '1px solid rgba(255, 255, 255, 0.08)',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                              {m.role === 'LEADER' ? (
                                <Crown size={14} color="#f59e0b" />
                              ) : (
                                <User size={14} color="#94a3b8" />
                              )}
                              <strong style={{ color: '#ffffff', fontSize: '0.92rem' }}>{m.name || 'Participant'}</strong>
                              <span
                                style={{
                                  fontSize: '0.72rem',
                                  fontWeight: 800,
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  background: m.role === 'LEADER' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(148, 163, 184, 0.15)',
                                  color: m.role === 'LEADER' ? '#fbbf24' : '#cbd5e1',
                                }}
                              >
                                {m.role || 'MEMBER'}
                              </span>
                              {m.cs_id && (
                                <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: '#00f0ff' }}>
                                  ({m.cs_id})
                                </span>
                              )}
                            </div>
                            <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', fontSize: '0.82rem', color: '#cbd5e1' }}>
                              {m.phone && (
                                <a
                                  href={`tel:${m.phone}`}
                                  style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#38bdf8', textDecoration: 'none' }}
                                  title="Call phone"
                                >
                                  <Phone size={12} /> {m.phone}
                                </a>
                              )}
                              {m.email && (
                                <a
                                  href={`mailto:${m.email}`}
                                  style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#a78bfa', textDecoration: 'none' }}
                                  title="Send email"
                                >
                                  <Mail size={12} /> {m.email}
                                </a>
                              )}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                          {t.team_leader_registration_code ? `Leader: ${t.team_leader_registration_code}` : 'No participants registered yet'}
                        </div>
                      )}
                    </div>
                  </td>

                  <td>
                    <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{t.current_members || 0}</span> / {t.max_members}
                  </td>

                  <td>
                    <StatusBadge status={t.status} />
                  </td>

                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', flexWrap: 'wrap' }}>
                      <a
                        href={buildTeamConfirmationGmailLink(t)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-secondary"
                        style={{ padding: '7px 12px', fontSize: '0.85rem', background: 'rgba(0, 240, 255, 0.12)', borderColor: 'rgba(0, 240, 255, 0.4)', color: '#00f0ff' }}
                        title="Email Team Leader QR Passes"
                      >
                        <Mail size={14} /> Email Team
                      </a>
                      <button
                        type="button"
                        onClick={() => setActiveDetails(t)}
                        className="btn btn-secondary"
                        style={{ padding: '7px 14px', fontSize: '0.85rem' }}
                      >
                        <Eye size={14} /> View
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '36px', color: 'var(--text-dim)' }}>
                  No teams found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add Team Modal */}
      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Create New Team" maxWidth="560px">
        <form onSubmit={handleAddTeam}>
          <div className="form-group">
            <label className="form-label">Event *</label>
            <select
              required
              className="form-select"
              value={form.eventId}
              onChange={(e) => setForm({ ...form, eventId: e.target.value })}
            >
              <option value="">Select Event...</option>
              {events.map((evt) => (
                <option key={evt.id} value={evt.id}>
                  {evt.code} - {evt.name} ({evt.day})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Team Name *</label>
            <input
              type="text"
              required
              className="form-input"
              placeholder="e.g. Sentinels of Code"
              value={form.teamName}
              onChange={(e) => setForm({ ...form, teamName: e.target.value })}
            />
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Leader Registration ID (Optional)</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. CS-1042"
                value={form.leaderRegistrationCode}
                onChange={(e) => setForm({ ...form, leaderRegistrationCode: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Max Members *</label>
              <input
                type="number"
                min="2"
                required
                className="form-input"
                value={form.maxMembers}
                onChange={(e) => setForm({ ...form, maxMembers: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
            <button type="button" onClick={() => setIsAddModalOpen(false)} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className="btn btn-primary">
              {isSubmitting ? 'Creating Team...' : 'Create Team'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Details Modal */}
      <DetailsModal
        isOpen={Boolean(activeDetails)}
        onClose={() => setActiveDetails(null)}
        data={
          activeDetails
            ? {
                team_code: activeDetails.team_code,
                team_name: activeDetails.team_name,
                event: getEventBadge(activeDetails),
                status: activeDetails.status,
                leader_cs_id: activeDetails.team_leader_registration_code || 'N/A',
                leader_name: activeDetails.team_leader_name || 'N/A',
                members_count: `${(activeDetails.team_members || []).length} / ${activeDetails.max_members || '—'}`,
                members_roster:
                  (activeDetails.team_members || [])
                    .map((m) => `${m.role === 'LEADER' ? '👑 ' : ''}${m.name || 'Member'} (${m.cs_id || 'ID missing'})`)
                    .join('; ') || 'No members joined yet',
              }
            : null
        }
        title="Team Roster & Information"
      />
    </div>
  );
}

export default AdminTeams;
