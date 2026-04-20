/**
 * Internal dependencies
 */
import {
	deepEqual,
	deepMerge,
	computeDelta,
	removePath,
	applyOverride,
} from '../responsive-utils';

describe( 'responsive-utils', () => {
	describe( 'deepEqual', () => {
		it( 'returns true for identical primitives', () => {
			expect( deepEqual( 'x', 'x' ) ).toBe( true );
			expect( deepEqual( 42, 42 ) ).toBe( true );
			expect( deepEqual( null, null ) ).toBe( true );
		} );

		it( 'returns false across types', () => {
			expect( deepEqual( '14px', 14 ) ).toBe( false );
			expect( deepEqual( {}, null ) ).toBe( false );
		} );

		it( 'compares nested objects structurally', () => {
			const a = { typography: { fontSize: '14px' } };
			const b = { typography: { fontSize: '14px' } };
			expect( deepEqual( a, b ) ).toBe( true );
		} );

		it( 'detects differing keys in either tree', () => {
			expect(
				deepEqual( { a: 1 }, { a: 1, b: 2 } )
			).toBe( false );
			expect(
				deepEqual( { a: 1, b: 2 }, { a: 1 } )
			).toBe( false );
		} );
	} );

	describe( 'deepMerge', () => {
		it( 'returns override when base is not an object', () => {
			expect( deepMerge( null, { a: 1 } ) ).toEqual( { a: 1 } );
			expect( deepMerge( 'old', { a: 1 } ) ).toEqual( { a: 1 } );
		} );

		it( 'returns base for undefined override', () => {
			expect( deepMerge( { a: 1 }, undefined ) ).toEqual( { a: 1 } );
		} );

		it( 'override keys win over base keys', () => {
			expect(
				deepMerge(
					{ typography: { fontSize: '18px', lineHeight: '1.5' } },
					{ typography: { fontSize: '14px' } }
				)
			).toEqual( {
				typography: { fontSize: '14px', lineHeight: '1.5' },
			} );
		} );

		it( 'preserves unchanged branches from base', () => {
			expect(
				deepMerge(
					{ typography: { fontSize: '18px' }, spacing: { padding: '20px' } },
					{ spacing: { padding: '10px' } }
				)
			).toEqual( {
				typography: { fontSize: '18px' },
				spacing: { padding: '10px' },
			} );
		} );

		it( 'does not mutate base', () => {
			const base = { typography: { fontSize: '18px' } };
			const override = { typography: { fontSize: '14px' } };
			deepMerge( base, override );
			expect( base.typography.fontSize ).toBe( '18px' );
		} );
	} );

	describe( 'computeDelta', () => {
		it( 'returns undefined for deeply equal trees', () => {
			expect(
				computeDelta(
					{ typography: { fontSize: '18px' } },
					{ typography: { fontSize: '18px' } }
				)
			).toBeUndefined();
		} );

		it( 'returns only the changed leaves', () => {
			expect(
				computeDelta(
					{ typography: { fontSize: '18px', lineHeight: '1.5' } },
					{ typography: { fontSize: '14px', lineHeight: '1.5' } }
				)
			).toEqual( { typography: { fontSize: '14px' } } );
		} );

		it( 'drops undefined keys (reset semantics)', () => {
			expect(
				computeDelta(
					{ typography: { fontSize: '18px' } },
					{ typography: { fontSize: undefined } }
				)
			).toBeUndefined();
		} );

		it( 'prunes empty subtrees back up to undefined', () => {
			expect(
				computeDelta(
					{ a: { b: { c: 1 } } },
					{ a: { b: { c: undefined } } }
				)
			).toBeUndefined();
		} );

		it( 'treats primitive-vs-object as a full replacement', () => {
			expect(
				computeDelta( 'red', { value: 'blue' } )
			).toEqual( { value: 'blue' } );
		} );

		it( 'preserves added keys not in base', () => {
			expect(
				computeDelta(
					{ typography: { fontSize: '18px' } },
					{
						typography: { fontSize: '18px' },
						spacing: { padding: '10px' },
					}
				)
			).toEqual( { spacing: { padding: '10px' } } );
		} );
	} );

	describe( 'removePath', () => {
		it( 'removes a leaf key', () => {
			expect(
				removePath( { a: 1, b: 2 }, 'a' )
			).toEqual( { b: 2 } );
		} );

		it( 'removes a nested leaf and prunes the now-empty branch', () => {
			expect(
				removePath(
					{ typography: { fontSize: '14px' } },
					'typography.fontSize'
				)
			).toEqual( {} );
		} );

		it( 'leaves siblings intact', () => {
			expect(
				removePath(
					{
						typography: { fontSize: '14px', lineHeight: '1.5' },
					},
					'typography.fontSize'
				)
			).toEqual( { typography: { lineHeight: '1.5' } } );
		} );

		it( 'is a no-op for nonexistent paths', () => {
			const tree = { typography: { fontSize: '14px' } };
			expect(
				removePath( tree, 'spacing.padding' )
			).toEqual( tree );
		} );

		it( 'does not mutate the input tree', () => {
			const tree = { typography: { fontSize: '14px', lineHeight: '1.5' } };
			removePath( tree, 'typography.fontSize' );
			expect( tree.typography.fontSize ).toBe( '14px' );
		} );
	} );

	describe( 'applyOverride', () => {
		it( 'returns base when override is empty', () => {
			expect( applyOverride( { a: 1 }, {} ) ).toEqual( { a: 1 } );
			expect( applyOverride( { a: 1 }, undefined ) ).toEqual( { a: 1 } );
		} );

		it( 'merges like deepMerge when override is non-empty', () => {
			expect(
				applyOverride(
					{ typography: { fontSize: '18px' } },
					{ typography: { fontSize: '14px' } }
				)
			).toEqual( { typography: { fontSize: '14px' } } );
		} );
	} );
} );
