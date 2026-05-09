# Product

## Register

product

## Users

People who live in the browser address bar: developers, researchers, and power searchers who already think in `!bangs` or want a faster, more portable version of that habit. They care about latency, predictability, and not routing every keystroke through a third party when it can stay local. They may self-host or use the hosted site; either way, they expect honest disclosure of what touches the network (OpenSearch, optional suggest, cookies used for configuration and frecency ranking).

## Product Purpose

bangs.to turns the address bar into a shortcut launcher: type a bang and query, and the Service Worker resolves the destination quickly, without an intermediate "redirect page" experience. It exists to beat round-trip latency and engine lock-in while keeping core redirects private and device-local. Success is measured by speed users can feel, clarity of setup (search engine URL, suggestions), and trust: defaults that protect query content on the redirect path, with optional features clearly bounded.

## Brand Personality

Precise, calm, and quietly technical: the product explains mechanisms when it matters (privacy, suggest, stats) without sounding like marketing fluff. Three words: **fast**, **forthright**, **local-first**.

## Anti-references

Heavy "growth" landing pages with vague superlatives, fake urgency, or stock hero imagery that could belong to any SaaS. Dark "hacker" cosplay or neon crypto-terminal aesthetics used as decoration. Dashboards that look like generic admin templates. Interstitial redirect pages that flash branding before sending users onward. Any UI pattern that implies tracking or social proof where the product’s promise is the opposite.

## Design Principles

1. **Speed is the feature:** If a visual or interaction adds perceived latency or cognitive steps without a clear payoff, it does not ship.
2. **Say what happens:** When something uses the network or storage, say so in plain language; never imply "all local" when a path is optional or server-assisted.
3. **Tool, not spectacle:** Layout and type should help people configure, search, and inspect stats; avoid novelty chrome that competes with the task.
4. **Progressive depth:** Make the default path short (install as search engine, go). Advanced settings and stats stay discoverable but not noisy.
5. **Respect the medium:** The product is often a thin shell around the browser’s own UI; align copy and affordances with how search engines and address bars actually work.

## Accessibility & Inclusion

Target WCAG 2.2 Level AA for primary reading and interactive surfaces where feasible. Support keyboard paths for settings and navigation, visible focus, and sufficient contrast in both themes. Honor `prefers-reduced-motion` for nonessential animation. Avoid relying on color alone for state in stats and settings. Copy should remain readable for non-native English speakers: short sentences, concrete verbs, minimal idioms.
