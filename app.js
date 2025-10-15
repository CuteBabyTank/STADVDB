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
        // Remove selected class from all cards
        document.querySelectorAll('.report-card').forEach(c => c.classList.remove('selected'));
        // Add selected class to clicked card
        card.classList.add('selected');
        selectedReport = card.getAttribute('data-report');
        // Enable run button
        document.getElementById('run-query').disabled = false;
    });
});

document.getElementById('run-query').addEventListener('click', () => {
    if (selectedReport) {
        runReportQuery(selectedReport);
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
    try {
        const response = await fetch(`http://localhost:3000/api/reports/${reportType}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        const data = await response.json();

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

    // Create data rows
    tableInfo.data.forEach(rowData => {
        const tr = document.createElement('tr');
        rowData.forEach(cellData => {
            const td = document.createElement('td');
            td.textContent = cellData;
            tr.appendChild(td);
        });
        body.appendChild(tr);
    });
}

function displayQueryResults(tableInfo) {
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

    // Create data rows
    tableInfo.data.forEach(rowData => {
        const tr = document.createElement('tr');
        rowData.forEach(cellData => {
            const td = document.createElement('td');
            td.textContent = cellData;
            tr.appendChild(td);
        });
        body.appendChild(tr);
    });

    // Show the report data section
    document.getElementById('report-data').classList.remove('hidden');
    
    // Update report name if available
    if (selectedReport) {
        document.getElementById('selected-report-name').textContent = 
            document.querySelector(`[data-report="${selectedReport}"] .report-title`).textContent + ' Results';
    }
}
