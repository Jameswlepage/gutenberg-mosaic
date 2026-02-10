/**
 * External dependencies
 */
import '@wordpress/core-abilities';

/**
 * Internal dependencies
 */
export { registerBlockAbilities, AGENT_CATEGORY } from './block-abilities';
export { registerNoteAbilities } from './note-abilities';
export { registerSearchAbilities } from './search-abilities';
export { registerContentAbilities } from './content-abilities';
export { registerShortcutAbilities } from './shortcut-abilities';
export { registerMediaAbilities } from './media-abilities';
export { registerPatternAbilities } from './pattern-abilities';

import { registerBlockAbilities } from './block-abilities';
import { registerNoteAbilities } from './note-abilities';
import { registerSearchAbilities } from './search-abilities';
import { registerContentAbilities } from './content-abilities';
import { registerShortcutAbilities } from './shortcut-abilities';
import { registerMediaAbilities } from './media-abilities';
import { registerPatternAbilities } from './pattern-abilities';

/**
 * Register all agent abilities with the WordPress Abilities API
 *
 * Call this once during plugin/application initialization to make
 * all agent abilities available for the Gemini Live bridge.
 */
export function registerAllAgentAbilities(): void {
	registerBlockAbilities();
	registerNoteAbilities();
	registerSearchAbilities();
	registerContentAbilities();
	registerShortcutAbilities();
	registerMediaAbilities();
	registerPatternAbilities();
}
