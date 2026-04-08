// Shared trip-active state so the layout (and other components)
// can detect whether live tracking is in progress.
let _active = $state(false);

export const tripState = {
	get active() {
		return _active;
	},
	setActive(val: boolean) {
		_active = val;
	}
};
