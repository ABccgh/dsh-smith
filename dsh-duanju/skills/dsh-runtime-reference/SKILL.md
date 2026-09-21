---
name: dsh-runtime-reference
description: Use when you need to locate a package, confirm which plane owns a row, check the exact config surface of a plugin, find the live service or prompt-section name for a capability, or work out why a composed row contributed nothing. Carries this deployment's paths, the two-plane inventory, and the verification commands.
---

# This deployment's runtime, concretely

Everything here was read from the installed deployment. Re-read before you rely on a
version-sensitive detail: an upgrade can move any of it.

## Where things are

| What | Path |
| --- | --- |
| Harness home | `$DSH_HOME`, default `~/.dsh` |
| User agent presets | `$DSH_HOME/.agent-presets/<id>/agent.cordis.yml` |
| Shipped agent presets | `node_modules/@deepseek-ai/dsh-agent-presets/presets/<id>/` — read-only, never edit |
| Profiles (host compositions) | `$DSH_HOME/profiles/<name>/` — `cordis.yml` is an empty root; every row arrives as a bundle patch |
| Profile patch layer | `$DSH_HOME/profiles/<name>/cordis.patch.yml` — the user's own row insertions and overrides |
| Installed packages | `$DSH_HOME/profiles/node_modules/@deepseek-ai/<pkg>/` |
| Package type declarations | `…/<pkg>/lib/types/*.d.ts` — the authoritative config surface |
| Sessions | `$DSH_HOME/sessions/` |

A profile is composed as **bundle patches**, in order: each package named in
`package.json`'s `dsh.profile.bundles`, then `cordis.patch.yml`, then `--patch` overlays.
The base bundle (`@deepseek-ai/dsh-base`) carries the shared core rows; the mode bundle
(`@deepseek-ai/dsh-web-app` for the web GUI) restates mode-specific config. A patch
replaces a row's whole `config` rather than merging into it, so a row targeted by two
layers ends at the last one's complete config.

## The two planes, as an inventory

**Host-plane rows** (in a profile patch; one instance per process):

- registries: `tools`, `systemPrompt`, `skills`, `commands`, `jobs`, `goals`, `subagents`, `sessions`, `settings`
- the model route: `llm`, adapters (`llm-deepseek`, `llm-pi-ai`), `llm-retry`, `agent-default-model`
- persistence and query: `session-persistence-jsonl`, `session-query-sqlite`, `session-projection`, `storage*`, `attachment-local`
- confinement: `sandbox`, `sandbox-policy`, `bash-sandbox`, `pwsh-sandbox`, `fs-sandbox`, `approval`, `permission`
- the agent factory: `agent`, `agent-loop`, `token-meter`
- delegation: `subagent`, `subagent-spawn-in-process`, `subagent-fork-in-process`
- the web surface: `webserver`, the `api-*` controllers, `dsh-web-app`

**Preset-plane rows** (in a preset composition; one instance per session): `persona`,
`agent-instructions`, the `tool-*` model-facing tools, `plan-mode`, `compaction-basic`,
the delegation tool rows, and any `skill-filesystem` layer the preset wants.

## Services you are likely to reason about

Read the live contract rather than trusting this table when the exact signature matters —
query the `Service` inspect provider.

| Service key | Owner | What it answers |
| --- | --- | --- |
| `tools` | host | `register`, `restrict`, `guard`, `schemas`, `execute` |
| `systemPrompt` | host | `section`, `context`, `variable`, `tools`, `assemble` |
| `skills` | host | `registerProvider`, `register`, `list`, `get` |
| `subagents` | host | `registerProvider`, `start`, `startContinuable`, `sendMessage`, `listChildren` |
| `agentPresets` | host | `list`, `read`, `copy`, `remove`, `resolve`, `mount`, `standingKeyFor`, `compositionInventory` |
| `agents` | host | live agent registry, `create`, `get`, `list`, `roots` |
| `agentLoop` | host | the agent factory and driver (`create`, `createAgent`, `resume`) |
| `jobs` | host | background job registry |
| `goals` | host | the session-log-backed goal |
| `fs` | host | `resolve`, `readText`, `writeText`, `editText`, `stat`, `listDir` |
| `shell` / `subprocess` | host | command execution backends |
| `compaction` | preset realm | `compactIfNeeded`, `compactNow`, `compactRegion` |
| `toolResultPruner` | preset realm | `pruneContent`, `pruneSession` |
| `planMode` | preset realm | plan state for one agent |
| `workflowEngine` | preset realm | `start` for the workflow tool |
| `agentTeams` | host (when composed) | named teammates over a live session log — not composed in this deployment's base profile |
| `userQuestions`, `approval`, `credentials`, `settings` | host | the respective host facilities |

## How delegated children inherit `agentOptions`

Read from `resolveChildAgentOptions` in `@deepseek-ai/dsh-subagent`, because the answer is not
"children inherit the parent" and not "children get defaults":

1. The parent's **provider, model, reasoning effort, and maxTokens** are the starting values.
2. The row's `agentOptions` is spread **over** them, so a field named there wins.
3. If the resolved route differs from the parent's **and** the row did not name
   `reasoningEffort`, the inherited effort is **deleted** — the new route resolves its own
   default instead of being forced onto an effort that belonged to another model.

Two consequences this preset depends on. A child sharing the parent's route but inheriting its
effort is why `agentOptions.reasoningEffort: max` is meaningful at all — most rows omit
`agentOptions`, so they think at whatever the parent's route was using. And a row that pins an
effort while the lead switches models keeps its pinned effort, because naming it suppresses the
deletion rule. `modelSelectionSettings: true` on the generic row is the separate path by which a
child gets an independently sampled model instead.

## A package directory that exists may still be absent

`node_modules` under a profile is full of **junctions into the install cache**, and a junction
whose target is missing resolves to a path that does not exist. So `Test-Path <pkg>` answers
"is there an entry" while `Test-Path <pkg>/lib` answers "is the package actually here", and the
two can disagree.

This is not hypothetical: `@deepseek-ai/dsh-tool-subagent-report` is a junction to a
non-existent target in this deployment. It looks installed, is mentioned by the toolset's own
prompt-section table, and cannot be imported. Check the contents before planning against a
package, and prefer "can it be imported / does `lib/` exist" over "is the name listed".

## Prompt-section names

Sections are registered by name into a scope; a scoped section **shadows** a global one
with the same name, and a duplicate inside one layer throws. Order comes from the
registry's central table (`SECTION_ORDERS`), so a section's position is decided by its
name:

`harness identity` (-1000) → `deployment:persona-prefix` (0) → `plan policy` (500) →
`team policy` (600) → per-tool sections (1000–5000) → deliverables (9000) →
`deployment:persona-suffix` (10200).

That ordering is why a preset writes its reasoning discipline into the persona
*prefix* and its operational protocols into the persona *suffix*: the prefix precedes
first-party tool guidance, the suffix follows all of it.

## Verifying a composition

`agentPresets.standingKeyFor(id)` is the mount check, and it is the only one that counts:
it composes the preset's plugin subtree the way a session start does, minus the agent. It
rejects the four real failures — an unresolvable package, an invalid config, a row that
never activated (`N row(s) did not activate: <id>: waiting for <service>`), and a service
published into the root realm (`row(s) published process-global service(s) [<name>]`, or a
collision: `service "<name>" has been registered at <Owner>`).

Do not treat the roster's `broken` field as validation: it reports whether the file parsed
into named rows, which every failure above passes.

## Diagnosing a row that contributed nothing

1. Did it activate? A `waiting for <service>` result names the missing dependency — either
   the provider row is absent, or it sits behind a realm this consumer cannot see.
2. Did it publish into a realm nobody reads? A consumer outside the provider's realm
   resolves the host's service instead, so the row loads and contributes nothing.
3. Is a host row already providing the same service? The second registration collides at
   mount; a preset must consume the host instance rather than compose its own.
4. Is the contribution scoped to a different agent? Scoped registrations are keyed by
   agent, so a section or restriction installed for one scope is invisible in another.
