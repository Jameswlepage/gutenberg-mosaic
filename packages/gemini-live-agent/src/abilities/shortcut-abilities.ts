/**
 * WordPress dependencies
 */
import { select } from '@wordpress/data';
// @ts-expect-error No type declarations for keyboard-shortcuts.
import { store as keyboardShortcutsStore } from '@wordpress/keyboard-shortcuts';
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
	const modifierFn = ( modifiers as Record< string, ( ( _isApple: () => boolean ) => string[] ) | undefined > )[ modifier ];
	const keys = modifierFn
		? modifierFn( isAppleOS )
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

function runShortcutByName( name: string ) {
	const storeSelect = select( keyboardShortcutsStore );
	const combos = storeSelect.getAllShortcutKeyCombinations( name );

	if ( ! combos || combos.length === 0 || ! combos[ 0 ] ) {
		return {
			success: false,
			message: 'Shortcut not found.',
			representation: '',
		};
	}

	dispatchShortcutEvent( combos[ 0 ] );

	return {
		success: true,
		message: 'Shortcut dispatched.',
		representation: storeSelect.getShortcutRepresentation( name, 'raw' ),
	};
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
		description:
			'Lists editor UI actions (save, undo, redo, toggle panels, formatting, etc.) you can execute via agent/run-shortcut. Call this first to discover shortcut names.',
		category: AGENT_CATEGORY,
		input_schema: {
			type: 'object',
			properties: {
				categories: {
					type: 'array',
					items: { type: 'string' },
					description:
						'Filter by category. Options: global, main, block, formatting, text, selection, document, list-view, media. Omit to get all.',
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
		description:
			'Triggers an editor UI action by name — save, undo/redo, toggle sidebar/list-view, bold/italic, duplicate/remove block, etc. Use agent/list-shortcuts to find names.',
		category: AGENT_CATEGORY,
		input_schema: {
			type: 'object',
			properties: {
				name: {
					type: 'string',
					description:
						'Shortcut name, e.g. "core/editor/save", "core/editor/undo". Use agent/list-shortcuts to discover names.',
				},
				useAlias: {
					type: 'boolean',
					description: 'Use an alias key combination if available',
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
 * Register undo ability
 */
export function registerUndoAbility(): void {
	if ( getAbility( 'agent/undo' ) ) {
		return;
	}

	registerAbility( {
		name: 'agent/undo',
		label: 'Undo',
		description:
			'Undo one or more editor changes. For older changes, use list-post-revisions and restore-post-revision.',
		category: AGENT_CATEGORY,
		input_schema: {
			type: 'object',
			properties: {
				steps: {
					type: 'integer',
					description: 'Number of undo steps (default 1, max 20)',
				},
			},
		},
		output_schema: {
			type: 'object',
			properties: {
				success: { type: 'boolean' },
				message: { type: 'string' },
				steps: { type: 'integer' },
			},
		},
		meta: {
			annotations: {
				destructive: false,
				idempotent: false,
			},
		},
		callback: async ( input: { steps?: number } ) => {
			const steps = Math.min( Math.max( input.steps || 1, 1 ), 20 );
			let completed = 0;

			for ( let i = 0; i < steps; i++ ) {
				const result = runShortcutByName( 'core/editor/undo' );
				if ( ! result.success ) {
					break;
				}
				completed++;
			}

			if ( completed === 0 ) {
				return {
					success: false,
					message: 'Unable to undo.',
					steps: 0,
				};
			}

			return {
				success: true,
				message:
					completed === 1
						? 'Undo completed.'
						: `Undo completed for ${ completed } steps.`,
				steps: completed,
			};
		},
	} );
}

/**
 * Register redo ability
 */
export function registerRedoAbility(): void {
	if ( getAbility( 'agent/redo' ) ) {
		return;
	}

	registerAbility( {
		name: 'agent/redo',
		label: 'Redo',
		description: 'Redo one or more editor changes after undo.',
		category: AGENT_CATEGORY,
		input_schema: {
			type: 'object',
			properties: {
				steps: {
					type: 'integer',
					description: 'Number of redo steps (default 1, max 20)',
				},
			},
		},
		output_schema: {
			type: 'object',
			properties: {
				success: { type: 'boolean' },
				message: { type: 'string' },
				steps: { type: 'integer' },
			},
		},
		meta: {
			annotations: {
				destructive: false,
				idempotent: false,
			},
		},
		callback: async ( input: { steps?: number } ) => {
			const steps = Math.min( Math.max( input.steps || 1, 1 ), 20 );
			let completed = 0;

			for ( let i = 0; i < steps; i++ ) {
				const result = runShortcutByName( 'core/editor/redo' );
				if ( ! result.success ) {
					break;
				}
				completed++;
			}

			if ( completed === 0 ) {
				return {
					success: false,
					message: 'Unable to redo.',
					steps: 0,
				};
			}

			return {
				success: true,
				message:
					completed === 1
						? 'Redo completed.'
						: `Redo completed for ${ completed } steps.`,
				steps: completed,
			};
		},
	} );
}

/**
 * Register all shortcut abilities
 */
export function registerShortcutAbilities(): void {
	registerListShortcutsAbility();
	registerRunShortcutAbility();
	registerUndoAbility();
	registerRedoAbility();
}
