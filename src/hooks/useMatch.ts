import { useEffect, useReducer, useRef } from 'react';
import { applyMatch, replay, type MatchAction, type MatchState } from '../engine';
import type { MatchRecord } from '../store/repo';

interface State {
  record: MatchRecord;
  match: MatchState;
}

type Msg = { type: 'act'; action: MatchAction } | { type: 'undo' };

function reducer(state: State, msg: Msg): State {
  switch (msg.type) {
    case 'act': {
      const match = applyMatch(state.match, msg.action);
      if (match === state.match) return state;
      return {
        match,
        record: {
          ...state.record,
          actions: [...state.record.actions, msg.action],
          updatedAt: Date.now(),
          status: match.over ? 'finished' : 'live',
        },
      };
    }
    case 'undo': {
      if (state.record.actions.length === 0) return state;
      const actions = state.record.actions.slice(0, -1);
      const match = replay(state.record.config, actions);
      return { match, record: { ...state.record, actions, updatedAt: Date.now(), status: match.over ? 'finished' : 'live' } };
    }
  }
}

/** One match: useReducer over the pure engine, persisted after every change. */
export function useMatch(initial: MatchRecord, persist: (r: MatchRecord) => void) {
  const [state, dispatch] = useReducer(reducer, initial, (r) => ({ record: r, match: replay(r.config, r.actions) }));
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
    canUndo: state.record.actions.length > 0,
    /** Predicts whether an action would be accepted, without dispatching it. */
    wouldAccept: (action: MatchAction) => applyMatch(state.match, action) !== state.match,
  };
}
