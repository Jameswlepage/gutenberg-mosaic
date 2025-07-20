/**
 * WordPress dependencies
 */
import { useState } from '@wordpress/element';
import {
	Button,
} from '@wordpress/components';
import { _x, __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { sanitizeCommentString } from './utils';
import { MentionTextareaControl } from '../mention-textarea-control';

/**
 * EditComment component.
 *
 * @param {Object}   props                  - The component props.
 * @param {Function} props.onSubmit         - The function to call when updating the comment.
 * @param {Function} props.onCancel         - The function to call when canceling the comment update.
 * @param {Object}   props.thread           - The comment thread object.
 * @param {string}   props.submitButtonText - The text to display on the submit button.
 * @return {React.ReactNode} The CommentForm component.
 */
function CommentForm( { onSubmit, onCancel, thread, submitButtonText } ) {
	const [ inputComment, setInputComment ] = useState(
		thread?.content?.raw ?? ''
	);

	return (
		<div className="editor-collab-sidebar-panel__edit-form">
			<MentionTextareaControl
				value={ inputComment ?? '' }
				onChange={ setInputComment }
				placeholder={ __( 'Write a comment...' ) }
				rows={ 3 }
			/>
			<div className="editor-collab-sidebar-panel__edit-actions">
				<Button
					variant="primary"
					size="small"
					onClick={ () => {
						onSubmit( inputComment );
						setInputComment( '' );
					} }
					disabled={
						0 === sanitizeCommentString( inputComment ).length
					}
				>
					{ submitButtonText }
				</Button>
				<Button
					variant="tertiary"
					size="small"
					onClick={ onCancel }
				>
					{ _x( 'Cancel', 'Cancel comment button' ) }
				</Button>
			</div>
		</div>
	);
}

export default CommentForm;
