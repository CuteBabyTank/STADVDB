// Tab switching
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        // Remove active class from all tabs
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        // Add active class to clicked tab
        tab.classList.add('active');
        // Hide all tab contents
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.add('hidden');
        });
        // Show corresponding tab content
        const tabName = tab.getAttribute('data-tab');
        document.getElementById(`${tabName}-view`).classList.remove('hidden');

        // Hide both data containers when switching tabs
        document.getElementById('table-data').classList.add('hidden');
        document.getElementById('report-data').classList.add('hidden');
    });
});

// Global variables
let selectedTable = null;
let selectedReport = null;

// Global variables for pagination
let currentData = null;
let currentPage = 1;
const PAGE_SIZE = 1000;

// Global chart variable
let currentChart = null;

// Table selection
document.querySelectorAll('.table-card').forEach(card => {
    card.addEventListener('click', () => {
        // Remove selected class from all cards
        document.querySelectorAll('.table-card').forEach(c => c.classList.remove('selected'));
        // Add selected class to clicked card
        card.classList.add('selected');
        selectedTable = card.getAttribute('data-table');
        // Show table data
        displayTableData(selectedTable);
        document.getElementById('table-data').classList.remove('hidden');
    });
});

// Clear selection
document.getElementById('clear-selection').addEventListener('click', () => {
    document.querySelectorAll('.table-card').forEach(c => c.classList.remove('selected'));
    document.getElementById('table-data').classList.add('hidden');
    selectedTable = null;
});

// Report selection and query execution
document.querySelectorAll('.report-card').forEach(card => {
    card.addEventListener('click', () => {
        console.log('Report card clicked:', card.getAttribute('data-report'));
        // Remove selected class from all cards
        document.querySelectorAll('.report-card').forEach(c => c.classList.remove('selected'));
        // Add selected class to clicked card
        card.classList.add('selected');
        selectedReport = card.getAttribute('data-report');
        console.log('Selected report set to:', selectedReport);
        
        // Show/hide filters based on report type
        const filtersDiv = document.getElementById('report-filters');
        const drilldownFilter = document.getElementById('drilldown-filter');
        const rollupFilter = document.getElementById('rollup-filter');
        const sliceFilter = document.getElementById('slice-filter');
        const diceFilter = document.getElementById('dice-filter');
        const pivotFilter = document.getElementById('pivot-filter');
        
        // Hide all filters first
        drilldownFilter.classList.add('hidden');
        rollupFilter.classList.add('hidden');
        sliceFilter.classList.add('hidden');
        diceFilter.classList.add('hidden');
        pivotFilter.classList.add('hidden');
        
        if (selectedReport === 'drilldown') {
            filtersDiv.classList.remove('hidden');
            drilldownFilter.classList.remove('hidden');
            loadAvailableYears('drilldown-from-year');
            loadAvailableYears('drilldown-to-year');
        } else if (selectedReport === 'rollup') {
            filtersDiv.classList.remove('hidden');
            rollupFilter.classList.remove('hidden');
            loadAvailableYears('from-year-filter');
            loadAvailableYears('to-year-filter');
        } else if (selectedReport === 'slice') {
            filtersDiv.classList.remove('hidden');
            sliceFilter.classList.remove('hidden');
            loadAvailableYears('slice-from-year');
            loadAvailableYears('slice-to-year');
        } else if (selectedReport === 'dice') {
            filtersDiv.classList.remove('hidden');
            diceFilter.classList.remove('hidden');
            loadAvailableYears('dice-from-year');
            loadAvailableYears('dice-to-year');
            loadAvailableTransactionTypes();
        } else if (selectedReport === 'pivot') {
            filtersDiv.classList.remove('hidden');
            pivotFilter.classList.remove('hidden');
            loadAvailableYears('pivot-from-year');
            loadAvailableYears('pivot-to-year');
        } else {
            filtersDiv.classList.add('hidden');
        }
        
        // Enable run button
        document.getElementById('run-query').disabled = false;
        console.log('Run button enabled');
    });
});

// Load available years for filter
async function loadAvailableYears(selectId) {
    try {
        const response = await fetch('http://localhost:3000/api/available-years');
        const years = await response.json();
        
        const yearSelect = document.getElementById(selectId);
        
        if (selectId === 'year-filter') {
            yearSelect.innerHTML = '<option value="all">All Years</option>';
        } else {
            yearSelect.innerHTML = '<option value="">Select Year</option>';
        }
        
        years.forEach(year => {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            yearSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading years:', error);
    }
}

// Load available transaction types for filter
async function loadAvailableTransactionTypes() {
    try {
        const response = await fetch('http://localhost:3000/api/available-trans-types');
        const transTypes = await response.json();
        
        const transTypeSelect = document.getElementById('dice-trans-type');
        transTypeSelect.innerHTML = '<option value="">All Types</option>';
        
        transTypes.forEach(type => {
            const option = document.createElement('option');
            option.value = type;
            option.textContent = type;
            transTypeSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading transaction types:', error);
    }
}

document.getElementById('run-query').addEventListener('click', () => {
    console.log('Run Query button clicked!');
    console.log('Selected report:', selectedReport);
    if (selectedReport) {
        runReportQuery(selectedReport);
    } else {
        console.log('No report selected');
    }
});

// API functions
async function fetchTableData(tableName) {
    try {
        const response = await fetch(`http://localhost:3000/api/table/${tableName}`);
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to fetch table data');
        }
        
        return {
            columns: data.length > 0 ? Object.keys(data[0]) : [],
            data: data.map(row => Object.values(row))
        };
    } catch (error) {
        console.error('Error fetching table data:', error);
        
        // Add to compile logs
        const compileLog = document.createElement('div');
        compileLog.className = 'compile-log';
        const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
        compileLog.innerHTML = `
            <div class="compile-timestamp">${timestamp}</div>
            <div class="compile-message">ERROR: Failed to fetch ${tableName} - ${error.message}</div>
        `;
        document.getElementById('compile-logs-container').prepend(compileLog);
        
        return null;
    }
}

async function runReportQuery(reportType) {
    console.log('runReportQuery called with:', reportType);
    try {
        const url = `http://localhost:3000/api/reports/${reportType}`;
        console.log('Fetching:', url);
        
        // Get filter values based on report type
        const requestBody = {};
        if (reportType === 'drilldown') {
            const drilldownFromYear = document.getElementById('drilldown-from-year').value;
            const drilldownToYear = document.getElementById('drilldown-to-year').value;
            if (drilldownFromYear) requestBody.fromYear = drilldownFromYear;
            if (drilldownToYear) requestBody.toYear = drilldownToYear;
        } else if (reportType === 'rollup') {
            const fromYear = document.getElementById('from-year-filter').value;
            const toYear = document.getElementById('to-year-filter').value;
            if (fromYear) requestBody.fromYear = fromYear;
            if (toYear) requestBody.toYear = toYear;
        } else if (reportType === 'slice') {
            const sliceFromYear = document.getElementById('slice-from-year').value;
            const sliceToYear = document.getElementById('slice-to-year').value;
            if (sliceFromYear) requestBody.fromYear = sliceFromYear;
            if (sliceToYear) requestBody.toYear = sliceToYear;
        } else if (reportType === 'dice') {
            const diceFromYear = document.getElementById('dice-from-year').value;
            const diceToYear = document.getElementById('dice-to-year').value;
            const diceTransType = document.getElementById('dice-trans-type').value;
            if (diceFromYear) requestBody.fromYear = diceFromYear;
            if (diceToYear) requestBody.toYear = diceToYear;
            if (diceTransType) requestBody.transType = diceTransType;
        } else if (reportType === 'pivot') {
            const pivotFromYear = document.getElementById('pivot-from-year').value;
            const pivotToYear = document.getElementById('pivot-to-year').value;
            if (pivotFromYear) requestBody.fromYear = pivotFromYear;
            if (pivotToYear) requestBody.toYear = pivotToYear;
        }
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });
        console.log('Response status:', response.status);
        const data = await response.json();
        console.log('Data received:', data);

        if (response.ok) {
            const tableInfo = {
                columns: Object.keys(data[0] || {}),
                data: data.map(row => Object.values(row))
            };
            displayQueryResults(tableInfo);
        } else {
            throw new Error(data.error);
        }
    } catch (error) {
        console.error('Error:', error);
        const compileLog = document.createElement('div');
        compileLog.className = 'compile-log';
        const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
        compileLog.innerHTML = `
            <div class="compile-timestamp">${timestamp}</div>
            <div class="compile-message">ERROR: ${error.message}</div>
        `;
        document.getElementById('compile-logs-container').prepend(compileLog);
    }
}

// Display functions
async function displayTableData(tableName) {
    const tableInfo = await fetchTableData(tableName);
    if (!tableInfo) return;
    
    // Store data globally
    currentData = tableInfo;
    currentPage = 1;

    const headers = document.getElementById('table-headers');
    const body = document.getElementById('table-body');
    const tableNameElement = document.getElementById('selected-table-name');

    // Set table name
    tableNameElement.textContent = tableName;

    // Clear existing content
    headers.innerHTML = '';
    body.innerHTML = '';

    // Create headers
    const headerRow = document.createElement('tr');
    tableInfo.columns.forEach(column => {
        const th = document.createElement('th');
        th.textContent = column;
        headerRow.appendChild(th);
    });
    headers.appendChild(headerRow);

    // Render first page
    renderPage(currentPage);
}

let isLoading = false; // Add loading state flag

function handleScroll(e) {
    const container = e.target;
    const scrollBuffer = 100; // Increase buffer zone
    
    if (!isLoading && 
        container.scrollHeight - container.scrollTop - container.clientHeight < scrollBuffer) {
        // Near bottom, load more data if available
        if (currentData && (currentPage * PAGE_SIZE) < currentData.data.length) {
            isLoading = true;
            currentPage++;
            renderPage(currentPage);
            isLoading = false;
        }
    }
}

function renderPage(page) {
    if (!currentData) return;

    const body = document.getElementById(selectedReport ? 'report-body' : 'table-body');
    const start = (page - 1) * PAGE_SIZE;
    const end = Math.min(start + PAGE_SIZE, currentData.data.length);
    const pageData = currentData.data.slice(start, end);

    // Append new rows instead of clearing
    pageData.forEach(rowData => {
        const tr = document.createElement('tr');
        rowData.forEach(cellData => {
            const td = document.createElement('td');
            // Format numbers to 2 decimal places if it's a float
            if (typeof cellData === 'number' && !Number.isInteger(cellData)) {
                td.textContent = cellData.toFixed(2);
            } else {
                td.textContent = cellData;
            }
            tr.appendChild(td);
        });
        body.appendChild(tr);
    });

    // Update scroll event listener
    const tableContainer = document.querySelector('.table-responsive');
    tableContainer.onscroll = handleScroll;
}

function displayQueryResults(tableInfo) {
    // Store data globally
    currentData = tableInfo;
    currentPage = 1;
    
    const headers = document.getElementById('report-headers');
    const body = document.getElementById('report-body');
    
    // Clear existing content
    headers.innerHTML = '';
    body.innerHTML = '';

    // Create headers
    const headerRow = document.createElement('tr');
    tableInfo.columns.forEach(column => {
        const th = document.createElement('th');
        th.textContent = column;
        headerRow.appendChild(th);
    });
    headers.appendChild(headerRow);

    // Render first page
    renderPage(currentPage);

    // Generate chart for the report
    generateChart(tableInfo);

    // Show the report data section
    document.getElementById('report-data').classList.remove('hidden');
    
    if (selectedReport) {
        document.getElementById('selected-report-name').textContent = 
            document.querySelector(`[data-report="${selectedReport}"] .report-title`).textContent + ' Results';
    }
}

function generateChart(tableInfo) {
    // Destroy previous chart if exists
    if (currentChart) {
        currentChart.destroy();
    }

    const ctx = document.getElementById('report-chart').getContext('2d');
    
    // Different chart types for different reports
    switch(selectedReport) {
        case 'rollup':
            generateRollupChart(ctx, tableInfo);
            break;
        case 'drilldown':
            generateDrilldownChart(ctx, tableInfo);
            break;
        case 'slice':
            generateSliceChart(ctx, tableInfo);
            break;
        case 'dice':
            generateDiceChart(ctx, tableInfo);
            break;
        case 'pivot':
            generatePivotChart(ctx, tableInfo);
            break;
    }
}

function generateRollupChart(ctx, tableInfo) {
    // Line chart for time hierarchy
    const labels = [];
    const amounts = [];
    const counts = [];
    
    tableInfo.data.slice(0, 50).forEach(row => {
        const year = row[0];
        const quarter = row[1];
        const month = row[2];
        if (year && quarter && month) {
            labels.push(`${year}-Q${quarter}-M${month}`);
            amounts.push(parseFloat(row[3]) || 0);
            counts.push(parseInt(row[4]) || 0);
        }
    });

    currentChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Total Amount',
                data: amounts,
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                tension: 0.4,
                yAxisID: 'y'
            }, {
                label: 'Transaction Count',
                data: counts,
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                tension: 0.4,
                yAxisID: 'y1'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Transaction Trends Over Time',
                    color: '#f8fafc',
                    font: { size: 16 }
                },
                legend: {
                    labels: { color: '#f8fafc' }
                }
            },
            scales: {
                x: { 
                    ticks: { color: '#94a3b8' },
                    grid: { color: '#334155' }
                },
                y: {
                    type: 'linear',
                    position: 'left',
                    ticks: { color: '#94a3b8' },
                    grid: { color: '#334155' }
                },
                y1: {
                    type: 'linear',
                    position: 'right',
                    ticks: { color: '#94a3b8' },
                    grid: { display: false }
                }
            }
        }
    });
}

function generateDrilldownChart(ctx, tableInfo) {
    // Bar chart for regional breakdown
    const regionData = {};
    
    tableInfo.data.forEach(row => {
        const region = row[0];
        const amount = parseFloat(row[3]) || 0;
        if (!regionData[region]) {
            regionData[region] = 0;
        }
        regionData[region] += amount;
    });

    const labels = Object.keys(regionData).slice(0, 10);
    const data = labels.map(label => regionData[label]);

    currentChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Total Amount by Region',
                data: data,
                backgroundColor: '#3b82f6',
                borderColor: '#2563eb',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Transaction Amounts by Region',
                    color: '#f8fafc',
                    font: { size: 16 }
                },
                legend: {
                    labels: { color: '#f8fafc' }
                }
            },
            scales: {
                x: { 
                    ticks: { color: '#94a3b8' },
                    grid: { color: '#334155' }
                },
                y: {
                    ticks: { color: '#94a3b8' },
                    grid: { color: '#334155' }
                }
            }
        }
    });
}

function generateSliceChart(ctx, tableInfo) {
    // Pie chart for transaction types
    const labels = tableInfo.data.map(row => row[0]);
    const data = tableInfo.data.map(row => parseInt(row[1]) || 0);
    
    const colors = [
        '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
        '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#84cc16'
    ];

    currentChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors,
                borderColor: '#1e293b',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Transaction Distribution by Type',
                    color: '#f8fafc',
                    font: { size: 16 }
                },
                legend: {
                    labels: { color: '#f8fafc' },
                    position: 'right'
                }
            }
        }
    });
}

function generateDiceChart(ctx, tableInfo) {
    // Grouped bar chart for multi-dimensional analysis by transaction type
    
    // Check if we have multiple transaction types (All Types selected)
    const transTypes = [...new Set(tableInfo.data.map(row => row[2]))];
    const hasMultipleTypes = transTypes.length > 1;
    
    if (hasMultipleTypes) {
        // Group data by region-year and transaction type
        const regionYearData = {};
        
        tableInfo.data.forEach(row => {
            const region = row[0];
            const year = row[1];
            const transType = row[2];
            const amount = parseFloat(row[4]) || 0;
            const key = `${region} (${year})`;
            
            if (!regionYearData[key]) {
                regionYearData[key] = { CREDIT: 0, VYBER: 0, 'DEBIT (WITHDRAWAL)': 0 };
            }
            
            if (transType === 'CREDIT' || transType === 'VYBER' || transType === 'DEBIT (WITHDRAWAL)') {
                regionYearData[key][transType] += amount;
            }
        });
        
        // Get unique labels (region-year combinations)
        const labels = Object.keys(regionYearData).slice(0, 10);
        
        // Prepare datasets for each transaction type
        const datasets = [
            {
                label: 'CREDIT',
                data: labels.map(label => regionYearData[label].CREDIT),
                backgroundColor: '#10b981',
                borderColor: '#059669',
                borderWidth: 1
            },
            {
                label: 'DEBIT (WITHDRAWAL)',
                data: labels.map(label => regionYearData[label]['DEBIT (WITHDRAWAL)']),
                backgroundColor: '#ef4444',
                borderColor: '#dc2626',
                borderWidth: 1
            },
            {
                label: 'VYBER',
                data: labels.map(label => regionYearData[label].VYBER),
                backgroundColor: '#3b82f6',
                borderColor: '#2563eb',
                borderWidth: 1
            }
        ];
        
        currentChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Transaction Analysis by Type: Region × Year',
                        color: '#f8fafc',
                        font: { size: 16 }
                    },
                    legend: {
                        labels: { color: '#f8fafc' }
                    }
                },
                scales: {
                    x: { 
                        ticks: { color: '#94a3b8', maxRotation: 45, minRotation: 45 },
                        grid: { color: '#334155' }
                    },
                    y: {
                        ticks: { color: '#94a3b8' },
                        grid: { color: '#334155' }
                    }
                }
            }
        });
    } else {
        // Single transaction type selected - show simple bar chart
        const regionYearData = {};
        
        tableInfo.data.forEach(row => {
            const region = row[0];
            const year = row[1];
            const key = `${region}-${year}`;
            const amount = parseFloat(row[4]) || 0;
            
            if (!regionYearData[key]) {
                regionYearData[key] = { region, year, amount: 0 };
            }
            regionYearData[key].amount += amount;
        });

        const dataPoints = Object.values(regionYearData).slice(0, 20);
        const labels = dataPoints.map(d => `${d.region} (${d.year})`);
        const data = dataPoints.map(d => d.amount);
        
        const transType = transTypes[0] || 'Transaction';

        currentChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: `${transType} Amount`,
                    data: data,
                    backgroundColor: '#8b5cf6',
                    borderColor: '#7c3aed',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    title: {
                        display: true,
                        text: `${transType} Analysis: Region × Year`,
                        color: '#f8fafc',
                        font: { size: 16 }
                    },
                    legend: {
                        labels: { color: '#f8fafc' }
                    }
                },
                scales: {
                    x: { 
                        ticks: { color: '#94a3b8', maxRotation: 45, minRotation: 45 },
                        grid: { color: '#334155' }
                    },
                    y: {
                        ticks: { color: '#94a3b8' },
                        grid: { color: '#334155' }
                    }
                }
            }
        });
    }
}

function generatePivotChart(ctx, tableInfo) {
    // Stacked bar chart for inflow vs outflow
    const regionData = {};
    
    tableInfo.data.forEach(row => {
        const region = row[0];
        const inflow = parseFloat(row[3]) || 0;
        const outflow = parseFloat(row[4]) || 0;
        
        if (!regionData[region]) {
            regionData[region] = { inflow: 0, outflow: 0 };
        }
        regionData[region].inflow += inflow;
        regionData[region].outflow += outflow;
    });

    const labels = Object.keys(regionData);
    const inflowData = labels.map(label => regionData[label].inflow);
    const outflowData = labels.map(label => regionData[label].outflow);

    currentChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Inflow',
                data: inflowData,
                backgroundColor: '#10b981',
                borderColor: '#059669',
                borderWidth: 1
            }, {
                label: 'Outflow',
                data: outflowData,
                backgroundColor: '#ef4444',
                borderColor: '#dc2626',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Cash Flow Analysis: Inflow vs Outflow by Region',
                    color: '#f8fafc',
                    font: { size: 16 }
                },
                legend: {
                    labels: { color: '#f8fafc' }
                }
            },
            scales: {
                x: { 
                    ticks: { color: '#94a3b8' },
                    grid: { color: '#334155' }
                },
                y: {
                    ticks: { color: '#94a3b8' },
                    grid: { color: '#334155' },
                    stacked: false
                }
            }
        }
    });
}

