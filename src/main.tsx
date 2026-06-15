import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import Shell from './Shell';
import { ThemeProvider } from './themes/ThemeContext';
import { ModeProvider } from './themes/ModeContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <ModeProvider>
        <Shell />
      </ModeProvider>
    </ThemeProvider>
  </StrictMode>,
);
