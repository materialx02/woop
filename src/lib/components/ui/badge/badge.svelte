<script lang="ts">
	import { cn } from '$lib/utils.js';
	import { badgeVariants, type Variant } from './index.js';
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	interface Props extends HTMLAttributes<HTMLDivElement> {
		variant?: Variant;
		children?: Snippet;
		class?: string;
	}
	let { variant = 'default', class: className, children, ...rest }: Props = $props();
</script>

<div class={cn(badgeVariants({ variant }), className)} {...rest}>
	{#if children}
		{@render children()}
	{/if}
</div>
