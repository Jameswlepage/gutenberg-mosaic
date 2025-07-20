/**
 * WordPress dependencies
 */
import { createReduxStore, register, createSelector } from '@wordpress/data';

/**
 * Internal dependencies
 */
import { STORE_NAME } from './constants';

/**
 * Initial state for the suggestions store
 */
const DEFAULT_STATE = {
	suggestions: {},
	mode: 'edit',
	isActive: false,
	pendingChanges: {},
	originalContent: {},
};

/**
 * Reducer for the suggestions store
 */
function suggestionsReducer( state = DEFAULT_STATE, action ) {
	switch ( action.type ) {
		case 'SET_SUGGESTIONS_MODE':
			return {
				...state,
				mode: action.mode,
				isActive: action.mode === 'suggest',
			};

		case 'ADD_SUGGESTION':
			return {
				...state,
				suggestions: {
					...state.suggestions,
					[ action.blockClientId ]: {
						...state.suggestions[ action.blockClientId ],
						[ action.suggestionId ]: action.suggestion,
					},
				},
			};

		case 'UPDATE_SUGGESTION':
			return {
				...state,
				suggestions: {
					...state.suggestions,
					[ action.blockClientId ]: {
						...state.suggestions[ action.blockClientId ],
						[ action.suggestionId ]: {
							...state.suggestions[ action.blockClientId ]?.[ action.suggestionId ],
							...action.updates,
						},
					},
				},
			};

		case 'REMOVE_SUGGESTION':
			const blockSuggestions = { ...state.suggestions[ action.blockClientId ] };
			delete blockSuggestions[ action.suggestionId ];
			
			return {
				...state,
				suggestions: {
					...state.suggestions,
					[ action.blockClientId ]: blockSuggestions,
				},
			};

		case 'SET_PENDING_CHANGE':
			return {
				...state,
				pendingChanges: {
					...state.pendingChanges,
					[ action.blockClientId ]: action.change,
				},
			};

		case 'CLEAR_PENDING_CHANGE':
			const pendingChanges = { ...state.pendingChanges };
			delete pendingChanges[ action.blockClientId ];
			
			return {
				...state,
				pendingChanges,
			};

		case 'SET_ORIGINAL_CONTENT':
			return {
				...state,
				originalContent: {
					...state.originalContent,
					[ action.blockClientId ]: action.content,
				},
			};

		case 'CLEAR_ORIGINAL_CONTENT':
			const originalContent = { ...state.originalContent };
			delete originalContent[ action.blockClientId ];
			
			return {
				...state,
				originalContent,
			};

		case 'ACCEPT_SUGGESTION':
			const acceptedSuggestion = state.suggestions[ action.blockClientId ]?.[ action.suggestionId ];
			if ( ! acceptedSuggestion ) {
				return state;
			}

			const updatedSuggestions = { ...state.suggestions };
			const blockSuggestionsAfterAccept = { ...updatedSuggestions[ action.blockClientId ] };
			delete blockSuggestionsAfterAccept[ action.suggestionId ];
			updatedSuggestions[ action.blockClientId ] = blockSuggestionsAfterAccept;

			return {
				...state,
				suggestions: updatedSuggestions,
			};

		case 'REJECT_SUGGESTION':
			const rejectedSuggestion = state.suggestions[ action.blockClientId ]?.[ action.suggestionId ];
			if ( ! rejectedSuggestion ) {
				return state;
			}

			const suggestionsAfterReject = { ...state.suggestions };
			const blockSuggestionsAfterReject = { ...suggestionsAfterReject[ action.blockClientId ] };
			delete blockSuggestionsAfterReject[ action.suggestionId ];
			suggestionsAfterReject[ action.blockClientId ] = blockSuggestionsAfterReject;

			return {
				...state,
				suggestions: suggestionsAfterReject,
			};

		case 'CLEAR_ALL_SUGGESTIONS':
			return {
				...state,
				suggestions: {},
				pendingChanges: {},
				originalContent: {},
			};

		case 'CLEAR_BLOCK_SUGGESTIONS':
			const suggestionsAfterClear = { ...state.suggestions };
			delete suggestionsAfterClear[ action.blockClientId ];

			const pendingChangesAfterClear = { ...state.pendingChanges };
			delete pendingChangesAfterClear[ action.blockClientId ];

			const originalContentAfterClear = { ...state.originalContent };
			delete originalContentAfterClear[ action.blockClientId ];

			return {
				...state,
				suggestions: suggestionsAfterClear,
				pendingChanges: pendingChangesAfterClear,
				originalContent: originalContentAfterClear,
			};

		default:
			return state;
	}
}

/**
 * Action creators
 */
const actions = {
	setSuggestionsMode: ( mode ) => ( {
		type: 'SET_SUGGESTIONS_MODE',
		mode,
	} ),

	addSuggestion: ( blockClientId, suggestionId, suggestion ) => ( {
		type: 'ADD_SUGGESTION',
		blockClientId,
		suggestionId,
		suggestion,
	} ),

	updateSuggestion: ( blockClientId, suggestionId, updates ) => ( {
		type: 'UPDATE_SUGGESTION',
		blockClientId,
		suggestionId,
		updates,
	} ),

	removeSuggestion: ( blockClientId, suggestionId ) => ( {
		type: 'REMOVE_SUGGESTION',
		blockClientId,
		suggestionId,
	} ),

	setPendingChange: ( blockClientId, change ) => ( {
		type: 'SET_PENDING_CHANGE',
		blockClientId,
		change,
	} ),

	clearPendingChange: ( blockClientId ) => ( {
		type: 'CLEAR_PENDING_CHANGE',
		blockClientId,
	} ),

	setOriginalContent: ( blockClientId, content ) => ( {
		type: 'SET_ORIGINAL_CONTENT',
		blockClientId,
		content,
	} ),

	clearOriginalContent: ( blockClientId ) => ( {
		type: 'CLEAR_ORIGINAL_CONTENT',
		blockClientId,
	} ),

	clearAllSuggestions: () => ( {
		type: 'CLEAR_ALL_SUGGESTIONS',
	} ),

	clearBlockSuggestions: ( blockClientId ) => ( {
		type: 'CLEAR_BLOCK_SUGGESTIONS',
		blockClientId,
	} ),

	acceptSuggestion: ( blockClientId, suggestionId ) => ( {
		type: 'ACCEPT_SUGGESTION',
		blockClientId,
		suggestionId,
	} ),

	rejectSuggestion: ( blockClientId, suggestionId ) => ( {
		type: 'REJECT_SUGGESTION',
		blockClientId,
		suggestionId,
	} ),
};

/**
 * Selectors
 */
const selectors = {
	getSuggestionsMode: ( state ) => state.mode,
	
	isSuggestionsActive: ( state ) => state.isActive,

	getSuggestions: ( state ) => state.suggestions,

	getBlockSuggestions: ( state, blockClientId ) => 
		state.suggestions[ blockClientId ] || {},

	getPendingSuggestions: ( state ) => {
		const pending = {};
		Object.keys( state.suggestions ).forEach( blockClientId => {
			const blockSuggestions = state.suggestions[ blockClientId ];
			const pendingSuggestions = Object.keys( blockSuggestions ).filter( 
				suggestionId => blockSuggestions[ suggestionId ].status === 'pending'
			);
			if ( pendingSuggestions.length > 0 ) {
				pending[ blockClientId ] = pendingSuggestions.reduce( ( acc, suggestionId ) => {
					acc[ suggestionId ] = blockSuggestions[ suggestionId ];
					return acc;
				}, {} );
			}
		});
		return pending;
	},

	getBlockPendingSuggestions: createSelector(
		( state, blockClientId ) => {
			const blockSuggestions = state.suggestions[ blockClientId ] || {};
			const pending = {};
			for ( const [ id, suggestion ] of Object.entries( blockSuggestions ) ) {
				if ( suggestion.status === 'pending' ) {
					pending[ id ] = suggestion;
				}
			}
			return pending;
		},
		// Memoization key - only recompute when block suggestions change
		( state, blockClientId ) => [ state.suggestions[ blockClientId ], blockClientId ]
	),

	getPendingChange: ( state, blockClientId ) => 
		state.pendingChanges[ blockClientId ] || null,

	getOriginalContent: ( state, blockClientId ) => 
		state.originalContent[ blockClientId ] || null,

	hasPendingSuggestions: ( state, blockClientId ) => {
		const blockSuggestions = state.suggestions[ blockClientId ] || {};
		return Object.values( blockSuggestions ).some( 
			suggestion => suggestion.status === 'pending'
		);
	},

	getAllPendingSuggestions: createSelector(
		( state ) => {
			const allPending = [];
			Object.keys( state.suggestions ).forEach( blockClientId => {
				const blockSuggestions = state.suggestions[ blockClientId ];
				Object.keys( blockSuggestions ).forEach( suggestionId => {
					const suggestion = blockSuggestions[ suggestionId ];
					if ( suggestion.status === 'pending' ) {
						allPending.push( {
							blockClientId,
							suggestionId,
							...suggestion,
						} );
					}
				});
			});
			return allPending;
		},
		// Memoization key - only recompute when suggestions change
		( state ) => [ state.suggestions ]
	),
};

/**
 * Create and register the suggestions store
 */
const suggestionsStore = createReduxStore( 'gutenberg/suggestions', {
	reducer: suggestionsReducer,
	actions,
	selectors,
} );

// Register the store immediately
register( suggestionsStore );

// Export the store name for consistent access
export const SUGGESTIONS_STORE_NAME = 'gutenberg/suggestions';

export default suggestionsStore;