import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

const DEFAULT_FUEL_PRICE = 59.5;

export function getFuelPricePerLiter(): number {
	if (typeof window === 'undefined') return DEFAULT_FUEL_PRICE;
	const saved = localStorage.getItem('drivefuel-settings');
	if (saved) {
		try {
			const val = JSON.parse(saved).fuelPricePerLiter;
			if (typeof val === 'number' && val > 0) return val;
		} catch {
			// ignore
		}
	}
	return DEFAULT_FUEL_PRICE;
}
