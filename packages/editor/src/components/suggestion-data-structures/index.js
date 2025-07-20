/**
 * External dependencies
 */
import { makeDiff, makePatches, applyPatches } from '@sanity/diff-match-patch';

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * Suggestion status constants
 */
export const SUGGESTION_STATUS = {
	PENDING: 'pending',
	ACCEPTED: 'accepted',
	REJECTED: 'rejected',
	DRAFT: 'draft',
};

/**
 * Suggestion types
 */
export const SUGGESTION_TYPES = {
	TEXT_CHANGE: 'text_change',
	ATTRIBUTE_CHANGE: 'attribute_change',
	CONTENT_CHANGE: 'content_change',
};

/**
 * Creates a text diff suggestion for paragraph blocks
 *
 * @param {string} originalText - Original block content
 * @param {string} suggestedText - Suggested block content
 * @param {Object} blockData - Block information
 * @return {Object} Suggestion data structure
 */
export function createTextSuggestion( originalText, suggestedText, blockData ) {
	const diff = makeDiff( originalText, suggestedText );
	const patches = makePatches( originalText, suggestedText );

	return {
		type: SUGGESTION_TYPES.TEXT_CHANGE,
		blockClientId: blockData.clientId,
		blockType: blockData.name,
		originalContent: originalText,
		suggestedContent: suggestedText,
		diff,
		patches,
		timestamp: Date.now(),
		status: SUGGESTION_STATUS.PENDING,
	};
}

/**
 * Creates an attribute change suggestion for blocks
 *
 * @param {Object} originalAttributes - Original block attributes
 * @param {Object} suggestedAttributes - Suggested block attributes
 * @param {Object} blockData - Block information
 * @return {Object} Suggestion data structure
 */
export function createAttributeSuggestion( originalAttributes, suggestedAttributes, blockData ) {
	const changes = [];
	
	// Find attribute differences
	Object.keys( suggestedAttributes ).forEach( ( key ) => {
		if ( originalAttributes[ key ] !== suggestedAttributes[ key ] ) {
			changes.push( {
				attribute: key,
				from: originalAttributes[ key ],
				to: suggestedAttributes[ key ],
			} );
		}
	} );

	return {
		type: SUGGESTION_TYPES.ATTRIBUTE_CHANGE,
		blockClientId: blockData.clientId,
		blockType: blockData.name,
		originalAttributes,
		suggestedAttributes,
		changes,
		timestamp: Date.now(),
		status: SUGGESTION_STATUS.PENDING,
	};
}

/**
 * Creates a complete content change suggestion
 *
 * @param {Object} originalBlock - Original block data
 * @param {Object} suggestedBlock - Suggested block data
 * @return {Object} Suggestion data structure
 */
export function createContentSuggestion( originalBlock, suggestedBlock ) {
	return {
		type: SUGGESTION_TYPES.CONTENT_CHANGE,
		blockClientId: originalBlock.clientId,
		blockType: originalBlock.name,
		originalBlock,
		suggestedBlock,
		timestamp: Date.now(),
		status: SUGGESTION_STATUS.PENDING,
	};
}

/**
 * Applies a text suggestion to content
 *
 * @param {Object} suggestion - Suggestion data
 * @param {string} currentContent - Current content to apply to
 * @return {Array} Array containing [newContent, success]
 */
export function applyTextSuggestion( suggestion, currentContent ) {
	try {
		const [ newContent, success ] = applyPatches( suggestion.patches, currentContent );
		return [ newContent, success ];
	} catch ( error ) {
		return [ currentContent, false ];
	}
}

/**
 * Applies an attribute suggestion to block attributes
 *
 * @param {Object} suggestion - Suggestion data
 * @param {Object} currentAttributes - Current block attributes
 * @return {Object} New attributes with suggestion applied
 */
export function applyAttributeSuggestion( suggestion, currentAttributes ) {
	const newAttributes = { ...currentAttributes };
	
	suggestion.changes.forEach( ( change ) => {
		newAttributes[ change.attribute ] = change.to;
	} );

	return newAttributes;
}

/**
 * Generates a visual diff representation for text changes
 *
 * @param {Array} diff - Diff array from makeDiff
 * @return {Array} Array of diff elements with type and content
 */
export function generateDiffVisualization( diff ) {
	return diff.map( ( [ operation, text ] ) => {
		let type;
		switch ( operation ) {
			case -1:
				type = 'deletion';
				break;
			case 1:
				type = 'insertion';
				break;
			case 0:
				type = 'equal';
				break;
			default:
				type = 'equal';
		}

		return {
			type,
			content: text,
		};
	} );
}

/**
 * Converts suggestion data to comment meta format
 *
 * @param {Object} suggestion - Suggestion data
 * @param {string} description - Human-readable description
 * @return {Object} Comment meta object
 */
export function suggestionToCommentMeta( suggestion, description = '' ) {
	return {
		suggestion_type: suggestion.type,
		suggestion_status: suggestion.status,
		block_client_id: suggestion.blockClientId,
		block_type: suggestion.blockType,
		original_content: JSON.stringify( suggestion.originalContent || suggestion.originalAttributes || suggestion.originalBlock ),
		suggested_content: JSON.stringify( suggestion.suggestedContent || suggestion.suggestedAttributes || suggestion.suggestedBlock ),
		diff_data: JSON.stringify( suggestion.diff || suggestion.changes || {} ),
		patches_data: JSON.stringify( suggestion.patches || [] ),
		timestamp: suggestion.timestamp.toString(),
		description,
	};
}

/**
 * Converts comment meta to suggestion data format
 *
 * @param {Object} commentMeta - Comment meta object
 * @return {Object} Suggestion data
 */
export function commentMetaToSuggestion( commentMeta ) {
	return {
		type: commentMeta.suggestion_type,
		status: commentMeta.suggestion_status,
		blockClientId: commentMeta.block_client_id,
		blockType: commentMeta.block_type,
		originalContent: JSON.parse( commentMeta.original_content || '{}' ),
		suggestedContent: JSON.parse( commentMeta.suggested_content || '{}' ),
		diff: JSON.parse( commentMeta.diff_data || '[]' ),
		patches: JSON.parse( commentMeta.patches_data || '[]' ),
		timestamp: parseInt( commentMeta.timestamp, 10 ),
		description: commentMeta.description || '',
	};
}

/**
 * Validates if a suggestion can be applied to the current block state
 *
 * @param {Object} suggestion - Suggestion data
 * @param {Object} currentBlock - Current block data
 * @return {Object} Validation result with success flag and message
 */
export function validateSuggestion( suggestion, currentBlock ) {
	if ( suggestion.blockClientId !== currentBlock.clientId ) {
		return {
			success: false,
			message: __( 'Suggestion is for a different block.' ),
		};
	}

	if ( suggestion.blockType !== currentBlock.name ) {
		return {
			success: false,
			message: __( 'Block type has changed since suggestion was created.' ),
		};
	}

	// For text suggestions, validate that the original content matches
	if ( suggestion.type === SUGGESTION_TYPES.TEXT_CHANGE ) {
		const currentContent = currentBlock.attributes.content || '';
		if ( suggestion.originalContent !== currentContent ) {
			return {
				success: false,
				message: __( 'Block content has changed since suggestion was created.' ),
			};
		}
	}

	return {
		success: true,
		message: __( 'Suggestion can be applied.' ),
	};
}

/**
 * Default suggestion data structure
 */
export const DEFAULT_SUGGESTION = {
	type: SUGGESTION_TYPES.TEXT_CHANGE,
	blockClientId: '',
	blockType: '',
	originalContent: '',
	suggestedContent: '',
	diff: [],
	patches: [],
	timestamp: Date.now(),
	status: SUGGESTION_STATUS.PENDING,
};