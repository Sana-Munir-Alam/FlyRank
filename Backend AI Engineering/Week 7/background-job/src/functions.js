const { inngest } = require("./inngest");
const { reports } = require("./reports");
const fs = require("fs").promises;
const path = require("path");

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
        concurrency: {limit: 2},
        idempotency: "event.data.id",
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
        await step.sleep("do-the-slow-work", "8s");     // For Concurrency test and to see Queue on Inngest Dashboard comment this line out

        return await step.run("build-report", async () => {
            // await new Promise(resolve => setTimeout(resolve, 8000)); // For Concurrency test UNCOMMENT this line out
            const { id, topic } = event.data;
            const existingReport = reports.get(id);
            if (existingReport?.status === "done") {
                return existingReport.result;
            }
            if (topic === "fail") {  // This gives us a controlled failure that we can observe.
                throw new Error("The report oven is broken!");
            }
            const result = `Report generated for topic: ${topic}`;
            reports.set(id, {id, topic, status: "done", result});
            
            // Write the report to the outbox directory
            const outboxPath = path.join(__dirname, "..", "outbox", `${id}.txt`);
            await fs.writeFile(outboxPath, `Report ready\n\nTopic: ${topic}\n\n${result}\n`);
            
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