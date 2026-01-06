const API_BASE = 'http://localhost:3000';
let reservations = [];
let intervalId = null;

document.addEventListener('DOMContentLoaded', () => {
  fetchReservations();
  intervalId = setInterval(updateCountdowns, 1000);
  // Refresh data every 10 seconds to stay in sync
  setInterval(fetchReservations, 10000);
});

async function fetchReservations() {
  try {
    const res = await fetch(`${API_BASE}/reservations/pending`);
    const json = await res.json();

    if (!json.success) {
      setStatus('Failed to load reservations', 'error');
      return;
    }

    reservations = json.data || [];
    renderTable();
    if (reservations.length === 0) {
      setStatus('No active reservations');
    } else {
      setStatus(`Active reservations: ${reservations.length}`);
    }
  } catch (err) {
    console.error('Error fetching reservations', err);
    setStatus('Network error while loading reservations', 'error');
  }
}

function renderTable() {
  const tbody = document.getElementById('reservations-body');
  if (!tbody) return;

  if (!reservations.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty">No active reservations</td></tr>`;
    return;
  }

  tbody.innerHTML = reservations
    .map(r => {
      const remaining = timeRemaining(r.expires_at);
      const remainingText = remaining.text;
      const cls = ['countdown', remaining.className].filter(Boolean).join(' ');
      return `
        <tr>
          <td>${r.user_id}</td>
          <td>${r.id}</td>
          <td>${r.sku}</td>
          <td>${formatDate(r.expires_at)}</td>
          <td class="${cls}" data-exp="${r.expires_at}">${remainingText}</td>
        </tr>
      `;
    })
    .join('');
}

function updateCountdowns() {
  const cells = document.querySelectorAll('[data-exp]');
  cells.forEach(cell => {
    const exp = cell.getAttribute('data-exp');
    const { text, className } = timeRemaining(exp);
    cell.textContent = text;
    cell.className = ['countdown', className].filter(Boolean).join(' ');
  });
}

function timeRemaining(expiry) {
  const now = Date.now();
  const expTime = new Date(expiry).getTime();
  const diff = expTime - now;
  if (diff <= 0) return { text: 'Expired', className: 'expired' };
  const mins = Math.floor(diff / 60000);
  const secs = Math.floor((diff % 60000) / 1000);
  const warn = diff < 60_000;
  return { text: `${mins}:${secs.toString().padStart(2, '0')}`, className: warn ? 'warn' : '' };
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return d.toLocaleString();
}

function setStatus(text, type = 'info') {
  const el = document.getElementById('status');
  if (!el) return;
  el.textContent = text;
  el.className = `status ${type}`;
}

