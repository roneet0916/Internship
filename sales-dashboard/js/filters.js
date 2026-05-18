/**
 * filters.js
 * Logic for sidebar filters and slicers
 */

const filters = {
  
  state: {
    dateRange: [],
    regions: [],
    productSearch: '',
    topN: 5
  },
  
  init() {
    this.datePicker = null;
    this.bindEvents();
  },
  
  bindEvents() {
    // Search
    document.getElementById('productSearch').addEventListener('input', (e) => {
      this.state.productSearch = e.target.value.toLowerCase();
      this.applyFilters();
    });
    
    // Top N
    const topNBtns = document.querySelectorAll('.topn-btn');
    topNBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        topNBtns.forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this.state.topN = parseInt(e.target.getAttribute('data-n'));
        this.applyFilters(); // Re-render charts mainly
      });
    });
    
    // Reset
    document.getElementById('resetFilters').addEventListener('click', () => {
      this.resetFilters();
    });
    
    // Clear Date
    document.getElementById('clearDateBtn').addEventListener('click', () => {
      if (this.datePicker) this.datePicker.clear();
      this.state.dateRange = [];
      document.getElementById('clearDateBtn').classList.remove('visible');
      this.applyFilters();
    });
  },
  
  buildFilterUI() {
    const data = window.appData.raw;
    if (!data.length) return;
    
    // 1. Setup Date Picker
    const dates = data.map(d => d.Date.getTime());
    const minDate = new Date(Math.min(...dates));
    const maxDate = new Date(Math.max(...dates));
    
    if (this.datePicker) this.datePicker.destroy();
    
    this.datePicker = flatpickr("#dateRangePicker", {
      mode: "range",
      minDate: minDate,
      maxDate: maxDate,
      dateFormat: "Y-m-d",
      onChange: (selectedDates) => {
        if (selectedDates.length === 2) {
          // Add time to end date to include the whole day
          const end = new Date(selectedDates[1]);
          end.setHours(23, 59, 59, 999);
          
          this.state.dateRange = [selectedDates[0], end];
          document.getElementById('clearDateBtn').classList.add('visible');
          this.applyFilters();
        }
      }
    });
    
    // 2. Setup Region Checkboxes
    const regions = [...new Set(data.map(d => d.Region))].sort();
    const container = document.getElementById('regionCheckboxes');
    container.innerHTML = '';
    
    this.state.regions = [...regions]; // All selected by default
    
    regions.forEach(region => {
      const id = `reg-${region.replace(/\s+/g, '-')}`;
      const div = document.createElement('label');
      div.className = 'checkbox-label';
      
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = true;
      cb.value = region;
      cb.id = id;
      
      cb.addEventListener('change', (e) => {
        if (e.target.checked) {
          if (!this.state.regions.includes(region)) this.state.regions.push(region);
        } else {
          this.state.regions = this.state.regions.filter(r => r !== region);
        }
        this.applyFilters();
      });
      
      div.appendChild(cb);
      div.appendChild(document.createTextNode(region));
      container.appendChild(div);
    });
  },
  
  applyFilters() {
    const { dateRange, regions, productSearch } = this.state;
    
    window.appData.filtered = window.appData.raw.filter(row => {
      // Date filter
      if (dateRange.length === 2) {
        if (row.Date < dateRange[0] || row.Date > dateRange[1]) return false;
      }
      
      // Region filter
      if (regions.length > 0 && !regions.includes(row.Region)) {
        return false;
      }
      
      // Search filter
      if (productSearch) {
        if (!row.Product.toLowerCase().includes(productSearch)) return false;
      }
      
      return true;
    });
    
    app.updateDashboard();
  },
  
  resetFilters() {
    // Reset state
    this.state.productSearch = '';
    this.state.dateRange = [];
    
    // Reset UI
    document.getElementById('productSearch').value = '';
    
    if (this.datePicker) this.datePicker.clear();
    document.getElementById('clearDateBtn').classList.remove('visible');
    
    const checkboxes = document.getElementById('regionCheckboxes').querySelectorAll('input[type="checkbox"]');
    this.state.regions = [];
    checkboxes.forEach(cb => {
      cb.checked = true;
      this.state.regions.push(cb.value);
    });
    
    // Reset Top N
    document.getElementById('topn-5').click(); // This triggers applyFilters automatically
  }
};
