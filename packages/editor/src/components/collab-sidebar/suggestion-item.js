/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { Button } from '@wordpress/components';
import { check, close } from '@wordpress/icons';
import { useState } from '@wordpress/element';

/**
 * Internal dependencies
 */
import { generateDiffVisualization } from '../suggestion-data-structures';

/**
 * Create a simplified diff preview for the sidebar
 * @param {Array} diffArray - diff-match-patch diff array 
 * @return {string} Simple text preview of changes
 */
function createSidebarDiffPreview(diffArray) {
	if (!diffArray || !Array.isArray(diffArray)) {
		return '';
	}

	const diffElements = generateDiffVisualization(diffArray);
	let preview = '';
	let charCount = 0;
	const maxChars = 100;

	for (const element of diffElements) {
		if (charCount >= maxChars) {
			preview += '...';
			break;
		}

		const remainingChars = maxChars - charCount;
		let text = element.content;

		if (text.length > remainingChars) {
			text = text.substring(0, remainingChars);
		}

		if (element.type === 'insertion') {
			preview += `+${text}`;
		} else if (element.type === 'deletion') {
			preview += `-${text}`;
		} else {
			preview += text;
		}

		charCount += text.length;
	}

	return preview;
}

/**
 * SuggestionItem component for displaying individual suggestions in the sidebar
 * 
 * @param {Object} props - Component props
 * @param {Object} props.suggestion - Suggestion data object
 * @param {Function} props.onAccept - Accept suggestion callback
 * @param {Function} props.onReject - Reject suggestion callback
 * @param {Function} props.onViewDetails - View details callback (optional)
 * @return {React.ReactNode} The rendered SuggestionItem component
 */
export function SuggestionItem({ 
	suggestion, 
	onAccept, 
	onReject, 
	onViewDetails 
}) {
	const [showDetails, setShowDetails] = useState(false);

	if (!suggestion) {
		return null;
	}

	const diffPreview = createSidebarDiffPreview(suggestion.diff);
	const changeType = suggestion.metadata?.changeType || 'modification';
	const editCount = suggestion.metadata?.editCount || 1;
	const authorName = suggestion.author?.name || 'User';

	const handleAccept = () => {
		if (onAccept) {
			onAccept(suggestion.id);
		}
	};

	const handleReject = () => {
		if (onReject) {
			onReject(suggestion.id);
		}
	};

	const toggleDetails = () => {
		setShowDetails(!showDetails);
		if (onViewDetails && !showDetails) {
			onViewDetails(suggestion);
		}
	};

	return (
		<div className="editor-collab-sidebar-suggestion-item">
			<div className="editor-collab-sidebar-suggestion-item__header">
				<div className="editor-collab-sidebar-suggestion-item__info">
					<span className="editor-collab-sidebar-suggestion-item__author">
						{authorName}
					</span>
					<span className="editor-collab-sidebar-suggestion-item__meta">
						{editCount} {editCount === 1 ? __('change') : __('changes')} • {changeType}
					</span>
				</div>
				<div className="editor-collab-sidebar-suggestion-item__actions">
					<Button
						icon={check}
						label={__('Accept suggestion')}
						size="small"
						variant="primary"
						onClick={handleAccept}
					/>
					<Button
						icon={close}
						label={__('Reject suggestion')}
						size="small"
						onClick={handleReject}
					/>
				</div>
			</div>
			
			<div className="editor-collab-sidebar-suggestion-item__content">
				<button
					className="editor-collab-sidebar-suggestion-item__preview"
					onClick={toggleDetails}
				>
					<div className="editor-collab-sidebar-suggestion-item__preview-text">
						{diffPreview}
					</div>
					<span className="editor-collab-sidebar-suggestion-item__toggle">
						{showDetails ? __('Hide details') : __('Show details')}
					</span>
				</button>

				{showDetails && (
					<div className="editor-collab-sidebar-suggestion-item__details">
						<div className="editor-collab-sidebar-suggestion-item__diff">
							<div className="editor-collab-sidebar-suggestion-item__diff-section">
								<strong>{__('Original:')}</strong>
								<div className="editor-collab-sidebar-suggestion-item__diff-text">
									{suggestion.originalContent}
								</div>
							</div>
							<div className="editor-collab-sidebar-suggestion-item__diff-section">
								<strong>{__('Suggested:')}</strong>
								<div className="editor-collab-sidebar-suggestion-item__diff-text">
									{suggestion.suggestedContent}
								</div>
							</div>
						</div>
						{suggestion.created && (
							<div className="editor-collab-sidebar-suggestion-item__timestamp">
								{__('Created:')} {new Date(suggestion.created).toLocaleString()}
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);
}