/**
 * expenses.js — Expense Entry & Management
 * Family Budget & Finance Planner
 */

const Expenses = {
  session: null,
  db: null,
  editingId: null,

  async init() {
    Auth.requireAuth();
    this.session = Auth.getSession();
    this.db = await DB.init();

    renderSidebarUser();
    initMobileMenu();
    this.populateForm();
    this.renderExpenseList();
    this.bindEvents();
  },

  getHouseholdData() {
    const hhId = this.session.household_id;
    const categories = this.db.categories.filter(c => c.household_id === hhId);
    const catIds = categories.map(c => c.id);
    const expenses  = this.db.expenses.filter(e => catIds.includes(e.category_id));
    return { categories, expenses, catIds };
  },

  populateForm() {
    const { categories } = this.getHouseholdData();
    const catSel = document.getElementById('exp-category');
    if (catSel) {
      catSel.innerHTML = '<option value="">Select category...</option>' +
        categories.map(c => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join('');
    }

    const userSel = document.getElementById('exp-user');
    if (userSel) {
      const hhUsers = this.db.users.filter(u => u.household_id === this.session.household_id);
      userSel.innerHTML = hhUsers.map(u =>
        `<option value="${u.id}" ${u.id === this.session.user_id ? 'selected' : ''}>${u.name}</option>`
      ).join('');
    }

    // Default date to today
    const dateInput = document.getElementById('exp-date');
    if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
  },

  validateForm() {
    const amount   = parseFloat(document.getElementById('exp-amount').value);
    const category = document.getElementById('exp-category').value;
    const date     = document.getElementById('exp-date').value;
    const user     = document.getElementById('exp-user').value;

    if (!amount || amount <= 0) { showToast('error', 'Invalid Amount', 'Enter a valid positive amount.'); return false; }
    if (!category) { showToast('error', 'Category Required', 'Please select a category.'); return false; }
    if (!date)     { showToast('error', 'Date Required', 'Please select a date.'); return false; }
    if (!user)     { showToast('error', 'User Required', 'Please select who spent this.'); return false; }
    return true;
  },

  saveExpense() {
    if (!this.validateForm()) return;

    const amount   = parseFloat(document.getElementById('exp-amount').value);
    const category = document.getElementById('exp-category').value;
    const date     = document.getElementById('exp-date').value;
    const user     = document.getElementById('exp-user').value;
    const notes    = document.getElementById('exp-notes').value.trim();

    if (this.editingId) {
      const idx = this.db.expenses.findIndex(e => e.id === this.editingId);
      if (idx !== -1) {
        this.db.expenses[idx] = { id: this.editingId, category_id: category, user_id: user, amount, date, notes };
        DB.save(this.db);
        showToast('success', 'Expense Updated', 'Changes saved successfully.');
      }
      this.editingId = null;
      document.getElementById('form-title').textContent = 'Add New Expense';
      document.getElementById('submit-btn').textContent = '+ Add Expense';
      document.getElementById('cancel-edit-btn').classList.add('hidden');
    } else {
      const newExpense = { id: genId('exp'), category_id: category, user_id: user, amount, date, notes };
      this.db.expenses.push(newExpense);
      DB.save(this.db);
      showToast('success', 'Expense Added', `₹${amount.toLocaleString()} recorded.`);
      this.checkBudgetAlert(category, amount);
    }

    this.clearForm();
    this.renderExpenseList();
  },

  checkBudgetAlert(categoryId, addedAmount) {
    const cat = this.db.categories.find(c => c.id === categoryId);
    if (!cat) return;
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    const spent = this.db.expenses
      .filter(e => e.category_id === categoryId && e.date.startsWith(month))
      .reduce((s, e) => s + e.amount, 0);
    const pct = cat.budget_amount > 0 ? (spent / cat.budget_amount) * 100 : 0;
    if (pct >= 100) {
      showToast('error', `${cat.icon} Budget Exceeded!`, `${cat.name} is ${Math.round(pct - 100)}% over budget this month.`, 5000);
    } else if (pct >= 80) {
      showToast('warning', `${cat.icon} Budget Warning`, `${cat.name} is at ${Math.round(pct)}% of budget.`, 4000);
    }
  },

  clearForm() {
    ['exp-amount', 'exp-notes'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    const dateInput = document.getElementById('exp-date');
    if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
    const catSel = document.getElementById('exp-category');
    if (catSel) catSel.selectedIndex = 0;
  },

  deleteExpense(id) {
    if (!confirm('Delete this expense? This cannot be undone.')) return;
    this.db.expenses = this.db.expenses.filter(e => e.id !== id);
    DB.save(this.db);
    showToast('info', 'Expense Deleted', 'The record has been removed.');
    this.renderExpenseList();
  },

  editExpense(id) {
    const exp = this.db.expenses.find(e => e.id === id);
    if (!exp) return;
    this.editingId = id;

    document.getElementById('exp-amount').value   = exp.amount;
    document.getElementById('exp-category').value = exp.category_id;
    document.getElementById('exp-date').value     = exp.date;
    document.getElementById('exp-user').value     = exp.user_id;
    document.getElementById('exp-notes').value    = exp.notes || '';
    document.getElementById('form-title').textContent   = 'Edit Expense';
    document.getElementById('submit-btn').textContent   = 'Save Changes';
    document.getElementById('cancel-edit-btn').classList.remove('hidden');

    document.getElementById('expense-form-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },

  renderExpenseList() {
    const { categories, expenses } = this.getHouseholdData();
    const tbody = document.getElementById('expenses-table-body');
    const countEl = document.getElementById('expense-count');
    if (!tbody) return;

    // Filter state
    const filterCat   = document.getElementById('filter-category')?.value || '';
    const filterMonth = document.getElementById('filter-month')?.value     || '';
    const filterUser  = document.getElementById('filter-user')?.value      || '';
    const searchTerm  = document.getElementById('search-expenses')?.value?.toLowerCase() || '';

    let filtered = [...expenses];
    if (filterCat)   filtered = filtered.filter(e => e.category_id === filterCat);
    if (filterMonth) filtered = filtered.filter(e => e.date.startsWith(filterMonth));
    if (filterUser)  filtered = filtered.filter(e => e.user_id === filterUser);
    if (searchTerm)  filtered = filtered.filter(e => (e.notes||'').toLowerCase().includes(searchTerm));

    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

    if (countEl) countEl.textContent = `${filtered.length} expense${filtered.length !== 1 ? 's' : ''}`;

    if (!filtered.length) {
      tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state" style="padding:32px"><div class="empty-icon">📋</div><h4>No Expenses Found</h4><p>Try adjusting filters or add a new expense.</p></div></td></tr>`;
      this.renderTotalRow(0);
      return;
    }

    tbody.innerHTML = filtered.map(exp => {
      const cat  = categories.find(c => c.id === exp.category_id) || {};
      const user = this.db.users.find(u => u.id === exp.user_id)   || {};
      return `
        <tr>
          <td>${formatDate(exp.date)}</td>
          <td>
            <span class="category-tag" style="--tag-bg:${cat.color || '#2dd4bf'}22;--tag-color:${cat.color || '#2dd4bf'}">
              ${cat.icon || '📦'} ${cat.name || '—'}
            </span>
          </td>
          <td class="td-amount" style="color:var(--red)">−₹${exp.amount.toLocaleString()}</td>
          <td>
            <div style="display:flex;align-items:center;gap:8px">
              <div class="avatar" style="width:26px;height:26px;font-size:11px;">${(user.name||'?').charAt(0)}</div>
              <span class="text-sm">${user.name || '—'}</span>
            </div>
          </td>
          <td class="td-muted" style="max-width:180px" title="${exp.notes || ''}">${exp.notes ? (exp.notes.length > 30 ? exp.notes.slice(0,30)+'…' : exp.notes) : '—'}</td>
          <td>
            <div style="display:flex;gap:6px">
              <button class="btn btn-ghost btn-icon btn-sm" onclick="Expenses.editExpense('${exp.id}')" title="Edit">✏️</button>
              <button class="btn btn-ghost btn-icon btn-sm" onclick="Expenses.deleteExpense('${exp.id}')" title="Delete" style="color:var(--red)">🗑️</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    this.renderTotalRow(filtered.reduce((s, e) => s + e.amount, 0));
    this.populateFilterDropdowns(categories, expenses);
  },

  renderTotalRow(total) {
    const el = document.getElementById('expense-total');
    if (el) el.textContent = `Total: ₹${total.toLocaleString()}`;
  },

  populateFilterDropdowns(categories, expenses) {
    const catFilter = document.getElementById('filter-category');
    if (catFilter && catFilter.children.length <= 1) {
      catFilter.innerHTML = '<option value="">All Categories</option>' +
        categories.map(c => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join('');
    }

    const monthFilter = document.getElementById('filter-month');
    if (monthFilter && monthFilter.children.length <= 1) {
      const months = [...new Set(expenses.map(e => e.date.slice(0, 7)))].sort().reverse();
      monthFilter.innerHTML = '<option value="">All Months</option>' +
        months.map(m => `<option value="${m}">${getMonthLabel(m)}</option>`).join('');
    }

    const userFilter = document.getElementById('filter-user');
    if (userFilter && userFilter.children.length <= 1) {
      const hhUsers = this.db.users.filter(u => u.household_id === this.session.household_id);
      userFilter.innerHTML = '<option value="">All Members</option>' +
        hhUsers.map(u => `<option value="${u.id}">${u.name}</option>`).join('');
    }
  },

  bindEvents() {
    document.getElementById('submit-btn')?.addEventListener('click', () => this.saveExpense());

    document.getElementById('cancel-edit-btn')?.addEventListener('click', () => {
      this.editingId = null;
      this.clearForm();
      document.getElementById('form-title').textContent  = 'Add New Expense';
      document.getElementById('submit-btn').textContent  = '+ Add Expense';
      document.getElementById('cancel-edit-btn').classList.add('hidden');
    });

    ['filter-category', 'filter-month', 'filter-user'].forEach(id => {
      document.getElementById(id)?.addEventListener('change', () => this.renderExpenseList());
    });

    document.getElementById('search-expenses')?.addEventListener('input', () => this.renderExpenseList());

    document.getElementById('logout-btn')?.addEventListener('click', () => Auth.logout());
  }
};

window.Expenses = Expenses;
window.addEventListener('DOMContentLoaded', () => Expenses.init());
