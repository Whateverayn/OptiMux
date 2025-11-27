import React from 'react'
import { createRoot } from 'react-dom/client'
import './style.css'
import App from './App.js'
import '98.css'

const preventDefault = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
};

window.addEventListener('dragenter', preventDefault, false);
window.addEventListener('dragover', preventDefault, false);
window.addEventListener('dragleave', preventDefault, false);
window.addEventListener('drop', preventDefault, false);

const container = document.getElementById('root')

const root = createRoot(container!)

root.render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
)
