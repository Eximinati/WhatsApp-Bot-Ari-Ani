# Middleware Authority Status

## CURRENT STATE: ARCHITECTURAL ONLY

The middleware phases PRE_COMMIT, COMMIT, and POST_COMMIT are defined in MiddlewarePhase enum but are NOT currently executed through the middleware pipeline.

### What Exists:
- `MiddlewarePhase.PRE_COMMIT` = 'pre-commit'
- `MiddlewarePhase.COMMIT` = 'commit'  
- `MiddlewarePhase.POST_COMMIT` = 'post-commit'
- Phase ordering in MIDDLEWARE_PHASE_ORDER

### What Does NOT Execute:
- MiddlewareChain.execute() does NOT run these phases
- No middleware actually runs during PRE_COMMIT/COMMIT/POST_COMMIT
- TransportCommitCoordinator is invoked directly via lifecycle callbacks

### Actual Flow:
```
ExecutionCoordinator.execute()
  → onPreCommit callback (direct, NOT middleware)
  → onCommit callback (direct, NOT middleware)  
  → onPostCommit callback (direct, NOT middleware)
```

### Implications:
- Adding middleware to veto commits will NOT work
- Middleware policies during commit phases are NOT enforced
- Commit authority is callback-based, not middleware-based

### For Deterministic Replay:
The phase definitions exist for:
- Type safety
- Future implementation
- Audit semantics

But currently serve as documentation of intended lifecycle, not actual enforcement.

---

### TO MAKE MIDDLEWARE AUTHORITATIVE (Future Work):

1. Integrate lifecycle callbacks through MiddlewareChain.execute()
2. Add middleware handlers for PRE_COMMIT, COMMIT, POST_COMMIT phases
3. Ensure middleware can actually veto/rewrite/deny transport operations
4. Verify middleware runs BEFORE TransportCommitCoordinator is invoked