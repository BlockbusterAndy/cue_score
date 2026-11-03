import { useEffect, useReducer, useRef } from 'react';
import { applyMatch, removeAction, replay, type MatchAction, type MatchState } from '../engine';
import type { MatchRecord } from '../store/repo';

interface State {
  record: MatchRecord;
  match: MatchState;
  /**
   * Earlier action lists, newest last, so Undo can also bring back a removed log entry.
   * In memory only: after a reload Undo falls back to dropping the last action.
   */
  past: MatchAction[][];
}

type Msg = { type: 'act'; action: MatchAction } | { type: 'undo' } | { type: 'remove'; index: number };

function withActions(state: State, actions: MatchAction[], match: MatchState, past: MatchAction[][]): State {
  return {
    match,
    past,
    record: { ...state.record, actions, updatedAt: Date.now(), status: match.over ? 'finished' : 'live' },
  };
}

function reducer(state: State, msg: Msg): State {
  const { actions } = state.record;
  switch (msg.type) {
    case 'act': {
      const match = applyMatch(state.match, msg.action, actions.length);
      if (match === state.match) return state;
      return withActions(state, [...actions, msg.action], match, [...state.past, actions]);
    }
    case 'undo': {
      if (state.past.length) {
        const prev = state.past[state.past.length - 1];
        return withActions(state, prev, replay(state.record.config, prev), state.past.slice(0, -1));
      }
      if (actions.length === 0) return state;
      const prev = actions.slice(0, -1);
      return withActions(state, prev, replay(state.record.config, prev), []);
    }
    case 'remove': {
      if (msg.index < 0 || msg.index >= actions.length) return state;
      const r = removeAction(state.record.config, actions, msg.index);
      return withActions(state, r.actions, r.match, [...state.past, actions]);
    }
  }
}

/** One match: useReducer over the pure engine, persisted after every change. */
export function useMatch(initial: MatchRecord, persist: (r: MatchRecord) => void) {
  const [state, dispatch] = useReducer(reducer, initial, (r) => ({
    record: r,
    match: replay(r.config, r.actions),
    past: [],
  }));
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    persist(state.record);
  }, [state.record, persist]);
  return {
    match: state.match,
    record: state.record,
    act: (action: MatchAction) => dispatch({ type: 'act', action }),
    undo: () => dispatch({ type: 'undo' }),
    /** Delete one action from anywhere in the match (a mis-tap found in the log). */
    remove: (index: number) => dispatch({ type: 'remove', index }),
    /** How many later actions would also go if this one were removed. */
    removalCost: (index: number) => removeAction(state.record.config, state.record.actions, index).dropped,
    canUndo: state.past.length > 0 || state.record.actions.length > 0,
    /** Predicts whether an action would be accepted, without dispatching it. */
    wouldAccept: (action: MatchAction) => applyMatch(state.match, action) !== state.match,
  };
}
