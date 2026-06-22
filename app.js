// ============================================================
// Weekly Fitness — app.js
// Reset rule: every Monday at 00:00 local time (clean, predictable,
// matches how most people think about "this week").
// ============================================================

const STORAGE_KEY = 'wf_state_v1';
const THEME_KEY = 'wf_theme_v1';

const els = {
  themeToggle: document.getElementById('themeToggle'),
  themeIcon: document.getElementById('themeIcon'),
  streakCount: document.getElementById('streakCount'),
  ringWrap: document.getElementById('ringWrap'),
  trackGroup: document.getElementById('trackGroup'),
  fillGroup: document.getElementById('fillGroup'),
  doneCount: document.getElementById('doneCount'),
  ringSub: document.getElementById('ringSub'),
  statusLine: document.getElementById('statusLine'),
  resetPill: document.getElementById('resetPill'),
  buttons: Array.from(document.querySelectorAll('.workout-btn')),
};

let fillPaths = []; // index 0,1,2 -> <path> for workout 1,2,3

// ---------- date helpers ----------

function startOfMondayWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0 Sun ... 6 Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function dateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

// ---------- state ----------

function freshState(weekStartDate) {
  return {
    weekStart: dateKey(weekStartDate),
    workouts: { '1': false, '2': false, '3': false },
    streak: 0,
  };
}

function loadState() {
  const thisMonday = startOfMondayWeek(new Date());
  let state;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    state = raw ? JSON.parse(raw) : null;
  } catch (e) {
    state = null;
  }

  if (!state || !state.weekStart || !state.workouts) {
    state = freshState(thisMonday);
    saveState(state);
    return state;
  }

  if (state.weekStart !== dateKey(thisMonday)) {
    // Week has rolled over since we last saw this device.
    const wasFullyComplete = Object.values(state.workouts).every(Boolean);
    const newStreak = wasFullyComplete ? (state.streak || 0) + 1 : 0;
    state = freshState(thisMonday);
    state.streak = newStreak;
    saveState(state);
  }

  return state;
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

let state = loadState();

// ---------- ring geometry ----------

function polarToCartesian(cx, cy, r, angleDeg) {
  const a = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function describeArc(cx, cy, r, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, r, startAngle);
  const end = polarToCartesian(cx, cy, r, endAngle);
  const largeArc = endAngle - startAngle <= 180 ? 0 : 1;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

function buildRing() {
  const cx = 140, cy = 140, r = 108, gapDeg = 10, segDeg = 120 - gapDeg, strokeW = 20;
  els.trackGroup.innerHTML = '';
  els.fillGroup.innerHTML = '';
  fillPaths = [];

  for (let i = 0; i < 3; i++) {
    const a0 = -90 + i * 120 + gapDeg / 2;
    const a1 = a0 + segDeg;
    const d = describeArc(cx, cy, r, a0, a1);

    const track = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    track.setAttribute('d', d);
    track.setAttribute('class', 'track');
    track.setAttribute('stroke-width', strokeW);
    els.trackGroup.appendChild(track);

    const fill = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    fill.setAttribute('d', d);
    fill.setAttribute('class', 'fill');
    fill.setAttribute('stroke-width', strokeW);
    els.fillGroup.appendChild(fill);
    fillPaths.push(fill);
  }

  // measure after attaching to DOM
  fillPaths.forEach((p) => {
    const len = p.getTotalLength();
    p.style.setProperty('--len', String(len));
  });
}

// ---------- render ----------

function render() {
  const ids = ['1', '2', '3'];
  const doneCount = ids.filter((id) => state.workouts[id]).length;

  els.doneCount.textContent = doneCount;
  els.statusLine.textContent = `${doneCount} / 3 workouts completed`;
  els.streakCount.textContent = state.streak || 0;

  ids.forEach((id, i) => {
    const isDone = !!state.workouts[id];
    fillPaths[i].classList.toggle('lit', isDone);

    const btn = els.buttons.find((b) => b.dataset.id === id);
    btn.classList.toggle('done', isDone);
    btn.classList.toggle('locked', isDone);
    btn.setAttribute('aria-pressed', String(isDone));
  });

  const allDone = doneCount === 3;
  els.ringWrap.classList.toggle('complete', allDone);
  els.ringSub.textContent = allDone ? 'all done 🎉' : 'this week';

  renderCountdown();
}

function renderCountdown() {
  const monday = new Date(
    state.weekStart.slice(0, 4),
    Number(state.weekStart.slice(5, 7)) - 1,
    state.weekStart.slice(8, 10)
  );
  const nextReset = addDays(monday, 7);
  const now = new Date();
  const msLeft = nextReset - now;
  const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));

  let text;
  if (msLeft <= 0) {
    text = 'Resets now';
  } else if (daysLeft <= 1) {
    text = 'Resets tomorrow';
  } else {
    text = `Resets in ${daysLeft} days`;
  }
  els.resetPill.textContent = text;
}

// ---------- interactions ----------

function vibrate(pattern) {
  if (window.navigator && typeof window.navigator.vibrate === 'function') {
    window.navigator.vibrate(pattern);
  }
}

function handleWorkoutTap(id) {
  if (state.workouts[id]) return; // already completed this week, no double counting

  state.workouts[id] = true;
  saveState(state);

  const btn = els.buttons.find((b) => b.dataset.id === id);
  btn.classList.add('pop');
  setTimeout(() => btn.classList.remove('pop'), 340);

  els.ringWrap.classList.add('pop');
  setTimeout(() => els.ringWrap.classList.remove('pop'), 520);

  vibrate(12);

  render();

  const doneCount = Object.values(state.workouts).filter(Boolean).length;
  if (doneCount === 3) {
    vibrate([0, 20, 60, 20]);
    launchConfetti();
  }
}

els.buttons.forEach((btn) => {
  btn.addEventListener('click', () => handleWorkoutTap(btn.dataset.id));
});

// ---------- week rollover watcher ----------
// Catches the case where the app is left open across a Monday-midnight boundary.

function checkRollover() {
  const fresh = loadState();
  if (fresh.weekStart !== state.weekStart) {
    state = fresh;
    render();
  }
}

setInterval(checkRollover, 60 * 1000);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) checkRollover();
});

// keep the countdown text fresh even without a rollover
setInterval(renderCountdown, 60 * 1000);

// ---------- theme ----------

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  document.getElementById('theme-color-meta').setAttribute(
    'content',
    theme === 'light' ? '#F7F7F5' : '#0B0C0F'
  );
  els.themeIcon.innerHTML =
    theme === 'light'
      ? '<path d="M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0-15v2.2M12 19.8V22M4.2 12H2M22 12h-2.2M5.4 5.4l1.5 1.5M17.1 17.1l1.5 1.5M5.4 18.6l1.5-1.5M17.1 6.9l1.5-1.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>'
      : '<path d="M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36A5.4 5.4 0 0 1 12 3Z" fill="currentColor"/>';
}

function loadTheme() {
  let theme = localStorage.getItem(THEME_KEY);
  if (!theme) {
    const prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
    theme = prefersLight ? 'light' : 'dark';
  }
  applyTheme(theme);
}

els.themeToggle.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  localStorage.setItem(THEME_KEY, next);
  applyTheme(next);
});

// ---------- confetti ----------

function launchConfetti() {
  const canvas = document.getElementById('confettiCanvas');
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  canvas.style.display = 'block';
  ctx.scale(dpr, dpr);

  const colors = ['#FF5A36', '#FF8A5C', '#FFD166', '#F5F6F7', '#8A8F98'];
  const pieces = Array.from({ length: 80 }, () => ({
    x: window.innerWidth / 2 + (Math.random() - 0.5) * 60,
    y: window.innerHeight * 0.38,
    vx: (Math.random() - 0.5) * 9,
    vy: -Math.random() * 10 - 4,
    size: Math.random() * 6 + 4,
    color: colors[Math.floor(Math.random() * colors.length)],
    rot: Math.random() * 360,
    vr: (Math.random() - 0.5) * 16,
    shape: Math.random() > 0.5 ? 'rect' : 'circle',
  }));

  const gravity = 0.32;
  const start = performance.now();
  const duration = 1700;

  function frame(t) {
    const elapsed = t - start;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    pieces.forEach((p) => {
      p.vy += gravity;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rot * Math.PI) / 180);
      ctx.fillStyle = p.color;
      if (p.shape === 'rect') {
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });

    if (elapsed < duration) {
      requestAnimationFrame(frame);
    } else {
      canvas.style.display = 'none';
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    }
  }
  requestAnimationFrame(frame);
}

// ---------- service worker ----------

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(() => {
      /* offline support unavailable, app still works online */
    });
  });
}

// ---------- init ----------

loadTheme();
buildRing();
render();
