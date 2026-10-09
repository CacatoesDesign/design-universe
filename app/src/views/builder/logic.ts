import { pascal } from '../../lib/codegen';
import type { Library, Modes } from '../../lib/types';

/* Logique d'affichage du Builder : variables d'état, breakpoint, modes Figma, et nodes If / Router / Show. */

export type VarType = 'boolean' | 'enum' | 'number';
/** Variable d'état libre (ex. isLoggedIn, role, cartCount). Les valeurs sont stockées en texte. */
export interface StateVar { id: string; name: string; type: VarType; options: string[]; def: string }

/** Ce qu'une condition teste : une variable, le breakpoint, ou le mode d'une collection Figma. */
export type Subject = { src: 'var'; id: string } | { src: 'bp' } | { src: 'mode'; id: string };
export type Op = 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte';
export interface Cond { subject?: Subject; op: Op; value: string }

export interface IfData extends Record<string, unknown> { kind: 'if'; name: string; cond: Cond }
export interface SwitchCase { id: string; value: string }
export interface SwitchData extends Record<string, unknown> { kind: 'switch'; name: string; subject?: Subject; cases: SwitchCase[] }
export interface ShowData extends Record<string, unknown> { kind: 'show'; name: string; cond: Cond }
export type LogicData = IfData | SwitchData | ShowData;
export const isLogic = (d: { kind: string }): d is LogicData => d.kind === 'if' || d.kind === 'switch' || d.kind === 'show';

export type Breakpoint = 'desktop' | 'tablet' | 'mobile';
export const BREAKPOINTS: { id: Breakpoint; label: string; width: number; min: number }[] = [
  { id: 'desktop', label: 'Desktop', width: 1280, min: 1280 },
  { id: 'tablet', label: 'Tablet', width: 768, min: 768 },
  { id: 'mobile', label: 'Mobile', width: 390, min: 0 },
];
export const bpOf = (w: number): Breakpoint => (w >= 1280 ? 'desktop' : w >= 768 ? 'tablet' : 'mobile');

/** Contexte d'évaluation : valeurs simulées des variables, breakpoint et modes courants. */
export interface Env { lib: Library; vars: StateVar[]; values: Record<string, string>; bp: Breakpoint; modes: Modes }

/** Identifiant JS lisible tiré d'un nom libre, en conservant le camelCase saisi. */
export const ident = (s: string) => {
  const id = s.trim().replace(/[^A-Za-z0-9_$]+(.)?/g, (_, c: string | undefined) => (c ? c.toUpperCase() : '')).replace(/^[A-Z]/, c => c.toLowerCase());
  return !id ? 'value' : /^\d/.test(id) ? '_' + id : id;
};

/** Noms interdits pour une variable : mots réservés JS et noms déjà pris par le code généré. */
const RESERVED = new Set(('break case catch class const continue debugger default delete do else enum export extends false finally for function if '
  + 'import in instanceof new null return super switch this throw true try typeof var void while with yield let static implements interface package '
  + 'private protected public await arguments eval undefined NaN Infinity bp props').split(' '));
/** Erreur de nom d'une variable (vide si le nom est valide) : unicité et validité du nom JS généré. */
export function varNameError(lib: Library, vars: StateVar[], name: string, except?: string) {
  if (!name.trim()) return '';
  const id = ident(name);
  if (RESERVED.has(id)) return `"${id}" is reserved in the generated code.`;
  if (modeCollections(lib).some(c => modeProp(lib, c.id) === id)) return `"${id}" is already used by a Figma mode prop.`;
  const clash = vars.find(v => v.id !== except && ident(v.name) === id);
  return clash ? `"${clash.name}" already becomes ${id} in the code.` : '';
}

/** Collections Figma dont le mode peut varier (au moins deux modes). */
export const modeCollections = (lib: Library) => Object.values(lib.collections).filter(c => !c.orphan && c.modes.length > 1);

export interface SubjectInfo { key: string; subject: Subject; label: string; type: VarType; values: string[] }

/** Tout ce qu'une condition peut tester, dans l'ordre du menu. */
export function subjects(lib: Library, vars: StateVar[]): SubjectInfo[] {
  return [
    ...vars.map(v => ({ key: 'var:' + v.id, subject: { src: 'var', id: v.id } as Subject, label: v.name, type: v.type, values: v.type === 'boolean' ? ['true', 'false'] : v.type === 'enum' ? v.options : [] })),
    { key: 'bp', subject: { src: 'bp' }, label: 'Breakpoint', type: 'enum', values: BREAKPOINTS.map(b => b.id) },
    ...modeCollections(lib).map(c => ({ key: 'mode:' + c.id, subject: { src: 'mode', id: c.id } as Subject, label: `${c.name} mode`, type: 'enum' as VarType, values: c.modes.map(m => m.name) })),
  ];
}
export const subjectKey = (s?: Subject) => (!s ? '' : s.src === 'bp' ? 'bp' : `${s.src}:${s.id}`);
export const subjectInfo = (lib: Library, vars: StateVar[], s?: Subject) => subjects(lib, vars).find(x => x.key === subjectKey(s));

/** Valeur courante d'un sujet dans l'environnement simulé. */
export function valueOf(env: Env, s?: Subject): string | undefined {
  if (!s) return undefined;
  if (s.src === 'bp') return env.bp;
  if (s.src === 'mode') {
    const c = env.lib.collections[s.id]; if (!c) return undefined;
    return (c.modes.find(m => m.id === env.modes[c.id]) ?? c.modes[0])?.name;
  }
  const v = env.vars.find(x => x.id === s.id); if (!v) return undefined;
  return env.values[v.id] ?? v.def;
}

export const OPS: Record<Op, string> = { eq: '=', neq: '≠', gt: '>', lt: '<', gte: '≥', lte: '≤' };
export const opsFor = (t: VarType): Op[] => (t === 'number' ? ['eq', 'neq', 'gt', 'lt', 'gte', 'lte'] : ['eq', 'neq']);

/** Une condition sans sujet (ou dont la variable a été supprimée) n'est pas configurée : elle vaut faux. */
export function evalCond(env: Env, c: Cond): boolean {
  const cur = valueOf(env, c.subject);
  if (cur === undefined) return false;
  const info = subjectInfo(env.lib, env.vars, c.subject);
  if (info?.type === 'number') {
    const a = Number(cur), b = Number(c.value);
    return { eq: a === b, neq: a !== b, gt: a > b, lt: a < b, gte: a >= b, lte: a <= b }[c.op];
  }
  return c.op === 'neq' ? cur !== c.value : cur === c.value;
}

/** Branche choisie par un Router : l'id du premier cas qui correspond, sinon « default ».
 *  Même comparaison qu'un If (`=`), donc numérique pour un nombre, comme le code généré. */
export function switchPick(env: Env, d: SwitchData): string {
  return d.cases.find(k => evalCond(env, { subject: d.subject, op: 'eq', value: k.value }))?.id ?? 'default';
}

/** Poignée d'entrée active d'un node logique (pour atténuer les branches non prises sur le canvas). */
export function activeHandle(env: Env, d: LogicData): string | null {
  if (d.kind === 'if') return evalCond(env, d.cond) ? 'then' : 'else';
  if (d.kind === 'switch') return switchPick(env, d);
  return evalCond(env, d.cond) ? 'in' : null;
}

/** Texte court d'une condition, pour les nodes et l'inspecteur. */
export function condLabel(lib: Library, vars: StateVar[], c: Cond) {
  const info = subjectInfo(lib, vars, c.subject);
  if (!info) return c.subject ? 'missing variable' : 'no condition';
  if (info.type === 'boolean' && c.value === 'true') return c.op === 'eq' ? info.label : `not ${info.label}`;
  if (info.type === 'boolean') return c.op === 'eq' ? `not ${info.label}` : info.label;
  return `${info.label} ${OPS[c.op]} ${c.value || '…'}`;
}

/* ---------- Génération de code ---------- */

/** Ce que le code d'un écran doit déclarer pour ses conditions. */
export interface LogicUse { vars: Set<string>; bp: boolean; modes: Set<string> }
export const newLogicUse = (): LogicUse => ({ vars: new Set(), bp: false, modes: new Set() });

const jsStr = (s: string) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
export const modeProp = (lib: Library, collId: string) => ident(lib.collections[collId]?.name ?? 'mode') + 'Mode';

/** Expression JS d'un sujet, en notant ce qu'il faut déclarer. */
function subjectExpr(lib: Library, vars: StateVar[], s: Subject, use: LogicUse) {
  if (s.src === 'bp') { use.bp = true; return 'bp'; }
  if (s.src === 'mode') { use.modes.add(s.id); return modeProp(lib, s.id); }
  use.vars.add(s.id);
  return ident(vars.find(v => v.id === s.id)?.name ?? 'value');
}

/** Expression JS d'une condition (`false` si elle n'est pas configurée, comme dans l'aperçu). */
export function condExpr(lib: Library, vars: StateVar[], c: Cond, use: LogicUse): string {
  const info = subjectInfo(lib, vars, c.subject);
  if (!info || !c.subject) return 'false';
  const x = subjectExpr(lib, vars, c.subject, use);
  if (info.type === 'boolean') return (c.op === 'eq') === (c.value === 'true') ? x : `!${x}`;
  if (info.type === 'number') return `${x} ${{ eq: '===', neq: '!==', gt: '>', lt: '<', gte: '>=', lte: '<=' }[c.op]} ${Number(c.value) || 0}`;
  return `${x} ${c.op === 'neq' ? '!==' : '==='} ${jsStr(c.value)}`;
}

export function caseExpr(lib: Library, vars: StateVar[], s: Subject | undefined, value: string, use: LogicUse) {
  const info = subjectInfo(lib, vars, s);
  if (!info || !s) return 'false';
  return condExpr(lib, vars, { subject: s, op: 'eq', value }, use);
}

/** Props de l'écran (variables et modes utilisés) et préambule du composant (breakpoint). */
export function screenSignature(lib: Library, vars: StateVar[], use: LogicUse) {
  const props: string[] = [], defaults: string[] = [];
  for (const v of vars) {
    if (!use.vars.has(v.id)) continue;
    const n = ident(v.name);
    if (v.type === 'boolean') { props.push(`  ${n}?: boolean;`); defaults.push(`${n} = ${v.def === 'true'}`); }
    else if (v.type === 'number') { props.push(`  ${n}?: number;`); defaults.push(`${n} = ${Number(v.def) || 0}`); }
    else { props.push(`  ${n}?: ${v.options.map(jsStr).join(' | ') || 'string'};`); defaults.push(`${n} = ${jsStr(v.def)}`); }
  }
  for (const id of use.modes) {
    const c = lib.collections[id]; if (!c) continue;
    const n = modeProp(lib, id);
    props.push(`  /** Mode of the Figma collection "${c.name}". */\n  ${n}?: ${c.modes.map(m => jsStr(m.name)).join(' | ')};`);
    defaults.push(`${n} = ${jsStr(c.modes[0].name)}`);
  }
  return { props, defaults, hooks: use.bp ? ['  const bp = useBreakpoint();'] : [] };
}

export const BREAKPOINT_HOOK = `import { useSyncExternalStore } from 'react';

export type Breakpoint = 'desktop' | 'tablet' | 'mobile';

const queries = { desktop: '(min-width: 1280px)', tablet: '(min-width: 768px)' };
const read = (): Breakpoint =>
  window.matchMedia(queries.desktop).matches ? 'desktop' : window.matchMedia(queries.tablet).matches ? 'tablet' : 'mobile';
const subscribe = (cb: () => void) => {
  const mqs = Object.values(queries).map(q => window.matchMedia(q));
  mqs.forEach(m => m.addEventListener('change', cb));
  return () => mqs.forEach(m => m.removeEventListener('change', cb));
};

/** Current breakpoint: desktop ≥ 1280px, tablet ≥ 768px, mobile below. */
export function useBreakpoint(): Breakpoint {
  return useSyncExternalStore(subscribe, read, () => 'desktop');
}
`;

export const propsName = (screen: string) => `${pascal(screen)}Props`;
