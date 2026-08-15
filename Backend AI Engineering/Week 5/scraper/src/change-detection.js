const crypto = require("crypto");

function hashRecord(record) {
    const canonicalRecord = {
        title: record.title,
        product_url: record.product_url,
        price_text: record.price_text,
        price_gbp: record.price_gbp,
        availability_text: record.availability_text,
        rating_text: record.rating_text,
        description: record.description,
        source_page: record.source_page,
    };

    return crypto.createHash("sha256").update(JSON.stringify(canonicalRecord)).digest("hex");
}

function compareRecords(previousRecords, currentRecords) {
    const previousMap = new Map(
        previousRecords.map((record) => [
            record.product_url,
            hashRecord(record),
        ])
    );

    const currentMap = new Map(
        currentRecords.map((record) => [
            record.product_url,
            hashRecord(record),
        ])
    );

    let newRecords = 0;
    let changedRecords = 0;
    let unchangedRecords = 0;
    let goneRecords = 0;

    for (const [url, currentHash] of currentMap) {
        if (!previousMap.has(url)) {
            newRecords++;
        } else if (previousMap.get(url) !== currentHash) {
            changedRecords++;
        } else {
            unchangedRecords++;
        }
    }

    for (const url of previousMap.keys()) {
        if (!currentMap.has(url)) {
            goneRecords++;
        }
    }

    return {
        new: newRecords,
        changed: changedRecords,
        unchanged: unchangedRecords,
        gone: goneRecords,
    };
}

module.exports = {
    hashRecord,
    compareRecords,
};