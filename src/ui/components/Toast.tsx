import { useFlow } from '../FlowProvider';
import { CloseIcon } from './Icons';

/**
 * A short message about what just happened. It sits at the bottom, goes away
 * by itself and can be closed. Errors say what failed and what to do.
 */
export function Toast() {
  const { state, dispatch } = useFlow();
  const { notice } = state;
  if (!notice) return null;
  return (
    <div
      className={`toast ${notice.level}`}
      role={notice.level === 'error' ? 'alert' : 'status'}
    >
      <span>{notice.text}</span>
      <button
        type="button"
        className="icon-button"
        aria-label="Close message"
        onClick={() => dispatch({ type: 'dismiss' })}
      >
        <CloseIcon />
      </button>
    </div>
  );
}
