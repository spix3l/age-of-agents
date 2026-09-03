import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ModelLab } from './ModelLab';
import './model-lab.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ModelLab />
  </StrictMode>,
);
