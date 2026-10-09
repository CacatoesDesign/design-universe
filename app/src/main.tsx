import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { loadDefaultLibrary } from './lib/library'

const root = createRoot(document.getElementById('root')!)
// La lib de démo est chargée avant le premier rendu (fichier JSON séparé, mis en cache par son nom haché).
loadDefaultLibrary()
  .then(lib => root.render(<StrictMode><App initial={lib} /></StrictMode>))
  .catch(e => root.render(<p role="alert" style={{ font: '14px system-ui', padding: 24 }}>Could not load the library: {(e as Error).message}</p>))
