/**
 * charts.js
 * Chart.js configurations and rendering logic
 */

// Common Chart.js styling options for the dark theme
Chart.defaults.color = '#94a3b8';
Chart.defaults.font.family = "'Inter', sans-serif";
Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(18, 23, 40, 0.9)';
Chart.defaults.plugins.tooltip.titleColor = '#fff';
Chart.defaults.plugins.tooltip.padding = 12;
Chart.defaults.plugins.tooltip.cornerRadius = 8;
Chart.defaults.plugins.tooltip.borderColor = 'rgba(255,255,255,0.1)';
Chart.defaults.plugins.tooltip.borderWidth = 1;

const commonOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      labels: { color: '#f1f5f9', usePointStyle: true, boxWidth: 8 }
    }
  },
  scales: {
    x: {
      grid: { color: 'rgba(255, 255, 255, 0.05)', drawBorder: false }
    },
    y: {
      grid: { color: 'rgba(255, 255, 255, 0.05)', drawBorder: false },
      beginAtZero: true
    }
  },
  animation: { duration: 800, easing: 'easeOutQuart' }
};

const charts = {
  instances: {},
  trendMetric: 'revenue', // Default metric for main trend chart
  
  colors: {
    blue: '#4f8ef7',
    emerald: '#00d4aa',
    purple: '#9d4edd',
    amber: '#f59e0b',
    pink: '#f72585',
    orange: '#ff7aa2',
    palette: ['#4f8ef7', '#00d4aa', '#9d4edd', '#f59e0b', '#f72585', '#ff7aa2', '#4cc9f0', '#4361ee']
  },

  initEvents() {
    // Trend chart toggle
    document.getElementById('trend-revenue-btn')?.addEventListener('click', (e) => {
      this.trendMetric = 'revenue';
      e.target.classList.add('active');
      document.getElementById('trend-units-btn').classList.remove('active');
      this.renderTrendChart(window.appData.filtered);
    });
    
    document.getElementById('trend-units-btn')?.addEventListener('click', (e) => {
      this.trendMetric = 'units';
      e.target.classList.add('active');
      document.getElementById('trend-revenue-btn').classList.remove('active');
      this.renderTrendChart(window.appData.filtered);
    });
  },

  renderAll(data) {
    if (!this.eventsBound) {
      this.initEvents();
      this.eventsBound = true;
    }
    
    if (data.length === 0) {
      this.destroyAll();
      return;
    }

    // Process data for different views
    const monthlyData = this.aggregateByMonth(data);
    const productData = this.aggregateByProduct(data);
    const regionData = this.aggregateByRegion(data);

    // Section 1: Overview
    this.renderTrendChart(monthlyData, true);
    this.renderMonthlySalesChart(monthlyData);
    this.renderScatterChart(productData);

    // Section 2: Products
    this.renderProductBarChart(productData);
    this.renderProductDoughnutChart(productData);
    this.renderProductBubbleChart(productData);

    // Section 3: Regions
    this.renderRegionDoughnutChart(regionData);
    this.renderRegionBarChart(this.aggregateByRegionMonth(data));
    this.renderRegionLineChart(this.aggregateByRegionMonth(data));
  },

  destroyAll() {
    Object.keys(this.instances).forEach(key => {
      if (this.instances[key]) {
        this.instances[key].destroy();
        this.instances[key] = null;
      }
    });
  },

  // --- Aggregation Helpers ---
  
  aggregateByMonth(data) {
    const agg = {};
    data.forEach(row => {
      // Key format: YYYY-MM
      const d = row.Date;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      
      if (!agg[key]) agg[key] = { month: key, revenue: 0, sales: 0, units: 0, date: new Date(d.getFullYear(), d.getMonth(), 1) };
      agg[key].revenue += row.Revenue;
      agg[key].sales += row.Sales;
      agg[key].units += row.Units;
    });
    
    return Object.values(agg).sort((a, b) => a.date - b.date);
  },
  
  aggregateByProduct(data) {
    const agg = {};
    data.forEach(row => {
      const key = row.Product;
      if (!agg[key]) agg[key] = { product: key, revenue: 0, sales: 0, units: 0 };
      agg[key].revenue += row.Revenue;
      agg[key].sales += row.Sales;
      agg[key].units += row.Units;
    });
    
    return Object.values(agg).sort((a, b) => b.revenue - a.revenue); // Sort desc by revenue
  },
  
  aggregateByRegion(data) {
    const agg = {};
    data.forEach(row => {
      const key = row.Region;
      if (!agg[key]) agg[key] = { region: key, revenue: 0, sales: 0, units: 0 };
      agg[key].revenue += row.Revenue;
      agg[key].sales += row.Sales;
      agg[key].units += row.Units;
    });
    
    return Object.values(agg).sort((a, b) => b.revenue - a.revenue);
  },

  aggregateByRegionMonth(data) {
    const agg = {};
    const months = new Set();
    const regions = new Set();
    
    data.forEach(row => {
      const d = row.Date;
      const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const r = row.Region;
      
      months.add(m);
      regions.add(r);
      
      if (!agg[r]) agg[r] = {};
      if (!agg[r][m]) agg[r][m] = 0;
      agg[r][m] += row.Revenue;
    });
    
    return {
      months: Array.from(months).sort(),
      regions: Array.from(regions),
      data: agg
    };
  },

  // --- Chart Renderers ---

  formatMonthLabel(ym) {
    const [y, m] = ym.split('-');
    const date = new Date(parseInt(y), parseInt(m) - 1, 1);
    return date.toLocaleString('default', { month: 'short', year: 'numeric' });
  },

  renderTrendChart(data, isPreAggregated = false) {
    const ctx = document.getElementById('revenueTrendChart');
    if (!ctx) return;
    
    const monthlyData = isPreAggregated ? data : this.aggregateByMonth(data);
    const labels = monthlyData.map(d => this.formatMonthLabel(d.month));
    
    const isRev = this.trendMetric === 'revenue';
    const values = monthlyData.map(d => isRev ? d.revenue : d.units);
    
    if (this.instances.trend) this.instances.trend.destroy();
    
    this.instances.trend = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: isRev ? 'Revenue' : 'Units',
          data: values,
          borderColor: isRev ? this.colors.emerald : this.colors.blue,
          backgroundColor: isRev ? 'rgba(0, 212, 170, 0.1)' : 'rgba(79, 142, 247, 0.1)',
          borderWidth: 3,
          pointBackgroundColor: '#070911',
          pointBorderColor: isRev ? this.colors.emerald : this.colors.blue,
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        ...commonOptions,
        plugins: {
          ...commonOptions.plugins,
          tooltip: {
            callbacks: {
              label: (ctx) => {
                let val = ctx.raw;
                return isRev ? 'Revenue: ' + kpis.formatCurrency(val) : 'Units: ' + val.toLocaleString();
              }
            }
          }
        },
        scales: {
          ...commonOptions.scales,
          y: {
            ...commonOptions.scales.y,
            ticks: {
              callback: (val) => isRev ? kpis.formatCurrency(val) : val
            }
          }
        }
      }
    });
  },

  renderMonthlySalesChart(monthlyData) {
    const ctx = document.getElementById('monthlySalesChart');
    if (!ctx) return;

    if (this.instances.monthlySales) this.instances.monthlySales.destroy();

    this.instances.monthlySales = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: monthlyData.map(d => this.formatMonthLabel(d.month)),
        datasets: [{
          label: 'Units Sold',
          data: monthlyData.map(d => d.units),
          backgroundColor: this.colors.blue,
          borderRadius: 4
        }]
      },
      options: commonOptions
    });
  },

  renderScatterChart(productData) {
    const ctx = document.getElementById('scatterChart');
    if (!ctx) return;

    if (this.instances.scatter) this.instances.scatter.destroy();

    const scatterData = productData.map((d, i) => ({
      x: d.sales, // transactions
      y: d.revenue,
      product: d.product,
      color: this.colors.palette[i % this.colors.palette.length]
    }));

    this.instances.scatter = new Chart(ctx, {
      type: 'scatter',
      data: {
        datasets: [{
          label: 'Products',
          data: scatterData,
          backgroundColor: scatterData.map(d => d.color),
          pointRadius: 6,
          pointHoverRadius: 8
        }]
      },
      options: {
        ...commonOptions,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const d = ctx.raw;
                return `${d.product}: ${d.x} sales, ${kpis.formatCurrency(d.y)}`;
              }
            }
          }
        },
        scales: {
          x: { ...commonOptions.scales.x, title: { display: true, text: 'Transactions' } },
          y: { 
            ...commonOptions.scales.y, 
            title: { display: true, text: 'Revenue' },
            ticks: { callback: (val) => kpis.formatCurrency(val) }
          }
        }
      }
    });
  },

  // --- Products Section ---

  renderProductBarChart(productData) {
    const ctx = document.getElementById('productBarChart');
    if (!ctx) return;

    const topN = filters.state.topN || 5;
    const topData = productData.slice(0, topN);
    
    document.getElementById('topProductSubtitle').textContent = `Showing top ${topN} products`;

    if (this.instances.productBar) this.instances.productBar.destroy();

    this.instances.productBar = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: topData.map(d => d.product),
        datasets: [{
          label: 'Revenue',
          data: topData.map(d => d.revenue),
          backgroundColor: topData.map((_, i) => this.colors.palette[i % this.colors.palette.length]),
          borderRadius: 6
        }]
      },
      options: {
        ...commonOptions,
        indexAxis: 'y', // Horizontal bar
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => kpis.formatCurrency(ctx.raw)
            }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { callback: (val) => kpis.formatCurrency(val) }
          },
          y: { grid: { display: false } }
        }
      }
    });
  },

  renderProductDoughnutChart(productData) {
    const ctx = document.getElementById('productDoughnutChart');
    if (!ctx) return;

    const topN = filters.state.topN || 5;
    const topData = productData.slice(0, topN);
    const otherRev = productData.slice(topN).reduce((sum, p) => sum + p.revenue, 0);
    
    const labels = topData.map(d => d.product);
    const data = topData.map(d => d.revenue);
    const bgColors = topData.map((_, i) => this.colors.palette[i % this.colors.palette.length]);
    
    if (otherRev > 0) {
      labels.push('Other');
      data.push(otherRev);
      bgColors.push('#334155');
    }

    if (this.instances.productDoughnut) this.instances.productDoughnut.destroy();

    this.instances.productDoughnut = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: bgColors,
          borderWidth: 0,
          hoverOffset: 10
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        plugins: {
          legend: { position: 'right', labels: { color: '#f1f5f9', usePointStyle: true } },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.label}: ${kpis.formatCurrency(ctx.raw)}`
            }
          }
        }
      }
    });
  },

  renderProductBubbleChart(productData) {
    const ctx = document.getElementById('productBubbleChart');
    if (!ctx) return;

    if (this.instances.productBubble) this.instances.productBubble.destroy();
    
    const topN = filters.state.topN || 5;
    const topData = productData.slice(0, topN);

    // Max sales for radius normalization
    const maxSales = Math.max(...topData.map(d => d.sales)) || 1;

    const bubbleData = topData.map((d, i) => ({
      x: d.units,
      y: d.revenue,
      r: Math.max(5, (d.sales / maxSales) * 30), // Radius based on transaction count
      product: d.product,
      sales: d.sales
    }));

    this.instances.productBubble = new Chart(ctx, {
      type: 'bubble',
      data: {
        datasets: bubbleData.map((d, i) => ({
          label: d.product,
          data: [d],
          backgroundColor: this.colors.palette[i % this.colors.palette.length] + '80', // add transparency
          borderColor: this.colors.palette[i % this.colors.palette.length],
          borderWidth: 1
        }))
      },
      options: {
        ...commonOptions,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const d = ctx.raw;
                return `${d.product}: Units: ${d.x}, Rev: ${kpis.formatCurrency(d.y)}, Sales: ${d.sales}`;
              }
            }
          }
        },
        scales: {
          x: { title: { display: true, text: 'Units Sold' } },
          y: { 
            title: { display: true, text: 'Revenue' },
            ticks: { callback: (val) => kpis.formatCurrency(val) }
          }
        }
      }
    });
  },

  // --- Regions Section ---

  renderRegionDoughnutChart(regionData) {
    const ctx = document.getElementById('regionDoughnutChart');
    if (!ctx) return;

    if (this.instances.regionDoughnut) this.instances.regionDoughnut.destroy();

    this.instances.regionDoughnut = new Chart(ctx, {
      type: 'polarArea',
      data: {
        labels: regionData.map(d => d.region),
        datasets: [{
          data: regionData.map(d => d.revenue),
          backgroundColor: regionData.map((_, i) => this.colors.palette[i % this.colors.palette.length] + '99'),
          borderWidth: 1,
          borderColor: '#070911'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right', labels: { color: '#f1f5f9', usePointStyle: true } },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.label}: ${kpis.formatCurrency(ctx.raw)}`
            }
          }
        },
        scales: {
          r: {
            ticks: { display: false },
            grid: { color: 'rgba(255,255,255,0.05)' }
          }
        }
      }
    });
  },

  renderRegionBarChart({ months, regions, data }) {
    const ctx = document.getElementById('regionBarChart');
    if (!ctx) return;

    if (this.instances.regionBar) this.instances.regionBar.destroy();
    
    // Use last 6 months to avoid crowding
    const displayMonths = months.slice(-6);

    const datasets = regions.map((r, i) => {
      return {
        label: r,
        data: displayMonths.map(m => (data[r] && data[r][m]) ? data[r][m] : 0),
        backgroundColor: this.colors.palette[i % this.colors.palette.length]
      };
    });

    this.instances.regionBar = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: displayMonths.map(this.formatMonthLabel),
        datasets
      },
      options: {
        ...commonOptions,
        scales: {
          x: { stacked: true },
          y: { 
            stacked: true,
            ticks: { callback: (val) => kpis.formatCurrency(val) }
          }
        },
        plugins: {
          tooltip: {
            mode: 'index',
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: ${kpis.formatCurrency(ctx.raw)}`
            }
          }
        }
      }
    });
  },

  renderRegionLineChart({ months, regions, data }) {
    const ctx = document.getElementById('regionLineChart');
    if (!ctx) return;

    if (this.instances.regionLine) this.instances.regionLine.destroy();

    const datasets = regions.map((r, i) => {
      return {
        label: r,
        data: months.map(m => (data[r] && data[r][m]) ? data[r][m] : 0),
        borderColor: this.colors.palette[i % this.colors.palette.length],
        backgroundColor: 'transparent',
        borderWidth: 2,
        tension: 0.3
      };
    });

    this.instances.regionLine = new Chart(ctx, {
      type: 'line',
      data: {
        labels: months.map(this.formatMonthLabel),
        datasets
      },
      options: {
        ...commonOptions,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: ${kpis.formatCurrency(ctx.raw)}`
            }
          }
        },
        scales: {
          y: { ticks: { callback: (val) => kpis.formatCurrency(val) } }
        }
      }
    });
  }
};
