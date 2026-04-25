/**
 * auth.js — Authentication & Household Logic
 * Family Budget & Finance Planner
 */

const AUTH_KEY = 'fbp_session';
const DB_KEY   = 'fbp_database';

// ─── Database Manager ─────────────────────────────────────────
const DB = {
  load() {
    try {
      const raw = localStorage.getItem(DB_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { console.error('DB load error:', e); }
    return null;
  },

  save(data) {
    try {
      localStorage.setItem(DB_KEY, JSON.stringify(data));
    } catch (e) { console.error('DB save error:', e); }
  },

  async init() {
    let db = this.load();
    if (!db) {
      // Load sample data from JSON file
      try {
        const res = await fetch('../data/sample.json');
        db = await res.json();
        this.save(db);
      } catch (e) {
        // Fallback inline seed
        db = this.seed();
        this.save(db);
      }
    }
    return db;
  },

  seed() {
    return {
      households: [
        { id: 'hh_001', name: 'The Sharma Family' },
        { id: 'hh_002', name: 'The Johnsons' }
      ],
      users: [
        { id: 'u_001', name: 'Ravi Sharma',  household_id: 'hh_001', pin: '1234' },
        { id: 'u_002', name: 'Priya Sharma', household_id: 'hh_001', pin: '1234' },
        { id: 'u_003', name: 'Alex Johnson', household_id: 'hh_002', pin: '5678' }
      ],
      categories: [
        { id: 'cat_001', household_id: 'hh_001', name: 'Food',      budget_amount: 15000, icon: '🛒', color: '#10b981' },
        { id: 'cat_002', household_id: 'hh_001', name: 'Transport', budget_amount: 8000,  icon: '🚗', color: '#3b82f6' },
        { id: 'cat_003', household_id: 'hh_001', name: 'Utilities', budget_amount: 6000,  icon: '💡', color: '#f59e0b' },
        { id: 'cat_004', household_id: 'hh_001', name: 'Education', budget_amount: 10000, icon: '📚', color: '#8b5cf6' },
        { id: 'cat_005', household_id: 'hh_001', name: 'Misc',      budget_amount: 5000,  icon: '📦', color: '#ec4899' },
        { id: 'cat_006', household_id: 'hh_002', name: 'Food',      budget_amount: 20000, icon: '🛒', color: '#10b981' },
        { id: 'cat_007', household_id: 'hh_002', name: 'Transport', budget_amount: 12000, icon: '🚗', color: '#3b82f6' },
        { id: 'cat_008', household_id: 'hh_002', name: 'Utilities', budget_amount: 8000,  icon: '💡', color: '#f59e0b' },
        { id: 'cat_009', household_id: 'hh_002', name: 'Education', budget_amount: 5000,  icon: '📚', color: '#8b5cf6' },
        { id: 'cat_010', household_id: 'hh_002', name: 'Misc',      budget_amount: 6000,  icon: '📦', color: '#ec4899' }
      ],
      expenses: [
        { id: 'exp_001', category_id: 'cat_001', user_id: 'u_001', amount: 3200, date: '2025-04-02', notes: 'Weekly groceries' },
        { id: 'exp_002', category_id: 'cat_002', user_id: 'u_001', amount: 1500, date: '2025-04-03', notes: 'Petrol fill' },
        { id: 'exp_003', category_id: 'cat_003', user_id: 'u_002', amount: 2800, date: '2025-04-04', notes: 'Electricity bill' },
        { id: 'exp_004', category_id: 'cat_004', user_id: 'u_002', amount: 4500, date: '2025-04-05', notes: 'School fee' },
        { id: 'exp_005', category_id: 'cat_001', user_id: 'u_002', amount: 2100, date: '2025-04-07', notes: 'Restaurant dinner' },
        { id: 'exp_006', category_id: 'cat_005', user_id: 'u_001', amount: 1200, date: '2025-04-08', notes: 'Birthday gift' },
        { id: 'exp_007', category_id: 'cat_002', user_id: 'u_001', amount: 800,  date: '2025-04-10', notes: 'Taxi rides' },
        { id: 'exp_008', category_id: 'cat_001', user_id: 'u_001', amount: 3400, date: '2025-04-12', notes: 'Groceries + household items' },
        { id: 'exp_009', category_id: 'cat_003', user_id: 'u_002', amount: 1400, date: '2025-04-13', notes: 'Internet + phone' },
        { id: 'exp_010', category_id: 'cat_004', user_id: 'u_002', amount: 2200, date: '2025-04-15', notes: 'Online courses' },
        { id: 'exp_011', category_id: 'cat_001', user_id: 'u_001', amount: 4800, date: '2025-04-16', notes: 'Grocery run + snacks' },
        { id: 'exp_012', category_id: 'cat_005', user_id: 'u_001', amount: 2100, date: '2025-04-18', notes: 'Clothing' },
        { id: 'exp_013', category_id: 'cat_002', user_id: 'u_002', amount: 2200, date: '2025-04-19', notes: 'Car service' },
        { id: 'exp_014', category_id: 'cat_003', user_id: 'u_001', amount: 900,  date: '2025-04-20', notes: 'Water bill' },
        { id: 'exp_015', category_id: 'cat_001', user_id: 'u_002', amount: 1900, date: '2025-04-22', notes: 'Vegetables and dairy' },
        { id: 'exp_016', category_id: 'cat_002', user_id: 'u_001', amount: 1100, date: '2025-03-05', notes: 'Metro pass' },
        { id: 'exp_017', category_id: 'cat_001', user_id: 'u_001', amount: 6200, date: '2025-03-08', notes: 'Bulk groceries' },
        { id: 'exp_018', category_id: 'cat_003', user_id: 'u_002', amount: 3100, date: '2025-03-12', notes: 'Electricity + gas' },
        { id: 'exp_019', category_id: 'cat_004', user_id: 'u_002', amount: 8000, date: '2025-03-15', notes: 'Tuition fee' },
        { id: 'exp_020', category_id: 'cat_005', user_id: 'u_001', amount: 3400, date: '2025-03-20', notes: 'Home repair items' },
        { id: 'exp_021', category_id: 'cat_001', user_id: 'u_001', amount: 5100, date: '2025-03-25', notes: 'Party catering' },
        { id: 'exp_022', category_id: 'cat_002', user_id: 'u_002', amount: 3200, date: '2025-03-28', notes: 'Fuel + parking' },
        { id: 'exp_023', category_id: 'cat_001', user_id: 'u_001', amount: 2800, date: '2025-02-10', notes: 'Groceries' },
        { id: 'exp_024', category_id: 'cat_002', user_id: 'u_001', amount: 1900, date: '2025-02-14', notes: 'Cab fares' },
        { id: 'exp_025', category_id: 'cat_003', user_id: 'u_002', amount: 2600, date: '2025-02-18', notes: 'Utilities Feb' },
        { id: 'exp_026', category_id: 'cat_004', user_id: 'u_002', amount: 4200, date: '2025-02-20', notes: 'School books' },
        { id: 'exp_027', category_id: 'cat_005', user_id: 'u_001', amount: 1800, date: '2025-02-25', notes: 'Misc shopping' }
      ]
    };
  }
};

// ─── Session Manager ──────────────────────────────────────────
const Auth = {
  getSession() {
    try {
      const raw = localStorage.getItem(AUTH_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  },

  setSession(session) {
    localStorage.setItem(AUTH_KEY, JSON.stringify(session));
  },

  clearSession() {
    localStorage.removeItem(AUTH_KEY);
  },

  isLoggedIn() {
    return !!this.getSession();
  },

  requireAuth() {
    if (!this.isLoggedIn()) {
      window.location.href = 'login.html';
      return false;
    }
    return true;
  },

  redirectIfAuthed() {
    if (this.isLoggedIn()) {
      window.location.href = 'dashboard.html';
    }
  },

  async login(householdId, userName, pin) {
    const db = await DB.init();
    const household = db.households.find(h => h.id === householdId);
    if (!household) throw new Error('Household not found. Check the Household ID.');

    const user = db.users.find(u =>
      u.household_id === householdId &&
      u.name.toLowerCase().trim() === userName.toLowerCase().trim() &&
      u.pin === pin
    );
    if (!user) throw new Error('Invalid name or PIN. Please try again.');

    const session = {
      user_id: user.id,
      user_name: user.name,
      household_id: household.id,
      household_name: household.name,
      logged_at: new Date().toISOString()
    };
    this.setSession(session);
    return session;
  },

  async createHousehold(householdName, userName, pin) {
    if (!householdName.trim()) throw new Error('Household name is required.');
    if (!userName.trim())      throw new Error('Your name is required.');
    if (pin.length < 4)        throw new Error('PIN must be at least 4 digits.');

    const db = await DB.init();

    const hhId  = 'hh_' + Date.now();
    const uId   = 'u_'  + Date.now();

    const defaultCategories = [
      { name: 'Food',      budget_amount: 15000, icon: '🛒', color: '#10b981' },
      { name: 'Transport', budget_amount: 8000,  icon: '🚗', color: '#3b82f6' },
      { name: 'Utilities', budget_amount: 6000,  icon: '💡', color: '#f59e0b' },
      { name: 'Education', budget_amount: 10000, icon: '📚', color: '#8b5cf6' },
      { name: 'Misc',      budget_amount: 5000,  icon: '📦', color: '#ec4899' }
    ].map((c, i) => ({
      id: `cat_${Date.now()}_${i}`,
      household_id: hhId,
      ...c
    }));

    db.households.push({ id: hhId, name: householdName.trim() });
    db.users.push({ id: uId, name: userName.trim(), household_id: hhId, pin });
    db.categories.push(...defaultCategories);
    DB.save(db);

    const session = {
      user_id: uId,
      user_name: userName.trim(),
      household_id: hhId,
      household_name: householdName.trim(),
      logged_at: new Date().toISOString()
    };
    this.setSession(session);
    return session;
  },

  logout() {
    this.clearSession();
    window.location.href = 'index.html';
  }
};

// ─── Sidebar Helpers ──────────────────────────────────────────
function renderSidebarUser() {
  const session = Auth.getSession();
  if (!session) return;

  const nameEl = document.getElementById('sidebar-user-name');
  const hhEl   = document.getElementById('sidebar-hh-name');
  const initEl = document.getElementById('sidebar-user-init');

  if (nameEl)  nameEl.textContent = session.user_name;
  if (hhEl)    hhEl.textContent   = session.household_name;
  if (initEl)  initEl.textContent = session.user_name.charAt(0).toUpperCase();
}

function initMobileMenu() {
  const toggle = document.getElementById('menu-toggle');
  const sidebar = document.querySelector('.sidebar');
  if (!toggle || !sidebar) return;
  toggle.addEventListener('click', () => sidebar.classList.toggle('open'));
  document.addEventListener('click', e => {
    if (!sidebar.contains(e.target) && !toggle.contains(e.target)) {
      sidebar.classList.remove('open');
    }
  });
}

// ─── Toast Notifications ──────────────────────────────────────
function showToast(type, title, msg, duration = 3500) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || icons.info}</span>
    <div class="toast-body">
      <div class="toast-title">${title}</div>
      ${msg ? `<div class="toast-msg">${msg}</div>` : ''}
    </div>
  `;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ─── Format Helpers ───────────────────────────────────────────
function formatCurrency(amount, symbol = '₹') {
  if (amount >= 100000) return `${symbol}${(amount / 100000).toFixed(1)}L`;
  if (amount >= 1000)   return `${symbol}${(amount / 1000).toFixed(1)}K`;
  return `${symbol}${Math.round(amount).toLocaleString()}`;
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getMonthLabel(yearMonth) {
  const [y, m] = yearMonth.split('-');
  return new Date(y, m - 1).toLocaleString('en', { month: 'long', year: 'numeric' });
}

function genId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
}

// Expose globals
window.DB    = DB;
window.Auth  = Auth;
window.showToast    = showToast;
window.formatCurrency = formatCurrency;
window.formatDate     = formatDate;
window.getMonthLabel  = getMonthLabel;
window.genId          = genId;
window.renderSidebarUser = renderSidebarUser;
window.initMobileMenu    = initMobileMenu;
