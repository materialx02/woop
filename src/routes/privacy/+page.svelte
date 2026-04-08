<script lang="ts">
	import { base } from '$app/paths';
</script>

<svelte:head>
	<title>Privacy Policy - DriveFuel</title>
</svelte:head>

<div class="mx-auto max-w-3xl space-y-8">
	<div>
		<a href="{base}/settings" class="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4">
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<path d="m15 18-6-6 6-6"/>
			</svg>
			Back to Settings
		</a>
		<h1 class="text-3xl font-bold tracking-tight">Privacy Policy</h1>
		<p class="text-muted-foreground mt-1">Last updated: April 9, 2026</p>
	</div>

	<div class="space-y-6 text-sm leading-relaxed text-foreground">
		<section class="space-y-2">
			<h2 class="text-lg font-semibold">Overview</h2>
			<p>
				DriveFuel is a personal fuel tracking and driving assistant designed with privacy as a
				core principle. <strong>All your data stays on your device.</strong> We do not operate
				servers, collect analytics, or transmit your information to any third party.
			</p>
		</section>

		<section class="space-y-2">
			<h2 class="text-lg font-semibold">Data Storage</h2>
			<p>
				All data — including vehicle profiles, fuel logs, trip records, and AI insights — is
				stored locally on your device using IndexedDB (via Dexie.js). Your data is never
				uploaded to any server unless you explicitly choose to export it.
			</p>
			<p>
				App preferences (display name, theme, currency, notification settings) are stored in
				your browser's localStorage.
			</p>
		</section>

		<section class="space-y-2">
			<h2 class="text-lg font-semibold">Location Data</h2>
			<p>
				DriveFuel uses your device's GPS (via the browser Geolocation API) for the Live
				Tracking feature to record trip routes, distance, and speed. Location data is:
			</p>
			<ul class="list-disc pl-6 space-y-1">
				<li>Only collected while you actively start a trip</li>
				<li>Stored locally on your device</li>
				<li>Never transmitted to any external server</li>
				<li>Deletable at any time via Settings &gt; Clear All Data</li>
			</ul>
			<p>
				You can deny location permission at any time through your browser or device settings.
				The app will continue to function without it — only the Live Tracking feature
				requires location access.
			</p>
		</section>

		<section class="space-y-2">
			<h2 class="text-lg font-semibold">AI Service (Optional)</h2>
			<p>
				DriveFuel supports an optional, user-configured AI service for generating driving
				insights and predictions. If you choose to connect an AI service:
			</p>
			<ul class="list-disc pl-6 space-y-1">
				<li>You provide the service URL yourself in Settings</li>
				<li>Data is sent only to the URL you specify</li>
				<li>No AI service is connected by default</li>
				<li>All core features work fully offline without it</li>
			</ul>
		</section>

		<section class="space-y-2">
			<h2 class="text-lg font-semibold">Notifications</h2>
			<p>
				DriveFuel may send local push notifications for maintenance reminders, efficiency
				insights, and active trip updates. These notifications are generated entirely on your
				device using a service worker — no external push notification service is used.
				You can enable or disable notifications in Settings.
			</p>
		</section>

		<section class="space-y-2">
			<h2 class="text-lg font-semibold">Third-Party Services</h2>
			<p>
				DriveFuel loads Google Fonts (Inter) for typography. This is the only external
				network request the app makes. Google's privacy policy applies to font loading.
				No other third-party services, analytics, or tracking scripts are used.
			</p>
		</section>

		<section class="space-y-2">
			<h2 class="text-lg font-semibold">Data Deletion</h2>
			<p>
				You have full control over your data. You can:
			</p>
			<ul class="list-disc pl-6 space-y-1">
				<li>Export all data as JSON from Settings</li>
				<li>Delete all data from Settings &gt; Clear All Data</li>
				<li>Clear browser storage at any time to remove everything</li>
				<li>Uninstall the app to remove all associated data</li>
			</ul>
		</section>

		<section class="space-y-2">
			<h2 class="text-lg font-semibold">Children's Privacy</h2>
			<p>
				DriveFuel is not directed at children under 13. The app does not knowingly collect
				any personal information from children.
			</p>
		</section>

		<section class="space-y-2">
			<h2 class="text-lg font-semibold">Changes to This Policy</h2>
			<p>
				If this privacy policy is updated, the changes will be reflected on this page with
				an updated date.
			</p>
		</section>

		<section class="space-y-2 border-t pt-6">
			<h2 class="text-lg font-semibold">Contact</h2>
			<p>
				If you have questions about this privacy policy, you can reach us via the
				<a
					href="https://github.com/bayani-labs/drive-fuel/issues"
					target="_blank"
					rel="noopener noreferrer"
					class="text-primary hover:underline"
				>GitHub repository</a>.
			</p>
		</section>
	</div>
</div>
