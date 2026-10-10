import QRCode from 'qrcode';

export async function generateQrDataUrl(text, options = {}) {
  try {
    return await QRCode.toDataURL(text, {
      width: options.width || 320,
      margin: options.margin || 2,
      color: {
        dark: options.darkColor || '#0b1329',
        light: options.lightColor || '#ffffff',
      },
      errorCorrectionLevel: 'M',
    });
  } catch (err) {
    console.error('Failed to generate QR data URL:', err);
    throw err;
  }
}

export async function generateAndDownloadPassBadge({
  registrationCode,
  participantName,
  selectedDay,
  college,
  department,
  qrText,
}) {
  const qrDataUrl = await generateQrDataUrl(qrText, { width: 640 });

  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 1000;
    canvas.height = 1400;

    // Background gradient
    const bgGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    bgGradient.addColorStop(0, '#070b14');
    bgGradient.addColorStop(0.5, '#0b1426');
    bgGradient.addColorStop(1, '#050811');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Neon Cyber header accent bar
    const barGradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
    barGradient.addColorStop(0, '#00f0ff');
    barGradient.addColorStop(0.5, '#7000ff');
    barGradient.addColorStop(1, '#ff007a');
    ctx.fillStyle = barGradient;
    ctx.fillRect(0, 0, canvas.width, 18);

    // Border
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.25)';
    ctx.lineWidth = 4;
    ctx.strokeRect(20, 28, canvas.width - 40, canvas.height - 48);

    // Header Title
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 48px Outfit, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('CYBER SENTINEL 2K26', 80, 110);

    ctx.fillStyle = '#38bdf8';
    ctx.font = '600 24px Outfit, sans-serif';
    ctx.fillText('OFFICIAL VERIFIED ENTRY PASS', 80, 155);

    // QR container box
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(80, 200, 840, 720, 24);
    ctx.fill();

    const img = new Image();
    img.onload = () => {
      const qrSize = 580;
      const qrX = (canvas.width - qrSize) / 2;
      const qrY = 270;
      ctx.drawImage(img, qrX, qrY, qrSize, qrSize);

      // Registration Code below QR
      ctx.fillStyle = '#00f0ff';
      ctx.font = '800 42px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(registrationCode || 'CS-XXXX', canvas.width / 2, 990);

      // Participant Name
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 32px Outfit, sans-serif';
      ctx.fillText(participantName || 'Participant', canvas.width / 2, 1050);

      // College / Dept info
      ctx.fillStyle = '#94a3b8';
      ctx.font = '500 22px Outfit, sans-serif';
      const orgInfo = [department, college].filter(Boolean).join(' • ');
      ctx.fillText(orgInfo || 'Participant', canvas.width / 2, 1100);

      // Day Badge pill
      ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
      ctx.beginPath();
      ctx.roundRect(canvas.width / 2 - 180, 1140, 360, 56, 28);
      ctx.fill();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#38bdf8';
      ctx.font = '700 24px Outfit, sans-serif';
      ctx.fillText(`ACCESS: ${selectedDay || 'SYMPOSIUM'}`, canvas.width / 2, 1177);

      // Footer notice
      ctx.fillStyle = '#64748b';
      ctx.font = '500 20px Outfit, sans-serif';
      ctx.fillText('Present this pass at the gate desk and event coordinators', canvas.width / 2, 1260);

      // Download trigger
      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = `${registrationCode || 'CS'}-${selectedDay || 'PASS'}-EntryBadge.png`;
      link.click();
      resolve(link.href);
    };
    img.src = qrDataUrl;
  });
}

/**
 * Generate a standard data URL for a Team QR code
 */
export async function generateTeamQrDataUrl(team, options = {}) {
  const qrPayload = JSON.stringify({
    type: 'CYBER_SENTINEL_TEAM',
    team_id: team.id,
    team_code: team.team_code,
    team_name: team.team_name,
    event_id: team.event_id || null,
  });
  return await generateQrDataUrl(qrPayload, options);
}

/**
 * Generate and download a high-resolution, branded Team Entry Pass PNG badge
 */
export async function generateAndDownloadTeamQrBadge(team) {
  const qrDataUrl = await generateTeamQrDataUrl(team, { width: 640 });

  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 1000;
    canvas.height = 1480;

    // Background gradient
    const bgGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    bgGradient.addColorStop(0, '#070b14');
    bgGradient.addColorStop(0.5, '#0b1426');
    bgGradient.addColorStop(1, '#050811');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Neon Cyber header accent bar
    const barGradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
    barGradient.addColorStop(0, '#00f0ff');
    barGradient.addColorStop(0.5, '#a855f7');
    barGradient.addColorStop(1, '#ec4899');
    ctx.fillStyle = barGradient;
    ctx.fillRect(0, 0, canvas.width, 18);

    // Border
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.35)';
    ctx.lineWidth = 4;
    ctx.strokeRect(20, 28, canvas.width - 40, canvas.height - 48);

    // Header Title
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 44px Outfit, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('CYBER SENTINEL 2K26', 80, 105);

    ctx.fillStyle = '#00f0ff';
    ctx.font = '700 22px Outfit, sans-serif';
    ctx.fillText('OFFICIAL TEAM COMPETITION PASS', 80, 145);

    // QR container box
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(80, 180, 840, 680, 24);
    ctx.fill();

    const img = new Image();
    img.onload = () => {
      const qrSize = 540;
      const qrX = (canvas.width - qrSize) / 2;
      const qrY = 250;
      ctx.drawImage(img, qrX, qrY, qrSize, qrSize);

      // Team Code below QR
      ctx.fillStyle = '#00f0ff';
      ctx.font = '800 36px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`#${team.team_code || 'TEAM'}`, canvas.width / 2, 920);

      // Team Name
      ctx.fillStyle = '#ffffff';
      ctx.font = '800 38px Outfit, sans-serif';
      ctx.fillText(team.team_name || 'Team Name', canvas.width / 2, 975);

      // Event Name & Track
      ctx.fillStyle = '#c084fc'; // Purple accent
      ctx.font = '700 26px Outfit, sans-serif';
      const eventLabel = (team.event_name || team.event_code || 'Team Competition').toUpperCase();
      ctx.fillText(`EVENT: ${eventLabel}`, canvas.width / 2, 1025);

      // Leader and members roster
      ctx.fillStyle = '#94a3b8';
      ctx.font = '600 22px Outfit, sans-serif';
      const leaderName = team.team_leader_name || team.team_members?.find(m => m.role === 'LEADER')?.name || 'Leader';
      ctx.fillText(`Team Leader: ${leaderName}`, canvas.width / 2, 1075);

      // Member summary
      const memberNames = (team.team_members || []).map(m => m.name).filter(Boolean);
      if (memberNames.length > 0) {
        ctx.fillStyle = '#cbd5e1';
        ctx.font = '500 19px Outfit, sans-serif';
        const membersText = `Members: ${memberNames.slice(0, 4).join(', ')}${memberNames.length > 4 ? '...' : ''}`;
        ctx.fillText(membersText, canvas.width / 2, 1120);
      }

      // College name
      const college = team.college || team.team_members?.[0]?.college || 'Vel Tech High Tech College';
      ctx.fillStyle = '#64748b';
      ctx.font = '500 20px Outfit, sans-serif';
      ctx.fillText(college, canvas.width / 2, 1165);

      // Verification pill
      ctx.fillStyle = 'rgba(0, 240, 255, 0.12)';
      ctx.beginPath();
      ctx.roundRect(canvas.width / 2 - 200, 1210, 400, 52, 26);
      ctx.fill();
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#00f0ff';
      ctx.font = '700 22px Outfit, sans-serif';
      ctx.fillText('CS26-VERIFIED TEAM ACCREDITATION', canvas.width / 2, 1244);

      // Footer notice
      ctx.fillStyle = '#64748b';
      ctx.font = '500 18px Outfit, sans-serif';
      ctx.fillText('Present this team QR code at event coordinator inspection desk', canvas.width / 2, 1320);

      // Trigger PNG download
      const cleanName = (team.team_name || 'team').replace(/[^a-zA-Z0-9_-]/g, '_');
      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = `CyberSentinel-TeamQR-${cleanName}-${team.team_code || 'PASS'}.png`;
      link.click();
      resolve(link.href);
    };
    img.src = qrDataUrl;
  });
}

