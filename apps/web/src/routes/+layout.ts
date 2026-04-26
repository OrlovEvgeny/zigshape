export const prerender = true;
// SSR enabled at prerender time so per-page <svelte:head> content lands in
// the static HTML — necessary for SEO on the per-format landing pages.
// All runtime DOM work happens inside onMount / $effect (CodeMirror, file
// dialogs, clipboard, fetch), so the build-time render only emits the
// markup shell.
export const ssr = true;
