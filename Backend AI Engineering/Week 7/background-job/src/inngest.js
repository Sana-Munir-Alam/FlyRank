const { Inngest } = require("inngest");

// Create an Inngest client to send events to your account
const inngest = new Inngest({
    id: "report-api"
});

module.exports = { inngest };