import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  getCoordinatorAssignedEvents,
  inspectCoordinatorEventAttendance,
  recordCoordinatorEventAttendance,
  inspectCoordinatorTeamAttendance,
  recordCoordinatorTeamAttendance,
  getCoordinatorAttendanceList,
} from '../../services/coordinatorService';
import QrScannerModal from '../../components/common/QrScannerModal';
import StatusBadge from '../../components/ui/StatusBadge';
import { formatDate } from '../../utils/helpers';
import {
  QrCode,
  Camera,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Search,
  Layers,
  Clock,
  UserCheck,
  Eye,
  Users,
  Crown,
  User,
  Building,
  Phone,
  Mail,
  RotateCcw,
  ShieldCheck,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

export default function CoordinatorAttendance() {
  const { user, coordinatorProfile, getCoordinatorClientInstance } = useAuth();
  const { addToast } = useToast();

  const [assignedEvents, setAssignedEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [recentScans, setRecentScans] = useState([]);
  const [loadingScans, setLoadingScans] = useState(false);

  // Tab: 'participant' or 'team'
  const [scannerTab, setScannerTab] = useState('participant');

  // Participant Scanner & Inspection State
  const [scannerOpen, setScannerOpen] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [inspecting, setInspecting] = useState(false);
  const [inspectionResult, setInspectionResult] = useState(null);
  const [recording, setRecording] = useState(false);

  // Team Scanner & Inspection State
  const [teamManualCode, setTeamManualCode] = useState('');
  const [inspectingTeam, setInspectingTeam] = useState(false);
  const [teamInspectionResult, setTeamInspectionResult] = useState(null);
  const [recordingTeam, setRecordingTeam] = useState(false);

  const [selectedRecord, setSelectedRecord] = useState(null);

  const client = getCoordinatorClientInstance();

  // Check URL parameters for initial tab or team lookup
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam === 'team') {
        setScannerTab('team');
      }
      const teamParam = params.get('team');
      if (teamParam) {
        setTeamManualCode(teamParam);
      }
    } catch (_) {}
  }, []);

  useEffect(() => {
    async function loadEvents() {
      try {
        const coordId = user?.id || coordinatorProfile?.id;
        let normalEvents = [];
        if (coordId) {
          try {
            const eventsData = await getCoordinatorAssignedEvents(client, coordId);
            normalEvents = eventsData.normalEvents || [];
          } catch (evErr) {
            console.warn('Coordinator attendance events error:', evErr);
          }
        }
        setAssignedEvents(normalEvents);
        if (normalEvents.length > 0) {
          setSelectedEventId(normalEvents[0].id);
        }
      } catch (err) {
        console.warn('Coordinator attendance error:', err);
      }
    }
    loadEvents();
  }, []);

  const loadAttendance = async (eventId) => {
    if (!eventId) return;
    try {
      setLoadingScans(true);
      const list = await getCoordinatorAttendanceList(client, eventId);
      setRecentScans(list);
    } catch (err) {
      console.error(err);
      addToast(err.message || 'Failed to load attendance list', 'error');
    } finally {
      setLoadingScans(false);
    }
  };

  useEffect(() => {
    if (selectedEventId) {
      setInspectionResult(null);
      setTeamInspectionResult(null);
      loadAttendance(selectedEventId);
    }
  }, [selectedEventId]);

  // Auto-inspect team if passed in query param once events are loaded
  useEffect(() => {
    if (selectedEventId && teamManualCode && scannerTab === 'team' && !teamInspectionResult) {
      handleInspectTeam(teamManualCode);
    }
  }, [selectedEventId]);

  // --- 1. PARTICIPANT ATTENDANCE HANDLERS ---
  const handleInspect = async (qrToken, regCode) => {
    if (!selectedEventId) {
      addToast('Please select an active event before scanning', 'error');
      return;
    }

    try {
      setInspecting(true);
      const result = await inspectCoordinatorEventAttendance(
        client,
        qrToken || null,
        selectedEventId,
        regCode || null
      );

      setInspectionResult(result);
      if (result.not_authorized) {
        addToast(result.message || 'You are not assigned to coordinate this event.', 'error');
      } else if (result.already_marked) {
        addToast('Participant already marked PRESENT for this event', 'info');
      } else if (!result.is_registered) {
        addToast(result.message || 'Participant is not registered for this event!', 'error');
      } else {
        addToast(result.message || 'Participant verified! Ready to record.', 'success');
      }
    } catch (err) {
      console.error(err);
      addToast(err.message || 'Failed to inspect attendance', 'error');
      setInspectionResult(null);
    } finally {
      setInspecting(false);
    }
  };

  const handleManualLookup = (e) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    handleInspect(null, manualCode.trim());
  };

  const handleRecordAttendance = async () => {
    if (!inspectionResult || !selectedEventId) return;

    try {
      setRecording(true);
      const res = await recordCoordinatorEventAttendance(
        client,
        inspectionResult.qr_token || inspectionResult.registration_code,
        selectedEventId,
        user?.id || coordinatorProfile?.id
      );

      addToast(
        res?.message || `Attendance recorded for ${inspectionResult.registration_code}!`,
        'success'
      );
      setInspectionResult(null);
      setManualCode('');
      loadAttendance(selectedEventId);
    } catch (err) {
      console.error(err);
      addToast(err.message || 'Failed to record attendance', 'error');
    } finally {
      setRecording(false);
    }
  };

  // --- 2. TEAM ATTENDANCE HANDLERS ---
  const handleInspectTeam = async (tokenOrCode) => {
    if (!selectedEventId) {
      addToast('Please select an active event before scanning', 'error');
      return;
    }
    const clean = String(tokenOrCode || '').trim();
    if (!clean) return;

    try {
      setInspectingTeam(true);
      const result = await inspectCoordinatorTeamAttendance(
        client,
        clean,
        selectedEventId
      );

      setTeamInspectionResult(result);
      if (result.not_found) {
        addToast(result.message || 'Team not found.', 'error');
      } else if (result.is_mismatch) {
        addToast(result.message || 'Team is registered for a different event!', 'error');
      } else if (result.already_marked) {
        addToast(result.message || 'Team already marked PRESENT for this event', 'info');
      } else if (result.is_registered) {
        addToast(result.message || `Team verified! (${result.member_count} members)`, 'success');
      }
    } catch (err) {
      console.error(err);
      addToast(err.message || 'Failed to inspect team attendance', 'error');
      setTeamInspectionResult(null);
    } finally {
      setInspectingTeam(false);
    }
  };

  const handleManualTeamLookup = (e) => {
    e.preventDefault();
    if (!teamManualCode.trim()) return;
    handleInspectTeam(teamManualCode.trim());
  };

  const handleRecordTeamAttendance = async () => {
    if (!teamInspectionResult || !selectedEventId) return;

    try {
      setRecordingTeam(true);
      const res = await recordCoordinatorTeamAttendance(
        client,
        teamInspectionResult.team_id,
        selectedEventId,
        user?.id || coordinatorProfile?.id
      );

      addToast(
        res?.message || `Attendance recorded for team "${teamInspectionResult.team_name}"!`,
        'success'
      );
      setTeamInspectionResult(null);
      setTeamManualCode('');
      loadAttendance(selectedEventId);
    } catch (err) {
      console.error(err);
      addToast(err.message || 'Failed to record team attendance', 'error');
    } finally {
      setRecordingTeam(false);
    }
  };

  const currentEvent = assignedEvents.find((e) => e.id === selectedEventId);
  const isTeamEvent = currentEvent?.event_type === 'TEAM' || currentEvent?.min_team_size > 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/60 border border-cyan-500/30 text-xs font-mono text-cyan-300 mb-2">
            <ShieldCheck className="w-3.5 h-3.5 text-[#00f0ff]" />
            <span>ATTENDANCE ACCREDITATION DESK</span>
          </div>
          <h1 className="text-2xl font-bold font-heading text-white flex items-center gap-2">
            <UserCheck className="w-6 h-6 text-brand-cyan" />
            Event Attendance Scanner
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Single-detection verification scanner for individual participant badges and registered team passes.
          </p>
        </div>

        {/* Event Selector */}
        <div className="w-full sm:w-80">
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
            Active Event Track
          </label>
          <div className="relative">
            <Layers className="w-4 h-4 text-brand-cyan absolute left-3 top-1/2 -translate-y-1/2" />
            <select
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="cyber-input pl-9 text-sm w-full font-medium"
            >
              {assignedEvents.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.code} · {ev.name} ({ev.day || 'Track'} {ev.event_type ? `· ${ev.event_type}` : ''})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Mode Switcher Tabs */}
      <div className="flex items-center gap-3 p-1.5 rounded-2xl bg-white/[0.04] border border-white/[0.08] max-w-md">
        <button
          type="button"
          onClick={() => {
            setScannerTab('participant');
            setInspectionResult(null);
            setTeamInspectionResult(null);
          }}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold font-heading tracking-wide transition-all flex items-center justify-center gap-2 ${
            scannerTab === 'participant'
              ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-[0_0_15px_rgba(0,240,255,0.35)]'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>Participant Scanner</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setScannerTab('team');
            setInspectionResult(null);
            setTeamInspectionResult(null);
          }}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold font-heading tracking-wide transition-all flex items-center justify-center gap-2 ${
            scannerTab === 'team'
              ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-[0_0_15px_rgba(168,85,247,0.35)]'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Team QR Scanner</span>
          {isTeamEvent && (
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="Active event is a team competition" />
          )}
        </button>
      </div>

      {/* Main Scanner Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Scanner & Lookup Input */}
        <div className="lg:col-span-6 space-y-4">
          {/* TAB 1: PARTICIPANT SCANNER */}
          {scannerTab === 'participant' && (
            <div className="glass-card p-6 border-brand-cyan/20">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold font-heading text-white flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-brand-cyan" />
                  <span>Scan Participant Badge</span>
                </h2>
                {currentEvent && (
                  <span className="badge-outline text-xs text-brand-cyan border-brand-cyan/30">
                    {currentEvent.code} ({currentEvent.day})
                  </span>
                )}
              </div>

              {/* Camera Trigger */}
              <div className="space-y-4">
                <button
                  onClick={() => {
                    if (!selectedEventId) {
                      addToast('Please select an active event first', 'error');
                      return;
                    }
                    setScannerOpen(true);
                  }}
                  disabled={!selectedEventId}
                  className="w-full py-4 px-6 rounded-xl border border-cyan-300/60 bg-gradient-to-r from-cyan-500 via-sky-500 to-indigo-500 text-white font-bold shadow-[0_0_22px_rgba(34,211,238,0.45)] hover:brightness-110 hover:shadow-[0_0_28px_rgba(59,130,246,0.5)] transition-all duration-200 flex items-center justify-center gap-3 group"
                >
                  <Camera className="w-6 h-6 group-hover:scale-110 transition-transform" />
                  <span className="text-base">Launch Participant Camera Scanner</span>
                </button>

                <div className="relative flex py-1 items-center">
                  <div className="flex-grow border-t border-cyber-border"></div>
                  <span className="flex-shrink mx-4 text-xs font-semibold text-slate-500 uppercase tracking-widest">
                    OR ENTER REGISTRATION ID
                  </span>
                  <div className="flex-grow border-t border-cyber-border"></div>
                </div>

                {/* Manual Lookup Form */}
                <form onSubmit={handleManualLookup} className="flex flex-col sm:flex-row items-stretch gap-2">
                  <div className="relative flex-1 min-w-0">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="e.g. CS-26-0001 or raw token..."
                      value={manualCode}
                      onChange={(e) => setManualCode(e.target.value)}
                      className="cyber-input pl-10 text-sm w-full font-mono uppercase min-h-[44px]"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={inspecting || !manualCode.trim() || !selectedEventId}
                    className="btn-primary text-sm px-5 flex items-center justify-center gap-2 shrink-0 min-h-[44px]"
                  >
                    {inspecting ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <span>Lookup</span>
                    )}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* TAB 2: TEAM QR SCANNER */}
          {scannerTab === 'team' && (
            <div className="glass-card p-6 border-brand-purple/30">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-bold font-heading text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-purple-400" />
                  <span>Scan Team QR Pass</span>
                </h2>
                {currentEvent && (
                  <span className="badge-outline text-xs text-purple-300 border-purple-500/30">
                    {currentEvent.code} ({currentEvent.day})
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-400 mb-4">
                Scan official Team QR codes for registered teams in {currentEvent?.name || 'this track'} (Day 1: PP, US, WB · Day 2: FB, MS, CC, LL).
              </p>

              {/* Camera Trigger */}
              <div className="space-y-4">
                <button
                  onClick={() => {
                    if (!selectedEventId) {
                      addToast('Please select an active event first', 'error');
                      return;
                    }
                    setScannerOpen(true);
                  }}
                  disabled={!selectedEventId}
                  className="w-full py-4 px-6 rounded-xl border border-purple-400/60 bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 text-white font-bold shadow-[0_0_22px_rgba(168,85,247,0.45)] hover:brightness-110 hover:shadow-[0_0_28px_rgba(217,70,239,0.5)] transition-all duration-200 flex items-center justify-center gap-3 group"
                >
                  <Camera className="w-6 h-6 group-hover:scale-110 transition-transform" />
                  <span className="text-base">Launch Team QR Camera Scanner</span>
                </button>

                <div className="relative flex py-1 items-center">
                  <div className="flex-grow border-t border-cyber-border"></div>
                  <span className="flex-shrink mx-4 text-xs font-semibold text-slate-500 uppercase tracking-widest">
                    OR ENTER TEAM CODE
                  </span>
                  <div className="flex-grow border-t border-cyber-border"></div>
                </div>

                {/* Manual Team Lookup Form */}
                <form onSubmit={handleManualTeamLookup} className="flex flex-col sm:flex-row items-stretch gap-2">
                  <div className="relative flex-1 min-w-0">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="e.g. #PP-101, TWIN_FLAME_14..."
                      value={teamManualCode}
                      onChange={(e) => setTeamManualCode(e.target.value)}
                      className="cyber-input pl-10 text-sm w-full font-mono uppercase min-h-[44px]"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={inspectingTeam || !teamManualCode.trim() || !selectedEventId}
                    className="btn-primary text-sm px-5 flex items-center justify-center gap-2 shrink-0 min-h-[44px] bg-purple-600 hover:bg-purple-500"
                  >
                    {inspectingTeam ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <span>Lookup Team</span>
                    )}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* PARTICIPANT INSPECTION RESULT CARD */}
          {inspectionResult && scannerTab === 'participant' && (
            <div
              className={`glass-card p-6 border-2 transition-all ${
                inspectionResult.already_marked
                  ? 'border-amber-500/40 bg-amber-500/5'
                  : !inspectionResult.is_registered
                  ? 'border-rose-500/40 bg-rose-500/5'
                  : 'border-emerald-500/50 bg-emerald-500/5'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xl font-bold text-white">
                      {inspectionResult.registration_code || 'CS-XXXX'}
                    </span>
                    <span className="badge-outline text-xs">
                      {inspectionResult.selected_day || 'SYMPOSIUM'}
                    </span>
                  </div>
                  <div className="text-base font-semibold text-slate-100">
                    {inspectionResult.participant_name || 'Participant'}
                  </div>
                  <div className="text-xs text-slate-300">
                    {inspectionResult.college} · {inspectionResult.department}
                    {inspectionResult.year ? ` (Year ${inspectionResult.year})` : ''}
                  </div>
                </div>

                <div className="text-right">
                  {inspectionResult.already_marked ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Already Marked
                    </span>
                  ) : !inspectionResult.is_registered ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                      <XCircle className="w-3.5 h-3.5" />
                      Event Mismatch
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      <CheckCircle className="w-3.5 h-3.5" />
                      Verified
                    </span>
                  )}
                </div>
              </div>

              {/* Status details */}
              <div className="mt-4 pt-4 border-t border-cyber-border space-y-2 text-xs">
                {inspectionResult.already_marked && (
                  <p className="text-amber-300 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    Attendance was previously recorded on:{' '}
                    {formatDate(inspectionResult.existing_scan_at)}
                  </p>
                )}

                {!inspectionResult.is_registered && (
                  <p className="text-rose-300 leading-relaxed">
                    {inspectionResult.message || `Warning: Participant is not registered in ${currentEvent?.code || 'this event'}.`}
                  </p>
                )}

                {inspectionResult.is_registered && !inspectionResult.already_marked && (
                  <p className="text-emerald-300 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Participant is confirmed and enrolled in {currentEvent?.code} ({currentEvent?.name}).
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="mt-5 flex gap-3">
                <button
                  onClick={() => setInspectionResult(null)}
                  className="btn-secondary text-sm flex-1"
                >
                  Dismiss
                </button>
                <button
                  onClick={handleRecordAttendance}
                  disabled={recording || inspectionResult.already_marked || !inspectionResult.is_registered}
                  className={`btn-primary text-sm flex-1 text-white flex items-center justify-center gap-2 ${
                    inspectionResult.already_marked || !inspectionResult.is_registered
                      ? 'bg-slate-700 cursor-not-allowed opacity-60'
                      : 'bg-emerald-600 hover:bg-emerald-500'
                  }`}
                >
                  {recording ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4" />
                  )}
                  <span>
                    {inspectionResult.already_marked
                      ? 'Already Marked'
                      : !inspectionResult.is_registered
                      ? 'Cannot Check In'
                      : 'Mark Present'}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* TEAM INSPECTION RESULT CARD */}
          {teamInspectionResult && scannerTab === 'team' && (
            <div
              className={`glass-card p-6 border-2 transition-all ${
                teamInspectionResult.already_marked
                  ? 'border-amber-500/40 bg-amber-500/5'
                  : !teamInspectionResult.is_registered
                  ? 'border-rose-500/40 bg-rose-500/5'
                  : 'border-emerald-500/50 bg-emerald-500/5'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-heading text-xl font-bold text-white">
                      {teamInspectionResult.team_name}
                    </span>
                    <span className="font-mono text-xs text-brand-cyan px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-500/30">
                      #{teamInspectionResult.team_code}
                    </span>
                  </div>
                  <div className="text-xs text-purple-300 font-medium">
                    Event: {teamInspectionResult.event_name || currentEvent?.name} ({teamInspectionResult.event_day})
                  </div>
                  <div className="text-xs text-slate-300">
                    College: {teamInspectionResult.college}
                  </div>
                </div>

                <div className="text-right">
                  {teamInspectionResult.already_marked ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Already Marked
                    </span>
                  ) : !teamInspectionResult.is_registered ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                      <XCircle className="w-3.5 h-3.5" />
                      Event Mismatch
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      <CheckCircle className="w-3.5 h-3.5" />
                      Team Verified
                    </span>
                  )}
                </div>
              </div>

              {/* Leader & Member Roster Display */}
              <div className="mt-4 pt-4 border-t border-cyber-border space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-semibold uppercase tracking-wider">
                    Team Leader: <strong className="text-white">{teamInspectionResult.leader_name}</strong>
                  </span>
                  <span className="text-cyan-300 font-mono">
                    {teamInspectionResult.member_count} Members Total
                  </span>
                </div>

                {/* Member Roster List */}
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {(teamInspectionResult.members || []).map((m, idx) => (
                    <div
                      key={idx}
                      className={`p-2 rounded-lg text-xs flex items-center justify-between ${
                        m.role === 'LEADER'
                          ? 'bg-amber-500/10 border border-amber-500/30'
                          : 'bg-white/5 border border-white/10'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {m.role === 'LEADER' ? (
                          <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        ) : (
                          <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        )}
                        <span className="font-medium text-white">{m.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">({m.cs_id})</span>
                      </div>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                        {m.role}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Status notice */}
                {teamInspectionResult.already_marked && (
                  <p className="text-amber-300 text-xs flex items-center gap-1.5 pt-2">
                    <Clock className="w-3.5 h-3.5" />
                    Team attendance recorded previously at {formatDate(teamInspectionResult.existing_scan_at)}
                  </p>
                )}

                {!teamInspectionResult.is_registered && (
                  <p className="text-rose-300 text-xs pt-2">
                    {teamInspectionResult.message}
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="mt-5 flex gap-3">
                <button
                  onClick={() => setTeamInspectionResult(null)}
                  className="btn-secondary text-sm flex-1"
                >
                  Dismiss
                </button>
                <button
                  onClick={handleRecordTeamAttendance}
                  disabled={recordingTeam || teamInspectionResult.already_marked || !teamInspectionResult.is_registered}
                  className={`btn-primary text-sm flex-1 text-white flex items-center justify-center gap-2 ${
                    teamInspectionResult.already_marked || !teamInspectionResult.is_registered
                      ? 'bg-slate-700 cursor-not-allowed opacity-60'
                      : 'bg-emerald-600 hover:bg-emerald-500'
                  }`}
                >
                  {recordingTeam ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4" />
                  )}
                  <span>
                    {teamInspectionResult.already_marked
                      ? 'Already Marked'
                      : !teamInspectionResult.is_registered
                      ? 'Cannot Check In'
                      : `Mark Team Present (${teamInspectionResult.member_count})`}
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Live Attendance List */}
        <div className="lg:col-span-6 space-y-4">
          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold font-heading text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-brand-cyan" />
                  Recent Scans ({currentEvent?.code || 'Selected Event'})
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Live verification audit logs for this session
                </p>
              </div>

              <button
                onClick={() => loadAttendance(selectedEventId)}
                disabled={loadingScans || !selectedEventId}
                className="btn-ghost text-xs py-1 px-2 text-slate-400 hover:text-white"
                title="Refresh Attendance"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingScans ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {loadingScans ? (
              <div className="p-8 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
                <RefreshCw className="w-5 h-5 animate-spin text-brand-cyan" />
                <span className="text-xs">Loading records...</span>
              </div>
            ) : recentScans.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                No attendance recorded yet for this event today.
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[460px] overflow-y-auto">
                <table className="cyber-table text-xs">
                  <thead>
                    <tr>
                      <th>CS ID</th>
                      <th>Participant</th>
                      <th>Time</th>
                      <th>Scanned By</th>
                      <th className="text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentScans.map((rec) => (
                      <tr key={rec.id}>
                        <td className="font-mono font-medium text-brand-cyan">
                          {rec.registrations?.registration_code || rec.registration_id}
                        </td>
                        <td className="text-slate-200">
                          {rec.registrations?.participants?.name || '—'}
                        </td>
                        <td className="text-slate-400 whitespace-nowrap">
                          {formatDate(rec.scanned_at)}
                        </td>
                        <td className="text-slate-400 truncate max-w-[120px]" title={rec.scanned_by_email}>
                          {rec.scanned_by_email}
                        </td>
                        <td className="text-right">
                          <button
                            onClick={() => setSelectedRecord(rec)}
                            className="text-brand-cyan hover:underline inline-flex items-center gap-1"
                          >
                            <Eye className="w-3 h-3" />
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* QR Camera Scanner Modal — Supports both participant and team scanning with Google Pay single detection */}
      {scannerOpen && (
        <QrScannerModal
          isOpen={true}
          mode={scannerTab === 'team' ? 'team' : 'participant'}
          onClose={() => setScannerOpen(false)}
          onScanSuccess={(token) => {
            setScannerOpen(false);
            if (scannerTab === 'team') {
              handleInspectTeam(token);
            } else {
              handleInspect(token, null);
            }
          }}
          title={
            scannerTab === 'team'
              ? `Scan Team QR Pass — ${currentEvent?.name || 'Attendance'}`
              : `Scan Participant Badge — ${currentEvent?.name || 'Attendance'}`
          }
          placeholder={
            scannerTab === 'team'
              ? 'Enter Team Code (e.g. #PP-101)...'
              : 'Enter Registration ID (e.g. CS-26-0001)...'
          }
        />
      )}

      {/* Record Details Modal */}
      {selectedRecord && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md"
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedRecord(null); }}
        >
          <div className="bg-[#120d29] border border-[#3b2d6a] rounded-2xl w-full max-w-md shadow-2xl p-6 text-white">
            <div className="flex items-center justify-between border-b border-[#241c47] pb-3 mb-4">
              <h2 className="text-lg font-bold">Attendance Record</h2>
              <button
                onClick={() => setSelectedRecord(null)}
                className="p-1.5 rounded-lg bg-[#1f1742] hover:bg-[#2b1f5e] border border-[#3c2f6d] text-slate-300 hover:text-white transition-all"
              >
                ✕
              </button>
            </div>
            <div className="space-y-3 text-sm">
              {[
                ['CS Registration ID', selectedRecord.registrations?.registration_code || '—'],
                ['Participant Name', selectedRecord.registrations?.participants?.name || '—'],
                ['Email', selectedRecord.registrations?.participants?.email || '—'],
                ['College', selectedRecord.registrations?.participants?.college || '—'],
                ['Attendance Status', selectedRecord.status || 'PRESENT'],
                ['Scanned At', formatDate(selectedRecord.scanned_at)],
                ['Scanned By', selectedRecord.scanned_by_email || '—'],
              ].map(([label, value]) => (
                <div key={label} className="flex items-start justify-between gap-4 p-2.5 rounded-lg bg-[#181238] border border-[#2a1f52]">
                  <span className="text-slate-400 text-xs font-semibold uppercase tracking-wide shrink-0">{label}</span>
                  <span className="text-white font-medium text-right break-all">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
