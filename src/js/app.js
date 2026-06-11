// Country flag dictionary with fallback
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

// Global state
let configuredTeams = [
  "Argentina", "Brasil", "España", "Francia", "Inglaterra", 
  "Alemania", "Portugal", "Países Bajos", "Colombia", "Uruguay"
];

// DOM Elements
const btnDraw = document.getElementById('btn-draw');
const inputName = document.getElementById('participant-name');
const registrationView = document.getElementById('registration-view');
const rouletteWrapper = document.getElementById('roulette-wrapper');
const rouletteRibbon = document.getElementById('roulette-ribbon');
const resultWrapper = document.getElementById('result-wrapper');
const resultFlag = document.getElementById('result-flag');
const resultTeam = document.getElementById('result-team');
const resultMessage = document.getElementById('result-message');
const btnResetView = document.getElementById('btn-reset-view');
const alertBox = document.getElementById('alert-box');

// Fetch latest teams on load
async function loadTeams() {
  try {
    const res = await fetch('/api/teams');
    if (res.ok) {
      const data = await res.json();
      if (data.teams && data.teams.length > 0) {
        configuredTeams = data.teams.map(t => t.name);
      }
    }
  } catch (err) {
    console.warn("No se pudieron cargar los equipos dinámicos, usando predeterminados:", err);
  }
}

// Helper to show alerts
function showAlert(message, type = 'error') {
  alertBox.className = `alert alert-${type}`;
  alertBox.innerText = message;
  alertBox.style.display = 'flex';
}

function hideAlert() {
  alertBox.style.display = 'none';
}

// Helper for confetti explosion
function triggerConfetti() {
  const duration = 2.5 * 1000;
  const animationEnd = Date.now() + duration;
  const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 1000 };

  function randomInRange(min, max) {
    return Math.random() * (max - min) + min;
  }

  const interval = setInterval(function() {
    const timeLeft = animationEnd - Date.now();

    if (timeLeft <= 0) {
      return clearInterval(interval);
    }

    const particleCount = 50 * (timeLeft / duration);
    // since particles fall down, animate a bit higher than random
    confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
    confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
  }, 250);
}

// Roulette spin implementation
function spinRoulette(winnerTeam) {
  // Hide form, show roulette
  registrationView.style.display = 'none';
  rouletteWrapper.style.display = 'flex';
  hideAlert();

  // Build roulette ribbon items (60 items total)
  const totalItems = 60;
  const winnerIndex = 50; // The item that will align at the center
  rouletteRibbon.innerHTML = '';
  
  // Fill the ribbon
  for (let i = 0; i < totalItems; i++) {
    let teamName;
    if (i === winnerIndex) {
      teamName = winnerTeam;
    } else {
      // Pick random team from configured list
      const randIdx = Math.floor(Math.random() * configuredTeams.length);
      teamName = configuredTeams[randIdx];
    }

    const item = document.createElement('div');
    item.className = 'roulette-item';
    item.innerHTML = `<span class="flag">${getFlag(teamName)}</span> <span>${teamName}</span>`;
    rouletteRibbon.appendChild(item);
  }

  // Force reflow
  rouletteRibbon.style.transition = 'none';
  rouletteRibbon.style.transform = 'translateY(0)';
  rouletteRibbon.offsetHeight; // read offsetHeight to force repaint

  // Trigger spin animation (lasts exactly 5 seconds)
  // Height of each roulette-item is 120px, so we scroll down N items to center item N
  const itemHeight = 120;
  const targetScroll = winnerIndex * itemHeight;

  rouletteRibbon.style.transition = 'transform 5.0s cubic-bezier(0.05, 0.85, 0.1, 1)';
  rouletteRibbon.style.transform = `translateY(-${targetScroll}px)`;

  // Reveal winner after 5 seconds
  setTimeout(() => {
    // Show results
    rouletteWrapper.style.display = 'none';
    resultWrapper.style.display = 'flex';
    
    resultFlag.innerText = getFlag(winnerTeam);
    resultTeam.innerText = winnerTeam;
    resultMessage.className = 'alert alert-success';
    resultMessage.innerText = '¡Felicidades! Tu equipo ha sido asignado y guardado.';

    // Spark confetti
    triggerConfetti();
  }, 5000);
}

// Draw button event handler
async function handleDraw() {
  const name = inputName.value.trim();
  if (!name) {
    showAlert('Por favor, ingresa tu nombre.');
    return;
  }

  btnDraw.disabled = true;
  const originalBtnText = btnDraw.querySelector('.btn-text').innerText;
  btnDraw.querySelector('.btn-text').innerText = 'Procesando...';
  hideAlert();

  try {
    // 1. Check if already registered
    const statusRes = await fetch(`/api/status?name=${encodeURIComponent(name)}`);
    if (!statusRes.ok) {
      throw new Error('No se pudo verificar el estado del participante.');
    }
    
    const statusData = await statusRes.json();
    if (statusData.registered) {
      // Show existing assignment immediately (skip roulette)
      registrationView.style.display = 'none';
      resultWrapper.style.display = 'flex';
      resultFlag.innerText = getFlag(statusData.team);
      resultTeam.innerText = statusData.team;
      resultMessage.className = 'alert alert-info';
      resultMessage.innerText = `Ya tienes asignado el equipo ${statusData.team}. No se permite un nuevo sorteo.`;
      return;
    }

    // 2. Not registered, perform draw
    const drawRes = await fetch('/api/draw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });

    if (!drawRes.ok) {
      const errorText = await drawRes.text();
      let errorMsg = 'Error en el sorteo.';
      try {
        const errorJson = JSON.parse(errorText);
        errorMsg = errorJson.error || errorMsg;
      } catch (e) {
        errorMsg = errorText || errorMsg;
      }
      showAlert(errorMsg);
      btnDraw.disabled = false;
      btnDraw.querySelector('.btn-text').innerText = originalBtnText;
      return;
    }

    const drawData = await drawRes.json();
    
    if (drawData.alreadyRegistered) {
      // Handle edge case where name was registered between status check and draw
      registrationView.style.display = 'none';
      resultWrapper.style.display = 'flex';
      resultFlag.innerText = getFlag(drawData.team);
      resultTeam.innerText = drawData.team;
      resultMessage.className = 'alert alert-info';
      resultMessage.innerText = `Ya tenías asignado el equipo ${drawData.team}.`;
      return;
    }

    // 3. Trigger roulette animation for new assignment
    spinRoulette(drawData.team);

  } catch (error) {
    console.error(error);
    showAlert('Error de conexión con el servidor. Intenta de nuevo.');
    btnDraw.disabled = false;
    btnDraw.querySelector('.btn-text').innerText = originalBtnText;
  }
}

// Reset view to allow checking another name
function resetView() {
  inputName.value = '';
  btnDraw.disabled = false;
  btnDraw.querySelector('.btn-text').innerText = 'Sortear equipo';
  registrationView.style.display = 'block';
  resultWrapper.style.display = 'none';
  rouletteWrapper.style.display = 'none';
  hideAlert();
}

// Bind events
btnDraw.addEventListener('click', handleDraw);
btnResetView.addEventListener('click', resetView);
inputName.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    handleDraw();
  }
});

// Run initialization
loadTeams();
