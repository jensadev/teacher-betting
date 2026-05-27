 ## Plan: Robust Lobby Recovery (Local-First)

Build robustness without a database by introducing durable host snapshots in localStorage, deterministic reconnect flow for players, explicit late-join blocking, and host resume controls. This keeps your current Supabase Realtime channel model but removes single-tab fragility for the most common failure (host refresh/close).

**Steps**
1. Phase 1 - State model hardening
1. Add explicit metadata to session state in /Users/jens.andreasson/code/teacher-betting/src/App.tsx: host version counter, createdAt/updatedAt timestamps, round lock flag, and join cutoff flag (set once session leaves lobby).
2. Define a serializable persistence schema for host snapshots (session + teams + policy flags + checksum/version) and a migration guard for future shape changes. Depends on step 1.
3. Phase 2 - Host persistence and resume UX
1. Persist host snapshot to localStorage after every host state mutation path: create lobby, next slide, resolve challenge, reset game, and host policy changes. Reuse existing mutation points in createLobby, nextSlide, resolveChallenge, resetEntireGame. Depends on phase 1.
2. Add startup bootstrap logic for host: detect matching saved lobby snapshot, validate schema/version, and offer Resume vs Start New. If resume chosen, hydrate session/teams and rebroadcast current state on channel subscription. Depends on step 1 in this phase.
3. Add stale/corrupt snapshot handling: show safe warning, allow discard, and continue with clean session.
4. Phase 3 - Reconnect and late-join policy enforcement
1. Enforce Block late joins once session state is betting/result/ended: in player join/register path reject with clear error message and avoid tracking team presence.
2. Improve reconnect handshake: on subscribe, players request state and host responds with authoritative snapshot including join policy; player rehydrates myTeam from presence by playerId and re-syncs active bet state.
3. Add host reconnect rebroadcast on SUBSCRIBED to prevent players being stuck after transient reconnects.
4. Phase 4 - Reliability safeguards (still local-first)
1. Add guarded async wrappers around track/send flows with retry once and user-visible transient error states (instead of silent failure).
2. Add idempotency guards to avoid duplicate round resolution and duplicate payout application on repeated broadcasts (e.g., by last processed round id per player).
3. Add lightweight lobby code collision mitigation for createLobby by checking active presence quickly and regenerating if occupied.
5. Phase 5 - Validation and test pass
1. Manual scenario matrix: host refresh during lobby, host refresh during betting, player refresh with existing team, blocked late join after game start, host resume after full tab close.
2. Add small utility-level tests (if test setup exists) for snapshot parse/migrate/validate and late-join gate logic.
3. Verify no regressions in existing flow and document resume behavior in README.

**Relevant files**
- /Users/jens.andreasson/code/teacher-betting/src/App.tsx - Main state machine and all mutation points: createLobby, joinLobby, registerTeam, placeBet, cancelBet, nextSlide, resolveChallenge, resetEntireGame, subscribe handler.
- /Users/jens.andreasson/code/teacher-betting/src/main.tsx - Optional bootstrap hook if you want app-level preload before render (only if needed).
- /Users/jens.andreasson/code/teacher-betting/README.md - Add operator instructions for resume and late-join behavior.

**Verification**
1. Run app and execute end-to-end host flow, then force refresh host tab and confirm Resume restores session and teams state.
2. Join as player, place bet, refresh player tab, confirm identity and team state reconcile correctly.
3. Attempt new player join after state transitions to betting; verify blocking message and no team registration.
4. Simulate temporary send/track failure (offline toggle) and verify error handling and recovery behavior.
5. Run lint/tests available in project and ensure no type errors.

**Decisions**
- Persistence approach: Local-only browser storage for now (no DB tables).
- Late join policy: Block all late joins after game start.
- Resume authority: Any host device with lobby code is acceptable for this phase.
- Recovery target: Optimize for host accidental refresh/close.
- Snapshot TTL: Until manually reset.

**Scope boundaries**
- Included: Local snapshot resume, reconnect resilience, late-join gating, safer realtime error handling.
- Excluded: Full multi-device secure host auth, backend persistence, cross-device guaranteed resume without local snapshot availability.

**Effort estimate with current infrastructure**
1. Baseline robust local-first implementation: 1.5 to 2.5 developer days.
2. With extra safeguards (idempotency + collision checks + polished UX): 2.5 to 4 developer days.
3. If you later add minimal Supabase table persistence for cross-device resume: add about 1 to 2 extra days on top.

**Risk notes**
- All-in-one App.tsx file increases change risk; extracting small state/persistence helpers first will reduce bugs.
- Allowing any host device by lobby code is convenient but not secure against takeover if code leaks.
- localStorage resume cannot recover if no device has saved snapshot; this is the main remaining limitation without backend state.
