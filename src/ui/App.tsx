import { Audience } from './components/Audience';
import { BeforeAfter } from './components/BeforeAfter';
import { Check, useProblemCount } from './components/Check';
import { ExportButtons } from './components/ExportButtons';
import { RefreshIcon } from './components/Icons';
import { Results } from './components/Results';
import { RoutePicker } from './components/RoutePicker';
import { Teach } from './components/Teach';
import { Toast } from './components/Toast';
import { useFlow } from './FlowProvider';
import { plural } from './format';
import type { Tab } from './state';

function formatClock(at: number): string {
  return new Date(at).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function Header() {
  const { state, dispatch, refresh } = useFlow();
  const problems = useProblemCount();
  const tab = (id: Tab, label: string) => (
    <button
      type="button"
      role="tab"
      id={`tab-${id}`}
      aria-selected={state.tab === id}
      aria-controls={`panel-${id}`}
      onClick={() => dispatch({ type: 'tab', tab: id })}
    >
      {label}
    </button>
  );
  return (
    <header className="top">
      <div role="tablist" aria-label="Views">
        {tab('cost', 'Flow cost')}
        {tab('check', problems > 0 ? `Check (${problems})` : 'Check')}
      </div>
      <button
        type="button"
        className="refresh"
        data-busy={state.scanning}
        title="Read the prototype from the canvas again. This also happens by itself when you edit the page."
        onClick={refresh}
      >
        <RefreshIcon />
        {state.scanning ? 'Reading…' : 'Refresh'}
      </button>
    </header>
  );
}

/** Where the numbers come from, and how fresh they are. */
function StatusLine() {
  const { state } = useFlow();
  const { graph, lastReadAt, scanning } = state;
  if (!graph) return <p className="status">Reading the prototype…</p>;
  return (
    <p className="status" aria-live="polite">
      {graph.pageName} · {plural(graph.screens.length, 'screen', 'screens')} ·{' '}
      {plural(graph.links.length, 'connection', 'connections')}
      {lastReadAt !== null &&
        !scanning &&
        ` · updated ${formatClock(lastReadAt)}`}
    </p>
  );
}

export function App() {
  const { state } = useFlow();
  return (
    <main>
      <Header />
      <StatusLine />
      {state.tab === 'cost' ? (
        <div role="tabpanel" id="panel-cost" aria-labelledby="tab-cost">
          <RoutePicker />
          <Audience />
          <Results />
          <ExportButtons />
          <BeforeAfter />
          <Teach />
        </div>
      ) : (
        <div role="tabpanel" id="panel-check" aria-labelledby="tab-check">
          <Check />
        </div>
      )}
      <Toast />
    </main>
  );
}
