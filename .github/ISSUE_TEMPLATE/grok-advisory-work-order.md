---
name: Bounded Grok advisory work order
about: Request isolated, text-only Grok analysis that cannot affect trading state
title: "[Grok advisory] "
labels: "ai-generated,needs-human-review"
assignees: ""
---

# Bounded Grok advisory work order

This issue is an unapproved AI-work intake record. Creating it does not
authorize implementation, production use, merge, or a change to paper state.

## Identity and authority

- Work-order id:
- Repository: `rabbidbird/signal-desk-dashboard`
- Human requester/reviewer:
- Exact parent commit:
- Tool: hardened trading Grokodex `grok_run`
- Authentication: existing local `grok login`/grok.com subscription only

## Bounded advisory question

<!-- State one question that can be answered with response text only. -->

## Allowed prompt context

<!-- List the minimal non-secret snippets or facts Codex may place in the prompt. -->

## Exclusions and stop conditions

- [ ] No API key, credential, browser/login state, personal data, runtime state,
      database file, log, proposal, position data, or control-state token is in
      scope.
- [ ] No trading loop, heartbeat, market-session check, position monitor,
      proposal generator, approval flow, dashboard request/control handler, or
      production command will invoke or depend on Grok.
- [ ] Grok will receive no filesystem, shell, Git, GitHub, network, memory, or
      sub-agent tools and will return advisory text only.
- [ ] Missing subscription authentication, wrapper enforcement, exact worktree
      registration, or approved context stops the run.

## Isolation record (complete before dispatch)

- Grok issue: this issue
- Grok-only branch (`grok/issue-<n>-<slug>`):
- Exact registered non-canonical worktree root:
- `git worktree list --porcelain` registration checked by Codex: [ ]
- Advisory/evidence-only output path:
- Grok-only pull request:
- Separate downstream Codex issue/branch/worktree/PR: `Not created before human triage`

The Grok lane contains no implementation. Codex controls all Git and GitHub
actions used to record the lane. If a human selects any advice for
implementation, open a new Codex issue and create a new branch/worktree from
the reviewed base; do not reuse or cherry-pick this lane.

## Pre-dispatch verification

- [ ] Both the bot and Signal Desk `AGENTS.md` safety rules were checked if the
      question could affect their contract.
- [ ] `grok_setup` reports the local CLI and grok.com subscription login ready,
      without an API-key fallback.
- [ ] The requested `cwd` exactly equals the registered worktree root above.
- [ ] The prompt contains only the allowed context listed above.

## Sanitized result and human disposition

- Grok run/session identifier:
- Codex summary of advisory output:
- Limitations or conflicting evidence:
- Sensitive-content check:
- Advisory pull-request commit:
- Human disposition: `Untriaged`

Allowed human dispositions are `Adopt as input`, `Revise`, `Reject`,
`Quarantine`, `Pause`, or `Stop`. Grok and Codex cannot set acceptance on their
own output.
