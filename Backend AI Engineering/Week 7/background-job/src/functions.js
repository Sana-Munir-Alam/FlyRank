const { inngest } = require("./inngest");
const { reports } = require("./reports");

// Create a background function that will run when the "test/hello" event is sent to Inngest
const sayHello = inngest.createFunction(
    {
        id: "say-hello",
        triggers: [{ event: "test/hello" }]
    },
    async ({ step }) => {
        await step.sleep("wait-5-seconds", "5s");    // Background Sleep of 5 seconds
        return "Hello from the background!";
    }
);

// Create a background function that will run when the "report/requested" event is sent to Inngest
const makeReport = inngest.createFunction(
    {
        id: "make-report",
        triggers: [{ event: "report/requested" }]
    },
    async ({ event, step }) => {
        await step.sleep("do-the-slow-work", "8s");     // Background Sleep of 8 seconds to simulate slow work

        return await step.run("build-report", async () => {
            const { id, topic } = event.data;
            const result = `Report generated for topic: ${topic}`;
            reports.set(id, {id, topic, status: "done", result});
            return result;
        });
    }
);

module.exports = {
    sayHello,
    makeReport
};