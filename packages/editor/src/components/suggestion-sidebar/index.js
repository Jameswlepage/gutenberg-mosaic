/**
 * WordPress dependencies
 */
import { useSelect, useDispatch } from '@wordpress/data';
import { __ } from '@wordpress/i18n';
import { Button, Panel, PanelBody, PanelRow } from '@wordpress/components';
import { useState, useMemo } from '@wordpress/element';
import { dateI18n, format, getSettings } from '@wordpress/date';
import { store as coreStore } from '@wordpress/core-data';

/**
 * Internal dependencies
 */
import { store as editorStore } from '../../store';
import { commentMetaToSuggestion, applyTextSuggestion, validateSuggestion } from '../suggestion-data-structures';
import SuggestionPreview from './suggestion-preview';
import SuggestionActions from './suggestion-actions';

/**
 * Component for displaying a single suggestion
 */
function SuggestionItem( { suggestion, comment, onAccept, onReject } ) {
	const [ isExpanded, setIsExpanded ] = useState( false );

	const formattedDate = useMemo( () => {
		const dateFormat = getSettings().formats.date;
		return format( dateFormat, comment.date );
	}, [ comment.date ] );

	const authorName = comment.author_name || __( 'Anonymous' );

	return (
		<div className="editor-suggestion-item">
			<div className="editor-suggestion-item__header">
				<div className="editor-suggestion-item__author">
					<strong>{ authorName }</strong>
				</div>
				<div className="editor-suggestion-item__date">
					{ formattedDate }
				</div>
			</div>
			
			<div className="editor-suggestion-item__content">
				<div className="editor-suggestion-item__description">
					{ comment.content.rendered }
				</div>
				
				<Button
					variant="tertiary"
					size="small"
					onClick={ () => setIsExpanded( ! isExpanded ) }
				>
					{ isExpanded ? __( 'Hide Preview' ) : __( 'Show Preview' ) }
				</Button>
			</div>

			{ isExpanded && (
				<div className="editor-suggestion-item__preview">
					<SuggestionPreview suggestion={ suggestion } />
				</div>
			) }

			<div className="editor-suggestion-item__actions">
				<SuggestionActions
					suggestion={ suggestion }
					comment={ comment }
					onAccept={ onAccept }
					onReject={ onReject }
				/>
			</div>
		</div>
	);
}

/**
 * Component for displaying suggestions grouped by block
 */
function SuggestionBlock( { blockId, suggestions, onAccept, onReject } ) {
	const { block } = useSelect( ( select ) => {
		const { getBlock } = select( 'core/block-editor' );
		return {
			block: getBlock( blockId ),
		};
	}, [ blockId ] );

	if ( ! block ) {
		return null;
	}

	const blockTitle = block.name.split( '/' )[ 1 ] || 'Block';

	return (
		<PanelBody
			title={ `${ blockTitle } Suggestions (${ suggestions.length })` }
			initialOpen={ false }
			className="editor-suggestion-block"
		>
			<div className="editor-suggestion-block__content">
				{ suggestions.map( ( { suggestion, comment } ) => (
					<SuggestionItem
						key={ comment.id }
						suggestion={ suggestion }
						comment={ comment }
						onAccept={ onAccept }
						onReject={ onReject }
					/>
				) ) }
			</div>
		</PanelBody>
	);
}

/**
 * Main suggestion sidebar component
 */
function SuggestionSidebar() {
	const { comments, isLoading, postId } = useSelect( ( select ) => {
		const { getCurrentPostId } = select( editorStore );
		const { getEntityRecords, isResolving } = select( coreStore );
		
		const currentPostId = getCurrentPostId();
		const commentsData = getEntityRecords( 'root', 'comment', {
			post: currentPostId,
			type: 'block_suggestion',
			per_page: 100,
			_embed: true,
		} ) || [];

		return {
			comments: commentsData,
			isLoading: isResolving( 'root', 'comment', {
				post: currentPostId,
				type: 'block_suggestion',
				per_page: 100,
				_embed: true,
			} ),
			postId: currentPostId,
		};
	}, [] );

	// Memoize the suggestions conversion to prevent unnecessary re-renders
	const suggestions = useMemo( () => {
		return comments.map( ( comment ) => {
			const suggestion = commentMetaToSuggestion( comment.meta );
			return {
				suggestion,
				comment,
			};
		} );
	}, [ comments ] );

	const { saveEntityRecord, updateBlockAttributes } = useDispatch( coreStore );

	/**
	 * Groups suggestions by block client ID
	 */
	const suggestionsByBlock = useMemo( () => {
		const grouped = {};
		suggestions.forEach( ( item ) => {
			const blockId = item.suggestion.blockClientId;
			if ( ! grouped[ blockId ] ) {
				grouped[ blockId ] = [];
			}
			grouped[ blockId ].push( item );
		} );
		return grouped;
	}, [ suggestions ] );

	/**
	 * Handles accepting a suggestion
	 */
	const handleAcceptSuggestion = async ( suggestion, comment ) => {
		try {
			// Get current block
			const { getBlock } = wp.data.select( 'core/block-editor' );
			const currentBlock = getBlock( suggestion.blockClientId );
			
			if ( ! currentBlock ) {
				throw new Error( __( 'Block not found' ) );
			}

			// Validate suggestion
			const validation = validateSuggestion( suggestion, currentBlock );
			if ( ! validation.success ) {
				throw new Error( validation.message );
			}

			// Apply the suggestion
			const currentContent = currentBlock.attributes.content || '';
			const [ newContent, success ] = applyTextSuggestion( suggestion, currentContent );
			
			if ( ! success ) {
				throw new Error( __( 'Failed to apply suggestion' ) );
			}

			// Update block attributes
			await updateBlockAttributes( suggestion.blockClientId, {
				content: newContent,
				hasPendingSuggestions: false,
				suggestionMode: null,
			} );

			// Update suggestion status
			await saveEntityRecord( 'root', 'comment', {
				id: comment.id,
				meta: {
					...comment.meta,
					suggestion_status: 'accepted',
				},
			} );

		} catch ( error ) {
			console.error( 'Error accepting suggestion:', error );
			// TODO: Show error notice
		}
	};

	/**
	 * Handles rejecting a suggestion
	 */
	const handleRejectSuggestion = async ( suggestion, comment ) => {
		try {
			// Update suggestion status
			await saveEntityRecord( 'root', 'comment', {
				id: comment.id,
				meta: {
					...comment.meta,
					suggestion_status: 'rejected',
				},
			} );

			// Update block attributes if no other pending suggestions
			const otherSuggestions = suggestions.filter( 
				( item ) => item.comment.id !== comment.id && 
				item.suggestion.blockClientId === suggestion.blockClientId &&
				item.suggestion.status === 'pending'
			);

			if ( otherSuggestions.length === 0 ) {
				await updateBlockAttributes( suggestion.blockClientId, {
					hasPendingSuggestions: false,
					suggestionMode: null,
				} );
			}

		} catch ( error ) {
			console.error( 'Error rejecting suggestion:', error );
			// TODO: Show error notice
		}
	};

	if ( isLoading ) {
		return (
			<div className="editor-suggestion-sidebar">
				<div className="editor-suggestion-sidebar__loading">
					{ __( 'Loading suggestions...' ) }
				</div>
			</div>
		);
	}

	if ( suggestions.length === 0 ) {
		return (
			<div className="editor-suggestion-sidebar">
				<div className="editor-suggestion-sidebar__empty">
					<p>{ __( 'No suggestions available.' ) }</p>
					<p>{ __( 'Switch to suggestion mode to create suggestions.' ) }</p>
				</div>
			</div>
		);
	}

	return (
		<div className="editor-suggestion-sidebar">
			<div className="editor-suggestion-sidebar__header">
				<h3>{ __( 'Suggestions' ) }</h3>
				<div className="editor-suggestion-sidebar__count">
					{ suggestions.length } { suggestions.length === 1 ? __( 'suggestion' ) : __( 'suggestions' ) }
				</div>
			</div>

			<Panel className="editor-suggestion-sidebar__content">
				{ Object.entries( suggestionsByBlock ).map( ( [ blockId, blockSuggestions ] ) => (
					<SuggestionBlock
						key={ blockId }
						blockId={ blockId }
						suggestions={ blockSuggestions }
						onAccept={ handleAcceptSuggestion }
						onReject={ handleRejectSuggestion }
					/>
				) ) }
			</Panel>
		</div>
	);
}

export default SuggestionSidebar;