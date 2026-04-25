/**
 * dashboard.js — Charts, Analytics & Dashboard Logic
 * Family Budget & Finance Planner
 */

let barChart   = null;
let pieChart   = null;
let trendChart = null;

const Dashboard = {
  session: null,
  db: null,
  currentMonth: null,

  async init() {
    Auth.requireAuth();
    this.session = Auth.getSession();
    this.db = await DB.init();

    // Default to current month
    const now = new Date();
    this.currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    renderSidebarUser();
    initMobileMenu();
    this.renderMonthFilters();
    this.renderAll();
    this.bindEvents();
  },

  getHouseholdData() {
    const hhId = this.session.household_id;
    const categories = this.db.categories.filter(c => c.household_id === hhId);
    const catIds = categories.map(c => c.id);
    const expenses = this.db.expenses.filter(e => catIds.includes(e.category_id));
    return { categories, expenses };
  },

  filterByMonth(expenses, month) {
    return expenses.filter(e => e.date.startsWith(month));
  },

  renderMonthFilters() {
    const { expenses } = this.getHouseholdData();
    const months = [...new Set(expenses.map(e => e.date.slice(0, 7)))].sort().reverse();
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    if (!months.includes(currentMonth)) months.unshift(currentMonth);

    const container = document.getElementById('month-filters');
    if (!container) return;
    container.innerHTML = months.slice(0, 6).map(m => `
      <button class="filter-pill ${m === this.currentMonth ? 'active' : ''}" data-month="${m}">
        ${getMonthLabel(m)}
      </button>
    `).join('');

    container.querySelectorAll('.filter-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        this.currentMonth = btn.dataset.month;
        container.querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.renderAll();
      });
    });
  },

  renderAll() {
    const { categories, expenses } = this.getHouseholdData();
    const monthExpenses = this.filterByMonth(expenses, this.currentMonth);
    this.renderStatCards(categories, monthExpenses, expenses);
    this.renderBudgetProgress(categories, monthExpenses);
    this.renderAlerts(categories, monthExpenses);
    this.renderBarChart(categories, monthExpenses);
    this.renderPieChart(categories, monthExpenses);
    this.renderTrendChart(expenses);
    this.renderRecentExpenses(monthExpenses, categories);
    this.renderTopSpenders(monthExpenses);
  },

  getCategorySpend(categories, expenses) {
    return categories.map(cat => {
      const spent = expenses
        .filter(e => e.category_id === cat.id)
        .reduce((sum, e) => sum + e.amount, 0);
      return { ...cat, spent };
    });
  },

  renderStatCards(categories, monthExpenses, allExpenses) {
    const totalBudget  = categories.reduce((s, c) => s + c.budget_amount, 0);
    const totalSpent   = monthExpenses.reduce((s, e) => s + e.amount, 0);
    const remaining    = totalBudget - totalSpent;
    const overspentCats = categories.filter(cat => {
      const spent = monthExpenses.filter(e => e.category_id === cat.id).reduce((s, e) => s + e.amount, 0);
      return spent > cat.budget_amount;
    });

    // Last month comparison
    const [y, m] = this.currentMonth.split('-').map(Number);
    const prevDate = new Date(y, m - 2);
    const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
    const prevSpent = this.filterByMonth(allExpenses, prevMonth).reduce((s, e) => s + e.amount, 0);
    const delta = prevSpent ? ((totalSpent - prevSpent) / prevSpent * 100).toFixed(1) : 0;
    const deltaType = delta > 0 ? 'down' : 'up';
    const deltaLabel = delta > 0 ? `▲ ${delta}% vs last month` : `▼ ${Math.abs(delta)}% vs last month`;

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

    set('stat-total-spent',   formatCurrency(totalSpent));
    set('stat-total-budget',  formatCurrency(totalBudget));
    set('stat-remaining',     formatCurrency(Math.abs(remaining)));
    set('stat-alerts',        overspentCats.length);
    set('stat-transactions',  monthExpenses.length);

    const deltaEl = document.getElementById('stat-delta');
    if (deltaEl) {
      deltaEl.textContent = deltaLabel;
      deltaEl.className = `stat-delta ${deltaType}`;
    }

    const remainEl = document.getElementById('stat-remaining-card');
    if (remainEl) {
      remainEl.style.setProperty('--accent-color', remaining >= 0 ? 'var(--green)' : 'var(--red)');
      remainEl.querySelector('.stat-label').textContent = remaining >= 0 ? 'Budget Remaining' : 'Over Budget';
    }

    const pct = Math.min(Math.round((totalSpent / totalBudget) * 100), 100);
    const budgetBar = document.getElementById('overall-budget-bar');
    if (budgetBar) {
      budgetBar.style.width = pct + '%';
      budgetBar.classList.toggle('over', totalSpent > totalBudget);
    }
    const budgetPct = document.getElementById('overall-budget-pct');
    if (budgetPct) budgetPct.textContent = pct + '% of budget used';
  },

  renderBudgetProgress(categories, monthExpenses) {
    const container = document.getElementById('budget-progress');
    if (!container) return;
    const data = this.getCategorySpend(categories, monthExpenses);

    container.innerHTML = data.map(cat => {
      const pct = cat.budget_amount > 0 ? Math.min((cat.spent / cat.budget_amount) * 100, 100) : 0;
      const over = cat.spent > cat.budget_amount;
      return `
        <div class="progress-bar-wrap">
          <div class="progress-bar-label">
            <span class="pb-name">${cat.icon} ${cat.name}</span>
            <span class="pb-values">${formatCurrency(cat.spent)} / ${formatCurrency(cat.budget_amount)}</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill ${over ? 'over' : ''}" style="width:${pct}%;--fill-color:${cat.color}"></div>
          </div>
          ${over ? `<div class="text-xs text-red mt-sm">⚠️ Over by ${formatCurrency(cat.spent - cat.budget_amount)}</div>` : ''}
        </div>
      `;
    }).join('');
  },

  renderAlerts(categories, monthExpenses) {
    const container = document.getElementById('alerts-list');
    if (!container) return;
    const alerts = [];

    categories.forEach(cat => {
      const spent = monthExpenses.filter(e => e.category_id === cat.id).reduce((s, e) => s + e.amount, 0);
      const pct = cat.budget_amount > 0 ? (spent / cat.budget_amount) * 100 : 0;
      if (pct >= 100) {
        alerts.push({ type: 'danger', icon: '🚨', title: `${cat.icon} ${cat.name} Over Budget`, msg: `Spent ${formatCurrency(spent)} of ${formatCurrency(cat.budget_amount)} (${Math.round(pct)}%)` });
      } else if (pct >= 80) {
        alerts.push({ type: 'warning', icon: '⚠️', title: `${cat.icon} ${cat.name} Near Limit`, msg: `${Math.round(100 - pct)}% budget remaining — spend carefully` });
      }
    });

    if (alerts.length === 0) {
      container.innerHTML = `<div class="alert alert-success"><span class="alert-icon">✅</span><div class="alert-body"><div class="alert-title">All Clear!</div><div class="alert-msg">All categories within budget this month.</div></div></div>`;
      return;
    }
    container.innerHTML = alerts.map(a => `
      <div class="alert alert-${a.type}">
        <span class="alert-icon">${a.icon}</span>
        <div class="alert-body">
          <div class="alert-title">${a.title}</div>
          <div class="alert-msg">${a.msg}</div>
        </div>
      </div>
    `).join('');
  },

  renderBarChart(categories, monthExpenses) {
    const ctx = document.getElementById('bar-chart');
    if (!ctx) return;
    const data = this.getCategorySpend(categories, monthExpenses);
    if (barChart) barChart.destroy();

    barChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.map(c => c.name),
        datasets: [
          {
            label: 'Budget',
            data: data.map(c => c.budget_amount),
            backgroundColor: 'rgba(99,119,147,0.2)',
            borderColor: 'rgba(99,119,147,0.5)',
            borderWidth: 1,
            borderRadius: 4,
          },
          {
            label: 'Spent',
            data: data.map(c => c.spent),
            backgroundColor: data.map(c => c.color + 'CC'),
            borderColor: data.map(c => c.color),
            borderWidth: 1,
            borderRadius: 4,
          }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#8b949e', font: { size: 11 }, boxWidth: 12 } },
          tooltip: {
            backgroundColor: '#1c2230', borderColor: '#30363d', borderWidth: 1,
            titleColor: '#e6edf3', bodyColor: '#8b949e',
            callbacks: { label: ctx => ` ₹${ctx.raw.toLocaleString()}` }
          }
        },
        scales: {
          x: { ticks: { color: '#8b949e', font: { size: 11 } }, grid: { color: 'rgba(99,119,147,0.08)' } },
          y: { ticks: { color: '#8b949e', font: { size: 11 }, callback: v => '₹' + (v >= 1000 ? (v/1000).toFixed(0)+'K' : v) }, grid: { color: 'rgba(99,119,147,0.08)' } }
        }
      }
    });
  },

  renderPieChart(categories, monthExpenses) {
    const ctx = document.getElementById('pie-chart');
    if (!ctx) return;
    const data = this.getCategorySpend(categories, monthExpenses).filter(c => c.spent > 0);
    if (pieChart) pieChart.destroy();
    if (!data.length) { ctx.parentElement.innerHTML = '<div class="empty-state"><div class="empty-icon">🥧</div><p>No expenses this month</p></div>'; return; }

    pieChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: data.map(c => `${c.icon} ${c.name}`),
        datasets: [{
          data: data.map(c => c.spent),
          backgroundColor: data.map(c => c.color + 'CC'),
          borderColor: data.map(c => c.color),
          borderWidth: 1,
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
          legend: { position: 'bottom', labels: { color: '#8b949e', font: { size: 11 }, boxWidth: 10, padding: 12 } },
          tooltip: {
            backgroundColor: '#1c2230', borderColor: '#30363d', borderWidth: 1,
            titleColor: '#e6edf3', bodyColor: '#8b949e',
            callbacks: { label: ctx => ` ₹${ctx.raw.toLocaleString()} (${Math.round(ctx.parsed / data.reduce((s,c)=>s+c.spent,0)*100)}%)` }
          }
        }
      }
    });
  },

  renderTrendChart(allExpenses) {
    const ctx = document.getElementById('trend-chart');
    if (!ctx) return;

    const { categories } = this.getHouseholdData();
    const catIds = categories.map(c => c.id);
    const hhExpenses = allExpenses.filter(e => catIds.includes(e.category_id));

    // Get last 6 months
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
    }

    const monthlyTotals = months.map(m => ({
      label: new Date(m + '-01').toLocaleString('en', { month: 'short' }),
      total: hhExpenses.filter(e => e.date.startsWith(m)).reduce((s, e) => s + e.amount, 0)
    }));

    if (trendChart) trendChart.destroy();
    trendChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: monthlyTotals.map(m => m.label),
        datasets: [{
          label: 'Monthly Spending',
          data: monthlyTotals.map(m => m.total),
          borderColor: '#2dd4bf',
          backgroundColor: 'rgba(45,212,191,0.06)',
          tension: 0.4,
          fill: true,
          pointBackgroundColor: '#2dd4bf',
          pointBorderColor: '#0d1117',
          pointBorderWidth: 2,
          pointRadius: 5
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1c2230', borderColor: '#30363d', borderWidth: 1,
            titleColor: '#e6edf3', bodyColor: '#8b949e',
            callbacks: { label: ctx => ` ₹${ctx.raw.toLocaleString()}` }
          }
        },
        scales: {
          x: { ticks: { color: '#8b949e', font: { size: 11 } }, grid: { display: false } },
          y: { ticks: { color: '#8b949e', font: { size: 11 }, callback: v => '₹' + (v >= 1000 ? (v/1000).toFixed(0)+'K' : v) }, grid: { color: 'rgba(99,119,147,0.08)' } }
        }
      }
    });
  },

  renderRecentExpenses(monthExpenses, categories) {
    const tbody = document.getElementById('recent-expenses-body');
    if (!tbody) return;
    const users = this.db.users;
    const sorted = [...monthExpenses].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 8);

    if (!sorted.length) {
      tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state" style="padding:24px"><div class="empty-icon">📋</div><p>No expenses this month</p></div></td></tr>`;
      return;
    }

    tbody.innerHTML = sorted.map(exp => {
      const cat  = categories.find(c => c.id === exp.category_id) || {};
      const user = users.find(u => u.id === exp.user_id) || {};
      return `
        <tr>
          <td>
            <span class="category-tag" style="--tag-bg:${cat.color}22;--tag-color:${cat.color}">
              ${cat.icon || '📦'} ${cat.name || 'Unknown'}
            </span>
          </td>
          <td class="td-amount text-red">−${formatCurrency(exp.amount)}</td>
          <td class="td-muted">${formatDate(exp.date)}</td>
          <td>
            <div style="display:flex;align-items:center;gap:8px">
              <div class="avatar" style="width:26px;height:26px;font-size:11px;">${(user.name||'?').charAt(0)}</div>
              <span style="font-size:0.82rem">${user.name || '—'}</span>
            </div>
          </td>
          <td class="td-muted truncate" style="max-width:140px">${exp.notes || '—'}</td>
        </tr>
      `;
    }).join('');
  },

  renderTopSpenders(monthExpenses) {
    const container = document.getElementById('top-spenders');
    if (!container) return;
    const users = this.db.users;

    const spendMap = {};
    monthExpenses.forEach(e => {
      spendMap[e.user_id] = (spendMap[e.user_id] || 0) + e.amount;
    });

    const total = Object.values(spendMap).reduce((s, v) => s + v, 0);
    const sorted = Object.entries(spendMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);

    if (!sorted.length) {
      container.innerHTML = '<div class="text-muted text-sm">No data</div>';
      return;
    }

    container.innerHTML = sorted.map(([uid, amt]) => {
      const user = users.find(u => u.id === uid) || { name: 'Unknown' };
      const pct  = total > 0 ? Math.round((amt / total) * 100) : 0;
      return `
        <div style="margin-bottom:14px">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
            <div class="avatar" style="width:30px;height:30px;font-size:12px;">${user.name.charAt(0)}</div>
            <span style="font-size:0.85rem;font-weight:600;flex:1">${user.name}</span>
            <span style="font-size:0.85rem;font-weight:700;color:var(--text-primary)">${formatCurrency(amt)}</span>
            <span class="badge badge-accent">${pct}%</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill" style="width:${pct}%"></div>
          </div>
        </div>
      `;
    }).join('');
  },

  bindEvents() {
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) logoutBtn.addEventListener('click', () => Auth.logout());
  }
};

window.addEventListener('DOMContentLoaded', () => Dashboard.init());
