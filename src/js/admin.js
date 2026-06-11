// Country flag dictionary
const COUNTRY_FLAGS = {
  "Argentina": "🇦🇷",
  "Brasil": "🇧🇷",
  "España": "🇪🇸",
  "Francia": "🇫🇷",
  "Inglaterra": "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
  "Alemania": "🇩🇪",
  "Portugal": "🇵🇹",
  "Países Bajos": "🇳🇱",
  "Colombia": "🇨🇴",
  "Uruguay": "🇺🇾",
  "Italia": "🇮🇹",
  "Bélgica": "🇧🇪",
  "Croacia": "🇭🇷",
  "Senegal": "🇸🇳",
  "Japón": "🇯🇵",
  "Marruecos": "🇲🇦",
  "Estados Unidos": "🇺🇸",
  "México": "🇲🇽",
  "Canadá": "🇨🇦",
  "Ecuador": "🇪🇨",
  "Chile": "🇨🇱",
  "Perú": "🇵🇪",
  "Suiza": "🇨🇭",
  "Dinamarca": "🇩🇰",
  "Arabia Saudita": "🇸🇦"
};

function getFlag(teamName) {
  return COUNTRY_FLAGS[teamName] || "⚽";
}

// DOM Elements
const loginWrapper = document.getElementById('admin-login-wrapper');
const panelWrapper = document.getElementById('admin-panel-wrapper');
const inputPassword = document.getElementById('admin-password');
const btnLogin = document.getElementById('btn-login');
const loginAlert = document.getElementById('login-alert');

const btnLogout = document.getElementById('btn-logout');
const btnReset = document.getElementById('btn-reset');
const btnToggleConfig = document.getElementById('btn-toggle-config');
const configWrapper = document.getElementById('config-teams-wrapper');
const teamsTextarea = document.getElementById('teams-textarea');
const btnSaveTeams = document.getElementById('btn-save-teams');
const btnCancelConfig = document.getElementById('btn-cancel-config');
const panelAlert = document.getElementById('panel-alert');

const statParticipants = document.getElementById('stat-participants');
const statTeamsTotal = document.getElementById('stat-teams-total');
const statTeamsAvail = document.getElementById('stat-teams-avail');

const participantsTbody = document.getElementById('participants-tbody');
const teamsTbody = document.getElementById('teams-tbody');

// Authentication Helper
function getAuthHeader() {
  const token = sessionStorage.getItem('adminToken');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

// Show/Hide Panel Alerts
function showPanelAlert(message, type = 'success') {
  panelAlert.className = `alert alert-${type}`;
  panelAlert.innerText = message;
  panelAlert.style.display = 'flex';
  setTimeout(() => {
    panelAlert.style.display = 'none';
  }, 6000);
}

// Fetch and load data
async function loadAdminData() {
  const headers = getAuthHeader();
  if (!headers.Authorization) {
    showLogin();
    return;
  }

  try {
    const res = await fetch('/api/manage/assignments', { headers });
    if (res.status === 401) {
      sessionStorage.removeItem('adminToken');
      showLogin();
      return;
    }

    if (!res.ok) {
      throw new Error('No se pudo cargar la información del sorteo.');
    }

    const data = await res.json();
    const { teams, participants } = data;

    // Update Stats
    statParticipants.innerText = participants.length;
    statTeamsTotal.innerText = teams.length;
    const availableTeamsCount = teams.filter(t => t.isAvailable).length;
    statTeamsAvail.innerText = availableTeamsCount;

    // Populate Participants Table
    participantsTbody.innerHTML = '';
    if (participants.length === 0) {
      participantsTbody.innerHTML = `
        <tr>
          <td colspan="3" style="text-align: center; color: var(--text-muted); padding: 24px;">
            No hay participantes registrados.
          </td>
        </tr>
      `;
    } else {
      participants.forEach(p => {
        const tr = document.createElement('tr');
        const formattedDate = new Date(p.drawTime).toLocaleString('es-ES', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });
        
        tr.innerHTML = `
          <td><strong>${escapeHTML(p.name)}</strong></td>
          <td class="td-team">${getFlag(p.team)} ${p.team}</td>
          <td class="td-date">${formattedDate}</td>
        `;
        participantsTbody.appendChild(tr);
      });
    }

    // Populate Teams Table
    teamsTbody.innerHTML = '';
    if (teams.length === 0) {
      teamsTbody.innerHTML = `
        <tr>
          <td colspan="3" style="text-align: center; color: var(--text-muted); padding: 24px;">
            No hay equipos cargados en el sorteo.
          </td>
        </tr>
      `;
    } else {
      teams.forEach(t => {
        const tr = document.createElement('tr');
        const statusText = t.isAvailable ? 'Libre' : 'Asignado';
        const statusClass = t.isAvailable ? 'alert-success' : 'alert-info';
        
        tr.innerHTML = `
          <td class="td-team">${getFlag(t.name)} ${t.name}</td>
          <td>
            <span style="padding: 4px 8px; border-radius: 6px; font-size: 0.8rem; font-weight:700;" class="${statusClass}">
              ${statusText}
            </span>
          </td>
          <td>${t.participant ? `<strong>${escapeHTML(t.participant)}</strong>` : '<span style="color: var(--text-muted);">-</span>'}</td>
        `;
        teamsTbody.appendChild(tr);
      });
    }

    // Populate Configuration Textarea with current teams list
    const teamNames = teams.map(t => t.name);
    teamsTextarea.value = teamNames.join('\n');

  } catch (err) {
    console.error(err);
    showPanelAlert(err.message, 'error');
  }
}

// Escaping helper
function escapeHTML(str) {
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

// View Switches
function showLogin() {
  loginWrapper.style.display = 'block';
  panelWrapper.style.display = 'none';
  loginAlert.style.display = 'none';
  inputPassword.value = '';
}

function showPanel() {
  loginWrapper.style.display = 'none';
  panelWrapper.style.display = 'flex';
  loadAdminData();
}

// Action Handlers
async function handleLogin() {
  const password = inputPassword.value;
  if (!password) {
    loginAlert.innerText = 'La contraseña es requerida.';
    loginAlert.style.display = 'block';
    return;
  }

  btnLogin.disabled = true;
  loginAlert.style.display = 'none';

  try {
    const res = await fetch('/api/manage/verify', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${password}`
      }
    });

    if (res.ok) {
      sessionStorage.setItem('adminToken', password);
      showPanel();
    } else {
      if (res.status === 401) {
        loginAlert.innerText = 'Contraseña incorrecta. Intente de nuevo.';
      } else {
        const errorText = await res.text();
        loginAlert.innerText = `Error del servidor (${res.status}): ${errorText || 'No se pudo conectar a la base de datos.'}`;
      }
      loginAlert.style.display = 'block';
      btnLogin.disabled = false;
    }
  } catch (err) {
    console.error(err);
    loginAlert.innerText = 'Error de conexión con el servidor.';
    loginAlert.style.display = 'block';
    btnLogin.disabled = false;
  }
}

async function handleReset() {
  const confirmAction = confirm('¿Estás absolutamente seguro de reiniciar el sorteo? \n\nEsto ELIMINARÁ todos los participantes actuales y dejará todos los equipos LIBRES para sortear nuevamente.');
  if (!confirmAction) return;

  btnReset.disabled = true;
  try {
    const res = await fetch('/api/manage/reset', {
      method: 'POST',
      headers: getAuthHeader()
    });

    if (!res.ok) throw new Error('Error al reiniciar el sorteo.');

    const data = await res.json();
    showPanelAlert(data.message, 'success');
    await loadAdminData();
  } catch (err) {
    console.error(err);
    showPanelAlert(err.message, 'error');
  } finally {
    btnReset.disabled = false;
  }
}

async function handleSaveTeams() {
  const text = teamsTextarea.value;
  const teams = text.split('\n')
                    .map(t => t.trim())
                    .filter(t => t.length > 0);

  if (teams.length === 0) {
    alert('Debe escribir al menos un equipo.');
    return;
  }

  const confirmAction = confirm(`¿Estás seguro de guardar estos ${teams.length} equipos? \n\nADVERTENCIA: Esta acción ELIMINARÁ a todos los participantes registrados y todos los registros del sorteo anteriores para arrancar de cero con esta nueva lista.`);
  if (!confirmAction) return;

  btnSaveTeams.disabled = true;
  try {
    const res = await fetch('/api/manage/config-teams', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader()
      },
      body: JSON.stringify({ teams })
    });

    if (!res.ok) throw new Error('Error al guardar la nueva lista de equipos.');

    const data = await res.json();
    showPanelAlert(data.message, 'success');
    configWrapper.style.display = 'none';
    await loadAdminData();
  } catch (err) {
    console.error(err);
    showPanelAlert(err.message, 'error');
  } finally {
    btnSaveTeams.disabled = false;
  }
}

function handleLogout() {
  sessionStorage.removeItem('adminToken');
  showLogin();
}

// Bind Events
btnLogin.addEventListener('click', handleLogin);
inputPassword.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') handleLogin();
});

btnLogout.addEventListener('click', handleLogout);
btnReset.addEventListener('click', handleReset);

btnToggleConfig.addEventListener('click', () => {
  configWrapper.style.display = 'block';
  btnToggleConfig.style.display = 'none';
});

btnCancelConfig.addEventListener('click', () => {
  configWrapper.style.display = 'none';
  btnToggleConfig.style.display = 'block';
  // reload to restore original list in textarea
  loadAdminData();
});

btnSaveTeams.addEventListener('click', handleSaveTeams);

// Check login status on page start
if (sessionStorage.getItem('adminToken')) {
  showPanel();
} else {
  showLogin();
}
