/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { Button, ButtonGroup } from '@wordpress/components';
import { useState } from '@wordpress/element';
import { check, close } from '@wordpress/icons';

/**
 * Internal dependencies
 */
import { SUGGESTION_STATUS } from '../suggestion-data-structures';

/**
 * Component for rendering suggestion action buttons
 */
function SuggestionActions( { suggestion, comment, onAccept, onReject } ) {
	const [ isAccepting, setIsAccepting ] = useState( false );
	const [ isRejecting, setIsRejecting ] = useState( false );

	const isPending = suggestion.status === SUGGESTION_STATUS.PENDING;
	const isAccepted = suggestion.status === SUGGESTION_STATUS.ACCEPTED;
	const isRejected = suggestion.status === SUGGESTION_STATUS.REJECTED;

	/**
	 * Handles accepting the suggestion
	 */
	const handleAccept = async () => {
		setIsAccepting( true );
		try {
			await onAccept( suggestion, comment );
		} finally {
			setIsAccepting( false );
		}
	};

	/**
	 * Handles rejecting the suggestion
	 */
	const handleReject = async () => {
		setIsRejecting( true );
		try {
			await onReject( suggestion, comment );
		} finally {
			setIsRejecting( false );
		}
	};

	if ( isAccepted ) {
		return (
			<div className="editor-suggestion-actions editor-suggestion-actions--accepted">
				<div className="editor-suggestion-actions__status">
					<check />
					{ __( 'Accepted' ) }
				</div>
			</div>
		);
	}

	if ( isRejected ) {
		return (
			<div className="editor-suggestion-actions editor-suggestion-actions--rejected">
				<div className="editor-suggestion-actions__status">
					<close />
					{ __( 'Rejected' ) }
				</div>
			</div>
		);
	}

	if ( ! isPending ) {
		return null;
	}

	return (
		<div className="editor-suggestion-actions">
			<ButtonGroup>
				<Button
					variant="primary"
					size="small"
					icon={ check }
					onClick={ handleAccept }
					disabled={ isAccepting || isRejecting }
					isBusy={ isAccepting }
				>
					{ __( 'Accept' ) }
				</Button>
				<Button
					variant="secondary"
					size="small"
					icon={ close }
					onClick={ handleReject }
					disabled={ isAccepting || isRejecting }
					isBusy={ isRejecting }
				>
					{ __( 'Reject' ) }
				</Button>
			</ButtonGroup>
		</div>
	);
}

export default SuggestionActions;