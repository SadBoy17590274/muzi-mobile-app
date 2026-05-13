// ========== MUZI KALENDER – App Logic ==========

// ===== STATE =====
const state = {
    currentDate: new Date(),
    selectedDate: new Date(),
    currentView: 'month',
    currentPage: 'pageCalendar',
    events: JSON.parse(localStorage.getItem('muzi_events') || '[]'),
    selectedColor: '#FFFFFF'
};

// ===== DOM REFS =====
const $ = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

const els = {
    sidebar: $('sidebar'),
    overlay: $('sidebarOverlay'),
    calGrid: $('calendarGrid'),
    headerMonth: $('headerMonth'),
    modalOverlay: $('eventModalOverlay'),
    eventTitle: $('eventTitle'),
    eventDate: $('eventDate'),
    eventStart: $('eventStartTime'),
    eventEnd: $('eventEndTime'),
    eventNotes: $('eventNotes'),
    aiMessages: $('aiMessages'),
    aiInput: $('aiInput'),
    searchInput: $('searchInput'),
    searchResults: $('searchResults'),
    statEvents: $('statEvents'),
    statReminders: $('statReminders'),
};

// ===== HELPERS =====
const MONTHS = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
const MONTHS_SHORT = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
const DAYS = ['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'];

function sameDay(a, b) {
    return a.getFullYear() === b.getFullYear() &&
           a.getMonth() === b.getMonth() &&
           a.getDate() === b.getDate();
}

function formatDate(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function getEventsForDate(date) {
    const ds = formatDate(date);
    return state.events.filter(e => e.date === ds);
}

function saveEvents() {
    localStorage.setItem('muzi_events', JSON.stringify(state.events));
    updateStats();
}

// ===== SIDEBAR =====
function openSidebar() {
    els.sidebar.classList.add('open');
    els.overlay.classList.add('open');
}
function closeSidebar() {
    els.sidebar.classList.remove('open');
    els.overlay.classList.remove('open');
}

// All menu buttons
['menuBtn','menuBtnAI','menuBtnProfile','menuBtnSearch','menuBtnSettings'].forEach(id => {
    const el = $(id);
    if (el) el.addEventListener('click', openSidebar);
});
$('sidebarCloseBtn').addEventListener('click', closeSidebar);
els.overlay.addEventListener('click', closeSidebar);

// Sidebar nav
$$('.sidebar-nav-item').forEach(item => {
    item.addEventListener('click', e => {
        e.preventDefault();
        const page = item.dataset.page;
        if (page === 'calendar') switchPage('pageCalendar');
        else if (page === 'events') switchPage('pageCalendar');
        else if (page === 'reminders') switchPage('pageCalendar');
        else if (page === 'settings') switchPage('pageSettings');
        $$('.sidebar-nav-item').forEach(n => n.classList.remove('active'));
        item.classList.add('active');
        closeSidebar();
    });
});

// ===== PAGE NAVIGATION =====
function switchPage(pageId) {
    state.currentPage = pageId;
    $$('.page').forEach(p => p.classList.remove('active'));
    $(pageId).classList.add('active');
    $$('.nav-item').forEach(n => {
        n.classList.toggle('active', n.dataset.page === pageId);
    });
    // Hide AI input bar when not on AI page
    const aiBar = document.querySelector('.ai-input-bar');
    if (aiBar) aiBar.style.display = pageId === 'pageAI' ? 'flex' : 'none';
}

$$('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => switchPage(btn.dataset.page));
});

// ===== CALENDAR RENDERING =====
function renderCalendar() {
    const year = state.currentDate.getFullYear();
    const month = state.currentDate.getMonth();
    els.headerMonth.textContent = `${MONTHS[month]} ${year}`;

    const firstDay = new Date(year, month, 1);
    let startDay = firstDay.getDay() - 1;
    if (startDay < 0) startDay = 6;

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrev = new Date(year, month, 0).getDate();
    const today = new Date();

    let html = '';
    // Previous month days
    for (let i = startDay - 1; i >= 0; i--) {
        const d = daysInPrev - i;
        const date = new Date(year, month - 1, d);
        const evts = getEventsForDate(date);
        html += `<div class="cal-day other-month" data-date="${formatDate(date)}">
            <span>${d}</span>
            ${evts.length ? `<div class="cal-day-dots">${evts.slice(0,3).map(e => `<div class="cal-day-dot" style="background:${e.color}"></div>`).join('')}</div>` : ''}
        </div>`;
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(year, month, d);
        const isToday = sameDay(date, today);
        const isSelected = sameDay(date, state.selectedDate);
        const evts = getEventsForDate(date);
        const classes = ['cal-day'];
        if (isToday) classes.push('today');
        if (isSelected) classes.push('selected');

        html += `<div class="${classes.join(' ')}" data-date="${formatDate(date)}">
            <span>${d}</span>
            ${evts.length ? `<div class="cal-day-dots">${evts.slice(0,3).map(e => `<div class="cal-day-dot" style="background:${e.color}"></div>`).join('')}</div>` : ''}
        </div>`;
    }

    // Next month days
    const totalCells = startDay + daysInMonth;
    const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
    for (let d = 1; d <= remaining; d++) {
        const date = new Date(year, month + 1, d);
        const evts = getEventsForDate(date);
        html += `<div class="cal-day other-month" data-date="${formatDate(date)}">
            <span>${d}</span>
            ${evts.length ? `<div class="cal-day-dots">${evts.slice(0,3).map(e => `<div class="cal-day-dot" style="background:${e.color}"></div>`).join('')}</div>` : ''}
        </div>`;
    }

    els.calGrid.innerHTML = html;

    // Day click handlers
    $$('.cal-day').forEach(day => {
        day.addEventListener('click', () => {
            const parts = day.dataset.date.split('-');
            state.selectedDate = new Date(parts[0], parts[1] - 1, parts[2]);
            // If different month, navigate
            if (state.selectedDate.getMonth() !== state.currentDate.getMonth()) {
                state.currentDate = new Date(state.selectedDate);
            }
            renderCalendar();
        });
    });
}



// ===== MONTH NAVIGATION (swipe) =====
let touchStartX = 0;
const calWrapper = $('calendarWrapper');
calWrapper.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
calWrapper.addEventListener('touchend', e => {
    const diff = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(diff) > 60) {
        if (diff > 0) {
            state.currentDate.setMonth(state.currentDate.getMonth() - 1);
        } else {
            state.currentDate.setMonth(state.currentDate.getMonth() + 1);
        }
        renderCalendar();
    }
});

// Today button
$('headerTodayBadge').addEventListener('click', () => {
    state.currentDate = new Date();
    state.selectedDate = new Date();
    renderCalendar();
});

// View switcher
$$('.view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        $$('.view-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.currentView = btn.dataset.view;
    });
});

// ===== EVENT MODAL =====
function openModal() {
    els.modalOverlay.classList.add('open');
    els.eventTitle.value = '';
    els.eventDate.value = formatDate(state.selectedDate);
    els.eventStart.value = '09:00';
    els.eventEnd.value = '10:00';
    els.eventNotes.value = '';
    state.selectedColor = '#FFFFFF';
    $$('.color-dot').forEach(d => d.classList.toggle('active', d.dataset.color === '#FFFFFF'));
    setTimeout(() => els.eventTitle.focus(), 400);
}

function closeModal() {
    els.modalOverlay.classList.remove('open');
}

$('addEventBtn').addEventListener('click', openModal);
$('modalCancelBtn').addEventListener('click', closeModal);
els.modalOverlay.addEventListener('click', e => {
    if (e.target === els.modalOverlay) closeModal();
});

// Color picker
$$('.color-dot').forEach(dot => {
    dot.addEventListener('click', () => {
        state.selectedColor = dot.dataset.color;
        $$('.color-dot').forEach(d => d.classList.remove('active'));
        dot.classList.add('active');
    });
});

// Save event
$('modalSaveBtn').addEventListener('click', () => {
    const title = els.eventTitle.value.trim();
    if (!title) { els.eventTitle.focus(); return; }

    const event = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2),
        title,
        date: els.eventDate.value,
        startTime: els.eventStart.value,
        endTime: els.eventEnd.value,
        color: state.selectedColor,
        notes: els.eventNotes.value.trim()
    };

    state.events.push(event);
    saveEvents();
    closeModal();

    // Navigate to that date
    const parts = event.date.split('-');
    state.selectedDate = new Date(parts[0], parts[1] - 1, parts[2]);
    state.currentDate = new Date(state.selectedDate);
    renderCalendar();
});

// ===== AI CHAT =====
const aiResponses = [
    'Ich habe deinen Kalender überprüft – heute stehen keine Termine an! 🎉',
    'Gerne! Ich kann dir helfen, einen neuen Termin zu erstellen. Sage mir einfach wann und was.',
    'Deine Woche sieht gut aus! Du hast bisher wenige Termine eingetragen.',
    'Tipp: Du kannst im Kalender nach links/rechts wischen um den Monat zu wechseln! 📅',
    'Ich bin Muzi, dein Kalender-Assistent. Ich kann Termine verwalten und dich erinnern.',
    'Möchtest du, dass ich eine Erinnerung für morgen erstelle? Sag mir einfach die Uhrzeit!',
];

function addAIMessage(text, type) {
    const msg = document.createElement('div');
    msg.className = `ai-msg ${type}`;
    msg.textContent = text;
    els.aiMessages.appendChild(msg);
    msg.scrollIntoView({ behavior: 'smooth' });
}

$('aiSendBtn').addEventListener('click', sendAIMessage);
els.aiInput.addEventListener('keydown', e => { if (e.key === 'Enter') sendAIMessage(); });

function sendAIMessage() {
    const text = els.aiInput.value.trim();
    if (!text) return;
    addAIMessage(text, 'user');
    els.aiInput.value = '';
    setTimeout(() => {
        const response = aiResponses[Math.floor(Math.random() * aiResponses.length)];
        addAIMessage(response, 'bot');
    }, 600 + Math.random() * 800);
}

$$('.ai-suggestion-chip').forEach(chip => {
    chip.addEventListener('click', () => {
        els.aiInput.value = chip.textContent.replace(/^[^\s]+\s/, '');
        switchPage('pageAI');
        setTimeout(sendAIMessage, 200);
    });
});

// ===== SEARCH =====
els.searchInput.addEventListener('input', () => {
    const q = els.searchInput.value.trim().toLowerCase();
    if (!q) {
        els.searchResults.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" opacity="0.3"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                </div>
                <p>Suche nach Terminen</p>
                <span>Gib einen Suchbegriff ein</span>
            </div>`;
        return;
    }

    const results = state.events.filter(e =>
        e.title.toLowerCase().includes(q) || (e.notes && e.notes.toLowerCase().includes(q))
    );

    if (results.length === 0) {
        els.searchResults.innerHTML = `
            <div class="empty-state">
                <p>Keine Ergebnisse</p>
                <span>Versuche einen anderen Suchbegriff</span>
            </div>`;
        return;
    }

    els.searchResults.innerHTML = results.map(ev => `
        <div class="event-card">
            <div class="event-color-bar" style="background:${ev.color}"></div>
            <div class="event-card-content">
                <div class="event-card-title">${ev.title}</div>
                <div class="event-card-time">${ev.date} · ${ev.startTime} – ${ev.endTime}</div>
            </div>
        </div>
    `).join('');
});

// ===== STATS =====
function updateStats() {
    if (els.statEvents) els.statEvents.textContent = state.events.length;
}

// ===== TOGGLES =====
$('toggleNotifications')?.addEventListener('click', function() {
    this.classList.toggle('active');
});
$('toggleDarkMode')?.addEventListener('click', function() {
    this.classList.toggle('active');
});

// ===== INIT =====
function init() {
    renderCalendar();
    updateStats();
    // Hide AI input bar initially
    const aiBar = document.querySelector('.ai-input-bar');
    if (aiBar) aiBar.style.display = 'none';
}

init();
