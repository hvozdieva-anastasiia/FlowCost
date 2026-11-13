import { render, screen } from '@testing-library/react';
import { App } from '../src/ui/App';

describe('App', () => {
  it('shows the product name', () => {
    render(<App />);
    expect(
      screen.getByRole('heading', { name: 'Flow Cost' }),
    ).toBeInTheDocument();
  });
});
