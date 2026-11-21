# Interactive cards provenance

The six maintained React/TypeScript cards in `source-registry/ui/cards/` are `imessage-chat`, `calendar-day-card`, `balance-bar-chart-card`, `liquid-glass-sheet`, `day-trading-order-ticket`, and `voice-assistant-card`. Their maintainers assert co-development and redistribution rights. Preserve the MIT and per-file license notices when copying or adapting these components.

The package contains maintained component source and scoped styles rather than the Studio HTML/framework wrappers. Reference photographs remain remote Unsplash URLs; consumers may supply their own avatar/background assets. Reference font files are not bundled. The glass sheet uses its reference remote forest photograph by default and generates its scoped refraction filter locally. Lucide icons retain their declared dependency and license. The voice card uses the original `voice-glow@0.2.1` dependency, whose published npm package declares MIT; it is not proprietary Mova source.

These are reusable UI components with optional callback integration. The trading ticket does not connect to a brokerage; its default submit action creates a local preview. The voice card does not request microphone access, send network requests, or synthesize a real assistant response. It streams a sample transcript locally and accepts optional application callbacks. Image attachments are local object URLs, revoked when changed or unmounted. Clipboard writing occurs only after a user presses a sheet action.

All six use component-scoped styles, explicit light/dark themes, visible keyboard focus, reduced-motion styles, portable source-copy entries, and no application-specific imports or CDN dependencies.
