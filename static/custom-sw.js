/**
 * FuelWise Custom Service Worker Extension
 *
 * Loaded via importScripts by the Workbox-generated service worker.
 * Handles background notifications, trip tracking, and periodic checks.
 */

// ── Constants ──────────────────────────────────────────────────────

var SCOPE = '/woop';
var ICON = SCOPE + '/pwa-192x192.png';
var BADGE = SCOPE + '/favicon-32x32.png';
var NOTIFICATIONS_DB = 'FuelWiseNotifications';
var NOTIFICATIONS_DB_VERSION = 1;

// ── IndexedDB Helpers ──────────────────────────────────────────────

function openNotificationsDB() {
	return new Promise(function (resolve, reject) {
		var req = indexedDB.open(NOTIFICATIONS_DB, NOTIFICATIONS_DB_VERSION);
		req.onupgradeneeded = function () {
			var db = req.result;
			if (!db.objectStoreNames.contains('settings')) {
				db.createObjectStore('settings');
			}
		};
		req.onsuccess = function () {
			resolve(req.result);
		};
		req.onerror = function () {
			reject(req.error);
		};
	});
}

function getSettings() {
	return openNotificationsDB()
		.then(function (db) {
			return new Promise(function (resolve) {
				var tx = db.transaction('settings', 'readonly');
				var store = tx.objectStore('settings');
				var get = store.get('notification-settings');
				get.onsuccess = function () {
					db.close();
					resolve(get.result || null);
				};
				get.onerror = function () {
					db.close();
					resolve(null);
				};
			});
		})
		.catch(function () {
			return null;
		});
}

function saveSettings(settings) {
	return openNotificationsDB()
		.then(function (db) {
			return new Promise(function (resolve) {
				var tx = db.transaction('settings', 'readwrite');
				var store = tx.objectStore('settings');
				store.put(settings, 'notification-settings');
				tx.oncomplete = function () {
					db.close();
					resolve();
				};
				tx.onerror = function () {
					db.close();
					resolve();
				};
			});
		})
		.catch(function () {});
}

function openFuelWiseDB() {
	return new Promise(function (resolve, reject) {
		var req = indexedDB.open('FuelWiseDB');
		req.onsuccess = function () {
			resolve(req.result);
		};
		req.onerror = function () {
			reject(req.error);
		};
	});
}

// ── Notification Condition Checks ──────────────────────────────────

function checkUnreadInsights() {
	return openFuelWiseDB()
		.then(function (db) {
			return new Promise(function (resolve) {
				var tx = db.transaction('aiInsights', 'readonly');
				var store = tx.objectStore('aiInsights');
				var index = store.index('isRead');
				// Dexie stores booleans as 0/1 in indexed fields
				var req = index.count(IDBKeyRange.only(0));

				req.onsuccess = function () {
					var count = req.result;
					if (count > 0) {
						self.registration.showNotification('FuelWise Insights', {
							body:
								'You have ' +
								count +
								' unread AI insight' +
								(count > 1 ? 's' : '') +
								' to review',
							icon: ICON,
							badge: BADGE,
							tag: 'unread-insights',
							data: { url: SCOPE + '/insights' }
						});
					}
					resolve();
				};
				req.onerror = function () {
					resolve();
				};

				tx.oncomplete = function () {
					db.close();
				};
			});
		})
		.catch(function (e) {
			console.warn('[FuelWise SW] Failed to check insights:', e);
		});
}

function checkMaintenanceReminders() {
	return openFuelWiseDB()
		.then(function (db) {
			return new Promise(function (resolve) {
				var tx = db.transaction('vehicles', 'readonly');
				var store = tx.objectStore('vehicles');
				var req = store.getAll();

				req.onsuccess = function () {
					var vehicles = req.result;
					for (var i = 0; i < vehicles.length; i++) {
						var vehicle = vehicles[i];
						if (!vehicle.isActive) continue;

						// Check if odometer is within 500km of a 5,000km service interval
						var nextService = Math.ceil(vehicle.odometerKm / 5000) * 5000;
						var kmRemaining = nextService - vehicle.odometerKm;

						if (kmRemaining <= 500 && kmRemaining > 0) {
							self.registration.showNotification('Maintenance Reminder', {
								body:
									vehicle.name +
									' is ' +
									kmRemaining.toFixed(0) +
									'km away from its ' +
									nextService.toLocaleString() +
									'km service',
								icon: ICON,
								badge: BADGE,
								tag: 'maintenance-' + vehicle.id,
								data: { url: SCOPE + '/vehicles' }
							});
						}
					}
					resolve();
				};
				req.onerror = function () {
					resolve();
				};

				tx.oncomplete = function () {
					db.close();
				};
			});
		})
		.catch(function (e) {
			console.warn('[FuelWise SW] Failed to check maintenance:', e);
		});
}

function runNotificationChecks() {
	return getSettings().then(function (settings) {
		if (!settings) return;

		var checks = [];
		if (settings.efficiencyInsights) {
			checks.push(checkUnreadInsights());
		}
		if (settings.maintenanceReminders) {
			checks.push(checkMaintenanceReminders());
		}
		return Promise.all(checks);
	});
}

// ── Trip Tracking Notification ─────────────────────────────────────

function handleTripUpdate(data) {
	if (!data.isTracking) return;

	var minutes = Math.floor(data.duration / 60);
	var seconds = data.duration % 60;
	var timeStr = minutes + ':' + (seconds < 10 ? '0' : '') + seconds;

	self.registration.showNotification('Trip in Progress', {
		body:
			data.vehicleName +
			' \u00B7 ' +
			data.distance.toFixed(1) +
			' km \u00B7 ' +
			timeStr +
			' \u00B7 ' +
			data.avgSpeed.toFixed(0) +
			' km/h avg',
		icon: ICON,
		badge: BADGE,
		tag: 'active-trip',
		renotify: true,
		silent: true,
		data: { url: SCOPE + '/live-tracking' }
	});
}

// ── Event Listeners ────────────────────────────────────────────────

// Notification click → open/focus app on the relevant page
self.addEventListener('notificationclick', function (event) {
	event.notification.close();

	var targetUrl = (event.notification.data && event.notification.data.url) || SCOPE;

	event.waitUntil(
		self.clients
			.matchAll({ type: 'window', includeUncontrolled: true })
			.then(function (clientList) {
				// Focus an existing window if one is open
				for (var i = 0; i < clientList.length; i++) {
					var client = clientList[i];
					if ('focus' in client) {
						return client.focus().then(function (c) {
							return c.navigate(targetUrl);
						});
					}
				}
				// Otherwise open a new window
				return self.clients.openWindow(targetUrl);
			})
	);
});

// Periodic Background Sync → check conditions while app is closed
self.addEventListener('periodicsync', function (event) {
	if (event.tag === 'fuelwise-check') {
		event.waitUntil(runNotificationChecks());
	}
});

// Messages from the main app
self.addEventListener('message', function (event) {
	var data = event.data;
	if (!data || !data.type) return;

	switch (data.type) {
		case 'TRIP_UPDATE':
			handleTripUpdate(data);
			break;

		case 'TRIP_END':
			self.registration
				.getNotifications({ tag: 'active-trip' })
				.then(function (notifications) {
					notifications.forEach(function (n) {
						n.close();
					});
				});
			break;

		case 'SYNC_SETTINGS':
			saveSettings(data.settings);
			break;

		case 'CHECK_NOW':
			runNotificationChecks();
			break;
	}
});
