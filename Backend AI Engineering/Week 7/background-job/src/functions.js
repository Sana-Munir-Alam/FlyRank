const { inngest } = require("./inngest");

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

module.exports = { sayHello };