/**
 * FARMLY — Poultry Farm Management System (Single Farm)
 * Simple, Spacious, Farmer-Friendly Logic & LocalStorage Persistence
 */

(function () {
  'use strict';

  // --- Storage Key & Today's Date ---
  const STORAGE_KEY = 'farmly-farm-v3';
  const TODAY_STR = new Date().toISOString().slice(0, 10);

  // --- Default Single Farm State ---
  const DEFAULT_FARM = {
    name: 'FARMLY Poultry Farm',
    manager: 'Abhinand Roney',
    location: 'Sector 3, Main Shed',
    breed: 'Lohmann Brown',
    ageWeeks: 28,
    birds: 500,
    capacity: 600,
    feedStock: 250,
    dailyFeedRate: 45,
    eggsToday: 320,
    eggDate: TODAY_STR,
    totalLosses: 2,
    lossesToday: 0,
    vaccines: [
      { id: 'v1', name: 'Newcastle Disease (ND Lasota)', target: 'Newcastle Virus', date: '2026-11-14', method: 'Drinking Water', status: 'Upcoming', notes: 'Administer in morning cool water' },
      { id: 'v2', name: 'IBD / Gumboro Booster', target: 'Gumboro Disease', date: '2026-10-22', method: 'Eye Drop', status: 'Completed', notes: 'Completed on schedule without issues' },
      { id: 'v3', name: 'Deworming (Piperazine)', target: 'Roundworms', date: '2026-11-04', method: 'Drinking Water', status: 'Completed', notes: 'All drinkers treated. Shed cleaned' }
    ],
    finances: [
      { id: 'f1', type: 'income', category: 'Egg Sales', amount: 240, date: '2026-11-08', note: '16 crates Grade A delivered to market' },
      { id: 'f2', type: 'expense', category: 'Feed Purchase', amount: 135, date: '2026-11-05', note: '3 bags Layer Mash (50kg each)' }
    ],
    eggHistory: [
      { date: '2026-11-03', count: 305, gradeA: 298, damaged: 7 },
      { date: '2026-11-04', count: 310, gradeA: 302, damaged: 8 },
      { date: '2026-11-05', count: 315, gradeA: 308, damaged: 7 },
      { date: '2026-11-06', count: 322, gradeA: 314, damaged: 8 },
      { date: '2026-11-07', count: 318, gradeA: 310, damaged: 8 },
      { date: '2026-11-08', count: 325, gradeA: 318, damaged: 7 },
      { date: TODAY_STR, count: 320, gradeA: 312, damaged: 8 }
    ],
    flockHistory: [
      { date: '2026-11-08T08:15:00Z', action: 'Mortality', qty: 1, reason: 'Natural / Unknown', note: 'Old cull bird found' },
      { date: '2026-10-15T09:00:00Z', action: 'Flock Addition', qty: 100, reason: 'Restock', note: 'Point-of-lay pullets arrived' }
    ],
    feedHistory: [
      { date: '2026-11-09T07:30:00Z', action: 'Feed Used', qty: 45, formula: 'Layer Mash', note: 'Daily feeding' },
      { date: '2026-11-05T14:00:00Z', action: 'Feed Added', qty: 150, formula: 'Layer Mash', note: 'Silo restock' }
    ],
    records: [
      { id: 'r1', title: 'Morning egg collection complete', detail: 'Gathered 320 eggs (312 Grade A). Clean shell quality.', type: 'egg', time: '2026-11-09T08:30:00Z' },
      { id: 'r2', title: 'Feed silo refilled', detail: 'Added 150 kg layer mash into silo feeders.', type: 'feed', time: '2026-11-05T14:00:00Z' },
      { id: 'r3', title: 'Cleaned drinker lines & fresh water checked', detail: 'Drinker cups flushed with clean water.', type: 'note', time: '2026-11-04T10:00:00Z' }
    ]
  };

  // --- Backend API Configuration ---
  const API_ROOT = (window.location.protocol === 'http:' || window.location.protocol === 'https:')
    ? ''
    : 'http://localhost:3000';
  const API_URL = `${API_ROOT}/api/farm`;

  let isBackendOnline = false;
  let saveDebounceTimer = null;

  function updateServerBadge(status, text) {
    const badge = $('serverSyncBadge');
    const label = $('serverSyncText');
    if (!badge || !label) return;
    badge.className = `server-status-pill ${status}`;
    label.textContent = text;
  }

  // --- Active State & Local Cache ---
  let currentPage = 'dashboard';
  let farm = loadFarmData();

  function loadFarmData() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.name) {
          if (parsed.eggDate !== TODAY_STR) {
            parsed.eggDate = TODAY_STR;
            parsed.lossesToday = 0;
          }
          return parsed;
        }
      }

      // Check migration from previous version
      const legacyMulti = localStorage.getItem('farmly-multi-v2');
      if (legacyMulti) {
        const parsedMulti = JSON.parse(legacyMulti);
        if (parsedMulti.farms && parsedMulti.farms.length > 0) {
          return parsedMulti.farms[0];
        }
      }

      const legacyV1 = localStorage.getItem('farmly-data-v1');
      if (legacyV1) {
        const parsedV1 = JSON.parse(legacyV1);
        const data = JSON.parse(JSON.stringify(DEFAULT_FARM));
        data.birds = parsedV1.birds || 500;
        data.feedStock = parsedV1.feed || 250;
        data.eggsToday = parsedV1.eggs || 320;
        data.totalLosses = parsedV1.totalLosses || 2;
        data.lossesToday = parsedV1.lossesToday || 0;
        if (Array.isArray(parsedV1.records) && parsedV1.records.length > 0) {
          data.records = parsedV1.records;
        }
        return data;
      }
    } catch (e) {
      console.warn('Error reading stored farm data:', e);
    }
    return JSON.parse(JSON.stringify(DEFAULT_FARM));
  }

  // Save to LocalStorage immediately + sync to Backend API
  function saveFarmData() {
    // 1. Instant local persistence
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(farm));
    } catch (e) {
      console.error('Failed to save to localStorage:', e);
    }

    // 2. Debounced Backend API sync
    clearTimeout(saveDebounceTimer);
    saveDebounceTimer = setTimeout(async () => {
      try {
        updateServerBadge('syncing', 'Saving to Server...');
        const res = await fetch(API_URL, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(farm)
        });
        if (res.ok) {
          isBackendOnline = true;
          updateServerBadge('online', 'Backend Synced');
        } else {
          updateServerBadge('offline', 'Offline (Local)');
        }
      } catch (err) {
        isBackendOnline = false;
        updateServerBadge('offline', 'Offline (Local)');
      }
    }, 350);
  }

  // Initial Sync from Backend on launch
  async function syncInitialDataFromBackend() {
    updateServerBadge('checking', 'Connecting...');
    try {
      const res = await fetch(API_URL, { cache: 'no-store' });
      if (res.ok) {
        const payload = await res.json();
        if (payload && payload.success && payload.data && payload.data.name) {
          farm = payload.data;
          if (farm.eggDate !== TODAY_STR) {
            farm.eggDate = TODAY_STR;
            farm.lossesToday = 0;
          }
          // Update local cache
          localStorage.setItem(STORAGE_KEY, JSON.stringify(farm));
          isBackendOnline = true;
          updateServerBadge('online', 'Backend Synced');
          renderCurrentPage();
          return;
        }
      }
    } catch (err) {
      console.log('Backend not reachable at startup, operating in local mode:', err.message);
    }
    isBackendOnline = false;
    updateServerBadge('offline', 'Offline (Local)');
  }

  // Periodic heartbeat every 20 seconds
  setInterval(async () => {
    try {
      const res = await fetch(`${API_ROOT}/api/status`, { cache: 'no-store' });
      if (res.ok) {
        if (!isBackendOnline) {
          isBackendOnline = true;
          updateServerBadge('online', 'Backend Synced');
        }
      } else {
        if (isBackendOnline) {
          isBackendOnline = false;
          updateServerBadge('offline', 'Offline (Local)');
        }
      }
    } catch (_) {
      if (isBackendOnline) {
        isBackendOnline = false;
        updateServerBadge('offline', 'Offline (Local)');
      }
    }
  }, 20000);

  // --- Helpers ---
  const $ = id => document.getElementById(id);
  const safe = str => String(str || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function addRecord(title, detail, type) {
    if (!farm.records) farm.records = [];
    farm.records.unshift({
      id: 'r_' + Date.now(),
      title,
      detail,
      type,
      time: new Date().toISOString()
    });
    if (farm.records.length > 60) farm.records = farm.records.slice(0, 60);
  }

  // --- Page Switcher ---
  function navigateTo(pageId) {
    currentPage = pageId;

    // Show only the selected page section
    document.querySelectorAll('.farm-page-section').forEach(sec => {
      sec.style.display = sec.id === `page-${pageId}` ? 'block' : 'none';
    });

    // Update Sidebar active state
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.page === pageId);
    });

    // Update Header breadcrumbs and titles
    const titles = {
      dashboard: { title: 'Farm Overview', crumb: 'Dashboard' },
      flock: { title: 'Flock & Birds', crumb: 'Flock Management' },
      feed: { title: 'Feed & Silo Storage', crumb: 'Feed Inventory' },
      eggs: { title: 'Daily Egg Production', crumb: 'Egg Harvest' },
      health: { title: 'Vaccines & Care', crumb: 'Biosecurity' },
      finance: { title: 'Sales & Expenses', crumb: 'Farm Finances' },
      records: { title: 'Activity Logbook', crumb: 'Farm Records' },
      settings: { title: 'Farm Configuration', crumb: 'Settings' }
    };

    const info = titles[pageId] || { title: 'Farm Dashboard', crumb: 'Overview' };
    if ($('headerTitle')) $('headerTitle').textContent = info.title;
    if ($('headerBreadcrumb')) $('headerBreadcrumb').textContent = info.crumb;

    // Render current view
    renderCurrentPage();

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // --- RENDER CURRENT PAGE ---
  function renderCurrentPage() {
    updateLiveDate();
    checkUrgentAlerts();

    // Update sidebar brand title
    if ($('sideFarmName')) $('sideFarmName').textContent = farm.name || 'FARMLY Farm';

    // Calculate common metrics
    const daysLeft = farm.dailyFeedRate > 0 ? (farm.feedStock / farm.dailyFeedRate).toFixed(1) : '—';
    const isLowFeed = farm.feedStock <= 50 || Number(daysLeft) <= 3;
    const layingRate = farm.birds > 0 ? ((farm.eggsToday / farm.birds) * 100).toFixed(1) : '0';

    // Financial balance
    let totalIncome = 0;
    let totalExpense = 0;
    (farm.finances || []).forEach(f => {
      if (f.type === 'income') totalIncome += Number(f.amount) || 0;
      else if (f.type === 'expense') totalExpense += Number(f.amount) || 0;
    });
    const netBalance = totalIncome - totalExpense;

    // 1. DASHBOARD PAGE
    if ($('dashBirds')) $('dashBirds').textContent = farm.birds.toLocaleString();
    if ($('dashBirdsCap')) $('dashBirdsCap').textContent = `Capacity: ${farm.capacity.toLocaleString()} birds`;
    if ($('dashFeed')) $('dashFeed').textContent = Number(farm.feedStock).toLocaleString();
    if ($('dashFeedDays')) $('dashFeedDays').textContent = `~${daysLeft} days buffer (${farm.dailyFeedRate} kg/day)`;
    if ($('dashEggs')) $('dashEggs').textContent = Number(farm.eggsToday).toLocaleString();
    if ($('dashLayingRate')) $('dashLayingRate').textContent = `${layingRate}% laying rate`;
    if ($('dashNetBalance')) {
      $('dashNetBalance').textContent = `$${netBalance.toLocaleString(undefined, { minimumFractionDigits: 0 })}`;
      $('dashNetBalance').style.color = netBalance >= 0 ? 'var(--green-primary)' : 'var(--red-primary)';
    }
    if ($('dashLossesToday')) $('dashLossesToday').textContent = `${farm.lossesToday || 0} bird losses recorded today`;

    // 7-Day Egg Chart
    renderEggChart();

    // Feed Silo Gauge on Dashboard
    if ($('dashFeedGaugeVal')) $('dashFeedGaugeVal').textContent = farm.feedStock;
    if ($('dashFeedDaysText')) $('dashFeedDaysText').textContent = `~${daysLeft} days remaining at ${farm.dailyFeedRate} kg/day`;
    if ($('dashFeedProgressBar')) {
      const target = Math.max(farm.feedStock, 400);
      const fillPct = Math.max(0, Math.min(100, (farm.feedStock / target) * 100));
      $('dashFeedProgressBar').style.width = `${fillPct}%`;
      $('dashFeedProgressBar').className = 'progress-fill ' + (isLowFeed ? 'red' : 'blue');
    }
    if ($('dashFeedAlertBox')) {
      $('dashFeedAlertBox').className = isLowFeed ? 'urgent-banner warning' : 'urgent-banner success';
      if ($('dashFeedAlertTitle')) $('dashFeedAlertTitle').textContent = isLowFeed ? '⚠️ Feed Stock Low — Restock Silo' : '✓ Feed Stock Healthy';
      if ($('dashFeedAlertDesc')) $('dashFeedAlertDesc').textContent = isLowFeed
        ? `Silo balance has fallen to ${farm.feedStock} kg. Restock within ~${daysLeft} days.`
        : `Current inventory of ${farm.feedStock} kg will last comfortably for the upcoming week.`;
    }

    // Recent dashboard logs
    const dashLogs = $('dashRecentLogs');
    if (dashLogs) {
      const records = farm.records || [];
      dashLogs.innerHTML = records.length === 0
        ? `<div style="text-align:center; padding: 30px; color:var(--text-subtle);">No activity recorded yet. Click "＋ Quick Entry" to start.</div>`
        : records.slice(0, 5).map(renderRecordItem).join('');
    }

    // 2. FLOCK PAGE
    if ($('flockCurrentCount')) $('flockCurrentCount').textContent = farm.birds.toLocaleString();
    if ($('flockCapacityCount')) $('flockCapacityCount').textContent = farm.capacity.toLocaleString();
    if ($('flockOccupancyRate')) {
      const occPct = farm.capacity > 0 ? Math.round((farm.birds / farm.capacity) * 100) : 0;
      $('flockOccupancyRate').textContent = `${occPct}% capacity occupied`;
    }
    if ($('flockLossCount')) $('flockLossCount').textContent = farm.totalLosses || 0;
    const totalFlockBase = farm.birds + (farm.totalLosses || 0);
    const mortRate = totalFlockBase > 0 ? (((farm.totalLosses || 0) / totalFlockBase) * 100).toFixed(2) : '0.00';
    if ($('flockMortalitySub')) $('flockMortalitySub').textContent = `${mortRate}% lifetime mortality`;
    if ($('flockBreedText')) $('flockBreedText').textContent = farm.breed || 'Lohmann Brown';
    if ($('flockAgeText')) $('flockAgeText').textContent = `${farm.ageWeeks || 1} weeks old`;

    const flockHistTable = $('flockHistoryTableBody');
    if (flockHistTable) {
      const hist = farm.flockHistory || [];
      flockHistTable.innerHTML = hist.length === 0
        ? `<tr><td colspan="5" style="text-align:center; padding:20px; color:var(--text-subtle);">No flock changes recorded.</td></tr>`
        : hist.map(h => `
          <tr>
            <td><strong>${new Date(h.date).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</strong></td>
            <td><strong style="color:${h.action.includes('Mortality') ? 'var(--red-primary)' : 'var(--blue-primary)'}">${safe(h.action)}</strong></td>
            <td><strong>${h.qty} birds</strong></td>
            <td>${safe(h.reason || 'Normal')}</td>
            <td>${safe(h.note || '')}</td>
          </tr>
        `).join('');
    }

    // 3. FEED PAGE
    if ($('feedTabStock')) $('feedTabStock').textContent = farm.feedStock;
    if ($('feedTabDaily')) $('feedTabDaily').textContent = farm.dailyFeedRate;
    if ($('feedTabDays')) $('feedTabDays').textContent = daysLeft;
    if ($('feedTabStatusText')) {
      $('feedTabStatusText').textContent = isLowFeed ? 'Low Stock' : 'Sufficient';
      $('feedTabStatusText').style.color = isLowFeed ? 'var(--red-primary)' : 'var(--green-primary)';
    }

    const feedHistTable = $('feedHistoryTableBody');
    if (feedHistTable) {
      const hist = farm.feedHistory || [];
      feedHistTable.innerHTML = hist.length === 0
        ? `<tr><td colspan="5" style="text-align:center; padding:20px; color:var(--text-subtle);">No feed transactions recorded.</td></tr>`
        : hist.map(h => `
          <tr>
            <td><strong>${new Date(h.date).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</strong></td>
            <td><strong style="color:${h.action.includes('Added') ? 'var(--blue-primary)' : 'var(--amber-primary)'}">${safe(h.action)}</strong></td>
            <td><strong>${h.qty} kg</strong></td>
            <td>${safe(h.formula || 'Feed')}</td>
            <td>${safe(h.note || '')}</td>
          </tr>
        `).join('');
    }

    // 4. EGGS PAGE
    if ($('eggTabToday')) $('eggTabToday').textContent = farm.eggsToday;
    if ($('eggTabRate')) $('eggTabRate').textContent = `${layingRate}%`;
    const lastEggRec = (farm.eggHistory && farm.eggHistory.length > 0) ? farm.eggHistory[farm.eggHistory.length - 1] : { gradeA: farm.eggsToday, damaged: 0 };
    if ($('eggTabGradeA')) $('eggTabGradeA').textContent = lastEggRec.gradeA || farm.eggsToday;
    if ($('eggTabDamaged')) $('eggTabDamaged').textContent = lastEggRec.damaged || 0;

    const eggHistTable = $('eggHistoryTableBody');
    if (eggHistTable) {
      const hist = farm.eggHistory || [];
      eggHistTable.innerHTML = hist.length === 0
        ? `<tr><td colspan="5" style="text-align:center; padding:20px; color:var(--text-subtle);">No egg collection records.</td></tr>`
        : hist.slice().reverse().map(h => {
          const r = farm.birds > 0 ? ((h.count / farm.birds) * 100).toFixed(1) : 0;
          return `
            <tr>
              <td><strong>${h.date}</strong></td>
              <td><strong>${h.count} eggs</strong></td>
              <td>${h.gradeA || h.count}</td>
              <td>${h.damaged || 0}</td>
              <td><span style="font-weight:700; color:var(--green-primary);">${r}%</span></td>
            </tr>
          `;
        }).join('');
    }

    // 5. HEALTH & VACCINES PAGE
    const vaccinesGrid = $('vaccinesGrid');
    if (vaccinesGrid) {
      const list = farm.vaccines || [];
      vaccinesGrid.innerHTML = list.length === 0
        ? `<div style="grid-column: 1/-1; text-align:center; padding: 40px; color:var(--text-subtle); background:var(--bg-card); border-radius:var(--radius-lg);">No vaccines scheduled. Click "＋ Schedule New Vaccine" above.</div>`
        : list.map(v => {
          const isUpcoming = v.status === 'Upcoming';
          return `
            <div class="vaccine-card">
              <div class="vaccine-card-top">
                <div>
                  <h4 class="vaccine-name">${safe(v.name)}</h4>
                  <span class="vaccine-target">Target: ${safe(v.target || 'Biosecurity')}</span>
                </div>
                <span class="vaccine-status-pill ${isUpcoming ? 'upcoming' : 'completed'}">${v.status}</span>
              </div>
              <p style="font-size:13px; color:var(--text-muted); margin: 8px 0 14px; line-height:1.5;">
                ${safe(v.notes || 'Routine protocol')}
              </p>
              <div class="vaccine-date-info">
                <span>📅 ${v.date} (${safe(v.method || 'Water')})</span>
                ${isUpcoming ? `<button class="btn btn-sm btn-soft-blue" onclick="window.markVaccineDone('${v.id}')">✓ Mark Done</button>` : `<strong style="color:var(--green-primary);">✓ Completed</strong>`}
              </div>
            </div>
          `;
        }).join('');
    }

    // 6. FINANCES PAGE
    if ($('financeTotalIncome')) $('financeTotalIncome').textContent = `$${totalIncome.toLocaleString()}`;
    if ($('financeTotalExpense')) $('financeTotalExpense').textContent = `$${totalExpense.toLocaleString()}`;
    if ($('financeNetMargin')) {
      $('financeNetMargin').textContent = `$${netBalance.toLocaleString()}`;
      $('financeNetMargin').style.color = netBalance >= 0 ? 'var(--green-primary)' : 'var(--red-primary)';
    }

    const finLedger = $('financeLedgerTableBody');
    if (finLedger) {
      const list = farm.finances || [];
      finLedger.innerHTML = list.length === 0
        ? `<tr><td colspan="5" style="text-align:center; padding:20px; color:var(--text-subtle);">No transactions logged yet.</td></tr>`
        : list.slice().reverse().map(f => `
          <tr>
            <td><strong>${f.date}</strong></td>
            <td><span class="vaccine-status-pill ${f.type === 'income' ? 'completed' : 'upcoming'}">${f.type.toUpperCase()}</span></td>
            <td><strong>${safe(f.category)}</strong></td>
            <td><strong style="color:${f.type === 'income' ? 'var(--green-primary)' : 'var(--red-primary)'}">${f.type === 'income' ? '+' : '-'}$${Number(f.amount).toFixed(2)}</strong></td>
            <td>${safe(f.note || '')}</td>
          </tr>
        `).join('');
    }

    // 7. RECORDS LOGBOOK PAGE
    renderFullRecordsStream();

    // 8. SETTINGS PAGE
    if ($('setFarmName')) $('setFarmName').value = farm.name || '';
    if ($('setFarmManager')) $('setFarmManager').value = farm.manager || '';
    if ($('setFarmLocation')) $('setFarmLocation').value = farm.location || '';
    if ($('setFarmBreed')) $('setFarmBreed').value = farm.breed || '';
    if ($('setFarmAge')) $('setFarmAge').value = farm.ageWeeks || 1;
    if ($('setFarmCapacity')) $('setFarmCapacity').value = farm.capacity || 600;
    if ($('setFarmFeedRate')) $('setFarmFeedRate').value = farm.dailyFeedRate || 45;

    saveFarmData();
  }

  function renderRecordItem(r) {
    let icon = '📝';
    let iconClass = 'note';
    if (r.type === 'egg') { icon = '🥚'; iconClass = 'egg'; }
    else if (r.type === 'feed') { icon = '🌾'; iconClass = 'feed'; }
    else if (r.type === 'flock') { icon = '🐔'; iconClass = 'flock'; }
    else if (r.type === 'health') { icon = '💉'; iconClass = 'health'; }
    else if (r.type === 'finance') { icon = '💰'; iconClass = 'finance'; }

    const timeStr = r.time ? new Date(r.time).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Recent';

    return `
      <div class="record-item-spacious">
        <div class="record-icon-box-large ${iconClass}">${icon}</div>
        <div class="record-body-spacious">
          <div class="record-title-spacious">${safe(r.title)}</div>
          <div class="record-details-spacious">${safe(r.detail || '')}</div>
          <div class="record-time-spacious">⏱ ${timeStr}</div>
        </div>
      </div>
    `;
  }

  function renderFullRecordsStream() {
    const stream = $('fullFarmRecordsStream');
    if (!stream) return;

    const query = ($('recordSearchInput') ? $('recordSearchInput').value : '').toLowerCase().trim();
    const filter = $('recordTypeFilter') ? $('recordTypeFilter').value : 'all';

    const records = farm.records || [];
    const filtered = records.filter(r => {
      if (filter !== 'all' && r.type !== filter) return false;
      if (!query) return true;
      return (r.title && r.title.toLowerCase().includes(query)) ||
             (r.detail && r.detail.toLowerCase().includes(query));
    });

    if (filtered.length === 0) {
      stream.innerHTML = `<div style="text-align:center; padding: 40px; color:var(--text-subtle);">No matching activity records found.</div>`;
    } else {
      stream.innerHTML = filtered.map(renderRecordItem).join('');
    }
  }

  function renderEggChart() {
    const barsContainer = $('dashEggChartBars');
    const daysContainer = $('dashEggChartDays');
    if (!barsContainer || !daysContainer) return;

    const history = (farm.eggHistory && farm.eggHistory.length > 0)
      ? farm.eggHistory.slice(-7)
      : [
          { date: '2026-11-03', count: 300 },
          { date: '2026-11-04', count: 310 },
          { date: '2026-11-05', count: 315 },
          { date: '2026-11-06', count: 320 },
          { date: '2026-11-07', count: 315 },
          { date: '2026-11-08', count: 325 },
          { date: TODAY_STR, count: farm.eggsToday || 320 }
        ];

    const maxEggs = Math.max(...history.map(h => h.count), farm.birds || 500, 100);
    const sumEggs = history.reduce((acc, h) => acc + h.count, 0);
    const avgEggs = Math.round(sumEggs / history.length);

    if ($('dashEgg7DayAvg')) $('dashEgg7DayAvg').textContent = `7-day avg: ${avgEggs} eggs/day`;

    barsContainer.innerHTML = history.map((item, idx) => {
      const heightPct = Math.max(10, Math.round((item.count / maxEggs) * 100));
      const isToday = idx === history.length - 1;
      return `
        <div class="bar-col-spacious">
          <div class="bar-tooltip-spacious">${item.count} eggs (${item.date})</div>
          <div class="bar-pill-spacious ${isToday ? 'today' : ''}" style="height: ${heightPct}%;"></div>
        </div>
      `;
    }).join('');

    const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Today'];
    daysContainer.innerHTML = history.map((item, idx) => {
      const label = idx === history.length - 1 ? 'Today' : (item.date ? new Date(item.date).toLocaleDateString([], { weekday: 'short' }) : dayLabels[idx]);
      return `<span>${label}</span>`;
    }).join('');
  }

  function checkUrgentAlerts() {
    const alertBox = $('urgentAlertBox');
    if (!alertBox) return;

    const daysLeft = farm.dailyFeedRate > 0 ? (farm.feedStock / farm.dailyFeedRate).toFixed(1) : 10;
    if (farm.feedStock <= 50 || Number(daysLeft) <= 2.5) {
      alertBox.innerHTML = `
        <div class="urgent-banner warning">
          <div class="banner-left">
            <span class="banner-icon">⚠️</span>
            <div class="banner-text">
              <h5>Low Feed Supply Warning</h5>
              <p>Current silo has only <strong>${farm.feedStock} kg</strong> remaining (~${daysLeft} days buffer). Please schedule a feed delivery soon.</p>
            </div>
          </div>
          <button class="btn btn-sm btn-soft-cream" onclick="this.closest('.urgent-banner').remove()">Dismiss</button>
        </div>
      `;
    } else {
      alertBox.innerHTML = '';
    }
  }

  function updateLiveDate() {
    const now = new Date();
    const dateEl = $('liveDate');
    if (dateEl) {
      dateEl.textContent = `📅 ${now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}`;
    }
  }

  // --- Dynamic Category Fields in Quick Entry Modal ---
  function updateQuickEntryFields() {
    const cat = $('qeCategorySelect') ? $('qeCategorySelect').value : 'egg';
    const dyn = $('qeDynamicSection');
    if (!dyn) return;

    if (cat === 'egg') {
      dyn.innerHTML = `
        <div class="form-row">
          <div class="form-group">
            <label>Good / Table Eggs (Grade A)</label>
            <input type="number" id="qeEggGood" class="form-input" min="0" step="1" required placeholder="e.g. 300">
          </div>
          <div class="form-group">
            <label>Cracked / Broken</label>
            <input type="number" id="qeEggDamaged" class="form-input" min="0" step="1" value="0">
          </div>
        </div>
        <div class="form-group">
          <label>Collection Notes</label>
          <input type="text" id="qeEggNotes" class="form-input" placeholder="e.g. Morning round, clean shells">
        </div>
      `;
    } else if (cat === 'feed') {
      dyn.innerHTML = `
        <div class="form-row">
          <div class="form-group">
            <label>Action</label>
            <select id="qeFeedAction" class="form-select">
              <option value="use">－ Record Feed Consumed</option>
              <option value="add">＋ Restock Purchased Feed</option>
            </select>
          </div>
          <div class="form-group">
            <label>Quantity (kg)</label>
            <input type="number" id="qeFeedQty" class="form-input" min="0.5" step="0.5" required placeholder="e.g. 45">
          </div>
        </div>
        <div class="form-group">
          <label>Notes / Formula</label>
          <input type="text" id="qeFeedNotes" class="form-input" placeholder="e.g. Layer Mash daily ration">
        </div>
      `;
    } else if (cat === 'flock') {
      dyn.innerHTML = `
        <div class="form-row">
          <div class="form-group">
            <label>Action</label>
            <select id="qeFlockAction" class="form-select">
              <option value="loss">－ Record Bird Mortality / Loss</option>
              <option value="add">＋ Add Birds / New Pullets</option>
            </select>
          </div>
          <div class="form-group">
            <label>Number of Birds</label>
            <input type="number" id="qeFlockQty" class="form-input" min="1" step="1" required placeholder="e.g. 2">
          </div>
        </div>
        <div class="form-group">
          <label>Reason / Details</label>
          <input type="text" id="qeFlockNotes" class="form-input" placeholder="e.g. Heat stress / new batch arrived">
        </div>
      `;
    } else if (cat === 'health') {
      dyn.innerHTML = `
        <div class="form-row">
          <div class="form-group">
            <label>Vaccine / Medicine Name</label>
            <input type="text" id="qeHealthName" class="form-input" required placeholder="e.g. Newcastle ND Lasota">
          </div>
          <div class="form-group">
            <label>Scheduled Date</label>
            <input type="date" id="qeHealthDate" class="form-input" value="${TODAY_STR}" required>
          </div>
        </div>
        <div class="form-group">
          <label>Method & Dosage</label>
          <input type="text" id="qeHealthNotes" class="form-input" placeholder="e.g. Drinking water with skim milk stabilizer">
        </div>
      `;
    } else if (cat === 'finance') {
      dyn.innerHTML = `
        <div class="form-row">
          <div class="form-group">
            <label>Type</label>
            <select id="qeFinType" class="form-select">
              <option value="income">💵 Sales Revenue / Income</option>
              <option value="expense">💳 Farm Expense / Cost</option>
            </select>
          </div>
          <div class="form-group">
            <label>Amount ($)</label>
            <input type="number" id="qeFinAmount" class="form-input" min="0.1" step="0.1" required placeholder="e.g. 120.00">
          </div>
        </div>
        <div class="form-group">
          <label>Category & Note</label>
          <input type="text" id="qeFinNotes" class="form-input" placeholder="e.g. Sold 10 egg crates to market">
        </div>
      `;
    } else {
      dyn.innerHTML = `
        <div class="form-group">
          <label>Subject / Title</label>
          <input type="text" id="qeNoteTitle" class="form-input" required placeholder="e.g. Repaired drinker nipple line">
        </div>
        <div class="form-group">
          <label>Details & Observations</label>
          <textarea id="qeNoteDetails" class="form-textarea" rows="3" placeholder="Add specific farm notes..."></textarea>
        </div>
      `;
    }
  }

  // --- Mark Vaccine Done ---
  window.markVaccineDone = function (vaccineId) {
    const v = (farm.vaccines || []).find(item => item.id === vaccineId);
    if (v) {
      v.status = 'Completed';
      addRecord(`Vaccine Completed: ${v.name}`, `Administered on ${TODAY_STR} via ${v.method}.`, 'health');
      renderCurrentPage();
    }
  };

  // --- Attach DOM Listeners ---
  function initListeners() {
    // Mobile Drawer
    const mobileBtn = $('mobileMenuBtn');
    const sidebar = $('sidebar');
    if (mobileBtn && sidebar) {
      mobileBtn.onclick = () => sidebar.classList.toggle('open');
    }

    // Brand link clicks to dashboard
    const brandLink = $('brandLogoLink');
    if (brandLink) {
      brandLink.onclick = e => {
        e.preventDefault();
        navigateTo('dashboard');
      };
    }

    // Sidebar Navigation
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
      item.onclick = e => {
        e.preventDefault();
        if (sidebar) sidebar.classList.remove('open');
        const page = item.dataset.page;
        if (page) navigateTo(page);
      };
    });

    // Close Dialog Buttons
    document.querySelectorAll('[data-close]').forEach(btn => {
      btn.onclick = () => {
        const d = btn.closest('dialog');
        if (d) d.close();
      };
    });
    document.querySelectorAll('dialog').forEach(d => {
      d.addEventListener('click', e => {
        if (e.target === d) d.close();
      });
    });

    // Top Header Quick Add
    const qAddBtn = $('headerQuickAddBtn');
    if (qAddBtn) {
      qAddBtn.onclick = () => {
        updateQuickEntryFields();
        $('modalQuickEntry').showModal();
      };
    }
    if ($('qeCategorySelect')) {
      $('qeCategorySelect').onchange = updateQuickEntryFields;
    }

    // Dashboard Quick Buttons
    if ($('dashBtnEgg')) $('dashBtnEgg').onclick = () => $('modalEggAction').showModal();
    if ($('dashBtnFeed')) $('dashBtnFeed').onclick = () => $('modalFeedAction').showModal();
    if ($('dashBtnFlock')) $('dashBtnFlock').onclick = () => $('modalFlockAction').showModal();
    if ($('dashEggAddBtn')) $('dashEggAddBtn').onclick = () => $('modalEggAction').showModal();
    if ($('dashFeedManageBtn')) $('dashFeedManageBtn').onclick = () => $('modalFeedAction').showModal();
    if ($('dashViewAllRecordsBtn')) $('dashViewAllRecordsBtn').onclick = () => navigateTo('records');

    // Flock Page Buttons
    if ($('flockAddBirdsBtn')) {
      $('flockAddBirdsBtn').onclick = () => {
        $('flockActionType').value = 'add';
        $('flockReasonGroup').style.display = 'none';
        $('modalFlockAction').showModal();
      };
    }
    if ($('flockRecordLossBtn')) {
      $('flockRecordLossBtn').onclick = () => {
        $('flockActionType').value = 'loss';
        $('flockReasonGroup').style.display = 'block';
        $('modalFlockAction').showModal();
      };
    }
    if ($('flockActionType')) {
      $('flockActionType').onchange = e => {
        $('flockReasonGroup').style.display = e.target.value === 'loss' ? 'block' : 'none';
      };
    }

    // Feed Page Buttons
    if ($('feedPurchaseBtn')) {
      $('feedPurchaseBtn').onclick = () => {
        $('feedActionType').value = 'add';
        $('modalFeedAction').showModal();
      };
    }
    if ($('feedUsageBtn')) {
      $('feedUsageBtn').onclick = () => {
        $('feedActionType').value = 'use';
        $('modalFeedAction').showModal();
      };
    }

    // Eggs Page Button
    if ($('eggLogCollectionBtn')) $('eggLogCollectionBtn').onclick = () => $('modalEggAction').showModal();

    // Health Page Button
    if ($('healthScheduleVaccineBtn')) $('healthScheduleVaccineBtn').onclick = () => $('modalHealthAction').showModal();

    // Finance Page Buttons
    if ($('financeAddIncomeBtn')) {
      $('financeAddIncomeBtn').onclick = () => {
        $('financeActionType').value = 'income';
        $('modalFinanceAction').showModal();
      };
    }
    if ($('financeAddExpenseBtn')) {
      $('financeAddExpenseBtn').onclick = () => {
        $('financeActionType').value = 'expense';
        $('modalFinanceAction').showModal();
      };
    }

    // Records Page Buttons & Filters
    if ($('journalAddNoteBtn')) $('journalAddNoteBtn').onclick = () => $('modalNoteAction').showModal();
    if ($('recordSearchInput')) $('recordSearchInput').oninput = renderFullRecordsStream;
    if ($('recordTypeFilter')) $('recordTypeFilter').onchange = renderFullRecordsStream;

    // --- FORM SUBMISSIONS ---

    // 1. Quick Entry Global Form
    const formQuickEntry = $('formQuickEntry');
    if (formQuickEntry) {
      formQuickEntry.onsubmit = e => {
        e.preventDefault();
        const cat = $('qeCategorySelect').value;

        if (cat === 'egg') {
          const good = Number($('qeEggGood').value) || 0;
          const damaged = Number($('qeEggDamaged').value) || 0;
          const total = good + damaged;
          farm.eggsToday += total;
          if (!farm.eggHistory) farm.eggHistory = [];
          farm.eggHistory.push({ date: TODAY_STR, count: farm.eggsToday, gradeA: good, damaged });
          addRecord(`${total} eggs collected`, `${good} Grade A table eggs, ${damaged} damaged.`, 'egg');
        } else if (cat === 'feed') {
          const action = $('qeFeedAction').value;
          const qty = Number($('qeFeedQty').value) || 0;
          const note = $('qeFeedNotes').value.trim();
          if (action === 'add') {
            farm.feedStock = Math.round((farm.feedStock + qty) * 10) / 10;
            addRecord(`${qty} kg feed restocked`, note || 'Feed inventory increased', 'feed');
          } else {
            if (qty > farm.feedStock) {
              alert('Cannot use more feed than available in silo stock.');
              return;
            }
            farm.feedStock = Math.round((farm.feedStock - qty) * 10) / 10;
            addRecord(`${qty} kg feed consumed`, note || 'Daily feeding recorded', 'feed');
          }
        } else if (cat === 'flock') {
          const action = $('qeFlockAction').value;
          const qty = Number($('qeFlockQty').value) || 0;
          const note = $('qeFlockNotes').value.trim();
          if (action === 'add') {
            farm.birds += qty;
            addRecord(`${qty} birds added to flock`, note || 'Flock expanded', 'flock');
          } else {
            if (qty > farm.birds) {
              alert('Mortality cannot exceed current active birds.');
              return;
            }
            farm.birds -= qty;
            farm.lossesToday = (farm.lossesToday || 0) + qty;
            farm.totalLosses = (farm.totalLosses || 0) + qty;
            addRecord(`${qty} bird mortality recorded`, note || 'Mortality log', 'flock');
          }
        } else if (cat === 'health') {
          const name = $('qeHealthName').value.trim();
          const date = $('qeHealthDate').value;
          const notes = $('qeHealthNotes').value.trim();
          if (!farm.vaccines) farm.vaccines = [];
          farm.vaccines.push({
            id: 'v_' + Date.now(),
            name,
            date,
            method: 'Drinking Water',
            status: 'Upcoming',
            notes
          });
          addRecord(`Vaccine scheduled: ${name}`, `Scheduled for ${date}. ${notes}`, 'health');
        } else if (cat === 'finance') {
          const type = $('qeFinType').value;
          const amount = Number($('qeFinAmount').value) || 0;
          const notes = $('qeFinNotes').value.trim();
          if (!farm.finances) farm.finances = [];
          farm.finances.push({
            id: 'f_' + Date.now(),
            type,
            category: type === 'income' ? 'Egg Sales' : 'Feed Purchase',
            amount,
            date: TODAY_STR,
            note: notes
          });
          addRecord(`${type === 'income' ? 'Income' : 'Expense'}: $${amount.toFixed(2)}`, notes, 'finance');
        } else {
          const title = $('qeNoteTitle').value.trim();
          const details = $('qeNoteDetails').value.trim();
          addRecord(title, details, 'note');
        }

        formQuickEntry.reset();
        $('modalQuickEntry').close();
        renderCurrentPage();
      };
    }

    // 2. Flock Action Form
    const formFlock = $('formFlockAction');
    if (formFlock) {
      formFlock.onsubmit = e => {
        e.preventDefault();
        const action = $('flockActionType').value;
        const qty = Number($('flockActionAmount').value);
        const reason = $('flockReasonSelect').value;
        const note = $('flockActionNote').value.trim();

        if (action === 'add') {
          farm.birds += qty;
          if (!farm.flockHistory) farm.flockHistory = [];
          farm.flockHistory.unshift({ date: new Date().toISOString(), action: 'Flock Addition', qty, reason: 'Restock / Batch', note });
          addRecord(`${qty} birds added to flock`, note || 'New birds joined flock', 'flock');
        } else {
          if (qty > farm.birds) {
            alert('Mortality count cannot exceed current active birds.');
            return;
          }
          farm.birds -= qty;
          farm.lossesToday = (farm.lossesToday || 0) + qty;
          farm.totalLosses = (farm.totalLosses || 0) + qty;
          if (!farm.flockHistory) farm.flockHistory = [];
          farm.flockHistory.unshift({ date: new Date().toISOString(), action: 'Mortality', qty, reason, note });
          addRecord(`${qty} bird mortality recorded`, `Cause: ${reason}. ${note}`, 'flock');
        }

        formFlock.reset();
        $('modalFlockAction').close();
        renderCurrentPage();
      };
    }

    // 3. Feed Action Form
    const formFeed = $('formFeedAction');
    if (formFeed) {
      formFeed.onsubmit = e => {
        e.preventDefault();
        const action = $('feedActionType').value;
        const qty = Number($('feedActionAmount').value);
        const formula = $('feedActionFormula').value;
        const note = $('feedActionNote').value.trim();

        if (action === 'add') {
          farm.feedStock = Math.round((farm.feedStock + qty) * 10) / 10;
          if (!farm.feedHistory) farm.feedHistory = [];
          farm.feedHistory.unshift({ date: new Date().toISOString(), action: 'Feed Added', qty, formula, note });
          addRecord(`${qty} kg feed restocked`, `Formula: ${formula}. ${note}`, 'feed');
        } else {
          if (qty > farm.feedStock) {
            alert('Feed used cannot exceed available stock.');
            return;
          }
          farm.feedStock = Math.round((farm.feedStock - qty) * 10) / 10;
          if (!farm.feedHistory) farm.feedHistory = [];
          farm.feedHistory.unshift({ date: new Date().toISOString(), action: 'Feed Used', qty, formula, note });
          addRecord(`${qty} kg feed consumed`, `Formula: ${formula}. ${note}`, 'feed');
        }

        formFeed.reset();
        $('modalFeedAction').close();
        renderCurrentPage();
      };
    }

    // 4. Egg Action Form
    const formEgg = $('formEggAction');
    if (formEgg) {
      formEgg.onsubmit = e => {
        e.preventDefault();
        const good = Number($('eggActionGood').value) || 0;
        const damaged = Number($('eggActionDamaged').value) || 0;
        const slot = $('eggActionSlot').value;
        const note = $('eggActionNote').value.trim();
        const total = good + damaged;

        farm.eggsToday += total;
        if (!farm.eggHistory) farm.eggHistory = [];
        farm.eggHistory.push({ date: TODAY_STR, count: farm.eggsToday, gradeA: good, damaged });

        addRecord(`${total} eggs collected (${slot})`, `${good} Grade A table eggs, ${damaged} damaged. ${note}`, 'egg');

        formEgg.reset();
        $('modalEggAction').close();
        renderCurrentPage();
      };
    }

    // 5. Health Action Form
    const formHealth = $('formHealthAction');
    if (formHealth) {
      formHealth.onsubmit = e => {
        e.preventDefault();
        const name = $('healthActionName').value.trim();
        const date = $('healthActionDate').value;
        const method = $('healthActionMethod').value;
        const status = $('healthActionStatus').value;
        const notes = $('healthActionNotes').value.trim();

        if (!farm.vaccines) farm.vaccines = [];
        farm.vaccines.push({
          id: 'v_' + Date.now(),
          name,
          date,
          method,
          status,
          notes
        });

        addRecord(`Health treatment scheduled: ${name}`, `Date: ${date} via ${method}. ${notes}`, 'health');

        formHealth.reset();
        $('modalHealthAction').close();
        renderCurrentPage();
      };
    }

    // 6. Finance Action Form
    const formFinance = $('formFinanceAction');
    if (formFinance) {
      formFinance.onsubmit = e => {
        e.preventDefault();
        const type = $('financeActionType').value;
        const category = $('financeActionCategory').value;
        const amount = Number($('financeActionAmount').value);
        const note = $('financeActionNote').value.trim();

        if (!farm.finances) farm.finances = [];
        farm.finances.push({
          id: 'f_' + Date.now(),
          type,
          category,
          amount,
          date: TODAY_STR,
          note
        });

        addRecord(`${type === 'income' ? 'Income' : 'Expense'}: $${amount.toFixed(2)} (${category})`, note, 'finance');

        formFinance.reset();
        $('modalFinanceAction').close();
        renderCurrentPage();
      };
    }

    // 7. Journal Note Form
    const formNote = $('formNoteAction');
    if (formNote) {
      formNote.onsubmit = e => {
        e.preventDefault();
        const title = $('noteActionTitle').value.trim();
        const details = $('noteActionDetails').value.trim();

        addRecord(title, details, 'note');

        formNote.reset();
        $('modalNoteAction').close();
        renderCurrentPage();
      };
    }

    // 8. Farm Settings Form
    const formSettings = $('formFarmSettings');
    if (formSettings) {
      formSettings.onsubmit = e => {
        e.preventDefault();
        farm.name = $('setFarmName').value.trim();
        farm.manager = $('setFarmManager').value.trim();
        farm.location = $('setFarmLocation').value.trim();
        farm.breed = $('setFarmBreed').value.trim();
        farm.ageWeeks = Number($('setFarmAge').value) || farm.ageWeeks;
        farm.capacity = Number($('setFarmCapacity').value) || farm.capacity;
        farm.dailyFeedRate = Number($('setFarmFeedRate').value) || farm.dailyFeedRate;

        addRecord('Farm configuration updated', 'Profile settings saved.', 'note');
        alert('Farm settings saved successfully!');
        renderCurrentPage();
      };
    }

    // Backup & Restore
    const btnDownload = $('btnDownloadJson');
    if (btnDownload) {
      btnDownload.onclick = () => {
        const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(farm, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute('href', dataStr);
        downloadAnchor.setAttribute('download', `farmly-backup-${TODAY_STR}.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
      };
    }

    const inputRestore = $('inputRestoreJson');
    if (inputRestore) {
      inputRestore.onchange = e => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = evt => {
          try {
            const parsed = JSON.parse(evt.target.result);
            if (parsed && (parsed.birds !== undefined || parsed.name)) {
              farm = parsed;
              saveFarmData();
              renderCurrentPage();
              alert('Farm data restored successfully!');
            } else {
              alert('Invalid backup file.');
            }
          } catch (err) {
            alert('Error reading JSON backup file.');
          }
        };
        reader.readAsText(file);
      };
    }

    const btnReset = $('btnResetDemo');
    if (btnReset) {
      btnReset.onclick = () => {
        if (confirm('Reset to standard demo data?')) {
          farm = JSON.parse(JSON.stringify(DEFAULT_FARM));
          saveFarmData();
          renderCurrentPage();
        }
      };
    }

    // --- Download Entered Data System ---
    function downloadCsvFile(filename, content) {
      const blob = new Blob(["\uFEFF" + content], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    }

    // 1. Complete Farm Report (All Entered Data in One Clean Spreadsheet)
    function exportCompleteFarmData() {
      const lines = [];
      lines.push('FARMLY POULTRY FARM MANAGEMENT — COMPLETE FARM DATA REPORT');
      lines.push(`Farm Name:,"${farm.name || 'FARMLY'}",Manager:,"${farm.manager || ''}",Location:,"${farm.location || ''}"`);
      lines.push(`Export Date:,"${new Date().toLocaleString()}",Current Active Birds:,${farm.birds || 0},Feed Silo Balance (kg):,${farm.feedStock || 0}`);
      lines.push('');

      // [1] DAILY EGG PRODUCTION
      lines.push('--- [1] DAILY EGG COLLECTION RECORDS ---');
      lines.push('Date,Total Eggs Collected,Grade A Table Eggs,Damaged / Broken Eggs,Laying Rate (%)');
      const eggHist = farm.eggHistory || [];
      if (eggHist.length === 0) {
        lines.push('No egg records entered yet.');
      } else {
        eggHist.forEach(h => {
          const rate = farm.birds > 0 ? (((h.count || 0) / farm.birds) * 100).toFixed(1) : '—';
          lines.push(`"${h.date || ''}",${h.count || 0},${h.gradeA || 0},${h.damaged || 0},"${rate}%"`);
        });
      }
      lines.push('');

      // [2] FLOCK & MORTALITY
      lines.push('--- [2] FLOCK ADDITIONS & MORTALITY HISTORY ---');
      lines.push('Date & Time,Action,Quantity (Birds),Reason / Cause,Notes');
      const flockHist = farm.flockHistory || [];
      if (flockHist.length === 0) {
        lines.push('No flock records entered yet.');
      } else {
        flockHist.forEach(h => {
          const d = h.date ? new Date(h.date).toLocaleString() : '';
          lines.push(`"${d}","${h.action || ''}",${h.qty || 0},"${(h.reason || '').replace(/"/g, '""')}","${(h.note || '').replace(/"/g, '""')}"`);
        });
      }
      lines.push('');

      // [3] FEED & SILO
      lines.push('--- [3] FEED SILO INVENTORY & CONSUMPTION ---');
      lines.push('Date & Time,Action,Quantity (kg),Feed Formula,Notes');
      const feedHist = farm.feedHistory || [];
      if (feedHist.length === 0) {
        lines.push('No feed records entered yet.');
      } else {
        feedHist.forEach(h => {
          const d = h.date ? new Date(h.date).toLocaleString() : '';
          lines.push(`"${d}","${h.action || ''}",${h.qty || 0},"${(h.formula || '').replace(/"/g, '""')}","${(h.note || '').replace(/"/g, '""')}"`);
        });
      }
      lines.push('');

      // [4] FINANCES
      lines.push('--- [4] SALES INCOME & EXPENSES ---');
      lines.push('Date,Type,Category,Amount ($),Notes');
      const finHist = farm.finances || [];
      if (finHist.length === 0) {
        lines.push('No financial records entered yet.');
      } else {
        finHist.forEach(f => {
          lines.push(`"${f.date || ''}","${(f.type || '').toUpperCase()}","${(f.category || '').replace(/"/g, '""')}",${f.amount || 0},"${(f.note || '').replace(/"/g, '""')}"`);
        });
      }
      lines.push('');

      // [5] VACCINES
      lines.push('--- [5] VACCINES & HEALTH SCHEDULE ---');
      lines.push('Date,Vaccine Name,Target Disease,Method,Status,Notes');
      const vaxHist = farm.vaccines || [];
      if (vaxHist.length === 0) {
        lines.push('No vaccines recorded yet.');
      } else {
        vaxHist.forEach(v => {
          lines.push(`"${v.date || ''}","${(v.name || '').replace(/"/g, '""')}","${(v.target || '').replace(/"/g, '""')}","${(v.method || '').replace(/"/g, '""')}","${(v.status || '').replace(/"/g, '""')}","${(v.notes || '').replace(/"/g, '""')}"`);
        });
      }
      lines.push('');

      // [6] ACTIVITY DIARY
      lines.push('--- [6] ACTIVITY LOGBOOK & DIARY ---');
      lines.push('Date & Time,Category,Title,Details');
      const recs = farm.records || [];
      if (recs.length === 0) {
        lines.push('No activity notes entered yet.');
      } else {
        recs.forEach(r => {
          const d = r.time ? new Date(r.time).toLocaleString() : '';
          lines.push(`"${d}","${r.type || ''}","${(r.title || '').replace(/"/g, '""')}","${(r.detail || '').replace(/"/g, '""')}"`);
        });
      }

      downloadCsvFile(`farmly_all_entered_data_${TODAY_STR}.csv`, lines.join('\r\n'));
    }

    // Modal Trigger Handlers
    const openDownloadModal = () => {
      const modal = $('modalDownloadData');
      if (modal) modal.showModal();
    };

    if ($('headerDownloadBtn')) $('headerDownloadBtn').onclick = openDownloadModal;
    if ($('dashBtnDownload')) $('dashBtnDownload').onclick = openDownloadModal;
    if ($('exportFarmCsvBtn')) $('exportFarmCsvBtn').onclick = openDownloadModal;

    // Modal Action Buttons
    if ($('dlFullReportBtn')) $('dlFullReportBtn').onclick = () => {
      exportCompleteFarmData();
      $('modalDownloadData').close();
    };

    if ($('dlEggHistoryBtn')) $('dlEggHistoryBtn').onclick = () => {
      const lines = ['Date,Total Eggs,Grade A Table Eggs,Damaged / Broken,Laying Rate (%)'];
      (farm.eggHistory || []).forEach(h => {
        const rate = farm.birds > 0 ? (((h.count || 0) / farm.birds) * 100).toFixed(1) : '—';
        lines.push(`"${h.date || ''}",${h.count || 0},${h.gradeA || 0},${h.damaged || 0},"${rate}%"`);
      });
      downloadCsvFile(`farmly_egg_collections_${TODAY_STR}.csv`, lines.join('\r\n'));
      $('modalDownloadData').close();
    };

    if ($('dlFinancesBtn')) $('dlFinancesBtn').onclick = () => {
      const lines = ['Date,Type,Category,Amount ($),Notes'];
      (farm.finances || []).forEach(f => {
        lines.push(`"${f.date || ''}","${(f.type || '').toUpperCase()}","${(f.category || '').replace(/"/g, '""')}",${f.amount || 0},"${(f.note || '').replace(/"/g, '""')}"`);
      });
      downloadCsvFile(`farmly_sales_expenses_${TODAY_STR}.csv`, lines.join('\r\n'));
      $('modalDownloadData').close();
    };

    if ($('dlFlockHistoryBtn')) $('dlFlockHistoryBtn').onclick = () => {
      const lines = ['Date & Time,Action,Quantity (Birds),Reason / Cause,Notes'];
      (farm.flockHistory || []).forEach(h => {
        const d = h.date ? new Date(h.date).toLocaleString() : '';
        lines.push(`"${d}","${h.action || ''}",${h.qty || 0},"${(h.reason || '').replace(/"/g, '""')}","${(h.note || '').replace(/"/g, '""')}"`);
      });
      downloadCsvFile(`farmly_flock_history_${TODAY_STR}.csv`, lines.join('\r\n'));
      $('modalDownloadData').close();
    };

    if ($('dlFeedHistoryBtn')) $('dlFeedHistoryBtn').onclick = () => {
      const lines = ['Date & Time,Action,Quantity (kg),Feed Formula,Notes'];
      (farm.feedHistory || []).forEach(h => {
        const d = h.date ? new Date(h.date).toLocaleString() : '';
        lines.push(`"${d}","${h.action || ''}",${h.qty || 0},"${(h.formula || '').replace(/"/g, '""')}","${(h.note || '').replace(/"/g, '""')}"`);
      });
      downloadCsvFile(`farmly_feed_history_${TODAY_STR}.csv`, lines.join('\r\n'));
      $('modalDownloadData').close();
    };

    if ($('dlActivityLogBtn')) $('dlActivityLogBtn').onclick = () => {
      const lines = ['Date & Time,Category,Title,Details'];
      (farm.records || []).forEach(r => {
        const d = r.time ? new Date(r.time).toLocaleString() : '';
        lines.push(`"${d}","${r.type || ''}","${(r.title || '').replace(/"/g, '""')}","${(r.detail || '').replace(/"/g, '""')}"`);
      });
      downloadCsvFile(`farmly_activity_log_${TODAY_STR}.csv`, lines.join('\r\n'));
      $('modalDownloadData').close();
    };
  }

  // --- Initial Launch ---
  let isAppInitialized = false;
  function bootstrapApp() {
    if (isAppInitialized) return;
    isAppInitialized = true;
    initListeners();
    navigateTo('dashboard');
    syncInitialDataFromBackend();
  }

  document.addEventListener('DOMContentLoaded', bootstrapApp);
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    bootstrapApp();
  }
})();
