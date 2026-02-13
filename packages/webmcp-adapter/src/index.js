/**
 * WordPress dependencies
 */
import { executeAbility, getAbilities, getAbility } from '@wordpress/abilities';

/**
 * @typedef {import('@wordpress/abilities').Ability} Ability
 */

/**
 * @typedef {Record<string, string>} WordPressQueryVars
 */

/**
 * @typedef {{
 *  screen?: string,
 *  adminPage?: string,
 *  postType?: string,
 *  query: WordPressQueryVars,
 * }} WordPressWebMcpContext
 */

/**
 * @typedef {{
 *  screens?: string | string[],
 *  adminPages?: string | string[],
 *  postTypes?: string | string[],
 *  query?: Record<string, string | string[]>,
 * }} AbilityWebMcpContextRules
 */

/**
 * @typedef {{
 *  content: Array<{ type: string, text: string }>,
 * }} WebMcpToolResult
 */

/**
 * @typedef {{
 *  name: string,
 *  description: string,
 *  inputSchema: Record<string, any>,
 *  execute: (input?: Record<string, any>, agent?: WebMcpAgent) => any,
 * }} WebMcpTool
 */

/**
 * @typedef {{
 *  requestUserInteraction?: (callback: () => boolean | Promise<boolean>) => Promise<boolean>,
 * }} WebMcpAgent
 */

/**
 * @typedef {{
 *  provideContext: (context: { tools: WebMcpTool[] }) => void,
 * }} WebMcpModelContext
 */

/**
 * @typedef {'none' | 'default' | 'destructive'} ConfirmationLevel
 */

/**
 * @typedef {{
 *  discover: string,
 *  info: string,
 *  execute: string,
 * }} WebMcpToolNames
 */

/**
 * @typedef {{
 *  ability: Ability,
 *  agent: WebMcpAgent | undefined,
 *  confirmationLevel: ConfirmationLevel,
 * }} RequestConfirmationContext
 */

/**
 * @typedef {{
 *  isAbilityExposed?: (ability: Ability, wpContext: WordPressWebMcpContext) => boolean,
 *  requestConfirmation?: (context: RequestConfirmationContext) => boolean | Promise<boolean>,
 *  toolNames?: Partial<WebMcpToolNames>,
 *  getWpContext?: () => WordPressWebMcpContext,
 *  modelContext?: WebMcpModelContext,
 * }} RegisterAbilitiesWebMcpAdapterOptions
 */

/**
 * Default layered tool names.
 *
 * @type {WebMcpToolNames}
 */
export const DEFAULT_WEB_MCP_TOOL_NAMES = {
	discover: 'wp-discover-abilities',
	info: 'wp-get-ability-info',
	execute: 'wp-execute-ability',
};

/**
 * Returns a normalized array of strings.
 *
 * @param {unknown} value Candidate value.
 * @return {string[]} String array.
 */
function normalizeStringArray( value ) {
	if ( typeof value === 'string' && value ) {
		return [ value ];
	}

	if ( Array.isArray( value ) ) {
		return value.filter(
			( item ) => typeof item === 'string' && Boolean( item )
		);
	}

	return [];
}

/**
 * Converts any value to text content expected by WebMCP tool responses.
 *
 * @param {any} value Response payload.
 * @return {WebMcpToolResult} Tool result.
 */
function toTextContentResult( value ) {
	let text;
	if ( typeof value === 'string' ) {
		text = value;
	} else {
		try {
			text = JSON.stringify( value, null, 2 );
		} catch {
			text = String( value );
		}
	}

	return {
		content: [ { type: 'text', text } ],
	};
}

/**
 * Returns an object when the value is a plain object, otherwise an empty object.
 *
 * @param {unknown} value Candidate object.
 * @return {Record<string, any>} Safe object.
 */
function asObject( value ) {
	if ( value && typeof value === 'object' && ! Array.isArray( value ) ) {
		return /** @type {Record<string, any>} */ ( value );
	}
	return {};
}

/**
 * Returns query vars from the current location.
 *
 * @return {WordPressQueryVars} Query vars.
 */
function getQueryVarsFromLocation() {
	const query = {};
	const search = globalThis?.location?.search;

	if ( typeof search !== 'string' || ! search ) {
		return query;
	}

	const params = new URLSearchParams( search );
	params.forEach( ( value, key ) => {
		if ( typeof value === 'string' ) {
			query[ key ] = value;
		}
	} );

	return query;
}

/**
 * Returns WordPress context variables available in the current page.
 *
 * @return {WordPressWebMcpContext} Current WP context.
 */
export function getWordPressWebMcpContext() {
	const query = getQueryVarsFromLocation();
	const globalPostType =
		typeof globalThis.typenow === 'string' ? globalThis.typenow : undefined;
	const queryPostType =
		query.postType || query.post_type || query.post_type_name;

	return {
		screen:
			typeof globalThis.pagenow === 'string'
				? globalThis.pagenow
				: undefined,
		adminPage:
			typeof globalThis.adminpage === 'string'
				? globalThis.adminpage
				: undefined,
		postType: globalPostType || queryPostType,
		query,
	};
}

/**
 * Returns true when `ability.meta.mcp.context` rules match the WP context.
 *
 * @param {Ability | undefined}    ability   Ability definition.
 * @param {WordPressWebMcpContext} wpContext Current WP context.
 * @return {boolean} Whether the ability matches the context.
 */
export function doesAbilityMatchWpContext( ability, wpContext ) {
	const contextRules = /** @type {AbilityWebMcpContextRules} */ (
		asObject( ability?.meta?.mcp?.context )
	);

	const allowedScreens = normalizeStringArray( contextRules.screens );
	if (
		allowedScreens.length > 0 &&
		( typeof wpContext.screen !== 'string' ||
			! allowedScreens.includes( wpContext.screen ) )
	) {
		return false;
	}

	const allowedAdminPages = normalizeStringArray( contextRules.adminPages );
	if (
		allowedAdminPages.length > 0 &&
		( typeof wpContext.adminPage !== 'string' ||
			! allowedAdminPages.includes( wpContext.adminPage ) )
	) {
		return false;
	}

	const allowedPostTypes = normalizeStringArray( contextRules.postTypes );
	if (
		allowedPostTypes.length > 0 &&
		( typeof wpContext.postType !== 'string' ||
			! allowedPostTypes.includes( wpContext.postType ) )
	) {
		return false;
	}

	const queryRules = asObject( contextRules.query );
	const queryKeys = Object.keys( queryRules );

	for ( const key of queryKeys ) {
		const allowedValues = normalizeStringArray( queryRules[ key ] );
		if ( allowedValues.length === 0 ) {
			continue;
		}

		if (
			typeof wpContext.query?.[ key ] !== 'string' ||
			! allowedValues.includes( wpContext.query[ key ] )
		) {
			return false;
		}
	}

	return true;
}

/**
 * Returns true when an ability is marked as public for MCP exposure.
 *
 * @param {Ability | undefined} ability Ability definition.
 * @return {boolean} Whether the ability is public for agents.
 */
export function isAbilityPublicForAgents( ability ) {
	return Boolean( ability?.meta?.mcp?.public );
}

/**
 * Returns the confirmation level for an ability.
 *
 * @param {Ability | undefined} ability Ability definition.
 * @return {ConfirmationLevel} Required confirmation level.
 */
export function getAbilityConfirmationLevel( ability ) {
	if ( ability?.meta?.annotations?.readonly ) {
		return 'none';
	}

	if ( ability?.meta?.annotations?.destructive ) {
		return 'destructive';
	}

	return 'default';
}

/**
 * Default confirmation strategy for mutating abilities.
 *
 * Uses WebMCP `agent.requestUserInteraction` and a browser confirm flow.
 *
 * @param {RequestConfirmationContext} context Confirmation request details.
 * @return {Promise<boolean>} Whether execution is approved.
 */
async function defaultRequestConfirmation( context ) {
	const { ability, agent, confirmationLevel } = context;

	if ( confirmationLevel === 'none' ) {
		return true;
	}

	if ( typeof window === 'undefined' ) {
		return false;
	}

	if ( typeof agent?.requestUserInteraction !== 'function' ) {
		return false;
	}

	const label = ability.label || ability.name;
	const description = ability.description
		? `\n\n${ ability.description }`
		: '';

	if ( confirmationLevel === 'destructive' ) {
		const destructiveMessage = `Allow destructive ability execution?\n\n${ label }${ description }`;
		const secondPrompt =
			'This ability is marked destructive. Confirm again to continue.';

		return agent.requestUserInteraction( () => {
			// eslint-disable-next-line no-alert
			const firstConfirmation = window.confirm( destructiveMessage );
			if ( ! firstConfirmation ) {
				return false;
			}
			// eslint-disable-next-line no-alert
			return window.confirm( secondPrompt );
		} );
	}

	return agent.requestUserInteraction( () => {
		// eslint-disable-next-line no-alert
		return window.confirm(
			`Allow the agent to run this ability?\n\n${ label }${ description }`
		);
	} );
}

/**
 * Normalizes and validates an ability name input.
 *
 * @param {unknown} nameValue Ability name input.
 * @return {string} Ability name.
 */
function parseAbilityName( nameValue ) {
	if ( typeof nameValue !== 'string' || ! nameValue ) {
		throw new Error(
			'Ability name is required and must be a non-empty string.'
		);
	}

	return nameValue;
}

/**
 * Returns merged tool names.
 *
 * @param {Partial<WebMcpToolNames> | undefined} toolNames Tool name overrides.
 * @return {WebMcpToolNames} Final tool names.
 */
function getToolNames( toolNames ) {
	return {
		...DEFAULT_WEB_MCP_TOOL_NAMES,
		...toolNames,
	};
}

/**
 * Creates the layered WebMCP tools for abilities.
 *
 * @param {RegisterAbilitiesWebMcpAdapterOptions} [options] Adapter options.
 * @return {WebMcpTool[]} Tool definitions.
 */
export function createAbilitiesWebMcpTools( options = {} ) {
	const {
		isAbilityExposed = ( ability, wpContext ) =>
			isAbilityPublicForAgents( ability ) &&
			doesAbilityMatchWpContext( ability, wpContext ),
		requestConfirmation = defaultRequestConfirmation,
		toolNames: toolNameOverrides,
		getWpContext = getWordPressWebMcpContext,
	} = options;

	const toolNames = getToolNames( toolNameOverrides );

	/**
	 * Resolves and validates an ability for WebMCP access.
	 *
	 * @param {unknown}                abilityName Ability name.
	 * @param {WordPressWebMcpContext} wpContext   Current WP context.
	 * @return {Ability} Resolved ability.
	 */
	const resolveAbility = ( abilityName, wpContext ) => {
		const name = parseAbilityName( abilityName );
		const ability = getAbility( name );
		if ( ! ability ) {
			throw new Error( `Ability not found: ${ name }` );
		}
		if ( ! isAbilityExposed( ability, wpContext ) ) {
			throw new Error( `Ability is not exposed to agents: ${ name }` );
		}
		return ability;
	};

	return [
		{
			name: toolNames.discover,
			description:
				'List abilities available in this WordPress context for agents.',
			inputSchema: {
				type: 'object',
				properties: {
					category: {
						type: 'string',
						description: 'Optional ability category filter.',
					},
					publicOnly: {
						type: 'boolean',
						description:
							'Whether to filter results to agent-exposed abilities.',
					},
				},
				additionalProperties: false,
			},
			execute: ( rawInput = {} ) => {
				const input = asObject( rawInput );
				const wpContext = getWpContext();
				const { category, publicOnly = true } = input;
				const queryArgs =
					typeof category === 'string' && category
						? { category }
						: undefined;
				const abilities = getAbilities( queryArgs );
				const filteredAbilities = publicOnly
					? abilities.filter( ( ability ) =>
							isAbilityExposed( ability, wpContext )
					  )
					: abilities;

				return toTextContentResult(
					filteredAbilities.map( ( ability ) => ( {
						name: ability.name,
						label: ability.label,
						description: ability.description,
						category: ability.category,
					} ) )
				);
			},
		},
		{
			name: toolNames.info,
			description: 'Get schema and metadata for an ability by name.',
			inputSchema: {
				type: 'object',
				properties: {
					name: {
						type: 'string',
						description:
							'Ability name in namespace/ability format.',
					},
				},
				required: [ 'name' ],
				additionalProperties: false,
			},
			execute: ( rawInput = {} ) => {
				const input = asObject( rawInput );
				const wpContext = getWpContext();
				const ability = resolveAbility( input.name, wpContext );

				return toTextContentResult( {
					name: ability.name,
					label: ability.label,
					description: ability.description,
					category: ability.category,
					input_schema: ability.input_schema,
					output_schema: ability.output_schema,
					meta: ability.meta,
				} );
			},
		},
		{
			name: toolNames.execute,
			description: 'Execute an ability by name with optional JSON input.',
			inputSchema: {
				type: 'object',
				properties: {
					name: {
						type: 'string',
						description:
							'Ability name in namespace/ability format.',
					},
					input: {
						description: 'Ability input payload.',
						type: [
							'object',
							'array',
							'string',
							'number',
							'boolean',
							'null',
						],
					},
				},
				required: [ 'name' ],
				additionalProperties: false,
			},
			execute: async ( rawInput = {}, agent ) => {
				const input = asObject( rawInput );
				const wpContext = getWpContext();
				const ability = resolveAbility( input.name, wpContext );
				const confirmationLevel =
					getAbilityConfirmationLevel( ability );
				let isConfirmed = true;

				if ( confirmationLevel !== 'none' ) {
					isConfirmed = await requestConfirmation( {
						ability,
						agent,
						confirmationLevel,
					} );
				}

				if ( ! isConfirmed ) {
					throw new Error( 'Ability execution canceled.' );
				}

				const result = await executeAbility(
					ability.name,
					input.input
				);
				return toTextContentResult( result );
			},
		},
	];
}

/**
 * Registers the abilities WebMCP tools with `navigator.modelContext`.
 *
 * Returns `false` when WebMCP is unavailable in the current browser.
 *
 * @param {RegisterAbilitiesWebMcpAdapterOptions} [options] Adapter options.
 * @return {boolean} True when tools were registered.
 */
export function registerAbilitiesWebMCPAdapter( options = {} ) {
	const modelContext =
		options.modelContext || globalThis?.navigator?.modelContext;

	if ( ! modelContext || typeof modelContext.provideContext !== 'function' ) {
		return false;
	}

	modelContext.provideContext( {
		tools: createAbilitiesWebMcpTools( options ),
	} );

	return true;
}

registerAbilitiesWebMCPAdapter();
