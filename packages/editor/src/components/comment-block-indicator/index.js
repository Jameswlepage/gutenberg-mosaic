/**
 * WordPress dependencies
 */
import { useSelect, useDispatch } from '@wordpress/data';
import { useEffect, useRef, useState } from '@wordpress/element';
import { store as blockEditorStore } from '@wordpress/block-editor';
import { navigateToComment, subscribeToActiveComment, getActiveCommentId } from '../../utils/comment-navigation';

/**
 * CommentBlockIndicator component that adds visual dots to blocks with comments
 */
export function CommentBlockIndicator() {
	const indicatorsRef = useRef(new Map());
	const [activeCommentId, setActiveCommentId] = useState(getActiveCommentId());

	const { blockComments, selectedBlockId } = useSelect((select) => {
		const { getBlocks, getSelectedBlockClientId } = select(blockEditorStore);
		
		// Get all blocks and find ones with comments
		const allBlocks = getBlocks();
		const commentsMap = new Map();
		
		// Recursively check blocks for comment IDs
		const checkBlockForComments = (block) => {
			// Check for blockCommentId in various possible attribute structures
			const blockCommentId = block.attributes?.blockCommentId || 
								   block.attributes?.commentId ||
								   block.attributes?.['block-comment-id'];
			
			if (blockCommentId) {
				commentsMap.set(block.clientId, {
					blockId: block.clientId,
					commentId: blockCommentId,
					blockType: block.name
				});
			}
			
			// Check inner blocks recursively
			if (block.innerBlocks && block.innerBlocks.length > 0) {
				block.innerBlocks.forEach(checkBlockForComments);
			}
		};
		
		allBlocks.forEach(checkBlockForComments);

		return {
			blockComments: commentsMap,
			selectedBlockId: getSelectedBlockClientId(),
		};
	}); // Remove empty dependency array to ensure it re-runs when block data changes

	// Subscribe to active comment changes
	useEffect(() => {
		const unsubscribe = subscribeToActiveComment((commentId) => {
			setActiveCommentId(commentId);
		});

		return unsubscribe;
	}, []);

	useEffect(() => {
		// Clean up old indicators and unwrap blocks
		indicatorsRef.current.forEach(({ wrapper, indicator }) => {
			if (wrapper && wrapper.parentNode) {
				// Move the block back to its original position
				const blockElement = wrapper.querySelector('[data-block]');
				if (blockElement) {
					wrapper.parentNode.insertBefore(blockElement, wrapper);
				}
				// Remove the wrapper
				wrapper.parentNode.removeChild(wrapper);
			}
		});
		indicatorsRef.current.clear();

		console.log('CommentBlockIndicator: Found', blockComments.size, 'blocks with comments');

		// Add indicators for blocks with comments using wrapper system like suggestions
		blockComments.forEach((commentData, blockId) => {
			console.log('CommentBlockIndicator: Processing block', blockId, 'with comment', commentData.commentId);
			const blockElement = document.querySelector(`[data-block="${blockId}"]`);
			if (blockElement) {
				console.log('CommentBlockIndicator: Found DOM element for block', blockId);
				const isActive = activeCommentId === commentData.commentId;
				
				// Create wrapper similar to suggestion system
				const wrapper = document.createElement('div');
				wrapper.className = 'comment-wrapper';
				wrapper.style.position = 'relative';
				
				// Create the dot indicator
				const indicator = createCommentIndicator(commentData, isActive);
				wrapper.appendChild(indicator);
				
				// Wrap the block element
				const parent = blockElement.parentNode;
				parent.insertBefore(wrapper, blockElement);
				wrapper.appendChild(blockElement);
				
				indicatorsRef.current.set(blockId, { wrapper, indicator });
				console.log('CommentBlockIndicator: Added indicator for block', blockId);
			} else {
				console.warn('CommentBlockIndicator: Could not find DOM element for block', blockId);
			}
		});

		return () => {
			// Cleanup on unmount - unwrap blocks and remove wrappers
			indicatorsRef.current.forEach(({ wrapper, indicator }) => {
				if (wrapper && wrapper.parentNode) {
					// Move the block back to its original position
					const blockElement = wrapper.querySelector('[data-block]');
					if (blockElement) {
						wrapper.parentNode.insertBefore(blockElement, wrapper);
					}
					// Remove the wrapper
					wrapper.parentNode.removeChild(wrapper);
				}
			});
			indicatorsRef.current.clear();
		};
	}, [blockComments, activeCommentId]);

	return null; // This component doesn't render anything itself
}

/**
 * Creates a comment indicator dot element
 * @param {Object} commentData - Comment data including blockId, commentId
 * @param {boolean} isActive - Whether this comment is currently active
 * @returns {HTMLElement} The indicator element
 */
function createCommentIndicator(commentData, isActive = false) {
	const indicator = document.createElement('div');
	indicator.className = 'comment-indicator';
	indicator.setAttribute('data-comment-id', commentData.commentId);
	indicator.setAttribute('data-block-id', commentData.blockId);
	indicator.setAttribute('data-tooltip', `Comment on this ${commentData.blockType?.replace('core/', '') || 'block'}`);
	
	// Set opacity based on active state
	if (isActive) {
		indicator.classList.add('is-active');
	}
	
	// Add click handler to open comment
	indicator.addEventListener('click', (e) => {
		e.preventDefault();
		e.stopPropagation();
		handleIndicatorClick(commentData);
	});
	
	return indicator;
}

/**
 * Handles clicking on a comment indicator
 * @param {Object} commentData - Comment data
 */
function handleIndicatorClick(commentData) {
	// Use the navigation utility to handle opening the comment
	navigateToComment(commentData.commentId, commentData.blockId);
}