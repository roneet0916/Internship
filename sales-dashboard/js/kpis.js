/**
 * kpis.js
 * Pure functions to calculate KPIs from a dataset array
 */

const kpis = {
  
  // Format numbers nicely
  formatCurrency(value) {
    if (value >= 1000000) return '$' + (value / 1000000).toFixed(2) + 'M';
    if (value >= 1000) return '$' + (value / 1000).toFixed(1) + 'k';
    return '$' + value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  },

  formatNumber(value) {
    if (value >= 1000000) return (value / 1000000).toFixed(2) + 'M';
    if (value >= 1000) return (value / 1000).toFixed(1) + 'k';
    return value.toLocaleString('en-US');
  },
  
  formatPercent(value) {
    const prefix = value > 0 ? '+' : '';
    return prefix + value.toFixed(1) + '%';
  },

  calculateAll(data, previousData = []) {
    if (!data || data.length === 0) {
      return this.emptyKPIs();
    }

    const current = this.computeMetrics(data);
    const previous = previousData.length > 0 ? this.computeMetrics(previousData) : null;

    // Calculate changes if we have previous data (e.g. comparing month over month)
    // For this simple version, we'll just compare first half of date range to second half, or return null if none
    
    // Top Product logic
    const productRevenues = {};
    data.forEach(row => {
      productRevenues[row.Product] = (productRevenues[row.Product] || 0) + row.Revenue;
    });
    
    let topProduct = 'None';
    let maxRev = 0;
    for (const [prod, rev] of Object.entries(productRevenues)) {
      if (rev > maxRev) {
        maxRev = rev;
        topProduct = prod;
      }
    }

    return {
      revenue: {
        value: this.formatCurrency(current.revenue),
        change: this.getChange(current.revenue, previous ? previous.revenue : null)
      },
      sales: {
        value: this.formatNumber(current.sales),
        change: this.getChange(current.sales, previous ? previous.sales : null)
      },
      aov: {
        value: this.formatCurrency(current.aov),
        change: this.getChange(current.aov, previous ? previous.aov : null)
      },
      units: {
        value: this.formatNumber(current.units),
        change: this.getChange(current.units, previous ? previous.units : null)
      },
      growth: {
        value: previous ? this.formatPercent(((current.revenue - previous.revenue) / (previous.revenue || 1)) * 100) : '—',
        change: null
      },
      topProduct: {
        value: topProduct,
        subValue: this.formatCurrency(maxRev),
        change: null
      }
    };
  },
  
  computeMetrics(data) {
    let revenue = 0;
    let sales = 0;
    let units = 0;
    
    data.forEach(row => {
      revenue += row.Revenue;
      sales += row.Sales;
      units += row.Units;
    });
    
    return {
      revenue,
      sales,
      units,
      aov: sales > 0 ? revenue / sales : 0
    };
  },
  
  getChange(current, previous) {
    if (previous === null || previous === 0) return null;
    const diff = current - previous;
    const percent = (diff / previous) * 100;
    
    return {
      isPositive: percent >= 0,
      text: this.formatPercent(percent)
    };
  },
  
  emptyKPIs() {
    return {
      revenue: { value: '—', change: null },
      sales: { value: '—', change: null },
      aov: { value: '—', change: null },
      units: { value: '—', change: null },
      growth: { value: '—', change: null },
      topProduct: { value: '—', subValue: '', change: null }
    };
  },

  updateDOM(kpiData) {
    // Helper to update a single KPI card
    const updateCard = (id, data, isSub = false) => {
      const valEl = document.getElementById(`kpi-${id}-val`);
      const chgEl = document.getElementById(`kpi-${id}-chg`);
      
      if (!valEl || !chgEl) return;
      
      // Counter animation logic
      valEl.textContent = data.value;
      
      if (data.change) {
        const svg = data.change.isPositive 
          ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>`
          : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>`;
          
        chgEl.innerHTML = svg + data.change.text;
        chgEl.className = 'kpi-change ' + (data.change.isPositive ? 'text-positive' : 'text-negative');
      } else if (isSub && data.subValue) {
        chgEl.textContent = data.subValue;
        chgEl.className = 'kpi-change';
      } else {
        chgEl.textContent = '';
      }
    };

    updateCard('revenue', kpiData.revenue);
    updateCard('sales', kpiData.sales);
    updateCard('aov', kpiData.aov);
    updateCard('units', kpiData.units);
    updateCard('growth', kpiData.growth);
    updateCard('topprod', kpiData.topProduct, true);
  }
};
