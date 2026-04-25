/**
 * budgets.js — Budget Management Logic
 * Family Budget & Finance Planner
 */

const Budgets = {
  session: null,
  db: null,

  async init() {
    Auth.requireAuth();
    this.session = Auth.getSession();
    this.db = await DB.init();

    renderSidebarUser();
    initMobileMenu();
    this.renderBudgetCards();
    this.renderSummary();
    this.bindEvents();
  },

  getHouseholdData() {
    const hhId = this.session.household_id;
    const categories = this.db.categories.filter(c => c.household_id === hhId);
    const catIds = categories.map(c => c.id);
    const expenses  = this.db.expenses.filter(e => catIds.includes(e.category_id));
    return { categories, expenses, catIds, hhId };
  },

  getCurrentMonthExpenses(expenses) {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    return expenses.filter(e => e.date.startsWith(month));
  },

  renderBudgetCards() {
    const { categories, expenses } = this.getHouseholdData();
    const monthExpenses = this.getCurrentMonthExpenses(expenses);
    const container = document.getElementById('budget-cards');
    if (!container) return;

    container.innerHTML = categories.map(cat => {
      const spent = monthExpenses.filter(e => e.category_id === cat.id).reduce((s, e) => s + e.amount, 0);
      const remaining = cat.budget_amount - spent;
      const pct = cat.budget_amount > 0 ? Math.min((spent / cat.budget_amount) * 100, 100) : 0;
      const over = spent > cat.budget_amount;
      const statusColor = over ? 'var(--red)' : pct >= 80 ? 'var(--amber)' : 'var(--green)';
      const statusLabel = over ? 'Over Budget' : pct >= 80 ? 'Near Limit' : 'On Track';

      return `
        <div class="budget-card card" data-id="${cat.id}" style="--cat-color:${cat.color}">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:16px">
            <div style="display:flex;align-items:center;gap:12px">
              <div style="width:44px;height:44px;background:${cat.color}22;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:22px;border:1px solid ${cat.color}44">${cat.icon}</div>
              <div>
                <div style="font-weight:700;font-size:1rem">${cat.name}</div>
                <div class="badge ${over ? 'badge-red' : pct >= 80 ? 'badge-amber' : 'badge-green'}" style="margin-top:4px">${statusLabel}</div>
              </div>
            </div>
            <div style="display:flex;gap:6px">
              <button class="btn btn-ghost btn-icon btn-sm" onclick="Budgets.openEditModal('${cat.id}')" title="Edit Budget">✏️</button>
              <button class="btn btn-ghost btn-icon btn-sm" onclick="Budgets.deleteCategory('${cat.id}')" title="Delete" style="color:var(--red)">🗑️</button>
            </div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
            <div style="background:var(--bg-elevated);border-radius:8px;padding:12px">
              <div class="label" style="margin-bottom:4px">Budget</div>
              <div style="font-size:1.1rem;font-weight:700;font-family:var(--font-display)">₹${cat.budget_amount.toLocaleString()}</div>
            </div>
            <div style="background:var(--bg-elevated);border-radius:8px;padding:12px">
              <div class="label" style="margin-bottom:4px">Spent</div>
              <div style="font-size:1.1rem;font-weight:700;font-family:var(--font-display);color:${over ? 'var(--red)' : 'var(--text-primary)'}">₹${spent.toLocaleString()}</div>
            </div>
          </div>

          <div style="margin-bottom:10px">
            <div style="display:flex;justify-content:space-between;margin-bottom:6px">
              <span style="font-size:0.78rem;color:var(--text-muted)">${Math.round(pct)}% used</span>
              <span style="font-size:0.78rem;font-weight:600;color:${statusColor}">
                ${over ? '−' : '+'}₹${Math.abs(remaining).toLocaleString()} ${over ? 'over' : 'left'}
              </span>
            </div>
            <div class="progress-track" style="height:8px">
              <div class="progress-fill ${over ? 'over' : ''}" style="width:${pct}%;--fill-color:${cat.color}"></div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    if (!categories.length) {
      container.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1;padding:60px">
          <div class="empty-icon">📊</div>
          <h4>No Categories Yet</h4>
          <p>Add your first budget category to get started.</p>
        </div>`;
    }
  },

  renderSummary() {
    const { categories, expenses } = this.getHouseholdData();
    const monthExpenses = this.getCurrentMonthExpenses(expenses);
    const totalBudget = categories.reduce((s, c) => s + c.budget_amount, 0);
    const totalSpent  = monthExpenses.reduce((s, e) => s + e.amount, 0);
    const totalLeft   = totalBudget - totalSpent;
    const overCount   = categories.filter(cat => {
      const spent = monthExpenses.filter(e => e.category_id === cat.id).reduce((s, e) => s + e.amount, 0);
      return spent > cat.budget_amount;
    }).length;

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('summary-total-budget', `₹${totalBudget.toLocaleString()}`);
    set('summary-total-spent',  `₹${totalSpent.toLocaleString()}`);
    set('summary-remaining',    totalLeft >= 0 ? `₹${totalLeft.toLocaleString()}` : `−₹${Math.abs(totalLeft).toLocaleString()}`);
    set('summary-overspent',    overCount);
    set('summary-categories',   categories.length);

    const pct = totalBudget > 0 ? Math.min(Math.round((totalSpent / totalBudget) * 100), 100) : 0;
    const bar = document.getElementById('summary-progress');
    if (bar) {
      bar.style.width = pct + '%';
      bar.classList.toggle('over', totalSpent > totalBudget);
    }
    const pctLabel = document.getElementById('summary-pct');
    if (pctLabel) pctLabel.textContent = pct + '%';
  },

  openAddModal() {
    document.getElementById('modal-title').textContent    = 'Add Category';
    document.getElementById('save-cat-btn').textContent   = 'Add Category';
    document.getElementById('cat-id-input').value         = '';
    document.getElementById('cat-name').value             = '';
    document.getElementById('cat-budget').value           = '';
    document.getElementById('cat-icon').value             = '📦';
    document.getElementById('cat-color').value            = '#10b981';
    document.getElementById('cat-modal').classList.remove('hidden');
  },

  openEditModal(catId) {
    const cat = this.db.categories.find(c => c.id === catId);
    if (!cat) return;
    document.getElementById('modal-title').textContent    = 'Edit Category';
    document.getElementById('save-cat-btn').textContent   = 'Save Changes';
    document.getElementById('cat-id-input').value         = cat.id;
    document.getElementById('cat-name').value             = cat.name;
    document.getElementById('cat-budget').value           = cat.budget_amount;
    document.getElementById('cat-icon').value             = cat.icon || '📦';
    document.getElementById('cat-color').value            = cat.color || '#10b981';
    document.getElementById('cat-modal').classList.remove('hidden');
  },

  closeModal() {
    document.getElementById('cat-modal').classList.add('hidden');
  },

  saveCategory() {
    const id     = document.getElementById('cat-id-input').value;
    const name   = document.getElementById('cat-name').value.trim();
    const budget = parseFloat(document.getElementById('cat-budget').value);
    const icon   = document.getElementById('cat-icon').value.trim() || '📦';
    const color  = document.getElementById('cat-color').value;

    if (!name)           { showToast('error', 'Name Required',   'Enter a category name.');       return; }
    if (!budget || budget <= 0) { showToast('error', 'Budget Required', 'Enter a valid budget amount.'); return; }

    if (id) {
      const idx = this.db.categories.findIndex(c => c.id === id);
      if (idx !== -1) {
        this.db.categories[idx] = { ...this.db.categories[idx], name, budget_amount: budget, icon, color };
        showToast('success', 'Budget Updated', `${icon} ${name} budget set to ₹${budget.toLocaleString()}`);
      }
    } else {
      const { hhId } = this.getHouseholdData();
      this.db.categories.push({
        id: genId('cat'), household_id: hhId, name, budget_amount: budget, icon, color
      });
      showToast('success', 'Category Added', `${icon} ${name} added with ₹${budget.toLocaleString()} budget.`);
    }

    DB.save(this.db);
    this.closeModal();
    this.renderBudgetCards();
    this.renderSummary();
  },

  deleteCategory(catId) {
    const cat = this.db.categories.find(c => c.id === catId);
    if (!cat) return;
    const expCount = this.db.expenses.filter(e => e.category_id === catId).length;
    const msg = expCount > 0
      ? `Delete "${cat.name}"? This will also remove ${expCount} associated expense${expCount !== 1 ? 's' : ''}. This cannot be undone.`
      : `Delete "${cat.name}"? This cannot be undone.`;

    if (!confirm(msg)) return;

    this.db.categories = this.db.categories.filter(c => c.id !== catId);
    this.db.expenses   = this.db.expenses.filter(e => e.category_id !== catId);
    DB.save(this.db);
    showToast('info', 'Category Deleted', `"${cat.name}" and its expenses have been removed.`);
    this.renderBudgetCards();
    this.renderSummary();
  },

  bindEvents() {
    document.getElementById('add-cat-btn')?.addEventListener('click', () => this.openAddModal());
    document.getElementById('save-cat-btn')?.addEventListener('click', () => this.saveCategory());
    document.getElementById('close-modal-btn')?.addEventListener('click', () => this.closeModal());
    document.getElementById('cancel-modal-btn')?.addEventListener('click', () => this.closeModal());
    document.getElementById('cat-modal')?.addEventListener('click', e => {
      if (e.target === document.getElementById('cat-modal')) this.closeModal();
    });
    document.getElementById('logout-btn')?.addEventListener('click', () => Auth.logout());
  }
};

window.Budgets = Budgets;
window.addEventListener('DOMContentLoaded', () => Budgets.init());
