# AI Decision Flow

A visual workflow builder where each node asks an AI model a yes or no question, and the answer decides which branch runs next. Built with Next.js, React Flow, and Inngest.

You draw the graph in the browser. When you run it, the graph is sent to a durable Inngest function that walks it one decision at a time, calling the model at each node, and reports live progress back to the UI while it runs.

## Tech Stack

* Next.js 16, App Router, TypeScript
* React Flow (`@xyflow/react`)
* Inngest for durable, step based workflow execution
* Google Gemini, called through its OpenAI compatible endpoint using the standard `openai` client library
* Tailwind CSS

## AI Provider

This project uses Gemini instead of OpenAI. The internship explicitly permits using any provider. Gemini is called through its OpenAI compatible API, using the `openai` client library pointed at Gemini's base URL, so the calling code still matches the assignment's required interface.

The model integration lives entirely in `lib/gemini.ts`. That file only knows about prompts and YES/NO answers. It has no knowledge of Inngest, retries, or the run store, by design. All orchestration decisions live in `lib/inngest/functions.ts`.

## Project Structure

```
ai-decision-flow/
├── app/
│   ├── api/
│   │   ├── inngest/
│   │   │   └── route.ts
│   │   ├── trigger-flow/
│   │   │   └── route.ts
│   │   └── runs/
│   │       └── [runId]/
│   │           └── route.ts
│   └── page.tsx
├── components/
│   └── flow/
│       ├── DecisionNode.tsx
│       ├── NoEdge.tsx
│       ├── YesEdge.tsx
│       └── LogsPanel.tsx
├── lib/
│   ├── inngest/
│   │   ├── client.ts
│   │   └── functions.ts
│   ├── gemini.ts
│   ├── runStore.ts
│   └── flowStorage.ts
├── fixtures/
│   ├── valid-flow.json
│   ├── bad-flow.json
│   └── converging-graph.json
├── screenshots/
├── .env.local
├── package.json
└── README.md
```

## Setup

```
npm install
```

Create `.env.local` in the project root:

```
GEMINI_API_KEY=your_gemini_api_key
INNGEST_DEV=1
```

Run the app, two terminals:

```
npm run dev
```

```
npx inngest cli@latest dev
```

Open the app at `http://localhost:3000`. Open the Inngest dashboard at `http://localhost:8288`.

## Features Implemented

The assignment asked for at least three items from a polish list. This build completed six of the eight:

* Visual execution state, every node shows pending, running, completed, failed, or skipped, live, while a run is in progress
* Execution logs panel, a live sidebar showing run status and every node's current state
* Error handling, real client side and server side validation before a run starts, plus accurate error surfacing when a node genuinely fails, plus a fix that stops a permanently invalid model key from being retried needlessly
* Animated active edges, the edge belonging to the branch actually taken lights up once its source node's decision is known
* Save and load workflows, backed by `localStorage`
* JSON export and import, with full structural validation on import, not just a `JSON.parse` and a hope

Deliberately left out, and why, covered under Known Limitations below: retry failed nodes, and node styling polish.

## How Execution Works

1. The user builds a graph in the editor and connects YES and NO handles.
2. Clicking Run Flow sends the current graph to `POST /api/trigger-flow`.
3. The route validates the whole workflow before anything is sent to Inngest. See Validation below.
4. If valid, the route sends a `flow/run` event to Inngest and returns a `runId` to the frontend immediately.
5. The frontend starts polling `GET /api/runs/[runId]` once per second and renders whatever it gets back in the logs panel.
6. On the backend, `runDecisionFlow` starts at the workflow's single root node. Each node executes as its own named Inngest step, `decide-<nodeId>`, which calls the model and returns strictly YES or NO.
7. As each node resolves, the run store is updated with that node's status, so the next poll reflects it.
8. The matching outgoing edge is followed. A node with no outgoing edge for its decision is a terminal node, execution ends there.
9. The unselected branch, and everything reachable from it, is immediately marked skipped, so the logs panel does not sit on pending forever for nodes that were never going to run.
10. Once traversal ends, the function returns the full execution order and marks the run complete or failed in the store.

## Validation

Enforced in `trigger-flow/route.ts`, independently of whatever the UI already prevents, because the UI is not the only possible caller of this endpoint:

* Request body must be valid JSON
* `startNodeId` must reference an existing node
* At least one node is required
* Every node must have a non empty prompt
* Node IDs must be unique
* Every edge must reference nodes that actually exist
* No edge may connect a node to itself
* Only `yes` or `no` are valid source handles
* A node may have at most one YES edge and at most one NO edge out of it
* A node may have at most one incoming edge
* The workflow must have exactly one root node, and `startNodeId` must be that root

The last two rules keep the graph a true tree rather than a general graph. The traversal logic, and the logic that marks unreached branches as skipped, both assume a tree structure. Two different nodes converging on the same downstream node, or two disconnected trees in the same graph, would both break that assumption without these checks.

The exact same rule set is enforced a second time in `lib/flowStorage.ts`, applied to an imported JSON file instead of a network request. A file is just as untrusted as a request body, someone could hand edit an exported file before importing it, so it gets validated on the way in rather than trusted because it came from disk.

The UI enforces the same rules while the graph is being built, so most invalid graphs are never even constructible by hand. The server and the import path both check independently, because both can be reached without going through the UI.

## Design Notes

**Step level durability.** Each node's model call is wrapped in its own `step.run`. If a later node fails, Inngest replays the function but reuses the already recorded results of earlier steps instead of recalling the model for them. This also means a node's decision cannot change on replay even though the model itself is not perfectly deterministic across separate calls.

**Retries, and where retry decisions actually have to live.** The function is configured with `retries: 2`, lower than Inngest's default of 4. A malformed model response is worth retrying once or twice, since a fresh sample may parse correctly, but is not worth retrying repeatedly since it is usually a prompt issue, not a transient one.

Some failures are not worth retrying at all. An invalid API key returns the same error every time, so retrying it just wastes time and quota. Classifying an error as permanent has to happen inside the callback passed to `step.run`, not in the code that awaits it. Inngest decides whether to retry based only on what happens inside that callback. Code outside it, in the block that awaits `step.run`, only runs after Inngest has already finished retrying, so it is too late to influence that decision. The permanent error check throws Inngest's `NonRetriableError` from inside the step callback itself, which causes an invalid key to fail after a single attempt instead of after three.

**Cycle detection.** Traversal keeps a visited set of node IDs. If a node is reached twice in the same run, the function throws `NonRetriableError`, since a cycle in the graph will not resolve itself on retry.

**Skipping, including nested branches.** When a node's decision is known, the unselected edge's target, and everything reachable from it, is marked skipped immediately using a breadth first walk. This matters for nested branches, if node C is skipped because its parent chose the other path, C's own children were never going to run either, and should be marked skipped right away rather than sitting at pending until the whole run ends.

**Exactly one root, enforced everywhere.** A workflow with zero or multiple root nodes is rejected before it ever reaches Inngest, both client side in the editor and server side on the trigger endpoint, and again on import. This closes a real bug found during testing, where a graph with two disconnected trees would silently only execute the first one, leaving the second tree's nodes stuck at pending forever even though the overall run reported completed.

## Known Limitations

* Retry failed nodes is not implemented. Retrying a single failed node correctly means resuming execution from that node with all prior decisions already known, not restarting the whole graph from the root. That is new orchestration logic, not a UI button, and was scoped out of this build.
* Node styling polish was scoped out in favor of the execution visibility and save and load work, which had a much bigger effect on whether the tool is actually usable.
* The run store is an in memory Map inside the Next.js process. This works because Inngest's local dev server calls back into the same running process. It would not work unmodified against most production serverless deployments, where separate invocations do not share memory.
* The run store never evicts old runs. Fine for a local development session, would grow unbounded in a long lived process.
* Model temperature is not pinned on the Gemini call. Every test prompt used here had one unambiguous correct answer, so this has not mattered in practice, but a genuinely ambiguous prompt could return different decisions across separate runs.
* Save and load use a single fixed key in `localStorage`, there is only ever one saved workflow slot, not multiple named saves.

## Fixtures

The `fixtures/` folder contains sample JSON files used for the import tests below, so the malformed and invalid cases are reproducible without hand editing a file each time:

* `valid-flow.json`, a plain three node chain, used for Test 12
* `bad-flow.json`, syntactically invalid JSON, missing a comma, used for Test 13
* `converging-graph.json`, valid JSON but structurally invalid, two edges both target the same node, used for Test 14

## Testing

Tested across 14 scenarios: successful multi node execution, branch skipping including nested subtrees, a permanent failure fast-failing after one attempt instead of retrying, structural validation enforced identically across the API and the file import path, and the full save, load, export, import cycle.

Full test log with screenshots: [TESTING.md](./TESTING.md)