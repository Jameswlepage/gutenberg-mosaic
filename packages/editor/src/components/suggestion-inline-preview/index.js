/**
 * WordPress dependencies
 */
import { useSelect } from '@wordpress/data';
import { useMemo } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { store as coreStore } from '@wordpress/core-data';
import { store as blockEditorStore } from '@wordpress/block-editor';

/**
 * Internal dependencies
 */
import { store as editorStore } from '../../store';
import { commentMetaToSuggestion, generateDiffVisualization } from '../suggestion-data-structures';

// Stable empty array reference to prevent unnecessary re-renders
const EMPTY_ARRAY = [];

/**
 * Component that renders inline suggestion previews within paragraph blocks
 */
function SuggestionInlinePreview( { blockClientId } ) {
	const { postId, collaborationMode, isBlockSelected } = useSelect( ( select ) => {
		const { getCurrentPostId, getCollaborationMode } = select( editorStore );
		const { getSelectedBlockClientId } = select( blockEditorStore );
		
		return {
			postId: getCurrentPostId(),
			collaborationMode: getCollaborationMode(),
			isBlockSelected: getSelectedBlockClientId() === blockClientId,
		};
	}, [ blockClientId ] );

	const { comments } = useSelect( ( select ) => {
		if ( ! blockClientId || ! postId || typeof postId !== 'number' ) {
			return {
				comments: EMPTY_ARRAY,
			};
		}

		const { getEntityRecords } = select( coreStore );
		const commentsData = getEntityRecords( 'root', 'comment', {
			post: postId,
			type: 'block_suggestion',
			per_page: 100,
		} );

		return {
			comments: commentsData || EMPTY_ARRAY,
		};
	}, [ blockClientId, postId ] );

	// Memoize the filtered suggestions to prevent unnecessary re-renders
	const suggestions = useMemo( () => {
		return comments.filter( 
			( comment ) => comment.meta?.block_client_id === blockClientId 
		);
	}, [ comments, blockClientId ] );

	const diffElements = useMemo( () => {
		if ( ! suggestions.length ) {
			return [];
		}

		// For now, show the first pending suggestion
		const pendingSuggestion = suggestions.find( 
			( comment ) => {
				const suggestion = commentMetaToSuggestion( comment.meta );
				return suggestion.status === 'pending';
			}
		);

		if ( ! pendingSuggestion ) {
			return [];
		}

		const suggestion = commentMetaToSuggestion( pendingSuggestion.meta );
		return generateDiffVisualization( suggestion.diff );
	}, [ suggestions ] );

	// Show preview in suggestion mode when there are suggestions
	if ( collaborationMode !== 'suggest' || ! diffElements.length ) {
		return null;
	}

	return (
		<div className="editor-suggestion-inline-preview">
			<div className="editor-suggestion-inline-preview__header">
				<span className="editor-suggestion-inline-preview__label">
					{ __( 'Suggested Change:' ) }
				</span>
			</div>
			<div className="editor-suggestion-inline-preview__content">
				{ diffElements.map( ( element, index ) => {
					if ( element.type === 'deletion' ) {
						return (
							<span
								key={ index }
								className="editor-suggestion-diff editor-suggestion-diff__deletion"
								style={ {
									backgroundColor: '#f8d7da',
									color: '#721c24',
									textDecoration: 'line-through',
									padding: '0 2px',
									borderRadius: '2px',
								} }
							>
								{ element.content }
							</span>
						);
					}
					
					if ( element.type === 'insertion' ) {
						return (
							<span
								key={ index }
								className="editor-suggestion-diff editor-suggestion-diff__insertion"
								style={ {
									backgroundColor: '#d4edda',
									color: '#155724',
									textDecoration: 'underline',
									padding: '0 2px',
									borderRadius: '2px',
								} }
							>
								{ element.content }
							</span>
						);
					}
					
					// Equal content (unchanged)
					return (
						<span
							key={ index }
							className="editor-suggestion-diff editor-suggestion-diff__equal"
						>
							{ element.content }
						</span>
					);
				} ) }
			</div>
		</div>
	);
}

/**
 * Hook that provides inline preview functionality for a block
 */
export function useInlinePreview( blockClientId ) {
	const { postId, collaborationMode } = useSelect( ( select ) => {
		const { getCurrentPostId, getCollaborationMode } = select( editorStore );
		
		return {
			postId: getCurrentPostId(),
			collaborationMode: getCollaborationMode(),
		};
	}, [ blockClientId ] );

	const { comments } = useSelect( ( select ) => {
		if ( ! blockClientId || ! postId || typeof postId !== 'number' ) {
			return {
				comments: EMPTY_ARRAY,
			};
		}

		const { getEntityRecords } = select( coreStore );
		const commentsData = getEntityRecords( 'root', 'comment', {
			post: postId,
			type: 'block_suggestion',
			per_page: 100,
		} );

		return {
			comments: commentsData || EMPTY_ARRAY,
		};
	}, [ blockClientId, postId ] );

	// Memoize the suggestions check to prevent unnecessary re-renders
	const hasSuggestions = useMemo( () => {
		return comments.some( 
			( comment ) => comment.meta?.block_client_id === blockClientId 
		);
	}, [ comments, blockClientId ] );

	return {
		hasSuggestions,
		showPreview: collaborationMode === 'suggest' && hasSuggestions,
	};
}

/**
 * Higher-order component that adds inline preview to blocks
 */
export function withInlinePreview( WrappedComponent ) {
	return function InlinePreviewComponent( props ) {
		const { clientId } = props;
		const { showPreview } = useInlinePreview( clientId );

		if ( ! showPreview ) {
			return <WrappedComponent { ...props } />;
		}

		return (
			<div className="editor-suggestion-inline-preview-wrapper">
				<WrappedComponent { ...props } />
				<SuggestionInlinePreview blockClientId={ clientId } />
			</div>
		);
	};
}

export default SuggestionInlinePreview;