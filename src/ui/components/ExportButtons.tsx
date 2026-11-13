import { useState } from 'react';
import { toCsv, toMarkdown } from '../../shared/export';
import { copyText } from '../clipboard';
import { useFlow } from '../FlowProvider';

export function ExportButtons() {
  const { state, chosen } = useFlow();
  const [status, setStatus] = useState('');
  const [fallback, setFallback] = useState('');

  if (!chosen) return null;

  const nameOf = (id: string | null) =>
    state.graph?.screens.find((screen) => screen.id === id)?.name ?? '';

  const copy = async (kind: 'markdown' | 'csv') => {
    const text =
      kind === 'markdown'
        ? toMarkdown({
            title: `Flow cost: ${state.graph?.pageName ?? 'page'}`,
            startName: nameOf(state.startId),
            goalName: nameOf(state.goalId),
            path: chosen,
            assumptions: state.settings.assumptions,
          })
        : toCsv(chosen);
    const done = await copyText(text);
    setFallback(done ? '' : text);
    setStatus(
      done
        ? `${kind === 'markdown' ? 'Markdown' : 'CSV'} copied`
        : 'Copying is blocked here. Select the text below and copy it.',
    );
  };

  return (
    <section aria-label="Export">
      <div className="row wrap">
        <button type="button" onClick={() => void copy('markdown')}>
          Copy Markdown
        </button>
        <button type="button" onClick={() => void copy('csv')}>
          Copy CSV
        </button>
      </div>
      <p role="status" className="hint">
        {status}
      </p>
      {fallback && (
        <textarea
          readOnly
          rows={6}
          value={fallback}
          aria-label="Text to copy"
          onFocus={(event) => event.currentTarget.select()}
        />
      )}
    </section>
  );
}
