/**
 * Comment Navigation Utilities
 * 
 * Shared utilities for managing comment state and navigation between 
 * the comment block indicators and the collab sidebar.
 */

let commentNavigationCallbacks = {
	onCommentActivate: null,
	onSidebarOpen: null,
};

let activeCommentState = {
	activeCommentId: null,
	listeners: new Set(),
};

/**
 * Register callbacks for comment navigation
 * 
 * @param {Object} callbacks - Callback functions
 * @param {Function} callbacks.onCommentActivate - Function to activate a comment by ID
 * @param {Function} callbacks.onSidebarOpen - Function to open the collab sidebar
 */
export function registerCommentNavigationCallbacks(callbacks) {
	commentNavigationCallbacks = { ...commentNavigationCallbacks, ...callbacks };
}

/**
 * Navigate to and activate a specific comment
 * 
 * @param {string} commentId - The comment ID to activate
 * @param {string} blockId - The block ID associated with the comment
 */
export function navigateToComment(commentId, blockId) {
	// Open the collab sidebar if it's not already open
	if (commentNavigationCallbacks.onSidebarOpen) {
		commentNavigationCallbacks.onSidebarOpen();
	}

	// Activate the specific comment
	if (commentNavigationCallbacks.onCommentActivate) {
		commentNavigationCallbacks.onCommentActivate(commentId);
	}

	// Scroll the associated block into view
	if (blockId) {
		setTimeout(() => {
			const blockElement = document.querySelector(`[data-block="${blockId}"]`);
			if (blockElement) {
				blockElement.scrollIntoView({ 
					behavior: 'smooth', 
					block: 'center' 
				});
			}
		}, 100); // Small delay to allow sidebar to open
	}
}

/**
 * Set the active comment ID and notify listeners
 * 
 * @param {string|null} commentId - The active comment ID or null to clear
 */
export function setActiveCommentId(commentId) {
	activeCommentState.activeCommentId = commentId;
	
	// Notify all listeners of the change
	activeCommentState.listeners.forEach(listener => {
		listener(commentId);
	});
}

/**
 * Get the current active comment ID
 * 
 * @returns {string|null} The active comment ID
 */
export function getActiveCommentId() {
	return activeCommentState.activeCommentId;
}

/**
 * Subscribe to active comment changes
 * 
 * @param {Function} listener - Function to call when active comment changes
 * @returns {Function} Unsubscribe function
 */
export function subscribeToActiveComment(listener) {
	activeCommentState.listeners.add(listener);
	
	// Return unsubscribe function
	return () => {
		activeCommentState.listeners.delete(listener);
	};
}

/**
 * Clear comment navigation callbacks (cleanup)
 */
export function clearCommentNavigationCallbacks() {
	commentNavigationCallbacks = {
		onCommentActivate: null,
		onSidebarOpen: null,
	};
}