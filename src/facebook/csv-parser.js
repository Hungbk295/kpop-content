const fs = require('fs');

/**
 * Parse Facebook export CSV file
 * @param {string} csvPath - Path to the CSV file
 * @returns {Array} Array of post objects
 */
function parseExportCSV(csvPath) {
    const content = fs.readFileSync(csvPath, 'utf-8');

    // Parse CSV properly handling multi-line quoted fields
    const rows = parseCSVContent(content);

    if (rows.length < 2) {
        throw new Error('CSV file is empty or invalid');
    }

    const header = rows[0];
    console.log('CSV Headers:', header);

    // More precise column matching
    const colIndex = {
        title: header.findIndex(h => h.toLowerCase() === 'title'),
        date: header.findIndex(h => h.toLowerCase() === 'date' || h.toLowerCase() === 'publish time'),
        type: header.findIndex(h => h.toLowerCase() === 'post type'),
        views: header.findIndex(h => h.toLowerCase() === 'views'),
        reach: header.findIndex(h => h.toLowerCase() === 'impressions'),
        engagement: header.findIndex(h => h.toLowerCase() === 'reactions'),
        comments: header.findIndex(h => h.toLowerCase() === 'comments'),
        shares: header.findIndex(h => h.toLowerCase() === 'shares'),
        url: header.findIndex(h => h.toLowerCase() === 'permalink')
    };

    console.log('Column mapping:', colIndex);

    const posts = [];

    for (let i = 1; i < rows.length; i++) {
        const cols = rows[i];
        if (cols.length < 5) continue; // Skip incomplete rows

        const post = {
            title: cols[colIndex.title] || '',
            date: cols[colIndex.date] || '',
            postType: cols[colIndex.type] || 'Post',
            views: cols[colIndex.views] || '0',
            impressions: cols[colIndex.reach] || '0',
            engagement: cols[colIndex.engagement] || '0',
            comments: cols[colIndex.comments] || '0',
            shares: cols[colIndex.shares] || '0',
            url: cols[colIndex.url] || ''
        };

        if (post.title || post.url) {
            posts.push(post);
        }
    }

    console.log(`Parsed ${posts.length} posts from CSV`);
    return posts;
}

/**
 * Parse CSV content handling multi-line quoted fields
 * @param {string} content - Raw CSV content
 * @returns {Array} Array of row arrays
 */
function parseCSVContent(content) {
    const rows = [];
    let currentRow = [];
    let currentField = '';
    let inQuotes = false;

    for (let i = 0; i < content.length; i++) {
        const char = content[i];
        const nextChar = content[i + 1];

        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                // Escaped quote
                currentField += '"';
                i++;
            } else {
                // Toggle quote mode
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            // End of field
            currentRow.push(currentField.trim());
            currentField = '';
        } else if ((char === '\n' || (char === '\r' && nextChar === '\n')) && !inQuotes) {
            // End of row
            if (char === '\r') i++; // Skip \n in \r\n
            currentRow.push(currentField.trim());
            if (currentRow.some(f => f)) { // Skip empty rows
                rows.push(currentRow);
            }
            currentRow = [];
            currentField = '';
        } else if (char === '\r' && !inQuotes) {
            // End of row (just \r)
            currentRow.push(currentField.trim());
            if (currentRow.some(f => f)) {
                rows.push(currentRow);
            }
            currentRow = [];
            currentField = '';
        } else {
            currentField += char;
        }
    }

    // Handle last field/row
    if (currentField || currentRow.length > 0) {
        currentRow.push(currentField.trim());
        if (currentRow.some(f => f)) {
            rows.push(currentRow);
        }
    }

    return rows;
}

module.exports = { parseExportCSV, parseCSVContent };
