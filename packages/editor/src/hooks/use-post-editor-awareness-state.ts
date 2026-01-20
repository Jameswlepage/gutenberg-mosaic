/**
 * External dependencies
 */
import { useSelect } from '@wordpress/data';
import { store as editorStore } from '../store';
import { useEffect, useState } from '@wordpress/element';
import * as Y from 'yjs';

/**
 * Internal dependencies
 */
import { getPostEditorAwareness, type EnhancedState, type PostEditorState, type SelectionCursor } from '@wordpress/sync';

interface PostEditorAwarenessState {
	activeUsers: EnhancedState< PostEditorState >[];
	getAbsolutePositionIndex: ( selection: SelectionCursor ) => number | null;
	isCurrentUserDisconnected: boolean;
}

const defaultState: PostEditorAwarenessState = {
	activeUsers: [],
	getAbsolutePositionIndex: () => null,
	isCurrentUserDisconnected: false,
};

function usePostEditorAwarenessState(): PostEditorAwarenessState {
	const [ state, setState ] = useState< PostEditorAwarenessState >( defaultState );
	const { postId, postType } = useSelect(
		( select ) => {
			const { getCurrentPostId, getCurrentPostType } = select( editorStore );
			return {
				postId: getCurrentPostId(),
				postType: getCurrentPostType(),
			};
		},
		[],
	);

	useEffect( () => {
		if ( null === postId || null === postType ) {
			return;
		}

		const awareness = getPostEditorAwareness( Number( postId ), postType );
		const unsubscribe = awareness?.onStateChange(
			( newState: EnhancedState< PostEditorState >[] ) => {
				setState( {
					activeUsers: newState,
					getAbsolutePositionIndex: ( selection: SelectionCursor ) =>
						Y.createAbsolutePositionFromRelativePosition(
							selection.cursorPosition.relativePosition,
							awareness.doc
						)?.index ?? null,
					isCurrentUserDisconnected: newState.find( user => user.isMe )?.isConnected === false,
				} );
			}
		);

		return unsubscribe;
	}, [ postId, postType ] );

	return state;
}

export function useActiveUsers(): EnhancedState< PostEditorState >[] {
	return usePostEditorAwarenessState().activeUsers;
}

export function useGetAbsolutePositionIndex(): ( selection: SelectionCursor ) => number | null {
	return usePostEditorAwarenessState().getAbsolutePositionIndex;
}

export function useIsDisconnected(): boolean {
	return usePostEditorAwarenessState().isCurrentUserDisconnected;
}
