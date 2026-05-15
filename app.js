// ========== MUZI KALENDER – App Logic ==========

// ===== STATE =====
const state = {
    currentDate: new Date(),
    selectedDate: new Date(),
    currentView: 'month',
    currentPage: 'pageCalendar',
    events: JSON.parse(localStorage.getItem('muzi_events') || '[]'),
    profiles: JSON.parse(localStorage.getItem('muzi_profiles_v3') || '[{"id":"1","name":"Muzi Nutzer","color":"#34C759","image":""}]'),
    activeProfileId: localStorage.getItem('muzi_active_profile_v3') || '1',
    selectedColor: '#FFFFFF',
    profileEditColor: '#34C759',
    profileEditImage: '',
    // Settings
    sharedView: JSON.parse(localStorage.getItem('muzi_shared_view') || 'false'),
    colorBinding: JSON.parse(localStorage.getItem('muzi_color_binding') || 'true'),
    visibleProfileIds: JSON.parse(localStorage.getItem('muzi_visible_profiles') || '[]'),
    editingProfileId: null, // target for editing in modal
    // Design
    currentTheme: localStorage.getItem('muzi_theme') || 'default',
    // Event modal state
    eventProfileId: null,  // which profile to assign a new event to
    eventUrgency: 100,
    get profile() { return this.profiles.find(p => p.id === (this.editingProfileId || this.activeProfileId)) || this.profiles[0]; }
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
    if (state.sharedView) {
        return state.events.filter(e => {
            if (e.date !== ds) return false;
            // Always show active profile events
            if (isEventForActiveProfile(e)) return true;
            // Show others if selected
            return state.visibleProfileIds.includes(String(e.profileId));
        });
    }
    return state.events.filter(e => e.date === ds && isEventForActiveProfile(e));
}

function getProfileById(id) {
    return state.profiles.find(p => String(p.id) === String(id)) || state.profiles[0];
}

function getEventDisplayColor(ev) {
    const profile = getProfileById(ev.profileId);
    const baseColor = state.colorBinding ? profile.color : (ev.color || profile.color);
    const urgency = ev.urgency != null ? ev.urgency : 100;
    
    // Krasser Unterschied für Dringlichkeit
    const opacity = Math.max(0.15, urgency / 100);
    const barWidth = '85%';
    const isImportant = urgency >= 80;
    const glow = isImportant ? `box-shadow: 0 0 8px ${hexToRgba(baseColor, 0.6)};` : '';
    
    return { 
        color: baseColor, 
        opacity, 
        width: barWidth,
        glow,
        initial: profile.name.charAt(0).toUpperCase() || '?', 
        profileColor: profile.color,
        urgency
    };
}

function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1,3), 16);
    const g = parseInt(hex.slice(3,5), 16);
    const b = parseInt(hex.slice(5,7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
}

function saveEvents() {
    localStorage.setItem('muzi_events', JSON.stringify(state.events));
    updateStats();
}

function saveProfile() {
    try {
        localStorage.setItem('muzi_profiles_v3', JSON.stringify(state.profiles));
        localStorage.setItem('muzi_active_profile_v3', state.activeProfileId);
    } catch (e) {
        console.error('Fehler beim Speichern des Profils:', e);
        alert('Speicherlimit erreicht! Bitte lösche einige Bilder oder verwende kleinere Bilder.');
    }
    updateProfileUI();
    renderCalendar();
    if (typeof renderSettingsProfileList === 'function') renderSettingsProfileList();
}

function updateProfileUI() {
    // Set global accent color based on active profile
    document.documentElement.style.setProperty('--profile-accent', state.profile.color);
    document.documentElement.style.setProperty('--profile-accent-glow', hexToRgba(state.profile.color, 0.4));

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
                <button class="profile-transfer-btn" data-id="${p.id}" title="Kalenderdaten übertragen">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 2.1l4 4-4 4"/><path d="M3 12.2v-2a4 4 0 0 1 4-4h12.8M7 21.9l-4-4 4-4"/><path d="M21 11.8v2a4 4 0 0 1-4 4H4.2"/></svg>
                </button>
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
    
    $$('.profile-member-card').forEach(item => {
        item.addEventListener('click', (e) => {
            // Don't switch if transfer button was clicked
            if (e.target.closest('.profile-transfer-btn')) return;
            
            const id = item.dataset.id;
            if (id) {
                state.activeProfileId = id;
                saveProfile();
            }
        });
    });

    $$('.profile-transfer-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            openPrivacyModal(btn.dataset.id);
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
['menuBtn','menuBtnProfile','menuBtnSearch','menuBtnSettings'].forEach(id => {
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
        else if (page === 'notes') switchPage('pageNotes');
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
}

$$('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => switchPage(btn.dataset.page));
});

// ===== CALENDAR RENDERING =====
function renderEventIndicator(evts) {
    if (!evts.length) return '';
    const bars = evts.slice(0, 3).map(e => {
        const d = getEventDisplayColor(e);
        const bgColor = hexToRgba(d.color, d.opacity);
        return `<div class="cal-day-bar" style="background:${bgColor}; width:${d.width}; ${d.glow}"></div>`;
    }).join('');
    const badge = evts.length >= 3
        ? `<div class="cal-day-badge">${evts.length}</div>`
        : '';
    // Show initials if shared view is on
    const initials = state.sharedView && evts.length <= 3
        ? evts.slice(0, 3).map(e => {
            const d = getEventDisplayColor(e);
            return `<span class="event-initial-badge" style="background:${d.profileColor}">${d.initial}</span>`;
        }).join('')
        : '';
    return `<div class="cal-day-events" style="align-items:center;">${bars}</div>${initials ? `<div class="cal-day-events" style="flex-direction:row;gap:2px;justify-content:center;bottom:auto;top:2px">${initials}</div>` : ''}${badge}`;
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
                    ${evts.length ? evts.map(ev => {
                        const d = getEventDisplayColor(ev);
                        const barColor = hexToRgba(d.color, d.opacity);
                        return `
                        <div class="week-event-card">
                            <span class="event-initial-badge" style="background:${d.profileColor}">${d.initial}</span>
                            <div class="week-event-color" style="background:${barColor}; ${d.glow}"></div>
                            <div class="week-event-info" style="opacity:${Math.max(0.4, ev.urgency / 100)}">
                                <div class="week-event-title">${ev.title}</div>
                                <div class="week-event-time">${ev.startTime} – ${ev.endTime}</div>
                            </div>
                        </div>`;
                    }).join('') : '<div class="week-empty-state">Keine Termine</div>'}
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
                ${events.length ? events.map(ev => {
                    const dc = getEventDisplayColor(ev);
                    const barColor = hexToRgba(dc.color, dc.opacity);
                    return `
                    <div class="event-card">
                        <span class="event-initial-badge" style="background:${dc.profileColor}">${dc.initial}</span>
                        <div class="event-color-bar" style="background:${barColor}; ${dc.glow}"></div>
                        <div class="event-card-content" style="opacity:${Math.max(0.4, ev.urgency / 100)}">
                            <div class="event-card-title">${ev.title}</div>
                            <div class="event-card-time">${ev.startTime} – ${ev.endTime}</div>
                        </div>
                    </div>`;
                }).join('') : '<div class="empty-state"><p>Keine Termine</p></div>'}
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
    els.calGrid.style.transition = 'transform 0.15s linear, opacity 0.15s linear';
    els.calGrid.style.transform = `translateX(${direction > 0 ? '-20px' : '20px'})`;
    els.calGrid.style.opacity = '0';
    
    setTimeout(() => {
        state.currentDate.setMonth(state.currentDate.getMonth() + direction);
        renderCalendar();
        
        els.calGrid.style.transition = 'none';
        els.calGrid.style.transform = `translateX(${direction > 0 ? '20px' : '-20px'})`;
        els.calGrid.offsetHeight; // force reflow
        
        els.calGrid.style.transition = 'transform 0.15s linear, opacity 0.15s linear';
        els.calGrid.style.transform = 'translateX(0)';
        els.calGrid.style.opacity = '1';
    }, 150);
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
        list.innerHTML = events.map((ev, i) => {
            const d = getEventDisplayColor(ev);
            const barColor = hexToRgba(d.color, d.opacity);
            return `
            <div class="event-card" style="animation-delay:${i * 0.05}s">
                <span class="event-initial-badge" style="background:${d.profileColor}">${d.initial}</span>
                <div class="event-color-bar" style="background:${barColor}; ${d.glow}"></div>
                <div class="event-card-content" style="opacity:${Math.max(0.4, ev.urgency / 100)}">
                    <div class="event-card-title">${ev.title}</div>
                    <div class="event-card-time">${ev.startTime} – ${ev.endTime}</div>
                </div>
                <button class="event-card-delete" data-id="${ev.id}">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
            </div>`;
        }).join('');

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
function renderEventProfileSelector() {
    const container = $('eventProfileSelector');
    if (!container) return;
    container.innerHTML = state.profiles.map(p => {
        const isActive = p.id === state.eventProfileId;
        const avatarStyle = p.image
            ? `background-image:url(${p.image});background-size:cover;background-position:center;`
            : `background-color:${p.color};`;
        const initial = p.image ? '' : (p.name.charAt(0).toUpperCase() || '?');
        return `<div class="profile-selector-item ${isActive ? 'active' : ''}" data-profile-id="${p.id}" style="${avatarStyle}">${initial}</div>`;
    }).join('');

    container.querySelectorAll('.profile-selector-item').forEach(item => {
        item.addEventListener('click', () => {
            state.eventProfileId = item.dataset.profileId;
            container.querySelectorAll('.profile-selector-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            // If color binding is on, auto-select the profile's color
            if (state.colorBinding) {
                const profile = getProfileById(state.eventProfileId);
                state.selectedColor = profile.color;
            }
        });
    });
}

function openModal() {
    els.modalOverlay.classList.add('open');
    els.eventTitle.value = '';
    els.eventDate.value = formatDate(state.selectedDate);
    els.eventStart.value = '09:00';
    els.eventEnd.value = '10:00';
    els.eventNotes.value = '';
    state.eventProfileId = state.activeProfileId;
    state.eventUrgency = 100;
    state.selectedColor = state.colorBinding ? state.profile.color : '#FFFFFF';

    // Render profile selector
    renderEventProfileSelector();

    // Setup urgency slider
    const urgSlider = $('eventUrgency');
    const urgValue = $('urgencyValue');
    if (urgSlider) {
        urgSlider.value = 100;
        urgValue.textContent = '100%';
    }

    // Show/hide free color picker based on color binding setting
    const freeColorGroup = $('freeColorGroup');
    if (freeColorGroup) {
        freeColorGroup.style.display = state.colorBinding ? 'none' : 'block';
    }

    $$('#colorPicker .color-dot').forEach(d => d.classList.toggle('active', d.dataset.color === state.selectedColor));
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

// Color picker (free color group)
$$('#colorPicker .color-dot').forEach(dot => {
    dot.addEventListener('click', () => {
        state.selectedColor = dot.dataset.color;
        $$('#colorPicker .color-dot').forEach(d => d.classList.remove('active'));
        dot.classList.add('active');
    });
});

// Urgency slider
$('eventUrgency')?.addEventListener('input', function() {
    state.eventUrgency = parseInt(this.value);
    $('urgencyValue').textContent = this.value + '%';
});

// Save event
$('modalSaveBtn').addEventListener('click', () => {
    const title = els.eventTitle.value.trim();
    if (!title) { els.eventTitle.focus(); return; }

    const assignedProfile = getProfileById(state.eventProfileId);
    const finalColor = state.colorBinding ? assignedProfile.color : state.selectedColor;

    const event = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2),
        title,
        date: els.eventDate.value,
        startTime: els.eventStart.value,
        endTime: els.eventEnd.value,
        color: finalColor,
        urgency: state.eventUrgency,
        notes: els.eventNotes.value.trim(),
        profileId: state.eventProfileId
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
function updateToggleVisuals(el) {
    if (!el) return;
    const isActive = el.classList.contains('active');
    el.closest('.profile-option')?.classList.toggle('checked', isActive);
}

$('toggleNotifications')?.addEventListener('click', function() {
    this.classList.toggle('active');
    updateToggleVisuals(this);
});
$('toggleDarkMode')?.addEventListener('click', function() {
    this.classList.toggle('active');
    updateToggleVisuals(this);
    const isDark = this.classList.contains('active');
    document.body.classList.toggle('light-mode', !isDark);
    localStorage.setItem('muzi_dark_mode', isDark);
});

// Accent Color Theme
function applyTheme(theme) {
    state.currentTheme = theme;
    document.body.classList.forEach(cls => {
        if (cls.startsWith('theme-')) document.body.classList.remove(cls);
    });
    if (theme !== 'default') {
        document.body.classList.add(`theme-${theme}`);
    }
    $$('#accentPicker .accent-dot').forEach(dot => {
        dot.classList.toggle('active', dot.dataset.theme === theme);
    });
    localStorage.setItem('muzi_theme', theme);
}

$$('#accentPicker .accent-dot').forEach(dot => {
    dot.addEventListener('click', () => {
        applyTheme(dot.dataset.theme);
    });
});

// Shared View toggle
$('toggleSharedView')?.addEventListener('click', function() {
    this.classList.toggle('active');
    updateToggleVisuals(this);
    state.sharedView = this.classList.contains('active');
    localStorage.setItem('muzi_shared_view', JSON.stringify(state.sharedView));
    renderCalendar();
});

// Color Binding toggle
$('toggleColorBinding')?.addEventListener('click', function() {
    this.classList.toggle('active');
    updateToggleVisuals(this);
    state.colorBinding = this.classList.contains('active');
    localStorage.setItem('muzi_color_binding', JSON.stringify(state.colorBinding));
    renderCalendar();
});

// ===== SETTINGS PROFILE LIST =====
function renderSettingsProfileList() {
    const list = $('settingsProfileList');
    if (!list) return;

    list.innerHTML = state.profiles.map(p => {
        const avatarStyle = p.image
            ? `background-image:url(${p.image});background-size:cover;background-position:center;`
            : `background-color:${p.color};`;
        const initial = p.image ? '' : (p.name.charAt(0).toUpperCase() || '?');
        const isVisible = state.visibleProfileIds.includes(String(p.id));
        const isCurrent = String(p.id) === String(state.activeProfileId);

        return `
        <div class="settings-profile-item" data-edit-profile-id="${p.id}">
            <div class="settings-profile-avatar" style="${avatarStyle}">${initial}</div>
            <div class="settings-profile-info">
                <div class="settings-profile-name">${p.name}${isCurrent ? ' (Ich)' : ''}</div>
                <div class="settings-profile-color-hint">
                    <span class="settings-profile-color-dot" style="background:${p.color}"></span>
                    ${p.color}
                </div>
            </div>
            <div class="settings-profile-actions">
                ${!isCurrent ? `
                <div class="toggle-switch mini ${isVisible ? 'active' : ''}" data-toggle-visibility-id="${p.id}" title="Termine anzeigen">
                    <div class="toggle-knob"></div>
                </div>
                ` : ''}
                <svg class="settings-profile-edit-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.4"><polyline points="9 18 15 12 9 6"/></svg>
            </div>
        </div>`;
    }).join('');

    list.querySelectorAll('.settings-profile-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (e.target.closest('.toggle-switch.mini')) return;
            const profileId = item.dataset.editProfileId;
            state.editingProfileId = profileId;
            const p = getProfileById(profileId);
            state.profileEditColor = p.color;
            state.profileEditImage = p.image;
            $('profileNameInput').value = p.name;
            $('profileImageRemoveBtn').style.display = p.image ? 'inline-block' : 'none';
            updateProfileUI();
            $('profileModalOverlay').classList.add('open');
        });
    });

    list.querySelectorAll('[data-toggle-visibility-id]').forEach(toggle => {
        toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = String(toggle.dataset.toggleVisibilityId);
            toggle.classList.toggle('active');
            if (toggle.classList.contains('active')) {
                if (!state.visibleProfileIds.includes(id)) {
                    state.visibleProfileIds.push(id);
                }
            } else {
                state.visibleProfileIds = state.visibleProfileIds.filter(vid => vid !== id);
            }
            localStorage.setItem('muzi_visible_profiles', JSON.stringify(state.visibleProfileIds));
            renderCalendar();
        });
    });
}

// ===== PROFILE EDIT MODAL =====
const profileModalOverlay = $('profileModalOverlay');
const profileImageInput = $('profileImageInput');
const profileNameInput = $('profileNameInput');

$('editProfileBtn')?.addEventListener('click', () => {
    state.editingProfileId = null;
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
    const target = state.profile;
    target.name = profileNameInput.value.trim() || 'Nutzer';
    target.color = state.profileEditColor;
    target.image = state.profileEditImage;
    saveProfile();
    state.editingProfileId = null;
    profileModalOverlay.classList.remove('open');
});

$('deleteProfileBtn')?.addEventListener('click', () => {
    const targetId = state.editingProfileId || state.activeProfileId;
    if (state.profiles.length <= 1) {
        alert('Du musst mindestens ein Profil behalten.');
        return;
    }
    state.profiles = state.profiles.filter(p => p.id !== targetId);
    if (state.activeProfileId === targetId) {
        state.activeProfileId = state.profiles[0].id;
    }
    saveProfile();
    state.editingProfileId = null;
    profileModalOverlay.classList.remove('open');
});

profileModalOverlay?.addEventListener('click', e => {
    if (e.target === profileModalOverlay) {
        state.editingProfileId = null;
        profileModalOverlay.classList.remove('open');
    }
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

    const isDark = localStorage.getItem('muzi_dark_mode') !== 'false';
    const darkToggle = $('toggleDarkMode');
    if (darkToggle) darkToggle.classList.toggle('active', isDark);
    document.body.classList.toggle('light-mode', !isDark);

    applyTheme(state.currentTheme);
    state.profileEditColor = state.profile.color;
    state.profileEditImage = state.profile.image;

    const sharedViewToggle = $('toggleSharedView');
    if (sharedViewToggle) sharedViewToggle.classList.toggle('active', state.sharedView);
    const colorBindingToggle = $('toggleColorBinding');
    if (colorBindingToggle) colorBindingToggle.classList.toggle('active', state.colorBinding);

    renderCalendar();
    updateStats();
    updateProfileUI();
    renderSettingsProfileList();
    $$('.toggle-switch').forEach(updateToggleVisuals);

    // Google Sync Status
    const googleToken = localStorage.getItem('muzi_google_token');
    const googleExpiry = localStorage.getItem('muzi_google_token_expiry');
    if (googleToken && googleExpiry && Date.now() < parseInt(googleExpiry)) {
        const btn = $('googleSyncBtn');
        if (btn) {
            btn.textContent = 'Verbunden';
            btn.classList.add('connected');
        }
    }

    if (!localStorage.getItem('muzi_first_open_done_v3')) {
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

// ===== GOOGLE CALENDAR SYNC =====
const GOOGLE_CLIENT_ID = '609973725824-r3laiud55hlke4tr82d6rkg7n2le2893.apps.googleusercontent.com';
const GOOGLE_SCOPES = 'https://www.googleapis.com/auth/calendar.events.readonly';

let tokenClient;
let gapiInited = false;
let gisInited = false;

function initGoogleSDK() {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: GOOGLE_SCOPES,
        callback: (tokenResponse) => {
            if (tokenResponse && tokenResponse.access_token) {
                localStorage.setItem('muzi_google_token', tokenResponse.access_token);
                localStorage.setItem('muzi_google_token_expiry', Date.now() + (tokenResponse.expires_in * 1000));
                handleGoogleSync();
            }
        },
    });
    gisInited = true;
}

// Load SDK on window load
window.addEventListener('load', () => {
    // GIS SDK is loaded via script tag in index.html
    // We wait a bit to ensure 'google' object is available
    const checkGIS = setInterval(() => {
        if (typeof google !== 'undefined') {
            clearInterval(checkGIS);
            initGoogleSDK();
        }
    }, 100);
});

async function handleGoogleSync() {
    const token = localStorage.getItem('muzi_google_token');
    const expiry = localStorage.getItem('muzi_google_token_expiry');
    
    if (!token || (expiry && Date.now() > expiry)) {
        tokenClient.requestAccessToken({ prompt: 'consent' });
        return;
    }

    const btn = $('googleSyncBtn');
    if (btn) {
        btn.textContent = 'Synchronisiere...';
        btn.disabled = true;
    }

    try {
        const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.status === 401) {
            // Token expired or invalid
            localStorage.removeItem('muzi_google_token');
            tokenClient.requestAccessToken();
            return;
        }

        const data = await response.json();
        if (data.items) {
            importGoogleEvents(data.items);
        }
        
        if (btn) {
            btn.textContent = 'Verbunden';
            btn.classList.add('connected');
            btn.disabled = false;
        }
    } catch (err) {
        console.error('Google Sync Error:', err);
        if (btn) {
            btn.textContent = 'Fehler';
            btn.disabled = false;
        }
    }
}

function importGoogleEvents(googleEvents) {
    let newEventsCount = 0;
    googleEvents.forEach(ge => {
        // Skip if already exists (simple ID check)
        if (state.events.some(e => e.googleId === ge.id)) return;

        const start = ge.start.dateTime || ge.start.date;
        const end = ge.end.dateTime || ge.end.date;
        
        if (!start) return;

        const startDate = new Date(start);
        const endDate = new Date(end || start);

        const newEvent = {
            id: 'google_' + ge.id,
            googleId: ge.id,
            title: ge.summary || 'Google Termin',
            date: formatDate(startDate),
            startTime: ge.start.dateTime ? startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : '00:00',
            endTime: ge.end.dateTime ? endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : '23:59',
            color: state.profile.color, // Default to current profile color
            urgency: 100,
            notes: ge.description || '',
            profileId: state.activeProfileId
        };

        state.events.push(newEvent);
        newEventsCount++;
    });

    if (newEventsCount > 0) {
        saveEvents();
        renderCalendar();
    }
}

$('googleSyncBtn')?.addEventListener('click', handleGoogleSync);

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
    localStorage.setItem('muzi_first_open_done_v3', 'true');
    localStorage.setItem('muzi_last_seen_version', APP_VERSION);
    $('onboardingOverlay').classList.remove('open');
});

// ===== WHAT'S NEW / CHANGELOG =====
const APP_VERSION = '1.4';

const CHANGELOG = [
    {
        version: '1.0',
        features: [
            {
                icon: '📅',
                title: 'Dein neuer Kalender',
                desc: 'Monats-, Wochen- und Tagesansicht mit elegantem Dark Mode. Wische nach links/rechts um zwischen Monaten zu navigieren.'
            },

            {
                icon: '🔍',
                title: 'Termin-Suche',
                desc: 'Durchsuche all deine Termine blitzschnell nach Titel oder Notizen.'
            }
        ]
    },
    {
        version: '1.1',
        features: [
            {
                icon: '👤',
                title: 'Profil-System',
                desc: 'Erstelle mehrere Profile für dich und deine Familie. Jedes Profil hat seinen eigenen Namen, Farbe und Avatar.'
            },
            {
                icon: '🎨',
                title: 'Personalisiertes Onboarding',
                desc: 'Beim ersten Start richtest du dein Profil mit Name, Farbe und optional einem Profilbild ein.'
            }
        ]
    },
    {
        version: '1.2',
        features: [
            {
                icon: '🎯',
                title: 'Termine zuweisen',
                desc: 'Weise Termine direkt einem Familienmitglied zu. Farbige Initialen zeigen sofort, wem ein Termin gehört.'
            },
            {
                icon: '🔥',
                title: 'Dringlichkeits-Stufen',
                desc: 'Neuer Slider beim Erstellen: 100% = fix & wichtig (volle Farbe), niedrigere Werte = flexibler Termin (blassere Farbe).'
            },
            {
                icon: '👨‍👩‍👧‍👦',
                title: 'Gemeinsame Ansicht',
                desc: 'In den Einstellungen aktivierbar – zeigt die Termine aller Profile gleichzeitig mit farbigen Initial-Badges.'
            },
            {
                icon: '🎨',
                title: 'Farb-Bindung',
                desc: 'Neuer Toggle: Termine nutzen automatisch die Profilfarbe. Oder deaktiviere ihn für völlig freie Farbwahl.'
            },
            {
                icon: '⚙️',
                title: 'Profile verwalten',
                desc: 'Alle Profile jetzt direkt in den Einstellungen bearbeitbar – Name, Farbe und Initialen jederzeit anpassen.'
            }
        ]
    },
    {
        version: '1.3',
        features: [
            {
                icon: '🔄',
                title: 'Profil-Reset',
                desc: 'Alle Profile wurden einmalig zurückgesetzt, um einen sauberen Start mit den neuen Funktionen zu ermöglichen.'
            },
            {
                icon: '👥',
                title: 'Verbesserte Ansicht',
                desc: 'Du kannst jetzt in den Einstellungen genau festlegen, ob du nur deine eigenen oder die Termine aller Familienmitglieder sehen möchtest.'
            }
        ]
    },
    {
        version: '1.4',
        features: [
            {
                icon: '🎨',
                title: 'Eigene Akzentfarben',
                desc: 'Wähle jetzt deine Lieblingsfarbe als Akzent für die gesamte App – Gelb, Orange, Rot, Blau oder Grün.'
            },
            {
                icon: '✨',
                title: 'Premium Design',
                desc: 'Verfeinerte Animationen und passend abgestimmte Farben für ein noch edleres Erlebnis.'
            }
        ]
    }
];

function showWhatsNew() {
    const lastSeen = localStorage.getItem('muzi_last_seen_version') || '0';
    if (!localStorage.getItem('muzi_first_open_done_v3')) return;
    if (lastSeen === APP_VERSION) return;

    const newFeatures = [];
    let latestVersion = APP_VERSION;
    CHANGELOG.forEach(entry => {
        if (entry.version > lastSeen) {
            entry.features.forEach(f => newFeatures.push(f));
            latestVersion = entry.version;
        }
    });

    if (newFeatures.length === 0) return;

    $('whatsNewVersion').textContent = 'v' + latestVersion;

    const content = $('whatsNewContent');
    content.innerHTML = newFeatures.map((f, i) => `
        <div class="whatsnew-item" style="animation-delay: ${0.1 + i * 0.08}s">
            <div class="whatsnew-item-icon">${f.icon}</div>
            <div class="whatsnew-item-text">
                <div class="whatsnew-item-title">${f.title}</div>
                <div class="whatsnew-item-desc">${f.desc}</div>
            </div>
        </div>
    `).join('');

    $('whatsNewOverlay').classList.add('open');
}

$('whatsNewDismissBtn')?.addEventListener('click', () => {
    localStorage.setItem('muzi_last_seen_version', APP_VERSION);
    $('whatsNewOverlay').classList.remove('open');
});

$('whatsNewOverlay')?.addEventListener('click', e => {
    if (e.target === $('whatsNewOverlay')) {
        localStorage.setItem('muzi_last_seen_version', APP_VERSION);
        $('whatsNewOverlay').classList.remove('open');
    }
});

setTimeout(showWhatsNew, 600);

// ===== PRIVACY & TRANSFER MODAL =====
function openPrivacyModal(profileId) {
    const overlay = $('privacyModalOverlay');
    const check1 = $('privacyCheck1');
    const check2 = $('privacyCheck2');
    const confirmBtn = $('privacyConfirmBtn');
    
    // Reset state
    check1.checked = false;
    check2.checked = false;
    confirmBtn.disabled = true;
    overlay.classList.add('open');
    
    const updateBtn = () => {
        confirmBtn.disabled = !(check1.checked && check2.checked);
    };
    
    check1.onclick = updateBtn;
    check2.onclick = updateBtn;
    
    confirmBtn.onclick = () => {
        const profile = getProfileById(profileId);
        overlay.classList.remove('open');
        
        // Show success message
        const successMsg = document.createElement('div');
        successMsg.style.cssText = `
            position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
            background: var(--accent); color: var(--bg);
            padding: 12px 24px; border-radius: 12px; font-weight: 600;
            z-index: 1000; animation: slideDown 0.3s ease forwards;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        `;
        successMsg.textContent = `Daten von "${profile.name}" erfolgreich übertragen!`;
        document.body.appendChild(successMsg);
        
        setTimeout(() => {
            successMsg.style.animation = 'slideUp 0.3s ease forwards';
            setTimeout(() => successMsg.remove(), 300);
        }, 3000);
    };
}

$('privacyModalOverlay')?.addEventListener('click', e => {
    if (e.target === $('privacyModalOverlay')) {
        $('privacyModalOverlay').classList.remove('open');
    }
});

// Animation for success message
const style = document.createElement('style');
style.textContent = `
    @keyframes slideDown {
        from { transform: translate(-50%, -100%); opacity: 0; }
        to { transform: translate(-50%, 0); opacity: 1; }
    }
    @keyframes slideUp {
        from { transform: translate(-50%, 0); opacity: 1; }
        to { transform: translate(-50%, -100%); opacity: 0; }
    }
`;
document.head.appendChild(style);

// Initialize app check (ensuring updateProfileUI is called if needed)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateProfileUI);
} else {
    updateProfileUI();
}

