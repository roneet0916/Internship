/**
 * dataLoader.js
 * Handles file reading (CSV/Excel) and data normalization
 */

// Global App State (will be populated)
window.appData = {
  raw: [],      // Original imported data
  filtered: [], // Data after filters applied
  fields: []    // Detected column names
};

const REQUIRED_FIELDS = ['Date', 'Product', 'Region', 'Sales', 'Revenue', 'Units'];

const dataLoader = {
  
  init() {
    this.dropZone = document.getElementById('dropZone');
    this.fileInput = document.getElementById('fileInput');
    this.loadSampleBtn = document.getElementById('loadSampleBtn');
    
    this.bindEvents();
  },
  
  bindEvents() {
    // Click to upload
    this.dropZone.addEventListener('click', () => this.fileInput.click());
    
    this.fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        this.handleFile(e.target.files[0]);
      }
    });

    // Drag and drop
    this.dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      this.dropZone.classList.add('dragover');
    });

    ['dragleave', 'dragend'].forEach(type => {
      this.dropZone.addEventListener(type, () => {
        this.dropZone.classList.remove('dragover');
      });
    });

    this.dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      this.dropZone.classList.remove('dragover');
      if (e.dataTransfer.files.length > 0) {
        this.handleFile(e.dataTransfer.files[0]);
      }
    });

    // Load sample data
    this.loadSampleBtn.addEventListener('click', () => {
      this.generateSampleData();
    });
  },

  handleFile(file) {
    if (!file) return;
    
    app.showLoading();
    
    const ext = file.name.split('.').pop().toLowerCase();
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target.result;
        let json = [];
        
        // Use SheetJS for both CSV and Excel
        const workbook = XLSX.read(data, { type: 'binary', cellDates: true });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        json = XLSX.utils.sheet_to_json(worksheet, { raw: false, dateNF: 'yyyy-mm-dd' });
        
        this.processData(json);
        app.showToast(`Successfully loaded ${json.length} rows from ${file.name}`, 'success');
      } catch (err) {
        console.error(err);
        app.showToast('Error reading file. Ensure it is a valid CSV or Excel file.', 'error');
        app.hideLoading();
      }
    };
    
    reader.readAsBinaryString(file);
  },

  processData(jsonArray) {
    if (!jsonArray || jsonArray.length === 0) {
      app.showToast('File contains no data', 'error');
      app.hideLoading();
      return;
    }

    // Attempt to map columns to our required format
    const keys = Object.keys(jsonArray[0]);
    const mapping = this.detectColumns(keys);

    const processed = jsonArray.map(row => {
      const parsedDate = new Date(row[mapping.Date]);
      
      return {
        Date: isNaN(parsedDate) ? new Date() : parsedDate,
        Product: String(row[mapping.Product] || 'Unknown').trim(),
        Region: String(row[mapping.Region] || 'Unknown').trim(),
        Sales: parseInt(row[mapping.Sales]) || 1, // Number of transactions (fallback to 1)
        Revenue: parseFloat(row[mapping.Revenue]) || 0,
        Units: parseInt(row[mapping.Units]) || 0,
        // Keep original data just in case
        _raw: row
      };
    });
    
    // Sort by date ascending
    processed.sort((a, b) => a.Date - b.Date);

    window.appData.raw = processed;
    window.appData.filtered = [...processed];
    window.appData.fields = Object.keys(processed[0]).filter(k => k !== '_raw');
    
    app.onDataLoaded();
  },

  detectColumns(headers) {
    const map = {};
    const lowerHeaders = headers.map(h => h.toLowerCase());
    
    // Date
    let idx = lowerHeaders.findIndex(h => h.includes('date') || h.includes('time') || h === 'day');
    map.Date = idx >= 0 ? headers[idx] : headers[0];
    
    // Product
    idx = lowerHeaders.findIndex(h => h.includes('product') || h.includes('item') || h.includes('name'));
    map.Product = idx >= 0 ? headers[idx] : headers[1 % headers.length];
    
    // Region
    idx = lowerHeaders.findIndex(h => h.includes('region') || h.includes('country') || h.includes('territory') || h.includes('location') || h.includes('city'));
    map.Region = idx >= 0 ? headers[idx] : headers[2 % headers.length];
    
    // Revenue
    idx = lowerHeaders.findIndex(h => h.includes('revenue') || h.includes('total') || h.includes('amount') || h.includes('price'));
    map.Revenue = idx >= 0 ? headers[idx] : headers[3 % headers.length];
    
    // Units
    idx = lowerHeaders.findIndex(h => h.includes('unit') || h.includes('qty') || h.includes('quantity'));
    map.Units = idx >= 0 ? headers[idx] : headers[4 % headers.length];
    
    // Sales (Transactions count)
    idx = lowerHeaders.findIndex(h => h === 'sales' || h.includes('transaction') || h.includes('order'));
    map.Sales = idx >= 0 ? headers[idx] : null; // If not found, defaults to 1 per row in processData
    
    return map;
  },

  generateSampleData() {
    app.showLoading();
    
    setTimeout(() => {
      const regions = ['North America', 'Europe', 'Asia Pacific', 'Latin America'];
      const products = ['Quantum Laptop', 'Nova Smartphone', 'Aura Smartwatch', 'Nebula Tablet', 'Zenith Earbuds', 'Pulse Monitor', 'Apex Keyboard'];
      
      const data = [];
      const now = new Date();
      // Generate last 12 months of data
      
      for (let i = 0; i < 800; i++) {
        // Random date within last year
        const date = new Date(now.getTime() - Math.random() * 365 * 24 * 60 * 60 * 1000);
        const region = regions[Math.floor(Math.random() * regions.length)];
        const product = products[Math.floor(Math.random() * products.length)];
        
        // Base price variations
        let basePrice = 0;
        if (product.includes('Laptop')) basePrice = 1200;
        else if (product.includes('Phone')) basePrice = 800;
        else if (product.includes('Tablet')) basePrice = 500;
        else if (product.includes('Watch')) basePrice = 250;
        else if (product.includes('Monitor')) basePrice = 350;
        else basePrice = 150;
        
        // Randomize price slightly and determine units
        const price = basePrice * (0.8 + (Math.random() * 0.4));
        const units = Math.floor(Math.random() * 5) + 1;
        const revenue = price * units;
        
        // Apply some seasonal trends (higher in Q4)
        const month = date.getMonth();
        let multiplier = 1;
        if (month === 10 || month === 11) multiplier = 1.5; // Nov/Dec boost
        
        data.push({
          Date: date,
          Product: product,
          Region: region,
          Sales: 1, // 1 transaction
          Units: units,
          Revenue: parseFloat((revenue * multiplier).toFixed(2))
        });
      }
      
      data.sort((a, b) => a.Date - b.Date);
      window.appData.raw = data;
      window.appData.filtered = [...data];
      window.appData.fields = REQUIRED_FIELDS;
      
      app.showToast('Sample dataset loaded successfully', 'success');
      app.onDataLoaded();
    }, 500);
  }
};
