import { useState } from 'react';
import { toCsv, toMarkdown } from '../../shared/export';
import { copyText } from '../clipboard';
import { useFlow } from '../FlowProvider';

/** Copies the result as text for a document or a spreadsheet. */
export function ExportButtons() {
  const { state, dispatch, chosen, analysis } = useFlow();
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
            flow: analysis?.flow ?? null,
          })
        : toCsv(chosen);
    const done = await copyText(text);
    setFallback(done ? '' : text);
    dispatch({
      type: 'notice',
      notice: done
        ? {
            level: 'info',
            text:
              kind === 'markdown'
                ? 'Report copied as Markdown.'
                : 'Steps copied as CSV.',
          }
        : {
            level: 'error',
            text: 'Copying is blocked here. Select the text below and copy it yourself.',
          },
    });
  };

  return (
    <section aria-labelledby="share-heading">
      <h3 id="share-heading">Share</h3>
      <div className="row wrap">
        <button type="button" onClick={() => void copy('markdown')}>
          Copy report as Markdown
        </button>
        <button type="button" onClick={() => void copy('csv')}>
          Copy steps as CSV
        </button>
      </div>
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
