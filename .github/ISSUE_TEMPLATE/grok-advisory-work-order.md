---
name: Bounded Grok advisory work order
about: Request isolated, text-only Grok analysis that cannot affect trading state
title: "[Grok advisory] "
labels: "ai-generated,needs-human-review"
assignees: ""
---

# Bounded Grok advisory work order

This issue is an unapproved AI-work intake record. Creating it does not
authorize a Grok run, implementation, production use, merge, or a change to
paper state.

## Identity and owner authority

- Work-order id:
- Repository: `rabbidbird/signal-desk-dashboard`
- Repository-owner reviewer (GitHub login):
- Exact parent commit:
- Owner-approved prompt SHA-256:
- Owner run-authorization comment/link:
- Tool: hardened trading Grokodex `grok_run` only
- Authentication: existing local `grok login`/grok.com subscription only
- Frozen plugin version:
- Frozen wrapper SHA-256:
- Frozen bridge-bundle SHA-256:
- Frozen manifest SHA-256:
- Frozen Grok CLI version:

The repository owner must personally populate the reviewer and run-authorization
fields. AI output cannot populate, sign, infer, or satisfy them.

## Bounded advisory question

<!-- State one question that can be answered with response text only. -->

## Allowed prompt context

<!-- List the exact minimal non-secret snippets or facts allowed in the prompt. -->

## Exclusions and stop conditions

- [ ] No API key, credential, browser/login state, personal data, runtime state,
      database file, log, proposal, position data, or control-state token is in
      scope.
- [ ] No trading loop, heartbeat, market-session check, position monitor,
      proposal generator, approval flow, dashboard request/control handler, or
      production command will invoke or depend on Grok.
- [ ] The wrapper exposes exactly `grok_setup` and `grok_run`; `grok_imagine`
      and every other Grok tool are unavailable.
- [ ] Grok will receive no filesystem, shell, Git, GitHub, network, memory, or
      sub-agent tools, will make zero model tool calls, and will return advisory
      text only.
- [ ] Missing owner authorization, subscription authentication, wrapper
      enforcement, frozen hashes, exact worktree registration, or approved
      context stops the run.

## Isolation record (complete before dispatch)

- Grok issue: this issue
- Exact Grok-only branch (`grok/issue-<n>-<slug>`):
- Exact registered non-canonical worktree root:
- Authoritative canonical repository root:
- Sole permitted created or modified file:
- Grok-only pull request:
- Separate downstream Codex issue/branch/worktree/PR: `Not created before human triage`

The Grok lane contains no implementation. Codex controls all Git and GitHub
actions used to record the lane. If a human selects any advice for
implementation, open a new Codex issue and create a new branch/worktree from
the reviewed base; do not reuse or cherry-pick this lane.

## Deterministic pre-dispatch checks

- [ ] `git status --porcelain` is empty in the exact worktree.
- [ ] `git rev-parse HEAD` equals the exact parent commit above.
- [ ] `git branch --show-current` equals the exact Grok-only branch above.
- [ ] `git worktree list --porcelain` registers that root under the authoritative
      canonical repository above.
- [ ] The wrapper tool list is exactly `grok_setup` and `grok_run`.
- [ ] `grok_setup` reports the frozen local CLI and grok.com login ready, with
      no API-key or leader fallback.
- [ ] Current plugin/wrapper/bundle/manifest hashes equal the frozen values.
- [ ] The exact prompt hashes to the owner-approved SHA-256 above and contains
      only the allowed context.
- [ ] The identified repository owner explicitly authorized this exact run.
- [ ] Both repositories' `AGENTS.md` rules were checked if the question could
      affect their contract.

## Deterministic post-run checks

- [ ] The run reports restricted permission and zero model tool calls.
- [ ] The sanitized advisory report records the run/session id, prompt hash,
      frozen versions/hashes, limitations, and sensitive-content check.
- [ ] `git diff --name-only <parent>...HEAD` contains exactly the sole permitted
      report path above, and `git status --porcelain` is empty after commit.
- [ ] The advisory report commit and pull request are separate from every Codex
      implementation/review branch and pull request.

Any failed check or additional diff path requires STOP and quarantine of the
run and output. Do not continue, broaden the allowlist, or normalize the gap.

## Sanitized result and owner disposition

- Grok run/session identifier:
- Codex summary of advisory output:
- Limitations or conflicting evidence:
- Sensitive-content check:
- Advisory report commit SHA:
- Exact commit SHA reviewed by repository owner:
- Owner review comment/link:
- Repository-owner disposition: `Pending owner entry`

Allowed owner dispositions are `Adopt as input`, `Revise`, `Reject`,
`Quarantine`, `Pause`, or `Stop`. AI output cannot populate or satisfy the
reviewed-commit, owner-review, or disposition fields. No acceptance or merge is
allowed until the identified repository owner reviews the exact commit/diff and
records a disposition.
