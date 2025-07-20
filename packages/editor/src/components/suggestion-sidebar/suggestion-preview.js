/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { useMemo } from '@wordpress/element';

/**
 * Internal dependencies
 */
import { generateDiffVisualization } from '../suggestion-data-structures';

/**
 * Component for rendering a visual diff preview of a suggestion
 */
function SuggestionPreview( { suggestion } ) {
	const diffElements = useMemo( () => {
		if ( ! suggestion.diff || ! Array.isArray( suggestion.diff ) ) {
			return [];
		}

		return generateDiffVisualization( suggestion.diff );
	}, [ suggestion.diff ] );

	if ( ! diffElements.length ) {
		return (
			<div className="editor-suggestion-preview editor-suggestion-preview--empty">
				<p>{ __( 'No preview available for this suggestion.' ) }</p>
			</div>
		);
	}

	return (
		<div className="editor-suggestion-preview">
			<div className="editor-suggestion-preview__header">
				<h4>{ __( 'Suggested Changes' ) }</h4>
			</div>

			<div className="editor-suggestion-preview__content">
				<div className="editor-suggestion-preview__original">
					<h5>{ __( 'Original' ) }</h5>
					<div className="editor-suggestion-preview__text">
						{ suggestion.originalContent }
					</div>
				</div>

				<div className="editor-suggestion-preview__suggested">
					<h5>{ __( 'Suggested' ) }</h5>
					<div className="editor-suggestion-preview__text">
						{ suggestion.suggestedContent }
					</div>
				</div>

				<div className="editor-suggestion-preview__diff">
					<h5>{ __( 'Changes' ) }</h5>
					<div className="editor-suggestion-preview__diff-content">
						{ diffElements.map( ( element, index ) => (
							<span
								key={ index }
								className={ `editor-suggestion-diff editor-suggestion-diff__${ element.type }` }
							>
								{ element.content }
							</span>
						) ) }
					</div>
				</div>
			</div>

			<div className="editor-suggestion-preview__meta">
				<div className="editor-suggestion-preview__block-info">
					<strong>{ __( 'Block:' ) }</strong> { suggestion.blockType }
				</div>
				<div className="editor-suggestion-preview__timestamp">
					<strong>{ __( 'Created:' ) }</strong> { new Date( suggestion.timestamp ).toLocaleString() }
				</div>
			</div>
		</div>
	);
}

export default SuggestionPreview;