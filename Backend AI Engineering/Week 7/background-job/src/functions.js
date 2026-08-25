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
        retries: 2,
        triggers: [{ event: "report/requested" }],
        onFailure: async ({ event, step }) => {
            const originalEvent = event.data.event;
            const { id, topic } = originalEvent.data;
            await step.run("mark-report-failed", async () => {
                reports.set(id, {id, topic, status: "failed"});
            });
        }
    },
    async ({ event, step }) => {
        await step.sleep("do-the-slow-work", "8s");     // Background Sleep of 8 seconds to simulate slow work

        return await step.run("build-report", async () => {
            const { id, topic } = event.data;

            if (topic === "fail") {  // This gives us a controlled failure that we can observe.
                throw new Error("The report oven is broken!");
            }

            const result = `Report generated for topic: ${topic}`;
            reports.set(id, {id, topic, status: "done", result});
            return result;
        });
    }
);

// Create a background function that will run every minute to log the status of reports
const heartbeat = inngest.createFunction(
    {
        id: "heartbeat",
        triggers: [{ cron: "* * * * *" }]   // minute   hour   day   month   weekday
    },
    async () => {
        let pending = 0, done = 0, failed = 0;
        for (const report of reports.values()) {
            if (report.status === "pending") { pending++; }
            else if (report.status === "done") { done++; }
            else if (report.status === "failed") { failed++;}
        }
        console.log(`Heartbeat: pending=${pending}, done=${done}, failed=${failed}`);
    }
);


module.exports = {
    sayHello,
    makeReport,
    heartbeat
};