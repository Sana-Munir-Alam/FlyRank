# Build Log

[← README](./README.md) · [Design](./DESIGN.md) · [Testing](./TESTING.md) · [Evidence](./EVIDENCE.md)

Honest record of where AI (Claude, via this internship's tutoring workflow) helped, where it was wrong, and what I changed. I built this stage by stage: I wrote the code myself at each stage, Claude reviewed it critically against the stage's actual requirement before I was allowed to commit, and for a few stages (CSRF, the hardening pass, the widget's render/submit logic) Claude wrote a first draft that I then had to test, understand, and defend. Anywhere I can't explain a piece of my own code, that's a problem — this log is partly a checklist that I can.

## How I used AI in this build

- **Design review, not code generation, for most stages.** Stages 0–12 I wrote first, then had the code reviewed critically against that specific stage's requirement (and only that stage — I was explicit about not reviewing ahead). This caught real bugs before they shipped, not after.
- **Claude wrote first drafts for two things:** the CSRF middleware (Stage 11.5) and the Stage 14 hardening pass (submission validation layers, geo provider modes, the `EMAIL_FORCE_FAIL` switch, auth rate limiting). I asked for these directly because I didn't yet know the right shape for a double-submit CSRF token or a three-tier validation scheme, and wanted a correct starting point to test and understand rather than inventing an insecure one myself.
- **I ran every test personally.** Every curl command, every `npm run test`, every screenshot in `/screenshots` is from my own terminal and browser, not generated. Claude never had direct access to run anything — it told me what to run and I ran it.

## Real bugs the review process caught before they shipped

These are the ones worth naming specifically, because they're the ones I'd be asked about in an interview:

1. **Missing `issueCsrfToken` import in `authController.js`.** I wired CSRF into signup and login but forgot the `require(...)` line. This wasn't a subtle bug — it would have thrown `ReferenceError` on every single signup and login call. Caught because I was asked to paste real `npm run test` output before moving on, and the whole suite failed loudly. Fixed by adding the missing import.

2. **`Cross-Origin-Resource-Policy: same-origin` blocking the widget from ever loading cross-origin.** I fixed CORS (`Access-Control-Allow-Origin`) at Stage 5–6 and every curl test passed. What curl can't test is CORP — a separate browser-enforced header that helmet sets to `same-origin` by default, which silently blocks a real browser from even *fetching* a cross-origin resource regardless of what the CORS headers say. This would have meant the widget rendered perfectly in every automated test and then failed the moment a real browser tried to load it on `test-site/index.html` — exactly the capstone's core "wow moment." Caught during a design review, not by any test I had written, because none of my tests used a real browser. Fixed by explicitly setting `Cross-Origin-Resource-Policy: cross-origin` on the three public routes (widget config, widget bundle, submissions) while leaving the dashboard API on the stricter default.

3. **Session fixation on signup, present on login only.** I'd correctly called `req.session.regenerate()` on login but not on signup — even though signup is also a privilege-escalation moment (anonymous → authenticated) and needed the identical defense. I'd gotten the *concept* right in one place and just not applied it consistently. Fixed by adding the same regenerate-then-populate pattern to signup.

4. **`dailyCounts` dates off by a timezone in the widget-stats endpoint.** `DATE(created_at)` grouped correctly in Postgres, but `node-postgres`'s default type parser for a `DATE` column builds the JS `Date` from local time components, and JSON-serializing it shifted the date by my machine's UTC offset — submissions made on the 27th were showing up under the 26th. This is a real, demonstrable `pg` gotcha, not a query logic bug. Fixed by casting to `TO_CHAR(created_at, 'YYYY-MM-DD')` in SQL so a plain string comes back and `pg`'s date parser never touches it.

5. **Two test files silently stealing each other's background jobs.** `jobRepository.claimNext()` uses `SELECT ... FOR UPDATE SKIP LOCKED` with no tenant or test-run scoping — correct for a real production worker, but under `node --test`'s default concurrent-file execution, one test file's `runOnce()` call could claim and process a completely unrelated test file's job. It didn't fail any assertions (the retry loops had enough headroom to absorb the noise), but it was real cross-contamination, provable in the test logs by the wrong widget name showing up in a test that never created that widget. Fixed with `--test-concurrency=1` — slower, but deterministic.

6. **Login had no rate limiting at all, and a 130-character company name 500'd.** Found during the Stage 14 hardening pass by walking the shared requirement ("validation at the boundary → clean 4xx, never a 500") against the actual endpoints rather than assuming Stage 3's validation was still sufficient. The `varchar(120)` column constraint was in the schema from Stage 1 but nothing in the Zod schema enforced it before the query ran, so an over-length name reached Postgres and came back as a raw constraint-violation 500. Fixed by adding `.max(120)` to the Zod schema (matching the column) and adding a shared per-IP rate limiter across both signup and login.

## Design decisions I made and can defend

- **Raw `pg`, no ORM.** With multi-tenant isolation as a graded requirement, I wanted `WHERE tenant_id = $1` visible in every query, not hidden behind an abstraction. More typing, but nothing to explain around when a reviewer asks "how do you know this query can't leak across tenants."
- **Two frontends, deliberately different.** The dashboard is React; the widget is vanilla JS with zero dependencies. Forcing a framework runtime onto a customer's page just to render a form is exactly the "widget that loads slowly is a widget customers remove" failure the brief warns about. Full reasoning in DESIGN.md §3.
- **404, not 403, for cross-tenant access.** A 403 confirms the resource exists; a 404 doesn't. For a multi-tenant system, not confirming existence to someone who shouldn't see it at all is the stronger property.
- **Idempotency scoped to `(widget_id, idempotency_key)`, not globally unique.** Two different widgets legitimately reusing the same client-generated key shouldn't collide with each other.
- **Bundle versions live in their own folder per version** (`widget/dist/v{N}/widget.js`) rather than one file overwritten on every build. An immutable, year-long cache header is only safe if the URL it's attached to never changes meaning — overwriting a "v1" URL's content the moment v2 ships would silently break every customer site still holding the old snippet.
- **Honeypot returns an identical response whether or not it fired.** The point of a honeypot is that the bot doesn't learn it was caught — a different status code or message on a flagged submission would defeat the entire mechanism.
- **Signup reveals whether an email is already taken (409 vs 201).** A stricter design would return an identical response either way and email the existing account owner instead. I chose the simpler, more common pattern for this scope and I'm naming it as a conscious trade-off rather than pretending it isn't one.
- **Geo provider modes (`live | mock | down`) added specifically so Probe 4 could be shown live.** The original design ("mock one provider, toggle the other off") turned out to be undemonstrable against the running system from a local machine, since a private IP has no real location to enrich. Rather than only proving the fallback chain in a unit test, I added a real runtime switch so an evaluator (or an interviewer) can watch all three states happen against the actual API.

## Where I pushed back or made my own call

- When told the honeypot could be defeated by browser autofill (a real, not hypothetical, concern — autofill genuinely can fill a hidden `website` input), I chose to document it as a known limitation rather than rename the field defensively. A determined bot would just adapt to a renamed field too; the honest fix is Shadow DOM isolation or a JS-timing-based heuristic, both out of scope here.
- I kept `express.json()`'s body-size limit as the single point of "too large" enforcement rather than adding a second check inside the validator, since duplicating the limit in two places is how they drift out of sync over time.
- Default widgets (created with `config: {}`) get looser server-side validation than widgets with an explicit field list. I could have forced every widget's config to include a default field list at creation time so all widgets get identical enforcement, but that changes what `POST /api/widgets` does in a way I didn't have time to fully test against every existing widget/dashboard code path this late in the build. Documented in DESIGN.md §9 and README as a real, current gap — not glossed over.

## What I'd do differently with more time

- Ship the seed script so a fresh clone doesn't need manual widget creation before the widget can be demoed.
- Materialize default fields into `config.fields` at widget creation, closing the validation gap between default and configured widgets.
- Move rate-limit state out of process memory (Redis) so it survives a restart and works across multiple backend instances.
- Add Shadow DOM to the embeddable widget for real style isolation from the host page.