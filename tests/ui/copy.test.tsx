import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { loadGraph, renderApp } from './harness';

describe('sharing the result', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('copies a Markdown report and says so', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(navigator, 'clipboard', 'get').mockReturnValue({
      writeText,
    } as unknown as Clipboard);
    const app = renderApp();
    loadGraph(app);
    await user.selectOptions(screen.getByLabelText('To'), 'done');
    await user.click(
      screen.getByRole('button', { name: 'Copy report as Markdown' }),
    );
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText.mock.calls[0]?.[0]).toContain('| Actions | 1 |');
    expect(screen.getByText('Report copied as Markdown.')).toBeInTheDocument();
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
    await user.selectOptions(screen.getByLabelText('To'), 'done');
    await user.click(screen.getByRole('button', { name: 'Copy steps as CSV' }));
    const area = screen.getByLabelText<HTMLTextAreaElement>('Text to copy');
    expect(area.value).toContain('step,screen,action,operator,detail,seconds');
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Copying is blocked here',
    );
  });
});
