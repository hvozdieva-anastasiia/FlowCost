import { AssumptionsPanel } from './components/Assumptions';
import { CompareSection } from './components/Compare';
import { ExportButtons } from './components/ExportButtons';
import { Health, useHealth } from './components/Health';
import { Marks } from './components/Marks';
import { Results } from './components/Results';
import { ScreenPicker } from './components/ScreenPicker';
import { useFlow } from './FlowProvider';
import type { Tab } from './state';

function Banners() {
  const { state, dispatch, bridge } = useFlow();
  return (
    <>
      {state.stale && (
        <div className="banner" role="status">
          <span>The page changed.</span>
          <button type="button" onClick={() => bridge.post({ type: 'SCAN' })}>
            Read it again
          </button>
        </div>
      )}
      {state.notice && (
        <div
          className={`banner ${state.notice.level}`}
          role={state.notice.level === 'error' ? 'alert' : 'status'}
        >
          <span>{state.notice.text}</span>
          <button type="button" onClick={() => dispatch({ type: 'dismiss' })}>
            Dismiss
          </button>
        </div>
      )}
    </>
  );
}

function Tabs() {
  const { state, dispatch, bridge } = useFlow();
  const problems = useHealth().filter(
    (issue) => issue.severity !== 'info',
  ).length;
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
        {tab('analyze', 'Analyze')}
        {tab('health', problems > 0 ? `Health (${problems})` : 'Health')}
      </div>
      <button type="button" onClick={() => bridge.post({ type: 'SCAN' })}>
        Read page
      </button>
    </header>
  );
}

export function App() {
  const { state } = useFlow();
  return (
    <main>
      <Tabs />
      <Banners />
      {state.tab === 'analyze' ? (
        <div role="tabpanel" id="panel-analyze" aria-labelledby="tab-analyze">
          <ScreenPicker />
          <AssumptionsPanel />
          <Results />
          <ExportButtons />
          <CompareSection />
          <Marks />
        </div>
      ) : (
        <div role="tabpanel" id="panel-health" aria-labelledby="tab-health">
          <Health />
        </div>
      )}
    </main>
  );
}
