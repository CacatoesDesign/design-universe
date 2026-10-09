// Normalise le scan de Simple Design System (scan/sds/*.json, produit par scan/figma/*.js via le MCP Figma)
// en src/data/library.json. Usage : node scan/build-sds.mjs
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalize } from './normalize.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const dir = join(here, 'sds');
const read = f => JSON.parse(readFileSync(join(dir, f), 'utf8'));
const files = readdirSync(dir).filter(f => f.endsWith('.json'));
const manifest = read('manifest.json');

// Couches du système, dans l'ordre des colonnes de la vue Library (d'après les pages du fichier Figma).
const LAYERS = ['Primitives', 'Compositions'];
const layerOf = page => (/^(Forms|Sections)$/.test(page) ? 'Compositions' : 'Primitives');

const pages = files.filter(f => f.startsWith('page-')).map(read);
const screens = files.filter(f => f.startsWith('screens-')).flatMap(f => read(f).screens);
const { library: out, stats } = normalize({
  vars: read('vars.json'), pages, screens, iconsPage: read('icons-page.json'),
  file: { key: manifest.fileKey, name: 'Simple Design System', scannedAt: manifest.scannedAt, via: 'Figma MCP use_figma (Plugin API, read-only) · scan/figma' },
  layers: LAYERS, layerOf, slotSurvey: files.includes('slots.json') ? read('slots.json').components : {},
});
const variables = out.variables, collections = out.collections, components = out.components, screensOut = out.screens, icons = out.icons;

const dest = join(here, '..', 'src', 'data', 'library.json');
mkdirSync(dirname(dest), { recursive: true });
writeFileSync(dest, JSON.stringify(out));
const rendered = Object.values(components).filter(c => c.variants.length).length;
console.log(`slots : ${stats.slots} props SLOT, ${stats.prefs} instances préférées rattachées`);
console.log(`relations : ${stats.remapped} rattachées par nom, ${stats.dropped} ignorées`);
console.log(`library.json : ${Object.keys(variables).length} variables, ${Object.keys(collections).length} collections, ${Object.keys(components).length} composants (${rendered} rendables), ${screensOut.length} écrans, ${Object.keys(icons).length} icônes`);
