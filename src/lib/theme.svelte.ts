export type Theme = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'fuelwise-theme';

function createThemeState() {
	let theme = $state<Theme>('dark');

	function applyTheme(t: Theme) {
		if (typeof document === 'undefined') return;
		const resolved = t === 'system'
			? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
			: t;
		document.documentElement.classList.toggle('dark', resolved === 'dark');
	}

	function init() {
		if (typeof window === 'undefined') return;
		const saved = localStorage.getItem(STORAGE_KEY) as Theme | null;
		theme = saved ?? 'dark';
		applyTheme(theme);

		// Listen for system preference changes when in 'system' mode
		window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
			if (theme === 'system') applyTheme('system');
		});
	}

	function set(t: Theme) {
		theme = t;
		localStorage.setItem(STORAGE_KEY, t);
		applyTheme(t);
	}

	return {
		get current() { return theme; },
		init,
		set
	};
}

export const themeState = createThemeState();
