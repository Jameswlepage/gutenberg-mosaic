/**
 * WordPress dependencies
 */
import { executeAbility, getAbilities, getAbility } from '@wordpress/abilities';

/**
 * Internal dependencies
 */
import {
	createAbilitiesWebMcpTools,
	doesAbilityMatchWpContext,
	getAbilityConfirmationLevel,
	getWordPressWebMcpContext,
	isAbilityPublicForAgents,
	registerAbilitiesWebMCPAdapter,
} from '../';

jest.mock( '@wordpress/abilities', () => ( {
	executeAbility: jest.fn(),
	getAbilities: jest.fn(),
	getAbility: jest.fn(),
} ) );

const PUBLIC_ABILITY = {
	name: 'test/public',
	label: 'Public ability',
	description: 'Public ability description',
	category: 'test',
	meta: {
		mcp: {
			public: true,
		},
	},
};

const PRIVATE_ABILITY = {
	name: 'test/private',
	label: 'Private ability',
	description: 'Private ability description',
	category: 'test',
	meta: {},
};

const CONTEXT_RESTRICTED_ABILITY = {
	name: 'test/context-restricted',
	label: 'Context-restricted ability',
	description: 'Context-restricted ability description',
	category: 'test',
	meta: {
		mcp: {
			public: true,
			context: {
				screens: [ 'post' ],
				postTypes: [ 'post' ],
				query: {
					post: [ '123' ],
				},
			},
		},
	},
};

describe( 'isAbilityPublicForAgents', () => {
	it( 'returns true when ability is marked as mcp public', () => {
		expect( isAbilityPublicForAgents( PUBLIC_ABILITY ) ).toBe( true );
	} );

	it( 'returns false for non-public abilities', () => {
		expect( isAbilityPublicForAgents( PRIVATE_ABILITY ) ).toBe( false );
	} );
} );

describe( 'getAbilityConfirmationLevel', () => {
	it( 'returns none for readonly abilities', () => {
		expect(
			getAbilityConfirmationLevel( {
				meta: {
					annotations: {
						readonly: true,
					},
				},
			} )
		).toBe( 'none' );
	} );

	it( 'returns destructive for destructive abilities', () => {
		expect(
			getAbilityConfirmationLevel( {
				meta: {
					annotations: {
						destructive: true,
					},
				},
			} )
		).toBe( 'destructive' );
	} );

	it( 'returns default for mutating non-destructive abilities', () => {
		expect(
			getAbilityConfirmationLevel( {
				meta: {
					annotations: {},
				},
			} )
		).toBe( 'default' );
	} );
} );

describe( 'doesAbilityMatchWpContext', () => {
	it( 'returns true when no context rules are defined', () => {
		expect(
			doesAbilityMatchWpContext( PUBLIC_ABILITY, {
				screen: 'dashboard',
				adminPage: 'toplevel_page_wp',
				postType: 'page',
				query: {},
			} )
		).toBe( true );
	} );

	it( 'returns true when screen, post type, and query match', () => {
		expect(
			doesAbilityMatchWpContext( CONTEXT_RESTRICTED_ABILITY, {
				screen: 'post',
				postType: 'post',
				query: {
					post: '123',
				},
			} )
		).toBe( true );
	} );

	it( 'returns false when screen does not match', () => {
		expect(
			doesAbilityMatchWpContext( CONTEXT_RESTRICTED_ABILITY, {
				screen: 'site-editor',
				postType: 'post',
				query: {
					post: '123',
				},
			} )
		).toBe( false );
	} );
} );

describe( 'getWordPressWebMcpContext', () => {
	const originalPagenow = globalThis.pagenow;
	const originalAdminpage = globalThis.adminpage;
	const originalTypenow = globalThis.typenow;

	beforeEach( () => {
		globalThis.pagenow = 'post';
		globalThis.adminpage = 'post-php';
		globalThis.typenow = 'post';
		window.history.replaceState( {}, '', '?post=123&foo=bar' );
	} );

	afterAll( () => {
		globalThis.pagenow = originalPagenow;
		globalThis.adminpage = originalAdminpage;
		globalThis.typenow = originalTypenow;
		window.history.replaceState( {}, '', '/' );
	} );

	it( 'returns context values from WP globals and query vars', () => {
		expect( getWordPressWebMcpContext() ).toEqual( {
			screen: 'post',
			adminPage: 'post-php',
			postType: 'post',
			query: {
				post: '123',
				foo: 'bar',
			},
		} );
	} );
} );

describe( 'createAbilitiesWebMcpTools', () => {
	beforeEach( () => {
		jest.clearAllMocks();
	} );

	it( 'discovers only exposed abilities by default', () => {
		getAbilities.mockReturnValue( [ PUBLIC_ABILITY, PRIVATE_ABILITY ] );
		const [ discoverTool ] = createAbilitiesWebMcpTools();

		const result = discoverTool.execute();
		const discovered = JSON.parse( result.content[ 0 ].text );

		expect( discovered ).toEqual( [
			{
				name: PUBLIC_ABILITY.name,
				label: PUBLIC_ABILITY.label,
				description: PUBLIC_ABILITY.description,
				category: PUBLIC_ABILITY.category,
			},
		] );
	} );

	it( 'returns full ability info for exposed abilities', () => {
		getAbility.mockReturnValue( PUBLIC_ABILITY );
		const tools = createAbilitiesWebMcpTools();
		const infoTool = tools[ 1 ];

		const result = infoTool.execute( {
			name: PUBLIC_ABILITY.name,
		} );
		const payload = JSON.parse( result.content[ 0 ].text );

		expect( payload.name ).toBe( PUBLIC_ABILITY.name );
		expect( payload.meta ).toEqual( PUBLIC_ABILITY.meta );
	} );

	it( 'rejects info for private abilities', () => {
		getAbility.mockReturnValue( PRIVATE_ABILITY );
		const tools = createAbilitiesWebMcpTools();
		const infoTool = tools[ 1 ];

		expect( () =>
			infoTool.execute( {
				name: PRIVATE_ABILITY.name,
			} )
		).toThrow(
			`Ability is not exposed to agents: ${ PRIVATE_ABILITY.name }`
		);
	} );

	it( 'filters abilities by WP context in discover tool', () => {
		getAbilities.mockReturnValue( [
			PUBLIC_ABILITY,
			CONTEXT_RESTRICTED_ABILITY,
		] );
		const [ discoverTool ] = createAbilitiesWebMcpTools( {
			getWpContext: () => ( {
				screen: 'dashboard',
				postType: 'page',
				query: {},
			} ),
		} );

		const result = discoverTool.execute();
		const discovered = JSON.parse( result.content[ 0 ].text );

		expect( discovered ).toEqual( [
			{
				name: PUBLIC_ABILITY.name,
				label: PUBLIC_ABILITY.label,
				description: PUBLIC_ABILITY.description,
				category: PUBLIC_ABILITY.category,
			},
		] );
	} );

	it( 'rejects info when context-restricted ability does not match page context', () => {
		getAbility.mockReturnValue( CONTEXT_RESTRICTED_ABILITY );
		const tools = createAbilitiesWebMcpTools( {
			getWpContext: () => ( {
				screen: 'dashboard',
				postType: 'page',
				query: {},
			} ),
		} );
		const infoTool = tools[ 1 ];

		expect( () =>
			infoTool.execute( {
				name: CONTEXT_RESTRICTED_ABILITY.name,
			} )
		).toThrow(
			`Ability is not exposed to agents: ${ CONTEXT_RESTRICTED_ABILITY.name }`
		);
	} );

	it( 'executes an exposed readonly ability without confirmation', async () => {
		getAbility.mockReturnValue( {
			...PUBLIC_ABILITY,
			meta: {
				...PUBLIC_ABILITY.meta,
				annotations: {
					readonly: true,
				},
			},
		} );
		executeAbility.mockResolvedValue( { ok: true } );
		const requestConfirmation = jest.fn();
		const tools = createAbilitiesWebMcpTools( {
			requestConfirmation,
		} );
		const executeTool = tools[ 2 ];

		const result = await executeTool.execute( {
			name: PUBLIC_ABILITY.name,
			input: {
				postId: 1,
			},
		} );
		const payload = JSON.parse( result.content[ 0 ].text );

		expect( payload ).toEqual( { ok: true } );
		expect( requestConfirmation ).not.toHaveBeenCalled();
		expect( executeAbility ).toHaveBeenCalledWith( PUBLIC_ABILITY.name, {
			postId: 1,
		} );
	} );

	it( 'rejects execution when confirmation callback denies', async () => {
		getAbility.mockReturnValue( PUBLIC_ABILITY );
		const tools = createAbilitiesWebMcpTools( {
			requestConfirmation: jest.fn().mockResolvedValue( false ),
		} );
		const executeTool = tools[ 2 ];

		await expect(
			executeTool.execute( {
				name: PUBLIC_ABILITY.name,
			} )
		).rejects.toThrow( 'Ability execution canceled.' );
		expect( executeAbility ).not.toHaveBeenCalled();
	} );
} );

describe( 'registerAbilitiesWebMCPAdapter', () => {
	it( 'registers tools when a modelContext is provided', () => {
		const modelContext = {
			provideContext: jest.fn(),
		};

		expect(
			registerAbilitiesWebMCPAdapter( {
				modelContext,
			} )
		).toBe( true );
		expect( modelContext.provideContext ).toHaveBeenCalledWith(
			expect.objectContaining( {
				tools: expect.any( Array ),
			} )
		);
	} );

	it( 'returns false when modelContext is unavailable', () => {
		expect(
			registerAbilitiesWebMCPAdapter( {
				modelContext: /** @type {any} */ ( null ),
			} )
		).toBe( false );
	} );
} );
