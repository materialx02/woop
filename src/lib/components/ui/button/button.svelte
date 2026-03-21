<script lang="ts">
	import { cn } from '$lib/utils.js';
	import { buttonVariants, type ButtonProps } from './index.js';

	let { variant = 'default', size = 'default', class: className, children, ...rest }: ButtonProps =
		$props();
</script>

<button class={cn(buttonVariants({ variant, size }), className)} {...rest}>
	{#if children}
		{@render children()}
	{/if}
</button>
