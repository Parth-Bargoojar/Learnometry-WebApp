export const THEME_KEY = "lm-theme";

/**
 * Runs once before first paint from the root layout (next/script beforeInteractive),
 * so a dark-mode learner never sees a white flash. Plain module: the server layout
 * imports it.
 */
export const themeScript = `(function(){try{var p=localStorage.getItem('${THEME_KEY}')||'system';var d=p==='dark'||(p==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light';}catch(e){}})();`;
