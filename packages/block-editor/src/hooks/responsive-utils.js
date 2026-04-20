/**
 * Pure helpers for the responsive attribute interceptor. Extracted for unit
 * testing — these functions are the architectural heart of the experiment:
 * wrong diffing = silent data corruption as overrides drift away from base.
 */

export function isPlainObject( value ) {
	return (
		!! value && typeof value === 'object' && value.constructor === Object
	);
}

export function deepEqual( a, b ) {
	if ( a === b ) {
		return true;
	}
	if ( ! isPlainObject( a ) || ! isPlainObject( b ) ) {
		return false;
	}
	const aKeys = Object.keys( a );
	const bKeys = Object.keys( b );
	if ( aKeys.length !== bKeys.length ) {
		return false;
	}
	return aKeys.every( ( key ) => deepEqual( a[ key ], b[ key ] ) );
}

/**
 * Deep merge: `override` wins where defined; primitives and arrays replace
 * wholesale (no element-wise merge for arrays).
 */
export function deepMerge( base, override ) {
	if ( ! isPlainObject( override ) ) {
		return override === undefined ? base : override;
	}
	if ( ! isPlainObject( base ) ) {
		return override;
	}
	const result = { ...base };
	for ( const key of Object.keys( override ) ) {
		result[ key ] = deepMerge( base[ key ], override[ key ] );
	}
	return result;
}

/**
 * Return the subset of `next` that differs from `base`, recursively. Returns
 * `undefined` if the two trees are deeply equal, so callers can treat an
 * undefined return as "nothing to store — inherit base".
 *
 * Keys set to `undefined` in `next` are dropped (reset semantics). Empty
 * subtrees prune — no breadcrumbs left behind in the override store.
 */
export function computeDelta( base, next ) {
	if ( deepEqual( base, next ) ) {
		return undefined;
	}
	if ( ! isPlainObject( next ) || ! isPlainObject( base ) ) {
		return next;
	}
	const result = {};
	for ( const key of Object.keys( next ) ) {
		if ( next[ key ] === undefined ) {
			continue;
		}
		const childDelta = computeDelta( base[ key ], next[ key ] );
		if ( childDelta !== undefined ) {
			result[ key ] = childDelta;
		}
	}
	return Object.keys( result ).length > 0 ? result : undefined;
}

/**
 * Remove a single dot-path from a nested tree. Empty subtrees prune.
 * Non-existent paths are a no-op.
 */
export function removePath( tree, path ) {
	if ( ! tree || ! path ) {
		return tree;
	}
	const [ head, ...rest ] = path.split( '.' );
	if ( rest.length === 0 ) {
		const { [ head ]: _removed, ...remainder } = tree;
		return remainder;
	}
	if ( ! isPlainObject( tree[ head ] ) ) {
		return tree;
	}
	const child = removePath( tree[ head ], rest.join( '.' ) );
	const next = { ...tree, [ head ]: child };
	if ( ! child || Object.keys( child ).length === 0 ) {
		delete next[ head ];
	}
	return next;
}

/**
 * Merge base + a sparse override tree, returning a new tree. Used by the
 * attribute interceptor when presenting `attributes.style` at a non-base
 * breakpoint.
 */
export function applyOverride( base, override ) {
	if ( ! override || Object.keys( override ).length === 0 ) {
		return base ?? {};
	}
	return deepMerge( base ?? {}, override );
}
