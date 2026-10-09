import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // FIGMA_TOKEN (fichier .env, ignoré par git) : lu ici côté serveur uniquement. Sans préfixe VITE_,
  // il n'est jamais injecté dans le bundle envoyé au navigateur.
  const { FIGMA_TOKEN = '' } = loadEnv(mode, process.cwd(), '')

  // Proxy vers l'API REST Figma : le navigateur appelle /figma-api (même origine), Vite relaie vers api.figma.com
  // et ajoute le token du .env si la requête n'en porte pas.
  const figmaProxy = {
    '/figma-api': {
      target: 'https://api.figma.com',
      changeOrigin: true,
      rewrite: (p: string) => p.replace(/^\/figma-api/, ''),
      configure: (proxy: { on: (ev: 'proxyReq', cb: (req: { getHeader: (n: string) => unknown; setHeader: (n: string, v: string) => void }) => void) => void }) => {
        proxy.on('proxyReq', req => {
          if (FIGMA_TOKEN && !req.getHeader('x-figma-token')) req.setHeader('X-Figma-Token', FIGMA_TOKEN)
        })
      },
    },
  }

  return {
    plugins: [react()],
    build: {
      rolldownOptions: {
        output: {
          // Fichiers séparés : React et le moteur de graphes (React Flow + d3).
          // Chacun reste en cache tant qu'il ne change pas, et aucun ne dépasse 500 kB.
          codeSplitting: {
            groups: [
              { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/, priority: 3 },
              { name: 'flow', test: /node_modules[\\/](@xyflow|d3-[a-z-]+|classcat|zustand)[\\/]/, priority: 2 },
            ],
          },
        },
      },
    },
    server: { proxy: figmaProxy },
    preview: { proxy: figmaProxy },
  }
})
