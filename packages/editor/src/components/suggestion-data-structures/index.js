/**
 * External dependencies
 */
import { diff_match_patch } from 'diff-match-patch';

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * Suggestion status constants (professional standard)
 */
export const SUGGESTION_STATUS = {
	PENDING: 'pending',
	ACCEPTED: 'accepted',
	REJECTED: 'rejected',
	DRAFT: 'draft',
};

/**
 * Suggestion types (professional standard)
 */
export const SUGGESTION_TYPES = {
	TEXT_CHANGE: 'text_change',
	ATTRIBUTE_CHANGE: 'attribute_change',
	CONTENT_CHANGE: 'content_change',
};

/**
 * Creates a text diff suggestion for paragraph blocks using our proven diff engine
 *
 * @param {string} originalText - Original block content
 * @param {string} suggestedText - Suggested block content
 * @param {Object} blockData - Block information
 * @return {Object} Suggestion data structure
 */
/**
 * Generate a simple UUID v4
 * 
 * @return {string} UUID string
 */
function generateUUID() {
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace( /[xy]/g, function( c ) {
		const r = Math.random() * 16 | 0;
		const v = c === 'x' ? r : ( r & 0x3 | 0x8 );
		return v.toString( 16 );
	} );
}

export function createTextSuggestion( originalText, suggestedText, blockData ) {
	// Use our proven diff-match-patch implementation
	const dmp = new diff_match_patch();
	dmp.Diff_Timeout = 2.0; // Increased timeout for better accuracy
	dmp.Diff_EditCost = 4;
	
	const diff = dmp.diff_main( originalText, suggestedText );
	
	// Use less aggressive cleanup to preserve deletions better
	// diff_cleanupSemanticLossless preserves separate -1/+1 operations for small word-level edits
	dmp.diff_cleanupSemanticLossless( diff );
	

	return {
		id: generateUUID(), // Add unique ID to each suggestion
		type: SUGGESTION_TYPES.TEXT_CHANGE,
		blockClientId: blockData.clientId,
		blockType: blockData.name,
		originalContent: originalText,
		suggestedContent: suggestedText,
		diff,
		patches: [], // Could implement patches later if needed
		timestamp: Date.now(),
		status: SUGGESTION_STATUS.PENDING,
	};
}

/**
 * Applies a text suggestion to content (simplified for now)
 *
 * @param {Object} suggestion - Suggestion data
 * @param {string} currentContent - Current content to apply to
 * @return {Array} Array containing [newContent, success]
 */
export function applyTextSuggestion( suggestion, currentContent ) {
	try {
		// For now, just return the suggested content if the current content matches original
		if ( currentContent === suggestion.originalContent ) {
			return [ suggestion.suggestedContent, true ];
		}
		return [ currentContent, false ];
	} catch ( error ) {
		return [ currentContent, false ];
	}
}

/**
 * Generates a visual diff representation for text changes using our proven algorithm
 *
 * @param {Array} diff - Diff array from diff-match-patch
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
 * Converts suggestion data to comment meta format (WordPress integration)
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
		original_content: JSON.stringify( suggestion.originalContent ),
		suggested_content: JSON.stringify( suggestion.suggestedContent ),
		diff_data: JSON.stringify( suggestion.diff || [] ),
		patches_data: JSON.stringify( suggestion.patches || [] ),
		timestamp: suggestion.timestamp.toString(),
		description,
	};
}

/**
 * Converts comment meta to suggestion data format (WordPress integration)
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
		originalContent: JSON.parse( commentMeta.original_content || '""' ),
		suggestedContent: JSON.parse( commentMeta.suggested_content || '""' ),
		diff: JSON.parse( commentMeta.diff_data || '[]' ),
		patches: JSON.parse( commentMeta.patches_data || '[]' ),
		timestamp: parseInt( commentMeta.timestamp, 10 ),
		description: commentMeta.description || '',
	};
}

/**
 * Default suggestion data structure
 */
export const DEFAULT_SUGGESTION = {
	id: '',
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