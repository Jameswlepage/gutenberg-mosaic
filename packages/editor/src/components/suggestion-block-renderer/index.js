/**
 * WordPress dependencies
 */
import { useSelect } from '@wordpress/data';
import { useMemo } from '@wordpress/element';
import { RichText } from '@wordpress/block-editor';
import { store as coreStore } from '@wordpress/core-data';

/**
 * Internal dependencies
 */
import { store as editorStore } from '../../store';
import { commentMetaToSuggestion, generateDiffVisualization } from '../suggestion-data-structures';

/**
 * Component that renders an overlay with diff visualization 
 * when there are pending suggestions
 */
export function SuggestionBlockRenderer( { blockClientId } ) {
	const { comments, collaborationMode } = useSelect( ( select ) => {
		if ( ! blockClientId ) {
			return {
				comments: [],
				collaborationMode: select( editorStore ).getCollaborationMode(),
			};
		}

		const { getCurrentPostId, getCollaborationMode } = select( editorStore );
		const { getEntityRecords } = select( coreStore );
		
		const postId = getCurrentPostId();
		const commentsData = getEntityRecords( 'root', 'comment', {
			post: postId,
			type: 'block_suggestion',
			per_page: 100,
		} ) || [];

		return {
			comments: commentsData,
			collaborationMode: getCollaborationMode(),
		};
	}, [ blockClientId ] );

	// Memoize the pending suggestion to prevent unnecessary re-renders
	const pendingSuggestion = useMemo( () => {
		// Filter suggestions for this specific block
		const blockSuggestions = comments.filter( 
			( comment ) => comment.meta?.block_client_id === blockClientId 
		);

		// Find the first pending suggestion
		return blockSuggestions.find( 
			( comment ) => {
				const suggestion = commentMetaToSuggestion( comment.meta );
				return suggestion.status === 'pending';
			}
		);
	}, [ comments, blockClientId ] );

	const diffElements = useMemo( () => {
		if ( ! pendingSuggestion ) {
			return [];
		}

		const suggestion = commentMetaToSuggestion( pendingSuggestion.meta );
		return generateDiffVisualization( suggestion.diff );
	}, [ pendingSuggestion ] );

	// Only show in suggestion mode with pending suggestions
	if ( collaborationMode !== 'suggest' || ! diffElements.length ) {
		return null;
	}

	return (
		<div className="editor-suggestion-block-renderer">
			<div className="editor-suggestion-block-content">
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
 * Higher-order component that wraps paragraph blocks with suggestion rendering
 */
export function withSuggestionBlockRenderer( WrappedComponent ) {
	return function SuggestionBlockRendererComponent( props ) {
		const { clientId } = props;
		
		const { collaborationMode } = useSelect( ( select ) => {
			return {
				collaborationMode: select( editorStore ).getCollaborationMode(),
			};
		}, [] );

		// Only apply to paragraph blocks in suggestion mode
		if ( props.name !== 'core/paragraph' || collaborationMode !== 'suggest' ) {
			return <WrappedComponent { ...props } />;
		}

		return (
			<div className="editor-suggestion-block-wrapper">
				<WrappedComponent { ...props } />
				<SuggestionBlockRenderer blockClientId={ clientId } />
			</div>
		);
	};
}

export default SuggestionBlockRenderer;