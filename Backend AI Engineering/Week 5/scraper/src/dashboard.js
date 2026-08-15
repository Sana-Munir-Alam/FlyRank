function generateDashboard(records, report) {
    const prices = records.map((record) => record.price_gbp).filter((price) => typeof price === "number");
    const minPrice = prices.length > 0 ? Math.min(...prices).toFixed(2) : "N/A";
    const maxPrice = prices.length > 0 ? Math.max(...prices).toFixed(2) : "N/A";

    const changes = report.changes || {
        new: 0,
        changed: 0,
        unchanged: 0,
        gone: 0,
    };

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Books Scraper Dashboard</title>

    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 1000px;
            margin: 40px auto;
            padding: 0 30px;
            background: #f5f5f5;
            color: #222;
        }

        h1 {
            margin-bottom: 30px;
        }

        .grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
        }

        .card {
            background: white;
            padding: 25px;
            border-radius: 10px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.08);
            min-height: 100px;
            box-sizing: border-box;
        }

        .label {
            color: #666;
            font-size: 16px;
        }

        .value {
            font-size: 28px;
            font-weight: bold;
            margin-top: 12px;
            word-break: break-word;
        }

        @media (max-width: 600px) {
            body {
                margin: 20px auto;
                padding: 0 15px;
            }

            .grid {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>

<body>

    <h1>Books Scraper Dashboard</h1>

    <div class="grid">

        <div class="card">
            <div class="label">Records</div>
            <div class="value">${records.length}</div>
        </div>

        <div class="card">
            <div class="label">Price Range</div>
            <div class="value">£${minPrice} – £${maxPrice}</div>
        </div>

        <div class="card">
            <div class="label">Failures</div>
            <div class="value">${report.failed_pages}</div>
        </div>

        <div class="card">
            <div class="label">Last Run</div>
            <div class="value">${report.start_time}</div>
        </div>

        <div class="card">
            <div class="label">New</div>
            <div class="value">${changes.new}</div>
        </div>

        <div class="card">
            <div class="label">Changed</div>
            <div class="value">${changes.changed}</div>
        </div>

        <div class="card">
            <div class="label">Unchanged</div>
            <div class="value">${changes.unchanged}</div>
        </div>

        <div class="card">
            <div class="label">Gone</div>
            <div class="value">${changes.gone}</div>
        </div>

    </div>

</body>
</html>`;
}

module.exports = {
    generateDashboard,
};