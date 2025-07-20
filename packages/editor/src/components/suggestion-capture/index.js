/**
 * WordPress dependencies
 */
import { useSelect, useDispatch } from '@wordpress/data';
import { useEffect, useRef, useMemo } from '@wordpress/element';
import { store as blockEditorStore } from '@wordpress/block-editor';

/**
 * Internal dependencies
 */
import { store as editorStore } from '../../store';
import { 
	createTextSuggestion, 
	suggestionToCommentMeta,
	SUGGESTION_STATUS 
} from '../suggestion-data-structures';

/**
 * Hook to capture text changes in paragraph blocks during suggestion mode
 *
 * @param {string|null} blockClientId - The block client ID to monitor, or null to disable
 * @return {Object} Suggestion capture utilities
 */
export function useSuggestionCapture( blockClientId ) {
	const previousContentRef = useRef( null );
	const isCapturingRef = useRef( false );
	const timeoutRef = useRef( null );

	const {
		collaborationMode,
		blockContent,
		blockName,
		postId,
	} = useSelect( ( select ) => {
		if ( ! blockClientId ) {
			return {
				collaborationMode: select( editorStore ).getCollaborationMode(),
				blockContent: '',
				blockName: '',
				postId: select( editorStore ).getCurrentPostId(),
			};
		}

		const { getBlock } = select( blockEditorStore );
		const { getCollaborationMode, getCurrentPostId } = select( editorStore );

		const block = getBlock( blockClientId );

		return {
			collaborationMode: getCollaborationMode(),
			blockContent: block?.attributes?.content || '',
			blockName: block?.name || '',
			postId: getCurrentPostId(),
		};
	}, [ blockClientId ] );

	const { saveEntityRecord } = useDispatch( 'core' );
	const { dispatch } = useDispatch();

	/**
	 * Creates a suggestion from the current text changes
	 */
	const createSuggestion = useMemo( () => async ( originalText, suggestedText ) => {
		if ( originalText === suggestedText || ! blockClientId ) {
			return;
		}

		const blockData = {
			clientId: blockClientId,
			name: blockName,
		};

		// Create suggestion data
		const suggestion = createTextSuggestion( originalText, suggestedText, blockData );
		const commentMeta = suggestionToCommentMeta( suggestion, `Text suggestion for ${ blockName }` );

		try {
			// Create suggestion comment
			const commentArgs = {
				post: postId,
				content: `Suggested change: "${ originalText }" → "${ suggestedText }"`,
				comment_type: 'block_suggestion',
				comment_approved: 0,
				meta: commentMeta,
			};

			const savedComment = await saveEntityRecord( 'root', 'comment', commentArgs );
			
			// Store suggestion in the dedicated suggestions store
			// instead of polluting block attributes
			const suggestionId = `suggestion_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
			
			// Add to suggestions store
			dispatch( 'gutenberg/suggestions' ).addSuggestion( blockClientId, suggestionId, {
				...suggestion,
				id: suggestionId,
				status: 'pending',
				commentId: savedComment?.id,
				timestamp: Date.now(),
			} );
		} catch ( error ) {
			console.error( 'Failed to create suggestion:', error );
			// Still store the suggestion in suggestions store even if comment creation fails
			const suggestionId = `suggestion_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
			
			dispatch( 'gutenberg/suggestions' ).addSuggestion( blockClientId, suggestionId, {
				...suggestion,
				id: suggestionId,
				status: 'pending',
				timestamp: Date.now(),
			} );
		}
	}, [ blockClientId, blockName, postId, saveEntityRecord, dispatch ] );

	/**
	 * Handles text change events with debouncing
	 */
	const handleTextChange = useMemo( () => ( newContent ) => {
		console.log( '[SuggestionCapture] handleTextChange called', {
			blockClientId,
			collaborationMode,
			blockName,
			newContent: newContent?.substring( 0, 50 ) + '...',
			previousContent: previousContentRef.current?.substring( 0, 50 ) + '...'
		} );

		if ( ! blockClientId || collaborationMode !== 'suggest' || !blockName?.includes( 'paragraph' ) ) {
			console.log( '[SuggestionCapture] Skipping - not in suggest mode or not paragraph block' );
			return;
		}

		// Clear existing timeout
		if ( timeoutRef.current ) {
			clearTimeout( timeoutRef.current );
		}

		console.log( '[SuggestionCapture] Setting timeout for suggestion creation' );

		// Set new timeout for debounced suggestion creation
		timeoutRef.current = setTimeout( () => {
			if ( previousContentRef.current && previousContentRef.current !== newContent ) {
				console.log( '[SuggestionCapture] Creating suggestion:', {
					from: previousContentRef.current,
					to: newContent
				} );
				createSuggestion( previousContentRef.current, newContent );
			} else {
				console.log( '[SuggestionCapture] No change detected, not creating suggestion' );
			}
		}, 1000 ); // 1 second debounce
	}, [ blockClientId, collaborationMode, blockName, createSuggestion ] );

	/**
	 * Starts capturing suggestions for the block
	 */
	const startCapture = useMemo( () => () => {
		if ( blockClientId && collaborationMode === 'suggest' && blockName?.includes( 'paragraph' ) ) {
			previousContentRef.current = blockContent;
			isCapturingRef.current = true;
		}
	}, [ blockClientId, collaborationMode, blockName, blockContent ] );

	/**
	 * Stops capturing suggestions for the block
	 */
	const stopCapture = useMemo( () => () => {
		isCapturingRef.current = false;
		if ( timeoutRef.current ) {
			clearTimeout( timeoutRef.current );
		}
	}, [] );

	// Monitor content changes
	useEffect( () => {
		if ( isCapturingRef.current && blockContent !== previousContentRef.current ) {
			handleTextChange( blockContent );
		}
	}, [ blockContent, handleTextChange ] );

	// Start/stop capture based on mode
	useEffect( () => {
		if ( blockClientId && collaborationMode === 'suggest' ) {
			startCapture();
		} else {
			stopCapture();
		}

		return () => {
			stopCapture();
		};
	}, [ collaborationMode, blockClientId, startCapture, stopCapture ] );

	// Cleanup on unmount
	useEffect( () => {
		return () => {
			if ( timeoutRef.current ) {
				clearTimeout( timeoutRef.current );
			}
		};
	}, [] );

	return {
		isCapturing: isCapturingRef.current,
		startCapture,
		stopCapture,
		createSuggestion,
	};
}

/**
 * Component that wraps paragraph blocks to capture suggestions
 */
export function SuggestionCaptureWrapper( { children, blockClientId } ) {
	const { isCapturing } = useSuggestionCapture( blockClientId );

	const { collaborationMode } = useSelect( ( select ) => {
		return {
			collaborationMode: select( editorStore ).getCollaborationMode(),
		};
	}, [] );

	// Only wrap if in suggestion mode
	if ( collaborationMode !== 'suggest' ) {
		return children;
	}

	return (
		<div
			className={ `editor-suggestion-capture ${ isCapturing ? 'is-capturing' : '' }` }
			data-block-id={ blockClientId }
		>
			{ children }
		</div>
	);
}

/**
 * Higher-order component to add suggestion capture to paragraph blocks
 */
export function withSuggestionCapture( WrappedComponent ) {
	return function SuggestionCaptureComponent( props ) {
		const { clientId } = props;
		
		return (
			<SuggestionCaptureWrapper blockClientId={ clientId }>
				<WrappedComponent { ...props } />
			</SuggestionCaptureWrapper>
		);
	};
}

export default useSuggestionCapture;