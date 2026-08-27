const { getReportData } = require("../src/report");
const data = getReportData();

console.log(JSON.stringify(data, null, 2));