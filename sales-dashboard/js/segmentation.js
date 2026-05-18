/**
 * segmentation.js
 * Client-side RFM Analysis and K-Means Clustering
 */

window.segmentationData = {
  customers: [],     // Array of customer RFM profiles
  clusters: [],      // Details of each cluster
  k: 4,              // Default number of clusters
  charts: {}         // Chart.js instances
};

const segmentation = {
  
  init() {
    this.kSlider = document.getElementById('clusterKSlider');
    this.kValueLabel = document.getElementById('clusterKValue');
    this.tableBody = document.getElementById('customerTableBody');
    this.searchBar = document.getElementById('customerSearch');
    
    this.bindEvents();
  },

  bindEvents() {
    if (this.kSlider) {
      this.kSlider.addEventListener('input', (e) => {
        const newK = parseInt(e.target.value);
        this.kValueLabel.textContent = newK;
        window.segmentationData.k = newK;
        this.runClustering();
      });
    }

    if (this.searchBar) {
      this.searchBar.addEventListener('input', () => {
        this.renderCustomerTable();
      });
    }
  },

  // Primary entry point called when dashboard data changes
  processAndRun() {
    const data = window.appData.filtered;
    if (!data || data.length === 0) {
      this.clearUI();
      return;
    }

    // 1. Calculate RFM for each customer
    this.calculateRFM(data);

    // 2. Perform K-Means Clustering
    this.runClustering();
  },

  clearUI() {
    if (this.tableBody) this.tableBody.innerHTML = '';
    // Destroy charts
    Object.keys(window.segmentationData.charts).forEach(key => {
      if (window.segmentationData.charts[key]) {
        window.segmentationData.charts[key].destroy();
        window.segmentationData.charts[key] = null;
      }
    });
  },

  calculateRFM(transactions) {
    const customerMap = {};
    
    // Find overall boundaries
    let minDate = new Date();
    let maxDate = new Date(0);
    
    transactions.forEach(t => {
      if (t.Date < minDate) minDate = t.Date;
      if (t.Date > maxDate) maxDate = t.Date;
    });

    // Aggregate transactions by CustomerID
    transactions.forEach(t => {
      const cid = t.CustomerID || 'UNKNOWN';
      const cname = t.CustomerName || `Customer ${cid}`;

      if (!customerMap[cid]) {
        customerMap[cid] = {
          id: cid,
          name: cname,
          maxDate: t.Date,
          ordersCount: 0,
          totalRevenue: 0,
          regions: new Set(),
          products: new Set()
        };
      }

      const c = customerMap[cid];
      if (t.Date > c.maxDate) {
        c.maxDate = t.Date;
      }
      c.ordersCount += t.Sales;
      c.totalRevenue += t.Revenue;
      c.regions.add(t.Region);
      c.products.add(t.Product);
    });

    // Map to array and calculate final Recency
    const customers = Object.values(customerMap).map(c => {
      // Recency = Days since last purchase to the overall max date in current filter
      const diffTime = Math.abs(maxDate - c.maxDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      return {
        id: c.id,
        name: c.name,
        recency: diffDays,                // Lower is better (Recent)
        frequency: c.ordersCount,         // Higher is better
        monetary: parseFloat(c.totalRevenue.toFixed(2)), // Higher is better
        favoriteRegion: Array.from(c.regions)[0] || 'Unknown',
        favoriteProduct: Array.from(c.products)[0] || 'Unknown'
      };
    });

    window.segmentationData.customers = customers;
  },

  runClustering() {
    const customers = window.segmentationData.customers;
    const k = window.segmentationData.k;

    if (customers.length < k || customers.length === 0) {
      console.warn("Not enough data to cluster");
      return;
    }

    // 1. Min-Max Scaling (Normalization)
    const stats = this.getStats(customers);
    const normalized = customers.map(c => {
      return {
        id: c.id,
        r: (c.recency - stats.minR) / (stats.maxR - stats.minR + 1e-6),
        f: (c.frequency - stats.minF) / (stats.maxF - stats.minF + 1e-6),
        m: (c.monetary - stats.minM) / (stats.maxM - stats.minM + 1e-6)
      };
    });

    // 2. Initialize Centroids (select k random normalized data points)
    let centroids = [];
    const usedIndices = new Set();
    while (centroids.length < k) {
      const idx = Math.floor(Math.random() * normalized.length);
      if (!usedIndices.has(idx)) {
        usedIndices.add(idx);
        centroids.push({ r: normalized[idx].r, f: normalized[idx].f, m: normalized[idx].m });
      }
    }

    // 3. Lloyd's Algorithm Iterations
    let assignments = new Array(normalized.length);
    let converged = false;
    let iter = 0;
    const maxIter = 80;

    while (!converged && iter < maxIter) {
      converged = true;
      iter++;

      // A. Assign customers to nearest centroid
      for (let i = 0; i < normalized.length; i++) {
        const item = normalized[i];
        let minDist = Infinity;
        let bestCentroidIdx = 0;

        for (let j = 0; j < k; j++) {
          const c = centroids[j];
          const dist = Math.pow(item.r - c.r, 2) + Math.pow(item.f - c.f, 2) + Math.pow(item.m - c.m, 2);
          if (dist < minDist) {
            minDist = dist;
            bestCentroidIdx = j;
          }
        }

        if (assignments[i] !== bestCentroidIdx) {
          assignments[i] = bestCentroidIdx;
          converged = false;
        }
      }

      // B. Recalculate centroids
      const nextCentroids = Array.from({ length: k }, () => ({ r: 0, f: 0, m: 0, count: 0 }));
      for (let i = 0; i < normalized.length; i++) {
        const cIdx = assignments[i];
        const item = normalized[i];
        nextCentroids[cIdx].r += item.r;
        nextCentroids[cIdx].f += item.f;
        nextCentroids[cIdx].m += item.m;
        nextCentroids[cIdx].count++;
      }

      for (let j = 0; j < k; j++) {
        if (nextCentroids[j].count > 0) {
          centroids[j] = {
            r: nextCentroids[j].r / nextCentroids[j].count,
            f: nextCentroids[j].f / nextCentroids[j].count,
            m: nextCentroids[j].m / nextCentroids[j].count
          };
        }
      }
    }

    // 4. Back-map cluster index to raw customer objects
    customers.forEach((c, idx) => {
      c.clusterIdx = assignments[idx];
    });

    // 5. Profile Clusters and Assign Semantic Persona Labels
    this.profileClusters(centroids, stats);

    // 6. Update UI Components
    this.updateKPIs();
    this.renderCustomerTable();
    this.renderCharts();
    this.renderProfiles();
  },

  getStats(customers) {
    let minR = Infinity, maxR = -Infinity;
    let minF = Infinity, maxF = -Infinity;
    let minM = Infinity, maxM = -Infinity;

    customers.forEach(c => {
      if (c.recency < minR) minR = c.recency;
      if (c.recency > maxR) maxR = c.recency;
      if (c.frequency < minF) minF = c.frequency;
      if (c.frequency > maxF) maxF = c.frequency;
      if (c.monetary < minM) minM = c.monetary;
      if (c.monetary > maxM) maxM = c.monetary;
    });

    return { minR, maxR, minF, maxF, minM, maxM };
  },

  profileClusters(centroids, stats) {
    const customers = window.segmentationData.customers;
    const k = window.segmentationData.k;
    
    // Calculate raw centroids
    const clusterProfiles = Array.from({ length: k }, (_, i) => ({
      index: i,
      avgR: 0,
      avgF: 0,
      avgM: 0,
      count: 0
    }));

    customers.forEach(c => {
      const p = clusterProfiles[c.clusterIdx];
      p.avgR += c.recency;
      p.avgF += c.frequency;
      p.avgM += c.monetary;
      p.count++;
    });

    // Finalize averages
    clusterProfiles.forEach(p => {
      if (p.count > 0) {
        p.avgR = parseFloat((p.avgR / p.count).toFixed(1));
        p.avgF = parseFloat((p.avgF / p.count).toFixed(1));
        p.avgM = parseFloat((p.avgM / p.count).toFixed(2));
      }
    });

    // Global Averages
    const totalCount = customers.length;
    const globalAvgR = customers.reduce((sum, c) => sum + c.recency, 0) / totalCount;
    const globalAvgF = customers.reduce((sum, c) => sum + c.frequency, 0) / totalCount;
    const globalAvgM = customers.reduce((sum, c) => sum + c.monetary, 0) / totalCount;

    // Define Persona Map heuristics
    // R (lower is better/recent), F (higher is better), M (higher is better)
    clusterProfiles.forEach(p => {
      let label = 'Regular Customers';
      let colorClass = 'badge--gray';
      let description = 'Customers displaying standard, moderate purchasing activity across frequency and spending metrics.';
      let recommendation = 'Nurture with quarterly newsletters, general marketing updates, and surveys to identify needs.';
      
      const isRecent = p.avgR < globalAvgR;
      const isFrequent = p.avgF >= globalAvgF;
      const isHighValue = p.avgM >= globalAvgM;

      // Logic classification
      if (isRecent && isFrequent && isHighValue) {
        label = 'VIP Champions';
        colorClass = 'badge--emerald';
        description = 'Your most valuable customers. They purchase very frequently, spent highly, and did so very recently!';
        recommendation = 'Reward them! Offer exclusive early-access products, VIP loyalty perks, and dedicated personal support.';
      } else if (!isRecent && isFrequent && isHighValue) {
        label = 'At-Risk VIPs';
        colorClass = 'badge--pink';
        description = 'Historically high-value, highly frequent purchasers who haven\'t bought in a relatively long time.';
        recommendation = 'Re-engage urgently! Send personalized "we miss you" deals, phone follow-ups, or a feedback survey with a high-value discount.';
      } else if (isRecent && !isFrequent && !isHighValue) {
        label = 'New Trialers';
        colorClass = 'badge--blue';
        description = 'Customers who bought very recently, but have low purchase counts and low total transaction spend.';
        recommendation = 'Onboard them. Send automated welcome emails, clear "How to use" guides, and cross-sell related low-friction accessories.';
      } else if (!isRecent && !isFrequent && !isHighValue) {
        label = 'Lost / Churned';
        colorClass = 'badge--red';
        description = 'Very inactive customers. They bought a long time ago, infrequently, and spent very little overall.';
        recommendation = 'Low priority. Attempt a standard automated win-back email campaign. Avoid spending heavy marketing budget here.';
      } else if (isRecent && isFrequent && !isHighValue) {
        label = 'Loyal Value Seekers';
        colorClass = 'badge--purple';
        description = 'Recent and highly frequent shoppers who buy smaller value items regularly.';
        recommendation = 'Up-sell. Recommend bulk packages, bundle discount offers, or subscription options to increase average order size.';
      } else if (!isRecent && !isFrequent && isHighValue) {
        label = 'Occasional High Spenders';
        colorClass = 'badge--amber';
        description = 'Infrequent buyers who make high-value bulk purchases when they do shop, but have been quiet recently.';
        recommendation = 'Targeted offers. Keep them warmed up with high-end premium releases, special seasonal offers, and catalog reviews.';
      }

      p.label = label;
      p.colorClass = colorClass;
      p.description = description;
      p.recommendation = recommendation;
    });

    window.segmentationData.clusters = clusterProfiles;

    // Apply persona properties back to customers
    customers.forEach(c => {
      const prof = clusterProfiles[c.clusterIdx];
      c.segmentLabel = prof.label;
      c.segmentColorClass = prof.colorClass;
      c.segmentRecommendation = prof.recommendation;
    });
  },

  updateKPIs() {
    const customers = window.segmentationData.customers;
    const totalCustomers = customers.length;
    
    const avgLTV = customers.reduce((sum, c) => sum + c.monetary, 0) / totalCustomers;
    const avgFreq = customers.reduce((sum, c) => sum + c.frequency, 0) / totalCustomers;

    document.getElementById('kpi-seg-total-val').textContent = totalCustomers.toLocaleString();
    document.getElementById('kpi-seg-ltv-val').textContent = kpis.formatCurrency(avgLTV);
    document.getElementById('kpi-seg-freq-val').textContent = avgFreq.toFixed(1) + ' orders';
  },

  renderProfiles() {
    const profilesContainer = document.getElementById('clusterProfilesGrid');
    if (!profilesContainer) return;

    let html = '';
    window.segmentationData.clusters.forEach(p => {
      const pct = ((p.count / window.segmentationData.customers.length) * 100).toFixed(0);
      html += `
        <div class="profile-card">
          <div class="profile-card-header">
            <span class="badge ${p.colorClass}">${p.label}</span>
            <span class="profile-card-pct">${pct}% (${p.count} accounts)</span>
          </div>
          <div class="profile-card-body">
            <p class="profile-desc">${p.description}</p>
            <div class="profile-stats">
              <div class="p-stat"><span>Avg Recency:</span><strong>${p.avgR} days ago</strong></div>
              <div class="p-stat"><span>Avg Frequency:</span><strong>${p.avgF} orders</strong></div>
              <div class="p-stat"><span>Avg Monetary:</span><strong>${kpis.formatCurrency(p.avgM)}</strong></div>
            </div>
            <div class="profile-action">
              <span class="action-label">Target Strategy</span>
              <p>${p.recommendation}</p>
            </div>
          </div>
        </div>
      `;
    });
    profilesContainer.innerHTML = html;
  },

  renderCustomerTable() {
    if (!this.tableBody) return;

    const customers = window.segmentationData.customers;
    const searchVal = this.searchBar ? this.searchBar.value.toLowerCase().trim() : '';

    const filtered = customers.filter(c => {
      if (!searchVal) return true;
      return c.id.toLowerCase().includes(searchVal) || 
             c.name.toLowerCase().includes(searchVal) ||
             c.segmentLabel.toLowerCase().includes(searchVal);
    });

    if (filtered.length === 0) {
      this.tableBody.innerHTML = `<tr><td colspan="7" class="text-center py-4">No matching customer profiles found.</td></tr>`;
      return;
    }

    // Limit to 80 rows for performance
    const renderList = filtered.slice(0, 80);
    let html = '';
    
    renderList.forEach(c => {
      html += `
        <tr>
          <td><strong>${c.id}</strong></td>
          <td>${c.name}</td>
          <td>${c.recency} days ago</td>
          <td>${c.frequency} purchases</td>
          <td>${kpis.formatCurrency(c.monetary)}</td>
          <td><span class="badge ${c.segmentColorClass}">${c.segmentLabel}</span></td>
          <td><span class="strategy-pill" title="${c.segmentRecommendation}">${c.segmentRecommendation.slice(0, 48)}...</span></td>
        </tr>
      `;
    });
    
    this.tableBody.innerHTML = html;
  },

  renderCharts() {
    const customers = window.segmentationData.customers;
    const clusters = window.segmentationData.clusters;
    const k = window.segmentationData.k;

    // Define colors mapped to clusters
    const clusterColors = [
      'rgba(16, 185, 129, 0.7)',  // emerald
      'rgba(59, 130, 246, 0.7)',  // blue
      'rgba(245, 158, 11, 0.7)',  // amber
      'rgba(239, 68, 68, 0.7)',   // red
      'rgba(139, 92, 246, 0.7)',  // purple
      'rgba(236, 72, 153, 0.7)'   // pink
    ];

    const clusterBorderColors = [
      '#10b981', '#3b82f6', '#f59e0b', '#ef4848', '#8b5cf6', '#ec4799'
    ];

    // Prepare dataset structured for Scatter chart (Recency vs Frequency)
    const scatterDatasets = Array.from({ length: k }, (_, i) => {
      const prof = clusters[i];
      return {
        label: prof ? prof.label : `Cluster ${i + 1}`,
        data: [],
        backgroundColor: clusterColors[i % clusterColors.length],
        borderColor: clusterBorderColors[i % clusterBorderColors.length],
        borderWidth: 1,
        pointRadius: 6,
        pointHoverRadius: 8
      };
    });

    customers.forEach(c => {
      if (scatterDatasets[c.clusterIdx]) {
        scatterDatasets[c.clusterIdx].data.push({
          x: c.recency,
          y: c.frequency,
          label: c.name,
          monetary: c.monetary
        });
      }
    });

    // Prepare dataset structured for Bubble chart (Frequency vs Monetary, size = monetary value)
    const bubbleDatasets = Array.from({ length: k }, (_, i) => {
      const prof = clusters[i];
      return {
        label: prof ? prof.label : `Cluster ${i + 1}`,
        data: [],
        backgroundColor: clusterColors[i % clusterColors.length],
        borderColor: clusterBorderColors[i % clusterBorderColors.length],
        borderWidth: 1
      };
    });

    // Find monetary max to scale bubbles
    const maxM = Math.max(...customers.map(c => c.monetary));

    customers.forEach(c => {
      if (bubbleDatasets[c.clusterIdx]) {
        // Calculate dynamic bubble radius scaled between 4 and 18
        const r = 4 + (c.monetary / maxM) * 14;
        bubbleDatasets[c.clusterIdx].data.push({
          x: c.frequency,
          y: c.monetary,
          r: r,
          label: c.name,
          recency: c.recency
        });
      }
    });

    // Render Scatter Chart (Recency vs Frequency)
    const ctxScatter = document.getElementById('scatterClusterChart');
    if (ctxScatter) {
      if (window.segmentationData.charts.scatter) {
        window.segmentationData.charts.scatter.destroy();
      }
      
      window.segmentationData.charts.scatter = new Chart(ctxScatter, {
        type: 'scatter',
        data: { datasets: scatterDatasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            tooltip: {
              callbacks: {
                label: function(context) {
                  const item = context.raw;
                  return `${item.label}: Last active ${item.x} days ago, ${item.y} purchases, Total Spend: $${item.monetary.toLocaleString()}`;
                }
              }
            },
            legend: {
              position: 'bottom',
              labels: { font: { family: 'Inter', size: 11 }, boxWidth: 10 }
            }
          },
          scales: {
            x: {
              title: { display: true, text: 'Recency (Days since last order — lower is better)', font: { weight: 'bold' } },
              grid: { color: 'rgba(255, 255, 255, 0.05)' }
            },
            y: {
              title: { display: true, text: 'Frequency (Total Purchase Count)', font: { weight: 'bold' } },
              grid: { color: 'rgba(255, 255, 255, 0.05)' }
            }
          }
        }
      });
    }

    // Render Bubble Chart (Frequency vs Monetary Spend)
    const ctxBubble = document.getElementById('bubbleClusterChart');
    if (ctxBubble) {
      if (window.segmentationData.charts.bubble) {
        window.segmentationData.charts.bubble.destroy();
      }

      window.segmentationData.charts.bubble = new Chart(ctxBubble, {
        type: 'bubble',
        data: { datasets: bubbleDatasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            tooltip: {
              callbacks: {
                label: function(context) {
                  const item = context.raw;
                  return `${item.label}: ${item.x} purchases, Spent: $${item.y.toLocaleString()}, Recency: ${item.recency} days`;
                }
              }
            },
            legend: {
              position: 'bottom',
              labels: { font: { family: 'Inter', size: 11 }, boxWidth: 10 }
            }
          },
          scales: {
            x: {
              title: { display: true, text: 'Frequency (Total Purchase Count)', font: { weight: 'bold' } },
              grid: { color: 'rgba(255, 255, 255, 0.05)' }
            },
            y: {
              title: { display: true, text: 'Monetary Spend (LTV in $)', font: { weight: 'bold' } },
              grid: { color: 'rgba(255, 255, 255, 0.05)' }
            }
          }
        }
      });
    }
  }
};
