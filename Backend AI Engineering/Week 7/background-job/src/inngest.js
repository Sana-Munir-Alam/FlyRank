const { Inngest } = require("inngest");

// Create the Inngest client for this application
const inngest = new Inngest({
    id: "report-api"
});

module.exports = { inngest };