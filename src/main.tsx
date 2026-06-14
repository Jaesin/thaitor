import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import Shell from './Shell';
import { ThemeProvider } from './themes/ThemeContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <Shell />
    </ThemeProvider>
  </StrictMode>,
);
