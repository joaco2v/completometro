import { render } from 'preact';
import { registerSW } from 'virtual:pwa-register';
import { App } from './interfaz/App';
import './interfaz/estilos.css';

render(<App />, document.getElementById('app')!);

// Service worker: guarda la app para usarla sin internet y se actualiza sola.
if ('serviceWorker' in navigator) registerSW({ immediate: true });
