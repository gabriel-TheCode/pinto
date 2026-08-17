import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Popup } from './Popup';
import '@/app/theme.css';

const container = document.getElementById('root');
if (!container) throw new Error('Pinto popup root element is missing');

createRoot(container).render(
  <StrictMode>
    <Popup />
  </StrictMode>,
);
