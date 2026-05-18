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

    const processed = jsonArray.map((row, index) => {
      const parsedDate = new Date(row[mapping.Date]);
      
      const customerId = mapping.CustomerID 
        ? String(row[mapping.CustomerID] || '').trim() 
        : `CUST-${String((index % 80) + 1).padStart(4, '0')}`;
        
      const customerName = mapping.CustomerName 
        ? String(row[mapping.CustomerName] || '').trim() 
        : (mapping.CustomerID ? `Client ${row[mapping.CustomerID]}` : `Customer ${String((index % 80) + 1).padStart(4, '0')}`);
      
      return {
        Date: isNaN(parsedDate) ? new Date() : parsedDate,
        Product: String(row[mapping.Product] || 'Unknown').trim(),
        Region: String(row[mapping.Region] || 'Unknown').trim(),
        Sales: parseInt(row[mapping.Sales]) || 1, // Number of transactions (fallback to 1)
        Revenue: parseFloat(row[mapping.Revenue]) || 0,
        Units: parseInt(row[mapping.Units]) || 0,
        CustomerID: customerId,
        CustomerName: customerName,
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
    
    // Customer ID
    idx = lowerHeaders.findIndex(h => h.includes('customerid') || h.includes('custid') || h === 'customer' || h.includes('clientid') || h.includes('accountid'));
    map.CustomerID = idx >= 0 ? headers[idx] : null;

    // Customer Name
    idx = lowerHeaders.findIndex(h => h.includes('customername') || h.includes('custname') || h.includes('clientname') || h.includes('buyer') || h === 'customer_name' || h === 'client');
    map.CustomerName = idx >= 0 ? headers[idx] : null;
    
    return map;
  },

  generateSampleData() {
    app.showLoading();
    
    setTimeout(() => {
      const regions = ['North America', 'Europe', 'Asia Pacific', 'Latin America'];
      const products = ['Quantum Laptop', 'Nova Smartphone', 'Aura Smartwatch', 'Nebula Tablet', 'Zenith Earbuds', 'Pulse Monitor', 'Apex Keyboard'];
      
      // Generate a pool of 150 unique customers with distinct profiles to make clustering look outstanding
      const customersPool = [];
      const firstNames = ['John', 'Jane', 'Robert', 'Mary', 'William', 'Patricia', 'David', 'Jennifer', 'Richard', 'Elizabeth', 'Thomas', 'Linda', 'Charles', 'Barbara', 'Christopher', 'Susan', 'Matthew', 'Karen', 'Steven', 'Lisa'];
      const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Miller', 'Davis', 'Garcia', 'Rodriguez', 'Wilson', 'Martinez', 'Anderson', 'Taylor', 'Thomas', 'Moore', 'Martin', 'Jackson', 'Thompson', 'White', 'Harris'];
      const companies = ['TechStart', 'CloudNet', 'GlobalLogistics', 'ApexSolutions', 'EcoPower', 'QuantumAI', 'PrimeHealth', 'AlphaCapital', 'NeoSoft', 'VertexMedia', 'InnovateInc', 'OmniGroup', 'BioSync', 'DeltaLogistics', 'NovaRetail', 'StarkCorp', 'WayneEnt', 'Cyberdyne', 'Initech', 'Hooli'];
      
      for (let c = 1; c <= 150; c++) {
        let name = '';
        let isCorporate = (c <= 35);
        
        if (isCorporate) {
          name = companies[c % companies.length] + ' ' + (c % 3 === 0 ? 'Corp' : (c % 3 === 1 ? 'LLC' : 'Ltd'));
        } else {
          name = firstNames[c % firstNames.length] + ' ' + lastNames[(c + 7) % lastNames.length];
        }
        
        // Profiles: VIP, Loyal, HighSpender, AtRisk, New, Regular
        let profile = 'Regular';
        if (c <= 15) profile = 'VIP';          // 10% VIPs
        else if (c <= 40) profile = 'Loyal';   // 17% Loyal
        else if (c <= 60) profile = 'HighSpender'; // 13% Occasional Big Spend
        else if (c <= 90) profile = 'AtRisk';  // 20% Churning/Old (at risk)
        else if (c <= 115) profile = 'New';     // 17% New Users
        
        customersPool.push({
          id: `CUST-${String(c).padStart(4, '0')}`,
          name: name,
          isCorporate: isCorporate,
          profile: profile
        });
      }

      const data = [];
      const now = new Date();
      
      // Let's generate 800 transaction records
      for (let i = 0; i < 800; i++) {
        // Select a customer from pool based on a weighted random or uniform
        // But distribute dates and prices based on the customer's profile!
        const randCust = customersPool[Math.floor(Math.random() * customersPool.length)];
        
        let date;
        let product = products[Math.floor(Math.random() * products.length)];
        let region = regions[Math.floor(Math.random() * regions.length)];
        
        const oneYearMs = 365 * 24 * 60 * 60 * 1000;
        
        if (randCust.profile === 'VIP') {
          // VIP: Buys frequently, expensive items, recent dates
          date = new Date(now.getTime() - Math.random() * 90 * 24 * 60 * 60 * 1000); // last 3 months
          if (Math.random() < 0.7) {
            product = Math.random() < 0.6 ? 'Quantum Laptop' : 'Nova Smartphone'; // expensive
          }
        } else if (randCust.profile === 'Loyal') {
          // Loyal: Buys frequently throughout the whole year, medium/high items
          date = new Date(now.getTime() - Math.random() * oneYearMs);
          if (Math.random() < 0.4) {
            product = Math.random() < 0.5 ? 'Nebula Tablet' : 'Aura Smartwatch';
          }
        } else if (randCust.profile === 'HighSpender') {
          // HighSpender: Buys rarely (so we map their dates to a specific range or let them be random), but highly expensive items
          date = new Date(now.getTime() - Math.random() * oneYearMs);
          product = 'Quantum Laptop'; // always premium
        } else if (randCust.profile === 'AtRisk') {
          // AtRisk: Purchased in the first half of the year (180 to 365 days ago), but none recently
          date = new Date(now.getTime() - (180 * 24 * 60 * 60 * 1000 + Math.random() * 185 * 24 * 60 * 60 * 1000));
        } else if (randCust.profile === 'New') {
          // New: Purchased only within the last 30 days
          date = new Date(now.getTime() - Math.random() * 30 * 24 * 60 * 60 * 1000);
          if (Math.random() < 0.6) {
            product = Math.random() < 0.5 ? 'Zenith Earbuds' : 'Pulse Monitor'; // lower end
          }
        } else {
          // Regular: Average random dates/products
          date = new Date(now.getTime() - Math.random() * oneYearMs);
        }

        // Base price variations
        let basePrice = 0;
        if (product.includes('Laptop')) basePrice = 1200;
        else if (product.includes('Phone')) basePrice = 800;
        else if (product.includes('Tablet')) basePrice = 500;
        else if (product.includes('Watch')) basePrice = 250;
        else if (product.includes('Monitor')) basePrice = 350;
        else basePrice = 150;
        
        // Randomize price slightly and determine units
        const price = basePrice * (0.9 + (Math.random() * 0.2));
        
        let units = Math.floor(Math.random() * 3) + 1;
        if (randCust.isCorporate) {
          units = Math.floor(Math.random() * 8) + 3; // Corporate buyers buy in bulk
        }
        
        const revenue = price * units;
        
        // Apply seasonal trend
        const month = date.getMonth();
        let multiplier = 1;
        if (month === 10 || month === 11) multiplier = 1.4; // Q4 holiday boost
        
        data.push({
          Date: date,
          Product: product,
          Region: region,
          Sales: 1,
          Units: units,
          Revenue: parseFloat((revenue * multiplier).toFixed(2)),
          CustomerID: randCust.id,
          CustomerName: randCust.name
        });
      }
      
      data.sort((a, b) => a.Date - b.Date);
      window.appData.raw = data;
      window.appData.filtered = [...data];
      window.appData.fields = REQUIRED_FIELDS.concat(['CustomerID', 'CustomerName']);
      
      app.showToast('Sample dataset loaded successfully', 'success');
      app.onDataLoaded();
    }, 500);
  }
};
