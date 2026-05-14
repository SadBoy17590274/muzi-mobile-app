// ========== MUZI KALENDER – App Logic ==========

// ===== STATE =====
const state = {
    currentDate: new Date(),
    selectedDate: new Date(),
    currentView: 'month',
    currentPage: 'pageCalendar',
    events: JSON.parse(localStorage.getItem('muzi_events') || '[]'),
    profiles: JSON.parse(localStorage.getItem('muzi_profiles_v2') || '[{"id":"1","name":"Muzi Nutzer","color":"#34C759","image":""}]'),
    activeProfileId: localStorage.getItem('muzi_active_profile_v2') || '1',
    selectedColor: '#FFFFFF',
    profileEditColor: '#34C759',
    profileEditImage: '',
    get profile() { return this.profiles.find(p => p.id === this.activeProfileId) || this.profiles[0]; }
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

function isEventForActiveProfile(e) {
    const activeStrId = String(state.activeProfileId);
    const mainProfileId = String(state.profiles[0] ? state.profiles[0].id : '1');
    return e.profileId ? String(e.profileId) === activeStrId : activeStrId === mainProfileId;
}

function getEventsForDate(date) {
    const ds = formatDate(date);
    return state.events.filter(e => e.date === ds && isEventForActiveProfile(e));
}

function saveEvents() {
    localStorage.setItem('muzi_events', JSON.stringify(state.events));
    updateStats();
}

function saveProfile() {
    try {
        localStorage.setItem('muzi_profiles_v2', JSON.stringify(state.profiles));
        localStorage.setItem('muzi_active_profile_v2', state.activeProfileId);
    } catch (e) {
        console.error('Fehler beim Speichern des Profils:', e);
        alert('Speicherlimit erreicht! Bitte lösche einige Bilder oder verwende kleinere Bilder.');
    }
    updateProfileUI();
    renderCalendar();
}

function updateProfileUI() {
    const avatarEls = [$('profileAvatarLarge')];
    const previewEl = $('profileEditAvatarPreview');
    const nameEl = $('profileName');

    const updateAvatar = (el) => {
        if (!el) return;
        if (state.profile.image) {
            el.style.backgroundImage = `url(${state.profile.image})`;
            el.textContent = '';
            el.style.backgroundColor = 'transparent';
        } else {
            el.style.backgroundImage = 'none';
            el.style.backgroundColor = state.profile.color;
            el.textContent = state.profile.name.charAt(0).toUpperCase() || 'M';
        }
    };

    avatarEls.forEach(updateAvatar);
    if (previewEl) {
        if (state.profileEditImage) {
            previewEl.style.backgroundImage = `url(${state.profileEditImage})`;
            previewEl.textContent = '';
            previewEl.style.backgroundColor = 'transparent';
        } else {
            previewEl.style.backgroundImage = 'none';
            previewEl.style.backgroundColor = state.profileEditColor;
            previewEl.textContent = ($('profileNameInput')?.value.charAt(0).toUpperCase()) || 'M';
        }
    }

    if (nameEl) nameEl.textContent = state.profile.name;
    renderProfileList();
}

function renderProfileList() {
    const list = $('profileList');
    if (!list) return;
    
    const checkSvg = `<svg class="profile-member-check" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
    
    let html = '';
    state.profiles.forEach(p => {
        const isActive = p.id === state.activeProfileId;
        const avatarStyle = p.image 
            ? `background-image: url(${p.image}); background-color: transparent;` 
            : `background-color: ${p.color};`;
        const initial = p.image ? '' : (p.name.charAt(0).toUpperCase() || '?');
        html += `
            <div class="profile-member-card ${isActive ? 'active' : ''}" data-id="${p.id}">
                <div class="profile-member-avatar" style="${avatarStyle}">${initial}</div>
                <div class="profile-member-info">
                    <div class="profile-member-name">${p.name}</div>
                    <div class="profile-member-role">${isActive ? 'Aktiv' : 'Tippen zum Wechseln'}</div>
                </div>
                ${checkSvg}
            </div>
        `;
    });
    
    html += `
        <div class="profile-add-btn" id="addProfileBtn">
            <div class="profile-add-btn-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </div>
            Profil hinzufügen
        </div>
    `;
    list.innerHTML = html;
    
    $$('.profile-member-card[data-id]').forEach(item => {
        item.addEventListener('click', () => {
            state.activeProfileId = item.dataset.id;
            saveProfile();
        });
    });
    
    $('addProfileBtn')?.addEventListener('click', () => {
        const newId = Date.now().toString();
        state.profiles.push({
            id: newId,
            name: 'Neuer Nutzer',
            color: '#007AFF',
            image: ''
        });
        state.activeProfileId = newId;
        saveProfile();
        $('editProfileBtn')?.click();
    });
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
function renderEventIndicator(evts) {
    if (!evts.length) return '';
    const bars = evts.slice(0, 3).map(e =>
        `<div class="cal-day-bar" style="background:${e.color}"></div>`
    ).join('');
    const badge = evts.length >= 3
        ? `<div class="cal-day-badge">${evts.length}</div>`
        : '';
    return `<div class="cal-day-events">${bars}</div>${badge}`;
}

function renderCalendar() {
    const view = state.currentView;
    els.calGrid.className = `calendar-grid view-${view}`;
    
    // Hide standard day names header if not in month view
    const dayNamesHeader = document.querySelector('.calendar-day-names');
    if (dayNamesHeader) {
        dayNamesHeader.style.display = view === 'month' ? 'grid' : 'none';
    }

    if (view === 'month') renderMonthView();
    else if (view === 'week') renderWeekView();
    else renderDayView();
}

function renderMonthView() {
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
    for (let i = startDay - 1; i >= 0; i--) {
        const d = daysInPrev - i;
        const date = new Date(year, month - 1, d);
        const evts = getEventsForDate(date);
        html += `<div class="cal-day other-month" data-date="${formatDate(date)}">
            <span>${d}</span>${renderEventIndicator(evts)}
        </div>`;
    }

    for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(year, month, d);
        const isToday = sameDay(date, today);
        const isSelected = sameDay(date, state.selectedDate);
        const evts = getEventsForDate(date);
        const classes = ['cal-day'];
        if (isToday) classes.push('today');
        if (isSelected) classes.push('selected');
        html += `<div class="${classes.join(' ')}" data-date="${formatDate(date)}">
            <span>${d}</span>${renderEventIndicator(evts)}
        </div>`;
    }

    const totalCells = startDay + daysInMonth;
    const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
    for (let d = 1; d <= remaining; d++) {
        const date = new Date(year, month + 1, d);
        const evts = getEventsForDate(date);
        html += `<div class="cal-day other-month" data-date="${formatDate(date)}">
            <span>${d}</span>${renderEventIndicator(evts)}
        </div>`;
    }

    els.calGrid.innerHTML = html;
    attachDayEvents();
}

function renderWeekView() {
    const d = new Date(state.selectedDate);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
    const monday = new Date(d.setDate(diff));
    
    els.headerMonth.textContent = `Woche ${getWeekNumber(monday)}, ${MONTHS[monday.getMonth()]}`;
    
    let html = '<div class="week-timeline">';
    const today = new Date();
    
    for (let i = 0; i < 7; i++) {
        const date = new Date(monday);
        date.setDate(monday.getDate() + i);
        const isToday = sameDay(date, today);
        const isSelected = sameDay(date, state.selectedDate);
        const evts = getEventsForDate(date);
        
        html += `
            <div class="week-day-group ${isSelected ? 'selected' : ''}" data-date="${formatDate(date)}">
                <div class="week-day-sidebar">
                    <span class="week-day-name">${DAYS[date.getDay()].substring(0,2)}</span>
                    <span class="week-day-number ${isToday ? 'today' : ''}">${date.getDate()}</span>
                </div>
                <div class="week-day-content">
                    ${evts.length ? evts.map(ev => `
                        <div class="week-event-card">
                            <div class="week-event-color" style="background:${ev.color}"></div>
                            <div class="week-event-info">
                                <div class="week-event-title">${ev.title}</div>
                                <div class="week-event-time">${ev.startTime} – ${ev.endTime}</div>
                            </div>
                        </div>
                    `).join('') : '<div class="week-empty-state">Keine Termine</div>'}
                </div>
            </div>
        `;
    }
    html += '</div>';
    els.calGrid.innerHTML = html;
    
    $$('.week-day-group').forEach(group => {
        group.addEventListener('click', () => {
            const parts = group.dataset.date.split('-');
            state.selectedDate = new Date(parts[0], parts[1] - 1, parts[2]);
            renderCalendar();
            openDayDetail();
        });
    });
}

function getWeekNumber(d) {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
}

function renderDayView() {
    const d = state.selectedDate;
    els.headerMonth.textContent = `${d.getDate()}. ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    
    const events = getEventsForDate(d);
    let html = `
        <div class="day-view-container">
            <div class="day-view-header">
                <div class="day-view-big-date">${d.getDate()}</div>
                <div class="day-view-day-name">${DAYS[d.getDay()]}</div>
            </div>
            <div class="day-view-list">
                ${events.length ? events.map(ev => `
                    <div class="event-card">
                        <div class="event-color-bar" style="background:${ev.color}"></div>
                        <div class="event-card-content">
                            <div class="event-card-title">${ev.title}</div>
                            <div class="event-card-time">${ev.startTime} – ${ev.endTime}</div>
                        </div>
                    </div>
                `).join('') : '<div class="empty-state"><p>Keine Termine</p></div>'}
            </div>
        </div>
    `;
    els.calGrid.innerHTML = html;
}

function attachDayEvents() {
    $$('.cal-day').forEach(day => {
        day.addEventListener('click', () => {
            const parts = day.dataset.date.split('-');
            state.selectedDate = new Date(parts[0], parts[1] - 1, parts[2]);
            if (state.currentView === 'month' && state.selectedDate.getMonth() !== state.currentDate.getMonth()) {
                state.currentDate = new Date(state.selectedDate);
            }
            renderCalendar();
            if (state.currentView === 'month') openDayDetail();
        });
    });
}

// ===== CALENDAR SWIPE NAVIGATION =====
let touchStartX = 0;
let touchStartY = 0;

els.calGrid.addEventListener('touchstart', e => {
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
}, { passive: true });

els.calGrid.addEventListener('touchend', e => {
    const touchEndX = e.changedTouches[0].screenX;
    const touchEndY = e.changedTouches[0].screenY;
    
    const diffX = touchEndX - touchStartX;
    const diffY = touchEndY - touchStartY;
    
    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 40) {
        changeMonth(diffX > 0 ? -1 : 1);
    }
}, { passive: true });

function changeMonth(direction) {
    els.calGrid.style.transition = 'transform 0.2s ease, opacity 0.2s ease';
    els.calGrid.style.transform = `translateX(${direction > 0 ? '-30px' : '30px'})`;
    els.calGrid.style.opacity = '0';
    
    setTimeout(() => {
        state.currentDate.setMonth(state.currentDate.getMonth() + direction);
        renderCalendar();
        
        els.calGrid.style.transition = 'none';
        els.calGrid.style.transform = `translateX(${direction > 0 ? '30px' : '-30px'})`;
        els.calGrid.offsetHeight; // force reflow
        
        els.calGrid.style.transition = 'transform 0.35s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.35s ease';
        els.calGrid.style.transform = 'translateX(0)';
        els.calGrid.style.opacity = '1';
    }, 200);
}

// ===== DAY DETAIL SHEET =====
function openDayDetail() {
    const d = state.selectedDate;
    const today = new Date();
    const isToday = sameDay(d, today);
    const dayName = isToday ? 'Heute' : DAYS[d.getDay()];
    $('dayDetailTitle').textContent = `${dayName}, ${d.getDate()}. ${MONTHS_SHORT[d.getMonth()]}`;

    const events = getEventsForDate(d);
    $('dayDetailCount').textContent = `${events.length} Termin${events.length !== 1 ? 'e' : ''}`;

    const list = $('dayDetailList');
    if (events.length === 0) {
        list.innerHTML = `<div class="empty-state"><p>Keine Termine</p><span>Tippe unten um einen Termin zu erstellen</span></div>`;
    } else {
        events.sort((a, b) => a.startTime.localeCompare(b.startTime));
        list.innerHTML = events.map((ev, i) => `
            <div class="event-card" style="animation-delay:${i * 0.05}s">
                <div class="event-color-bar" style="background:${ev.color}"></div>
                <div class="event-card-content">
                    <div class="event-card-title">${ev.title}</div>
                    <div class="event-card-time">${ev.startTime} – ${ev.endTime}</div>
                </div>
                <button class="event-card-delete" data-id="${ev.id}">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
            </div>`).join('');

        list.querySelectorAll('.event-card-delete').forEach(btn => {
            btn.addEventListener('click', e => {
                e.stopPropagation();
                state.events = state.events.filter(ev => ev.id !== btn.dataset.id);
                saveEvents();
                renderCalendar();
                openDayDetail();
            });
        });
    }
    $('dayDetailOverlay').classList.add('open');
}

function closeDayDetail() {
    $('dayDetailOverlay').classList.remove('open');
}

$('dayDetailOverlay').addEventListener('click', e => {
    if (e.target === $('dayDetailOverlay')) closeDayDetail();
});

$('dayDetailAddBtn').addEventListener('click', () => {
    closeDayDetail();
    openModal();
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
        renderCalendar();
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

$('addEventBtn')?.addEventListener('click', openModal);
$('modalCancelBtn')?.addEventListener('click', closeModal);
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
        notes: els.eventNotes.value.trim(),
        profileId: state.activeProfileId
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

    const results = state.events.filter(e => {
        if (!isEventForActiveProfile(e)) return false;
        return e.title.toLowerCase().includes(q) || (e.notes && e.notes.toLowerCase().includes(q));
    });

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
    if (els.statEvents) {
        els.statEvents.textContent = state.events.filter(isEventForActiveProfile).length;
    }
}

// ===== TOGGLES =====
$('toggleNotifications')?.addEventListener('click', function() {
    this.classList.toggle('active');
});
$('toggleDarkMode')?.addEventListener('click', function() {
    this.classList.toggle('active');
    const isDark = this.classList.contains('active');
    document.body.classList.toggle('light-mode', !isDark);
    localStorage.setItem('muzi_dark_mode', isDark);
});


// ===== PROFILE EDIT MODAL =====
const profileModalOverlay = $('profileModalOverlay');
const profileImageInput = $('profileImageInput');
const profileNameInput = $('profileNameInput');

$('editProfileBtn')?.addEventListener('click', () => {
    state.profileEditColor = state.profile.color;
    state.profileEditImage = state.profile.image;
    profileNameInput.value = state.profile.name;
    
    $$('#profileColorPicker .color-dot').forEach(d => {
        d.classList.toggle('active', d.dataset.color === state.profileEditColor);
    });

    $('profileImageRemoveBtn').style.display = state.profileEditImage ? 'inline-block' : 'none';
    updateProfileUI();
    profileModalOverlay.classList.add('open');
});

$('profileModalCancelBtn')?.addEventListener('click', () => {
    profileModalOverlay.classList.remove('open');
});

$('profileModalSaveBtn')?.addEventListener('click', () => {
    state.profile.name = profileNameInput.value.trim() || 'Nutzer';
    state.profile.color = state.profileEditColor;
    state.profile.image = state.profileEditImage;
    saveProfile();
    profileModalOverlay.classList.remove('open');
});

$('deleteProfileBtn')?.addEventListener('click', () => {
    if (state.profiles.length <= 1) {
        alert('Du musst mindestens ein Profil behalten.');
        return;
    }
    state.profiles = state.profiles.filter(p => p.id !== state.activeProfileId);
    state.activeProfileId = state.profiles[0].id;
    saveProfile();
    profileModalOverlay.classList.remove('open');
});

profileModalOverlay?.addEventListener('click', e => {
    if (e.target === profileModalOverlay) profileModalOverlay.classList.remove('open');
});

$$('#profileColorPicker .color-dot').forEach(dot => {
    dot.addEventListener('click', () => {
        state.profileEditColor = dot.dataset.color;
        $$('#profileColorPicker .color-dot').forEach(d => d.classList.remove('active'));
        dot.classList.add('active');
        updateProfileUI();
    });
});

profileImageInput?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const size = Math.min(img.width, img.height);
                const sx = (img.width - size) / 2;
                const sy = (img.height - size) / 2;
                
                canvas.width = 150;
                canvas.height = 150;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, sx, sy, size, size, 0, 0, 150, 150);
                
                state.profileEditImage = canvas.toDataURL('image/jpeg', 0.8);
                $('profileImageRemoveBtn').style.display = 'inline-block';
                updateProfileUI();
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    }
});

$('profileImageRemoveBtn')?.addEventListener('click', () => {
    state.profileEditImage = '';
    $('profileImageRemoveBtn').style.display = 'none';
    profileImageInput.value = '';
    updateProfileUI();
});

profileNameInput?.addEventListener('input', updateProfileUI);

// ===== INIT =====
function init() {
    // Migrate old single-profile data to multi-profile
    const oldProfile = localStorage.getItem('muzi_profile');
    if (oldProfile && !localStorage.getItem('muzi_profiles')) {
        try {
            const p = JSON.parse(oldProfile);
            p.id = p.id || '1';
            state.profiles = [p];
            state.activeProfileId = p.id;
            saveProfile();
            localStorage.removeItem('muzi_profile');
        } catch(e) {}
    }

    // Restore dark mode
    const isDark = localStorage.getItem('muzi_dark_mode') !== 'false';
    const darkToggle = $('toggleDarkMode');
    if (darkToggle) {
        darkToggle.classList.toggle('active', isDark);
    }
    document.body.classList.toggle('light-mode', !isDark);

    // Restore profile edit colors from active profile
    state.profileEditColor = state.profile.color;
    state.profileEditImage = state.profile.image;

    renderCalendar();
    updateStats();
    updateProfileUI();
    // Hide AI input bar initially
    const aiBar = document.querySelector('.ai-input-bar');
    if (aiBar) aiBar.style.display = 'none';

    if (!localStorage.getItem('muzi_first_open_done_v2')) {
        const onboardingOverlay = $('onboardingOverlay');
        if (onboardingOverlay) {
            onboardingOverlay.classList.add('open');
            setTimeout(() => {
                const nameInput = $('onboardingNameInput');
                if (nameInput) nameInput.focus();
            }, 400);
        }
    }
}

init();

// ===== ONBOARDING =====
let onboardingColor = '#34C759';
let onboardingImage = '';

function updateOnboardingPreview() {
    const preview = $('onboardingAvatarPreview');
    if (!preview) return;
    if (onboardingImage) {
        preview.style.backgroundImage = `url(${onboardingImage})`;
        preview.textContent = '';
        preview.style.backgroundColor = 'transparent';
    } else {
        preview.style.backgroundImage = 'none';
        preview.style.backgroundColor = onboardingColor;
        preview.textContent = ($('onboardingNameInput')?.value.trim().charAt(0).toUpperCase()) || 'M';
    }
}

$('onboardingNameInput')?.addEventListener('input', updateOnboardingPreview);

$$('#onboardingColorPicker .color-dot').forEach(dot => {
    dot.addEventListener('click', () => {
        onboardingColor = dot.dataset.color;
        $$('#onboardingColorPicker .color-dot').forEach(d => d.classList.remove('active'));
        dot.classList.add('active');
        updateOnboardingPreview();
    });
});

$('onboardingImageInput')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const size = Math.min(img.width, img.height);
                const sx = (img.width - size) / 2;
                const sy = (img.height - size) / 2;
                
                canvas.width = 150;
                canvas.height = 150;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, sx, sy, size, size, 0, 0, 150, 150);
                
                onboardingImage = canvas.toDataURL('image/jpeg', 0.8);
                $('onboardingImageRemoveBtn').style.display = 'inline-block';
                updateOnboardingPreview();
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    }
});

$('onboardingImageRemoveBtn')?.addEventListener('click', () => {
    onboardingImage = '';
    $('onboardingImageRemoveBtn').style.display = 'none';
    if ($('onboardingImageInput')) $('onboardingImageInput').value = '';
    updateOnboardingPreview();
});

$('onboardingSaveBtn')?.addEventListener('click', () => {
    const name = $('onboardingNameInput').value.trim() || 'Nutzer';
    if (state.profiles && state.profiles.length > 0) {
        state.profiles[0].name = name;
        state.profiles[0].color = onboardingColor;
        state.profiles[0].image = onboardingImage;
        saveProfile();
    }
    localStorage.setItem('muzi_first_open_done_v2', 'true');
    $('onboardingOverlay').classList.remove('open');
});
