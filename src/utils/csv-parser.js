/* ============================================
   CSV PARSER — Wrapper around PapaParse
   ============================================ */
var CSVParser = {
    /**
     * Parse a CSV file and return rows as objects
     * @param {File} file - File object from input
     * @returns {Promise<{data: Array, fields: Array}>}
     */
    parseFile: function (file) {
        return new Promise(function (resolve, reject) {
            Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                dynamicTyping: true,
                complete: function (results) {
                    // Strip BOM and whitespace from field names
                    var cleanFields = (results.meta.fields || []).map(function (f) {
                        return f.replace(/^\uFEFF/, '').trim();
                    });

                    // Re-map data keys to clean field names
                    var originalFields = results.meta.fields || [];
                    var cleanData = results.data.map(function (row) {
                        var newRow = {};
                        for (var i = 0; i < originalFields.length; i++) {
                            newRow[cleanFields[i]] = row[originalFields[i]];
                        }
                        return newRow;
                    });

                    console.log('[CSV Parser] Detected columns:', cleanFields.join(', '));

                    resolve({
                        data: cleanData,
                        fields: cleanFields,
                        errors: results.errors
                    });
                },
                error: function (err) {
                    reject(err);
                }
            });
        });
    },

    /**
     * Try to find a column by multiple possible names (case-insensitive)
     * Falls back to partial/contains matching if exact match not found
     */
    findColumn: function (fields, possibleNames) {
        // 1) Exact match (case-insensitive)
        for (var i = 0; i < possibleNames.length; i++) {
            for (var j = 0; j < fields.length; j++) {
                if (fields[j].toLowerCase().trim() === possibleNames[i].toLowerCase().trim()) {
                    return fields[j];
                }
            }
        }
        // 2) Partial/contains match (case-insensitive) as fallback
        for (var i = 0; i < possibleNames.length; i++) {
            for (var j = 0; j < fields.length; j++) {
                if (fields[j].toLowerCase().trim().indexOf(possibleNames[i].toLowerCase().trim()) !== -1) {
                    return fields[j];
                }
            }
        }
        return null;
    },

    /**
     * Get cell value with fallback column names
     */
    getValue: function (row, fields, possibleNames) {
        var col = CSVParser.findColumn(fields, possibleNames);
        if (col && row[col] !== undefined && row[col] !== null) {
            return String(row[col]).trim();
        }
        return '';
    }
};
