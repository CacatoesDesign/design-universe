import { createContext, useContext } from 'react';

/** Panneaux latéraux : ancrés au bord (défaut) ou flottants au-dessus du canvas. Bascule : ⇧⌘L (⇧Ctrl L hors Mac). */
export type PanelMode = 'docked' | 'floating';
export const PanelModeContext = createContext<{ mode: PanelMode; toggle: () => void }>({ mode: 'docked', toggle: () => {} });
export const usePanelMode = () => useContext(PanelModeContext);
export const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
export const panelShortcut = isMac ? '⇧⌘L' : 'Ctrl+Shift+L';
