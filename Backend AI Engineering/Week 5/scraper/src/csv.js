function escapeCsvValue(value) {
    if (value === null || value === undefined) {
        return "";
    }
    const stringValue = String(value);
    if ( stringValue.includes(",") || stringValue.includes('"') || stringValue.includes("\n") || stringValue.includes("\r")) {
        return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
}

function recordsToCsv(records) {
    const headers = [
        "title",
        "product_url",
        "price_text",
        "price_gbp",
        "availability_text",
        "rating_text",
        "description",
        "source_page",
        "fetched_at",
    ];

    const rows = records.map((record) =>
        headers.map((header) => escapeCsvValue(record[header])).join(",")
    );

    return [headers.join(","), ...rows].join("\n") + "\n";
}

module.exports = {
    recordsToCsv,
};