import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

const root = createRoot(document.getElementById('root'));
window.addEventListener('error', (event) => {
  const node = document.getElementById('root');
  if (node && (!node.textContent || !node.textContent.trim())) {
    node.innerHTML = '<main style="font-family:system-ui,sans-serif;max-width:680px;margin:12vh auto;padding:24px;color:#24213f"><h1 style="color:#5b4bdb">Resolve Tudo</h1><h2>O aplicativo encontrou um erro ao abrir.</h2><p>Atualize a página. Se continuar, envie esta mensagem ao suporte:</p><pre style="white-space:pre-wrap;background:#f3f1ff;padding:14px;border-radius:10px"></pre></main>';
    node.querySelector('pre').textContent = event.message || 'Erro de inicialização';
  }
});
window.addEventListener('unhandledrejection', (event) => {
  console.error('Resolve Tudo startup error:', event.reason);
});
try {
  root.render(<React.StrictMode><App /></React.StrictMode>);
} catch (error) {
  document.getElementById('root').innerHTML = '<main style="font-family:system-ui,sans-serif;max-width:680px;margin:12vh auto;padding:24px;color:#24213f"><h1 style="color:#5b4bdb">Resolve Tudo</h1><h2>Não foi possível iniciar a interface.</h2><p>Envie esta mensagem para identificar a causa:</p><pre style="white-space:pre-wrap;background:#f3f1ff;padding:14px;border-radius:10px"></pre></main>';
  document.querySelector('#root pre').textContent = error?.stack || error?.message || String(error);
}
