import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { loadGraph, renderApp } from './harness';

describe('export', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('copies a Markdown report', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(navigator, 'clipboard', 'get').mockReturnValue({
      writeText,
    } as unknown as Clipboard);
    const app = renderApp();
    loadGraph(app);
    await user.selectOptions(screen.getByLabelText('Goal'), 'done');
    await user.click(screen.getByRole('button', { name: 'Copy Markdown' }));
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText.mock.calls[0]?.[0]).toContain('| Actions | 1 |');
    expect(screen.getByText('Markdown copied')).toBeInTheDocument();
  });

  it('shows the text when copying is refused', async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator, 'clipboard', 'get').mockReturnValue({
      writeText: vi.fn().mockRejectedValue(new Error('blocked')),
    } as unknown as Clipboard);
    Object.defineProperty(document, 'execCommand', {
      value: vi.fn().mockReturnValue(false),
      configurable: true,
    });
    const app = renderApp();
    loadGraph(app);
    await user.selectOptions(screen.getByLabelText('Goal'), 'done');
    await user.click(screen.getByRole('button', { name: 'Copy CSV' }));
    const area = screen.getByLabelText<HTMLTextAreaElement>('Text to copy');
    expect(area.value).toContain('step,screen,action,operator,detail,seconds');
  });
});
