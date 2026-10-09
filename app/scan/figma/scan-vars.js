// Variables locales (lecture seule) → lignes [id, name, type, collectionId, codeWEB, "modeId=val|…"] (format de vars-*.json).
const cols = await figma.variables.getLocalVariableCollectionsAsync();
const strip = id => id.replace(/^VariableCollectionId:|^VariableID:/, '');
const hex = c => '#' + [c.r, c.g, c.b].map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('').toUpperCase() + (c.a !== undefined && c.a < 1 ? Math.round(c.a * 255).toString(16).padStart(2, '0').toUpperCase() : '');
const T = { COLOR: 'C', FLOAT: 'F', STRING: 'S', BOOLEAN: 'B' };
const vars = await figma.variables.getLocalVariablesAsync();
const rows = vars.map(v => [strip(v.id), v.name, T[v.resolvedType], strip(v.variableCollectionId), v.codeSyntax?.WEB || '',
  Object.entries(v.valuesByMode).map(([m, x]) => m + '=' + (x && x.type === 'VARIABLE_ALIAS' ? '@' + strip(x.id) : v.resolvedType === 'COLOR' ? hex(x) : JSON.stringify(x))).join('|')]);
return { collections: cols.map(c => ({ id: strip(c.id), name: c.name, modes: c.modes.map(m => [m.modeId, m.name]) })), rows };
