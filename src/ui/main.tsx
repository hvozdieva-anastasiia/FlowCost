import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { figmaBridge } from './bridge';
import { FlowProvider } from './FlowProvider';
import './styles.css';

const bridge = figmaBridge();

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <FlowProvider bridge={bridge}>
        <App />
      </FlowProvider>
    </StrictMode>,
  );
}
