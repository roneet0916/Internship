/**
 * app.js
 * Main application orchestrator
 */

const app = {
  
  init() {
    this.bindNavigation();
    
    // Initialize modules
    dataLoader.init();
    filters.init();
    segmentation.init();
    
    // UI Elements
    this.mobileMenuBtn = document.getElementById('mobileMenuBtn');
    this.sidebar = document.getElementById('sidebar');
    this.loadingOverlay = document.getElementById('loadingOverlay');
    this.toastContainer = document.getElementById('toastContainer');
    this.rowCountLabel = document.getElementById('rowCountLabel');
    
    // Sidebar toggle for mobile
    if (this.mobileMenuBtn) {
      this.mobileMenuBtn.addEventListener('click', () => {
        this.sidebar.classList.add('open');
      });
    }
    
    const sidebarToggle = document.getElementById('sidebarToggle');
    if (sidebarToggle) {
      sidebarToggle.addEventListener('click', () => {
        this.sidebar.classList.remove('open');
      });
    }
    
    // Close sidebar when clicking outside on mobile
    document.addEventListener('click', (e) => {
      if (window.innerWidth <= 768 && 
          this.sidebar.classList.contains('open') && 
          !this.sidebar.contains(e.target) && 
          !this.mobileMenuBtn.contains(e.target)) {
        this.sidebar.classList.remove('open');
      }
    });

    // Export buttons
    document.getElementById('exportBtn').addEventListener('click', () => this.exportToCSV());
    document.getElementById('exportBtnTable').addEventListener('click', () => this.exportToCSV());

    // Check if offline/network issues blocked CDNs
    if (typeof Chart === 'undefined') {
      setTimeout(() => {
        this.showToast('Failed to load Chart.js. Some interactive visualizations may be unavailable offline.', 'error');
      }, 1000);
    }
    if (typeof XLSX === 'undefined') {
      setTimeout(() => {
        this.showToast('Failed to load SheetJS. Importing Excel/CSV files may be unavailable offline.', 'error');
      }, 1500);
    }
    if (typeof flatpickr === 'undefined') {
      setTimeout(() => {
        this.showToast('Failed to load Flatpickr. Custom date range selector is unavailable offline.', 'error');
      }, 2000);
    }

    // Automatically load sample data on startup
    dataLoader.generateSampleData();
  },
  
  bindNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('.section');
    const pageTitle = document.getElementById('pageTitle');
    
    const titles = {
      'overview': 'Sales Overview',
      'products': 'Product Analysis',
      'regions': 'Regional Performance',
      'segmentation': 'Customer Segmentation',
      'data': 'Raw Data'
    };
    
    navItems.forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        
        // Update active nav
        navItems.forEach(nav => nav.classList.remove('active'));
        item.classList.add('active');
        
        // Show target section
        const targetId = item.getAttribute('data-section');
        sections.forEach(sec => sec.classList.add('hidden'));
        document.getElementById(`section-${targetId}`).classList.remove('hidden');
        
        // Update title
        if (pageTitle) {
          pageTitle.textContent = titles[targetId] || 'Dashboard';
        }
        
        // Close mobile sidebar
        if (window.innerWidth <= 768) {
          this.sidebar.classList.remove('open');
        }
      });
    });
  },

  // Called when data is first loaded from a file or sample generator
  onDataLoaded() {
    filters.buildFilterUI();
    this.updateDashboard();
    
    this.hideLoading();
  },

  // Called when filters change
  updateDashboard() {
    const data = window.appData.filtered;
    
    // Update badge
    this.rowCountLabel.textContent = `${data.length.toLocaleString()} rows`;
    
    // 1. Update KPIs
    const kpiData = kpis.calculateAll(data);
    kpis.updateDOM(kpiData);
    
    // 2. Update Charts
    charts.renderAll(data);
    
    // 3. Update Table
    this.renderTable(data);

    // 4. Run Customer Segmentation
    segmentation.processAndRun();
  },
  
  renderTable(data) {
    const thead = document.getElementById('tableHead');
    const tbody = document.getElementById('tableBody');
    const emptyState = document.getElementById('tableEmpty');
    
    if (data.length === 0) {
      thead.innerHTML = '';
      tbody.innerHTML = '';
      emptyState.classList.remove('hidden');
      return;
    }
    
    emptyState.classList.add('hidden');
    
    // Render Header (max 10 cols)
    const fields = ['Date', 'Product', 'Region', 'Sales', 'Units', 'Revenue'];
    
    let headHtml = '<tr>';
    fields.forEach(f => {
      headHtml += `<th>${f}</th>`;
    });
    headHtml += '</tr>';
    thead.innerHTML = headHtml;
    
    // Render Body (limit to 100 rows for performance)
    const displayData = data.slice(0, 100);
    let bodyHtml = '';
    
    displayData.forEach(row => {
      bodyHtml += '<tr>';
      fields.forEach(f => {
        let val = row[f];
        if (val instanceof Date) {
          val = val.toLocaleDateString();
        } else if (f === 'Revenue') {
          val = kpis.formatCurrency(val);
        } else if (typeof val === 'number') {
          val = val.toLocaleString();
        }
        bodyHtml += `<td>${val}</td>`;
      });
      bodyHtml += '</tr>';
    });
    
    tbody.innerHTML = bodyHtml;
  },
  
  exportToCSV() {
    const data = window.appData.filtered;
    if (data.length === 0) {
      this.showToast('No data to export', 'error');
      return;
    }
    
    // Create CSV string
    const fields = ['Date', 'Product', 'Region', 'Sales', 'Units', 'Revenue'];
    let csv = fields.join(',') + '\n';
    
    data.forEach(row => {
      const line = fields.map(f => {
        let val = row[f];
        if (val instanceof Date) {
          val = val.toISOString().split('T')[0];
        }
        // Escape quotes
        if (typeof val === 'string') {
          return `"${val.replace(/"/g, '""')}"`;
        }
        return val;
      }).join(',');
      csv += line + '\n';
    });
    
    // Trigger download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    
    link.setAttribute("href", url);
    link.setAttribute("download", `sales_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    this.showToast('Data exported successfully', 'success');
  },
  
  showLoading() {
    this.loadingOverlay.classList.remove('hidden');
  },
  
  hideLoading() {
    this.loadingOverlay.classList.add('hidden');
  },
  
  showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icon = type === 'success' 
      ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`
      : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
      
    toast.innerHTML = `${icon}<span>${message}</span>`;
    
    this.toastContainer.appendChild(toast);
    
    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => {
        toast.remove();
      }, 300);
    }, 3000);
  }
};

// Start app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  app.init();
});
