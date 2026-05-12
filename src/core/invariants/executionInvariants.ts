import { invariant, assertString, assertPositive, assertMonotonic } from './invariant.js'
import { ExecutionPhase, type ExecutionTransition } from '../execution/index.js'

export { type ExecutionTransition }

export const VALID_TRANSITIONS: Record<ExecutionPhase, ExecutionPhase[]> = {
    [ExecutionPhase.CREATED]: [ExecutionPhase.EXECUTING],
    [ExecutionPhase.EXECUTING]: [ExecutionPhase.PRE_COMMIT],
    [ExecutionPhase.PRE_COMMIT]: [ExecutionPhase.COMMITTING, ExecutionPhase.ABORTED],
    [ExecutionPhase.COMMITTING]: [ExecutionPhase.POST_COMMIT],
    [ExecutionPhase.POST_COMMIT]: [ExecutionPhase.COMPLETED],
    [ExecutionPhase.COMPLETED]: [],
    [ExecutionPhase.FAILED]: [],
    [ExecutionPhase.ABORTED]: []
}

export function validatePhaseTransition(from: ExecutionPhase, to: ExecutionPhase): void {
    const valid = VALID_TRANSITIONS[from]
    invariant(
        valid?.includes(to) ?? false,
        'INVALID_PHASE_TRANSITION',
        `Invalid phase transition: ${from} -> ${to}`,
        { from, to, validTransitions: valid }
    )
}

export function validateExecutionId(executionId: string): void {
    assertString(executionId, 'INVALID_EXECUTION_ID', 'Execution ID must be a string', { executionId })
    invariant(executionId.startsWith('exec-'), 'INVALID_EXECUTION_ID_FORMAT', 'Execution ID must start with "exec-"', { executionId })
}

export function validatePhase(phase: ExecutionPhase): void {
    const validPhases = Object.values(ExecutionPhase)
    invariant(
        validPhases.includes(phase),
        'INVALID_PHASE',
        `Invalid execution phase: ${phase}`,
        { phase, validPhases }
    )
}

export function validateTransitions(
    transitions: readonly ExecutionTransition[],
    expectedStart: ExecutionPhase,
    expectedEnd: ExecutionPhase
): void {
    invariant(transitions.length > 0, 'EMPTY_TRANSITIONS', 'Execution must have at least one transition', {})

    const first = transitions[0]
    invariant(first.from === expectedStart, 'INVALID_START_PHASE', 'Execution must start at CREATED', { firstFrom: first.from, expected: expectedStart })

    const last = transitions[transitions.length - 1]
    invariant(last.to === expectedEnd || last.to === ExecutionPhase.FAILED, 'INVALID_END_PHASE', 'Execution must end at COMPLETED or FAILED', { lastTo: last.to, expected: expectedEnd })

    for (let i = 1; i < transitions.length; i++) {
        const prev = transitions[i - 1]
        const curr = transitions[i]
        invariant(prev.to === curr.from, 'TRANSITION_GAP', 'Transitions must be consecutive', { prev: prev.to, curr: curr.from })
        validatePhaseTransition(prev.to, curr.to)
    }
}

export function validateNoDoubleFinalization(phase: ExecutionPhase): void {
    const finalPhases = [ExecutionPhase.COMPLETED, ExecutionPhase.FAILED, ExecutionPhase.ABORTED]
    invariant(
        !finalPhases.includes(phase) || phase === ExecutionPhase.COMPLETED,
        'DOUBLE_FINALIZATION',
        'Execution cannot be finalized twice',
        { phase }
    )
}

export function validateCommitOrder(preCommitPhase: ExecutionPhase, commitPhase: ExecutionPhase, postCommitPhase: ExecutionPhase): void {
    invariant(preCommitPhase === ExecutionPhase.PRE_COMMIT, 'PRE_COMMIT_MISSING', 'PRE_COMMIT phase must occur', { preCommitPhase })
    invariant(commitPhase === ExecutionPhase.COMMITTING || commitPhase === ExecutionPhase.ABORTED, 'COMMIT_ORDER_INVALID', 'COMMIT must follow PRE_COMMIT', { commitPhase })
    if (commitPhase === ExecutionPhase.COMMITTING) {
        invariant(postCommitPhase === ExecutionPhase.POST_COMMIT, 'POST_COMMIT_MISSING', 'POST_COMMIT must follow COMMIT', { postCommitPhase })
    }
}