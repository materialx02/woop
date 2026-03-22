<script lang="ts">
	import { Dialog as DialogPrimitive } from 'bits-ui';
	import type { ComponentProps } from 'svelte';

	let {
		open = $bindable(false),
		children,
		...rest
	}: ComponentProps<typeof DialogPrimitive.Root> = $props();
</script>

<DialogPrimitive.Root bind:open {...rest}>
	{#if children}
		{@render children()}
	{/if}
</DialogPrimitive.Root>
