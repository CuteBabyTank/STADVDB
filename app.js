document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.add('hidden');
        });
        const tabName = tab.getAttribute('data-tab');
        document.getElementById(`${tabName}-view`).classList.remove('hidden');
        document.getElementById('table-data').classList.add('hidden');
        document.getElementById('report-data').classList.add('hidden');
    });
});

let selectedTable = null;
let selectedReport = null;
let currentData = null;
let currentPage = 1;
const PAGE_SIZE = 1000;
let currentChart = null;

document.querySelectorAll('.table-card').forEach(card => {
    card.addEventListener('click', () => {
        document.querySelectorAll('.table-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        selectedTable = card.getAttribute('data-table');
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
        document.querySelectorAll('.report-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        selectedReport = card.getAttribute('data-report');
        console.log('Selected report set to:', selectedReport);
        document.getElementById('runtime-log').classList.add('hidden');
        
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
            loadAvailableRegions();
            loadAvailableDistricts();
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

// Load available regions for filter
async function loadAvailableRegions() {
    try {
        const response = await fetch('http://localhost:3000/api/available-regions');
        const regions = await response.json();
        
        const regionSelect = document.getElementById('drilldown-region');
        regionSelect.innerHTML = '<option value="">All Regions</option>';
        
        regions.forEach(region => {
            const option = document.createElement('option');
            option.value = region;
            option.textContent = region;
            regionSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading regions:', error);
    }
}

// Load available districts for filter
async function loadAvailableDistricts() {
    try {
        const response = await fetch('http://localhost:3000/api/available-districts');
        const districts = await response.json();
        
        const districtSelect = document.getElementById('drilldown-district');
        districtSelect.innerHTML = '<option value="">All Districts</option>';
        
        districts.forEach(district => {
            const option = document.createElement('option');
            option.value = district;
            option.textContent = district;
            districtSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading districts:', error);
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
    
    // Hide runtime log from previous query
    document.getElementById('runtime-log').classList.add('hidden');
    
    // Start timing
    const startTime = performance.now();
    
    try {
        const url = `http://localhost:3000/api/reports/${reportType}`;
        console.log('Fetching:', url);
        
        // Get filter values based on report type
        const requestBody = {};
        if (reportType === 'drilldown') {
            const drilldownFromYear = document.getElementById('drilldown-from-year').value;
            const drilldownToYear = document.getElementById('drilldown-to-year').value;
            const drilldownRegion = document.getElementById('drilldown-region').value;
            const drilldownDistrict = document.getElementById('drilldown-district').value;
            if (drilldownFromYear) requestBody.fromYear = drilldownFromYear;
            if (drilldownToYear) requestBody.toYear = drilldownToYear;
            if (drilldownRegion) requestBody.region = drilldownRegion;
            if (drilldownDistrict) requestBody.district = drilldownDistrict;
        } else if (reportType === 'rollup') {
            const fromYear = document.getElementById('from-year-filter').value;
            const toYear = document.getElementById('to-year-filter').value;
            const quarter = document.getElementById('rollup-quarter').value;
            if (fromYear) requestBody.fromYear = fromYear;
            if (toYear) requestBody.toYear = toYear;
            if (quarter) requestBody.quarter = quarter;
        } else if (reportType === 'slice') {
            const sliceFromYear = document.getElementById('slice-from-year').value;
            const sliceToYear = document.getElementById('slice-to-year').value;
            const sliceMetric = document.getElementById('slice-metric').value;
            if (sliceFromYear) requestBody.fromYear = sliceFromYear;
            if (sliceToYear) requestBody.toYear = sliceToYear;
            if (sliceMetric) requestBody.metric = sliceMetric;
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
        const responseData = await response.json();
        console.log('Data received:', responseData);

        if (response.ok) {
            // Extract data and server execution time from response
            const data = responseData.data;
            const serverExecutionTime = responseData.executionTime;
            
            const tableInfo = {
                columns: Object.keys(data[0] || {}),
                data: data.map(row => Object.values(row))
            };
            displayQueryResults(tableInfo);
            displayRuntimeLog(serverExecutionTime);
        } else {
            throw new Error(responseData.error);
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
function displayRuntimeLog(executionTime) {
    const runtimeLog = document.getElementById('runtime-log');
    const runtimeText = document.getElementById('runtime-text');
    
    runtimeText.textContent = `Query executed in ${executionTime} seconds`;
    runtimeLog.classList.remove('hidden');
    runtimeLog.classList.add('success');
    
    console.log(`✅ Query execution time: ${executionTime} seconds`);
}

// Display functions
async function displayTableData(tableName) {
    const tableInfo = await fetchTableData(tableName);
    if (!tableInfo) return;
    currentData = tableInfo;
    currentPage = 1;

    const headers = document.getElementById('table-headers');
    const body = document.getElementById('table-body');
    const tableNameElement = document.getElementById('selected-table-name');

    // Set table name
    tableNameElement.textContent = tableName;
    headers.innerHTML = '';
    body.innerHTML = '';
    const headerRow = document.createElement('tr');
    tableInfo.columns.forEach(column => {
        const th = document.createElement('th');
        th.textContent = column;
        headerRow.appendChild(th);
    });
    headers.appendChild(headerRow);
    renderPage(currentPage);
}

let isLoading = false;

function handleScroll(e) {
    const container = e.target;
    const scrollBuffer = 100;
    
    if (!isLoading && 
        container.scrollHeight - container.scrollTop - container.clientHeight < scrollBuffer) {
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

    pageData.forEach(rowData => {
        const tr = document.createElement('tr');
        rowData.forEach(cellData => {
            const td = document.createElement('td');
            if (typeof cellData === 'number' && !Number.isInteger(cellData)) {
                td.textContent = cellData.toFixed(2);
            } else {
                td.textContent = cellData;
            }
            tr.appendChild(td);
        });
        body.appendChild(tr);
    });
    const tableContainer = document.querySelector('.table-responsive');
    tableContainer.onscroll = handleScroll;
}

function displayQueryResults(tableInfo) {
    currentData = tableInfo;
    currentPage = 1;
    
    const headers = document.getElementById('report-headers');
    const body = document.getElementById('report-body');
    headers.innerHTML = '';
    body.innerHTML = '';
    const headerRow = document.createElement('tr');
    tableInfo.columns.forEach(column => {
        const th = document.createElement('th');
        th.textContent = column;
        headerRow.appendChild(th);
    });
    headers.appendChild(headerRow);
    renderPage(currentPage);
    generateChart(tableInfo);
    document.getElementById('report-data').classList.remove('hidden');
    
    if (selectedReport) {
        document.getElementById('selected-report-name').textContent = 
            document.querySelector(`[data-report="${selectedReport}"] .report-title`).textContent + ' Results';
    }
}

function generateChart(tableInfo) {
    if (currentChart) {
        currentChart.destroy();
    }
    if (window.comparisonCharts) {
        window.comparisonCharts.forEach(chart => chart.destroy());
        window.comparisonCharts = [];
    }
    document.querySelector('.chart-container').classList.remove('hidden');
    document.getElementById('comparison-charts-container').classList.add('hidden');
    const ctx = document.getElementById('report-chart').getContext('2d');

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
    const districtData = {};
    
    tableInfo.data.forEach(row => {
        const district = row[1];
        const amount = parseFloat(row[4]) || 0;
        if (!districtData[district]) {
            districtData[district] = 0;
        }
        districtData[district] += amount;
    });

    // Sort districts by amount and get all of them (or limit if too many)
    const sortedDistricts = Object.entries(districtData)
        .sort((a, b) => b[1] - a[1]);
    
    const labels = sortedDistricts.map(entry => entry[0]);
    const data = sortedDistricts.map(entry => entry[1]);

    currentChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Total Amount by District',
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
                    text: 'Transaction Amounts by District',
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

function generateSliceChart(ctx, tableInfo) {
    const selectedMetric = document.getElementById('slice-metric').value || 'transaction_count';
    if (selectedMetric === 'all') {
        generateSliceComparisonCharts(tableInfo);
        return;
    }
    
    const labels = tableInfo.data.map(row => row[0]);
    let data;
    let chartTitle;
    switch(selectedMetric) {
        case 'transaction_count':
            data = tableInfo.data.map(row => parseInt(row[1]) || 0);
            chartTitle = 'Transaction Distribution by Type (Count)';
            break;
        case 'total_amount':
            data = tableInfo.data.map(row => parseFloat(row[2]) || 0);
            chartTitle = 'Transaction Distribution by Type (Total Amount)';
            break;
        case 'average_amount':
            data = tableInfo.data.map(row => parseFloat(row[3]) || 0);
            chartTitle = 'Transaction Distribution by Type (Average Amount)';
            break;
        default:
            data = tableInfo.data.map(row => parseInt(row[1]) || 0);
            chartTitle = 'Transaction Distribution by Type';
    }
    
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
                    text: chartTitle,
                    color: '#f8fafc',
                    font: { size: 16 }
                },
                legend: {
                    labels: { color: '#f8fafc' },
                    position: 'right'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((value / total) * 100).toFixed(2);
                            return `${label}: ${value.toLocaleString()} (${percentage}%)`;
                        }
                    }
                },
                datalabels: {
                    color: '#ffffff',
                    font: {
                        weight: 'bold',
                        size: 14
                    },
                    formatter: (value, context) => {
                        const total = context.dataset.data.reduce((a, b) => a + b, 0);
                        const percentage = ((value / total) * 100).toFixed(1);
                        return percentage > 3 ? `${percentage}%` : '';
                    },
                    anchor: 'center',
                    align: 'center'
                }
            }
        },
        plugins: [ChartDataLabels]  // Register the plugin
    });
}

function generateSliceComparisonCharts(tableInfo) {
    document.querySelector('.chart-container').classList.add('hidden');
    document.getElementById('comparison-charts-container').classList.remove('hidden');
    
    const labels = tableInfo.data.map(row => row[0]);
    const colors = [
        '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
        '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#84cc16'
    ];
    
    const metrics = [
        {
            canvasId: 'comparison-chart-1',
            data: tableInfo.data.map(row => parseInt(row[1]) || 0),
            title: 'Transaction Count'
        },
        {
            canvasId: 'comparison-chart-2',
            data: tableInfo.data.map(row => parseFloat(row[2]) || 0),
            title: 'Total Amount'
        },
        {
            canvasId: 'comparison-chart-3',
            data: tableInfo.data.map(row => parseFloat(row[3]) || 0),
            title: 'Average Amount'
        }
    ];
    
    if (window.comparisonCharts) {
        window.comparisonCharts.forEach(chart => chart.destroy());
    }
    window.comparisonCharts = [];

    metrics.forEach(metric => {
        const ctx = document.getElementById(metric.canvasId).getContext('2d');
        const chart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: labels,
                datasets: [{
                    data: metric.data,
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
                        text: metric.title,
                        color: '#f8fafc',
                        font: { size: 18, weight: 'bold' },
                        padding: { bottom: 20 }
                    },
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.parsed || 0;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((value / total) * 100).toFixed(2);
                                return `${label}: ${value.toLocaleString()} (${percentage}%)`;
                            }
                        }
                    },
                    datalabels: {
                        color: '#ffffff',
                        font: {
                            weight: 'bold',
                            size: 14
                        },
                        formatter: (value, context) => {
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((value / total) * 100).toFixed(1);
                            return percentage > 3 ? `${percentage}%` : '';
                        },
                        anchor: 'center',
                        align: 'center'
                    }
                }
            },
            plugins: [ChartDataLabels]  // Register the plugin
        });
        window.comparisonCharts.push(chart);
    });
    
    // Create a single legend at the bottom
    const legendContainer = document.getElementById('comparison-legend');
    legendContainer.innerHTML = '';
    
    labels.forEach((label, index) => {
        const legendItem = document.createElement('div');
        legendItem.className = 'comparison-legend-item';
        
        const colorBox = document.createElement('div');
        colorBox.className = 'comparison-legend-color';
        colorBox.style.backgroundColor = colors[index];
        
        const labelText = document.createElement('span');
        labelText.textContent = label;
        
        legendItem.appendChild(colorBox);
        legendItem.appendChild(labelText);
        legendContainer.appendChild(legendItem);
    });
}

function generateDiceChart(ctx, tableInfo) {
    const transTypes = [...new Set(tableInfo.data.map(row => row[2]))];
    const hasMultipleTypes = transTypes.length > 1;
    
    if (hasMultipleTypes) {
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
        
        const labels = Object.keys(regionYearData).slice(0, 10);
        
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

