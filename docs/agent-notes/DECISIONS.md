# Decisions

## D-1: Does the `tool-cordis` row keep its `disabled: !!js` gate?
- **Decided:** Yes — keep the gate, and record the row as a **known limitation with an
  upstream fix**, not as something this repository can solve. The four Cordis plugin-authoring
  tools are consequently absent from a `dsh-smith` session's tool table.
- **Because:** three facts read from the installed 0.1.5-rc.1 packages, not inferred:
  (1) `@deepseek-ai/dsh-cordis-host-runner\lib\index.js` line 732 throws
  `Host Cordis inspect provider "<id>" is already registered` when a provider id is already
  in the map — there is no idempotent path; (2) `@deepseek-ai/dsh-tool-cordis\lib\index.js`
  line 9113 registers the four providers (`Service`, `Event`, `Builtin`, `Tool`) at
  **apply** time, unconditionally, with no config branch; (3) therefore a second composition
  containing this row throws inside `ctx.effect` during the *first* session that mounts after
  another session already claimed those ids, failing that row.
- **Rejected:** sharpening the predicate to ask "are the providers already registered?"
  (`ctx.get('cordisInspect').list()`). It fails on its own terms: `apply` is what registers
  the model-facing tools, so skipping it means **every session after the first gets no
  `cordis_*` tools** — exactly the outcome the row exists to prevent. It also cannot tell a
  sibling preset's registration from a dynamic `cordis_run` package's. Its runtime
  feasibility was never settled, but settling it would not change the verdict.
- **Rejected:** moving `tool-cordis` to the host composition. Mechanically viable — the
  `Tool` provider's `listTools` reads `ctx.tools.schemas(context.agent)` with the agent
  supplied per query, so a host-registered provider is not agent-blind. It loses as a
  *scope* decision: it would expose `cordis_define` / `cordis_run` (arbitrary JavaScript
  against the live runtime) to **every** session of the profile, not only `dsh-smith`.
- **Reversed by:** an upstream `CordisInspectRegistryService.register()` that is idempotent —
  returns the existing disposer for an already-registered provider id instead of throwing —
  shipped in a DSH release. Then the gate is deleted and the row enabled unconditionally.

## D-2: Does the upstream idempotent-`register()` fix need a refcount?
- **Decided:** Open — deliberately not settled. Recorded so the next session does not
  mistake the proposal for a decided design.
- **Because:** the `expert_architect` report of this session recommended "idempotent by
  provider id **with a refcount**". The first half is forced by D-1; the refcount is a new
  mechanism — grep over `dsh-cordis-host-runner\lib\index.js` for `refcount|refCount` returns
  **no match**, so nothing existing supports it. It also carries a hazard the report did not
  address: with a refcount the provider is removed when the last consumer disposes, and
  `cordis_inspect_list` / `cordis_inspect_query` read the registry at *call* time, so a
  surviving consumer could find the provider gone.
- **Rejected:** adopting the report's full recommendation as-is. The verified half is sound;
  the unverified half would introduce a new failure mode on the strength of an expert claim.
- **Reversed by:** a stated lifetime rule for the four providers — "first registration wins
  and never disposes for the life of the process" is the alternative worth preferring,
  because it needs no accounting and cannot leave a live tool without its provider.
