/**
 * WordPress dependencies
 */
import { select } from '@wordpress/data';
import {
	store as keyboardShortcutsStore,
} from '@wordpress/keyboard-shortcuts';
import { modifiers, isAppleOS } from '@wordpress/keycodes';
import { getAbility, registerAbility } from '@wordpress/abilities';

/**
 * Internal dependencies
 */
import { AGENT_CATEGORY } from './block-abilities';

const DEFAULT_CATEGORIES = [
	'global',
	'main',
	'block',
	'formatting',
	'text',
	'selection',
	'document',
	'list-view',
	'media',
];

function buildCategoryMap( categories: string[] ): Map< string, string > {
	const storeSelect = select( keyboardShortcutsStore );
	const map = new Map< string, string >();

	for ( const category of categories ) {
		const names = storeSelect.getCategoryShortcuts( category );
		for ( const name of names ) {
			if ( ! map.has( name ) ) {
				map.set( name, category );
			}
		}
	}

	return map;
}

function getShortcutDetails( name: string, categoryMap: Map< string, string > ) {
	const storeSelect = select( keyboardShortcutsStore );
	const keyCombination = storeSelect.getShortcutKeyCombination( name );
	const aliases = storeSelect.getShortcutAliases( name );

	return {
		name,
		category: categoryMap.get( name ) || '',
		description: storeSelect.getShortcutDescription( name ) || '',
		keyCombination,
		aliases,
		representation: storeSelect.getShortcutRepresentation( name, 'raw' ),
	};
}

function getKeyMeta( character: string ) {
	const lower = character.toLowerCase();
	const keyCodeMap: Record< string, number > = {
		',': 188,
		'\\': 220,
		'`': 192,
		' ': 32,
	};

	let code = '';
	let keyCode = keyCodeMap[ lower ] ?? 0;

	if ( lower.length === 1 && lower >= 'a' && lower <= 'z' ) {
		code = `Key${ lower.toUpperCase() }`;
		keyCode = lower.toUpperCase().charCodeAt( 0 );
	} else if ( lower.length === 1 && lower >= '0' && lower <= '9' ) {
		code = `Digit${ lower }`;
		keyCode = lower.charCodeAt( 0 );
	} else if ( lower === ',' ) {
		code = 'Comma';
	} else if ( lower === '\\' ) {
		code = 'Backslash';
	} else if ( lower === '`' ) {
		code = 'Backquote';
	} else if ( lower === ' ' ) {
		code = 'Space';
	}

	return { code, keyCode };
}

function dispatchShortcutEvent( combination: {
	modifier?: string;
	character: string;
} ) {
	const modifier = combination?.modifier || 'undefined';
	const keys = modifiers[ modifier ]
		? modifiers[ modifier ]( isAppleOS )
		: [];

	const { code, keyCode } = getKeyMeta( combination.character );
	const eventInit: KeyboardEventInit = {
		key: combination.character,
		code: code || undefined,
		keyCode,
		which: keyCode,
		bubbles: true,
		cancelable: true,
		ctrlKey: keys.includes( 'ctrl' ),
		shiftKey: keys.includes( 'shift' ),
		altKey: keys.includes( 'alt' ),
		metaKey: keys.includes( 'meta' ),
	};

	const downEvent = new KeyboardEvent( 'keydown', eventInit );
	document.dispatchEvent( downEvent );

	const upEvent = new KeyboardEvent( 'keyup', eventInit );
	document.dispatchEvent( upEvent );
}

/**
 * Register list shortcuts ability
 */
export function registerListShortcutsAbility(): void {
	if ( getAbility( 'agent/list-shortcuts' ) ) {
		return;
	}

	registerAbility( {
		name: 'agent/list-shortcuts',
		label: 'List Shortcuts',
		description: 'Lists available keyboard shortcuts',
		category: AGENT_CATEGORY,
		input_schema: {
			type: 'object',
			properties: {
				categories: {
					type: 'array',
					items: { type: 'string' },
					description:
						'Shortcut categories to include (default: common editor categories)',
				},
				names: {
					type: 'array',
					items: { type: 'string' },
					description: 'Specific shortcut names to describe',
				},
			},
		},
		output_schema: {
			type: 'object',
			properties: {
				shortcuts: {
					type: 'array',
					items: {
						type: 'object',
						properties: {
							name: { type: 'string' },
							category: { type: 'string' },
							description: { type: 'string' },
							representation: { type: 'string' },
						},
					},
				},
			},
		},
		meta: {
			annotations: {
				readonly: true,
				idempotent: true,
			},
		},
		callback: async ( input: {
			categories?: string[];
			names?: string[];
		} ) => {
			const categories =
				input.categories && input.categories.length > 0
					? input.categories
					: DEFAULT_CATEGORIES;
			const categoryMap = buildCategoryMap( categories );

			const names =
				input.names && input.names.length > 0
					? input.names
					: Array.from( categoryMap.keys() );

			return {
				shortcuts: names.map( ( name ) =>
					getShortcutDetails( name, categoryMap )
				),
			};
		},
	} );
}

/**
 * Register run shortcut ability
 */
export function registerRunShortcutAbility(): void {
	if ( getAbility( 'agent/run-shortcut' ) ) {
		return;
	}

	registerAbility( {
		name: 'agent/run-shortcut',
		label: 'Run Shortcut',
		description: 'Runs a registered keyboard shortcut by name',
		category: AGENT_CATEGORY,
		input_schema: {
			type: 'object',
			properties: {
				name: {
					type: 'string',
					description: 'Shortcut name to execute',
				},
				useAlias: {
					type: 'boolean',
					description: 'Use an alias combination if available',
				},
			},
			required: [ 'name' ],
		},
		output_schema: {
			type: 'object',
			properties: {
				success: { type: 'boolean' },
				message: { type: 'string' },
				representation: { type: 'string' },
			},
		},
		meta: {
			annotations: {
				destructive: false,
				idempotent: false,
			},
		},
		callback: async ( input: { name: string; useAlias?: boolean } ) => {
			const storeSelect = select( keyboardShortcutsStore );
			const combos = storeSelect.getAllShortcutKeyCombinations(
				input.name
			);

			if ( ! combos || combos.length === 0 ) {
				return {
					success: false,
					message: 'Shortcut not found.',
					representation: '',
				};
			}

			const combo =
				input.useAlias && combos.length > 1 ? combos[ 1 ] : combos[ 0 ];

			if ( ! combo ) {
				return {
					success: false,
					message: 'Shortcut has no key combination.',
					representation: '',
				};
			}

			dispatchShortcutEvent( combo );

			return {
				success: true,
				message: 'Shortcut dispatched.',
				representation: storeSelect.getShortcutRepresentation(
					input.name,
					'raw'
				),
			};
		},
	} );
}

/**
 * Register toggle list view ability
 */
/**
 * Register all shortcut abilities
 */
export function registerShortcutAbilities(): void {
	registerListShortcutsAbility();
	registerRunShortcutAbility();
}
