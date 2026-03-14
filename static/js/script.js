let categoryChart;
let barChart;

// Toast notification
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// Theme toggle
function setupThemeToggle() {
    const toggleBtn = document.getElementById('theme-toggle');
    if (!toggleBtn) return;

    toggleBtn.addEventListener('click', () => {
        const isDark = document.body.classList.toggle('dark-mode');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        updateChartColors();
    });
}

// Update chart colors based on theme
function updateChartColors() {
    const isDark = document.body.classList.contains('dark-mode');
    const textColor = isDark ? '#e9ecef' : '#212529';
    const gridColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';

    if (categoryChart) {
        categoryChart.options.plugins.legend.labels.color = textColor;
        categoryChart.update();
    }
    if (barChart) {
        barChart.options.scales.x.grid.color = gridColor;
        barChart.options.scales.y.grid.color = gridColor;
        barChart.options.scales.x.ticks.color = textColor;
        barChart.options.scales.y.ticks.color = textColor;
        barChart.update();
    }
}

// Format date
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

// Load expenses
async function loadExpenses(startDate = '', endDate = '') {
    try {
        const tbody = document.getElementById('expenses-tbody');
        tbody.innerHTML = '<tr><td colspan="5" class="loading-message">Loading expenses...</td></tr>';

        let url = '/get_expenses';
        if (startDate && endDate) {
            url += `?start_date=${startDate}&end_date=${endDate}`;
        }

        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch expenses');
        
        const expenses = await response.json();
        
        if (expenses.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="loading-message">No expenses found</td></tr>';
            return;
        }

        // Sort by date (newest first)
        expenses.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        tbody.innerHTML = expenses.map(expense => `
            <tr>
                <td>${formatDate(expense.date)}</td>
                <td>${expense.description}</td>
                <td>₹${expense.amount.toFixed(2)}</td>
                <td><span class="category-badge category-${expense.category}">${expense.category}</span></td>
                <td>
                    <button class="action-btn edit-btn" data-id="${expense.id}">Edit</button>
                    <button class="action-btn delete-btn" data-id="${expense.id}">Delete</button>
                </td>
            </tr>
        `).join('');
        
    } catch (error) {
        console.error('Error:', error);
        document.getElementById('expenses-tbody').innerHTML = 
            '<tr><td colspan="5" class="loading-message">Error loading expenses</td></tr>';
        showToast('Failed to load expenses', 'danger');
    }
}

// Load stats
async function loadStats() {
    try {
        const response = await fetch('/get_stats');
        if (!response.ok) throw new Error('Failed to fetch stats');
        
        const stats = await response.json();
        
        // Update total amount
        const totalEl = document.getElementById('total-amount');
        if (totalEl) {
            totalEl.textContent = `₹${stats.total.toFixed(2)}`;
        }
        
        // Update budget input
        const budgetInput = document.getElementById('monthly-budget');
        if (budgetInput && stats.budget > 0) {
            budgetInput.value = stats.budget;
        }
        
        // Update budget status
        if (stats.budget > 0) {
            const remaining = stats.budget - stats.total;
            const statusEl = document.getElementById('budget-status');
            if (statusEl) {
                if (remaining >= 0) {
                    statusEl.textContent = `Remaining: ₹${remaining.toFixed(2)}`;
                    statusEl.style.color = 'var(--success)';
                } else {
                    statusEl.textContent = `Overspent: ₹${Math.abs(remaining).toFixed(2)}`;
                    statusEl.style.color = 'var(--danger)';
                }
            }
        }
        
        // Update charts if they exist on the page
        updateCharts(stats);
        
    } catch (error) {
        console.error('Error loading stats:', error);
        showToast('Failed to load statistics', 'danger');
    }
}

// Update charts
function updateCharts(stats) {
    const pieCanvas = document.getElementById('categoryChart');
    const barCanvas = document.getElementById('barChart');
    
    if (!pieCanvas && !barCanvas) return;
    
    const categories = Object.keys(stats.by_category);
    const amounts = Object.values(stats.by_category);
    
    // Colors for pie chart
    const colors = {
        'Home': '#ffec99',
        'Education': '#b2f2bb',
        'Hobby': '#ffc9c9',
        'Transportation': '#a5d8ff',
        'Food': '#ffd8a8',
        'Health': '#d0bfff',
        'Shopping': '#2abbbe',
        'Other': '#e9ecef'
    };
    
    const backgroundColors = categories.map(cat => colors[cat] || '#e9ecef');
    const isDark = document.body.classList.contains('dark-mode');
    const textColor = isDark ? '#e9ecef' : '#212529';
    
    // Pie Chart
    if (pieCanvas) {
        const pieCtx = pieCanvas.getContext('2d');
        
        if (categoryChart) {
            categoryChart.data.labels = categories;
            categoryChart.data.datasets[0].data = amounts;
            categoryChart.data.datasets[0].backgroundColor = backgroundColors;
            categoryChart.update();
        } else {
            categoryChart = new Chart(pieCtx, {
                type: 'pie',
                data: {
                    labels: categories,
                    datasets: [{
                        data: amounts,
                        backgroundColor: backgroundColors,
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'right',
                            labels: { color: textColor }
                        }
                    }
                }
            });
        }
    }
    
    // Bar Chart
    if (barCanvas) {
        const months = Object.keys(stats.monthly_totals).sort();
        const monthlyAmounts = months.map(month => stats.monthly_totals[month]);
        const barCtx = barCanvas.getContext('2d');
        
        if (barChart) {
            barChart.data.labels = months;
            barChart.data.datasets[0].data = monthlyAmounts;
            barChart.update();
        } else {
            barChart = new Chart(barCtx, {
                type: 'bar',
                data: {
                    labels: months,
                    datasets: [{
                        label: 'Monthly Spending',
                        data: monthlyAmounts,
                        backgroundColor: '#8267d4',
                        borderRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: { color: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' },
                            ticks: { color: textColor }
                        },
                        x: {
                            grid: { display: false },
                            ticks: { color: textColor }
                        }
                    }
                }
            });
        }
    }
}

// Toggle select all/deselect all
let allSelected = false;

document.getElementById('select-all-btn').addEventListener('click', function() {
    const checkboxes = document.querySelectorAll('input[name="split-with"]');
    
    if (allSelected) {
        // Deselect all
        checkboxes.forEach(cb => cb.checked = false);
        this.textContent = '✅ Select All';
        allSelected = false;
    } else {
        // Select all
        checkboxes.forEach(cb => cb.checked = true);
        this.textContent = '❌ Deselect All';
        allSelected = false; // Actually true, but we'll toggle in next step
        allSelected = true;
    }
});

// Budget form
document.addEventListener('submit', async (e) => {
    if (e.target.id === 'budget-form') {
        e.preventDefault();
        
        const budgetInput = document.getElementById('monthly-budget');
        const budget = parseFloat(budgetInput.value);
        
        if (!budget || budget <= 0) {
            showToast('Please enter a valid budget', 'danger');
            return;
        }

        try {
            const response = await fetch('/set_budget', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: `budget=${budget}`
            });
            
            if (response.ok) {
                showToast(`Budget set to ₹${budget}`, 'success');
                loadStats();
            } else {
                throw new Error('Failed to set budget');
            }
        } catch (error) {
            showToast(error.message, 'danger');
        }
    }
});

// Expense form
document.addEventListener('submit', async (e) => {
    if (e.target.id === 'expense-form') {
        e.preventDefault();
        
        const form = e.target;
        const amount = parseFloat(document.getElementById('amount').value);
        const category = document.getElementById('category').value;
        const description = document.getElementById('description').value;
        const date = document.getElementById('date').value || new Date().toISOString().split('T')[0];
        
        if (!amount || !category || !description) {
            showToast('Please fill all fields', 'danger');
            return;
        }
        
        try {
            let url = '/add_expense';
            let body = new URLSearchParams({ amount, category, description, date });
            
            if (form.dataset.editMode === 'true') {
                url = '/update_expense';
                body.append('id', form.dataset.editId);
            }
            
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: body
            });
            
            if (response.ok) {
                // Reset form
                form.reset();
                delete form.dataset.editMode;
                delete form.dataset.editId;
                document.getElementById('date').valueAsDate = new Date();
                document.getElementById('submit-expense-btn').textContent = 'Add Expense';
                
                showToast('Expense saved successfully', 'success');
                loadExpenses();
                loadStats();
            } else {
                throw new Error('Failed to save expense');
            }
        } catch (error) {
            showToast(error.message, 'danger');
        }
    }
});

// Handle edit/delete clicks
document.addEventListener('click', async (e) => {
    // Edit
    if (e.target.classList.contains('edit-btn')) {
        const id = parseInt(e.target.dataset.id);
        
        try {
            const response = await fetch('/get_expenses');
            const expenses = await response.json();
            const expense = expenses.find(e => e.id === id);
            
            if (expense) {
                document.getElementById('amount').value = expense.amount;
                document.getElementById('category').value = expense.category;
                document.getElementById('description').value = expense.description;
                document.getElementById('date').value = expense.date;
                
                const form = document.getElementById('expense-form');
                form.dataset.editMode = 'true';
                form.dataset.editId = id;
                document.getElementById('submit-expense-btn').textContent = 'Update Expense';
                
                // Scroll to form
                form.scrollIntoView({ behavior: 'smooth' });
            }
        } catch (error) {
            showToast('Failed to load expense', 'danger');
        }
    }
    
    // Delete
    if (e.target.classList.contains('delete-btn')) {
        if (!confirm('Are you sure you want to delete this expense?')) return;
        
        const id = e.target.dataset.id;
        
        try {
            const response = await fetch(`/delete_expense/${id}`, { method: 'DELETE' });
            if (response.ok) {
                showToast('Expense deleted', 'success');
                loadExpenses();
                loadStats();
            } else {
                throw new Error('Failed to delete');
            }
        } catch (error) {
            showToast(error.message, 'danger');
        }
    }
});

// Filter button
document.getElementById('filter-btn')?.addEventListener('click', () => {
    const start = document.getElementById('start-date').value;
    const end = document.getElementById('end-date').value;
    
    if (start && end) {
        if (new Date(start) > new Date(end)) {
            showToast('Start date must be before end date', 'danger');
            return;
        }
        loadExpenses(start, end);
        // Also load stats with filter
        fetch(`/get_stats?start_date=${start}&end_date=${end}`)
            .then(res => res.json())
            .then(stats => updateCharts(stats))
            .catch(() => showToast('Failed to load stats', 'danger'));
    } else {
        showToast('Please select both dates', 'danger');
    }
});

// Export button
document.getElementById('export-btn')?.addEventListener('click', () => {
    window.location.href = '/export_expenses';
});