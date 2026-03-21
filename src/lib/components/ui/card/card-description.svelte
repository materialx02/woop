<script lang="ts">
	import { cn } from '$lib/utils.js';
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	interface Props extends HTMLAttributes<HTMLParagraphElement> {
		children?: Snippet;
		class?: string;
	}
	let { class: className, children, ...rest }: Props = $props();
</script>

<p class={cn('text-sm text-muted-foreground', className)} {...rest}>
	{#if children}
		{@render children()}
	{/if}
</p>
