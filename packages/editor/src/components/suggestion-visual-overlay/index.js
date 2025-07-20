/**
 * WordPress dependencies
 */
import { useSelect } from '@wordpress/data';
import { useMemo } from '@wordpress/element';
import { createPortal } from '@wordpress/element';

/**
 * Internal dependencies
 */
import { generateDiffVisualization } from '../suggestion-data-structures';

/**
 * Hook to get the DOM element for a specific block
 */
function useBlockElement( clientId ) {
	return useMemo( () => {
		if ( ! clientId ) {
			return null;
		}
		
		// Find the block element by its data-block attribute
		const blockElement = document.querySelector( `[data-block="${ clientId }"]` );
		return blockElement;
	}, [ clientId ] );
}

/**
 * Component that renders a visual overlay with diff highlights
 * directly over the block content without modifying the actual content
 */
export function SuggestionVisualOverlay( { blockClientId } ) {
	const blockElement = useBlockElement( blockClientId );
	
	const suggestions = useSelect( ( select ) => {
		return select( 'gutenberg/suggestions' ).getBlockPendingSuggestions( blockClientId );
	}, [ blockClientId ] );

	const isInSuggestMode = useSelect( ( select ) => {
		return select( 'gutenberg/suggestions' ).isSuggestionsActive();
	}, [] );

	const diffElements = useMemo( () => {
		if ( ! suggestions || Object.keys( suggestions ).length === 0 ) {
			return [];
		}

		// Get the first pending suggestion
		const firstSuggestionId = Object.keys( suggestions )[0];
		const suggestion = suggestions[ firstSuggestionId ];

		if ( ! suggestion || ! suggestion.diff ) {
			return [];
		}

		return generateDiffVisualization( suggestion.diff );
	}, [ suggestions ] );

	// Don't render if not in suggest mode or no block element or no suggestions
	if ( ! isInSuggestMode || ! blockElement || diffElements.length === 0 ) {
		return null;
	}

	// Find the paragraph content element within the block
	const paragraphContent = blockElement.querySelector( '[data-rich-text-format-boundary]' ) || 
	                        blockElement.querySelector( 'p' ) || 
	                        blockElement;

	if ( ! paragraphContent ) {
		return null;
	}

	// Create the overlay content
	const overlayContent = (
		<div 
			className="editor-suggestion-visual-overlay"
			style={ {
				position: 'absolute',
				top: 0,
				left: 0,
				right: 0,
				bottom: 0,
				pointerEvents: 'none',
				zIndex: 10,
				backgroundColor: 'rgba(255, 255, 255, 0.9)',
				border: '2px solid #007cba',
				borderRadius: '4px',
				padding: '12px',
				fontSize: 'inherit',
				lineHeight: 'inherit',
				fontFamily: 'inherit',
			} }
		>
			<div 
				className="editor-suggestion-visual-overlay__content"
				style={ {
					position: 'relative',
					zIndex: 11,
				} }
			>
				{ diffElements.map( ( element, index ) => {
					const baseStyles = {
						fontSize: 'inherit',
						lineHeight: 'inherit',
						fontFamily: 'inherit',
					};

					if ( element.type === 'deletion' ) {
						return (
							<span
								key={ index }
								className="editor-suggestion-diff editor-suggestion-diff__deletion"
								style={ {
									...baseStyles,
									backgroundColor: '#f8d7da',
									color: '#721c24',
									textDecoration: 'line-through',
									padding: '2px 4px',
									borderRadius: '2px',
									margin: '0 1px',
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
									...baseStyles,
									backgroundColor: '#d4edda',
									color: '#155724',
									textDecoration: 'underline',
									padding: '2px 4px',
									borderRadius: '2px',
									margin: '0 1px',
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
							style={ baseStyles }
						>
							{ element.content }
						</span>
					);
				} ) }
			</div>
			<div 
				className="editor-suggestion-visual-overlay__label"
				style={ {
					position: 'absolute',
					top: '-28px',
					left: 0,
					backgroundColor: '#007cba',
					color: 'white',
					padding: '4px 8px',
					borderRadius: '4px 4px 0 0',
					fontSize: '12px',
					lineHeight: '1.2',
					fontWeight: '500',
				} }
			>
				Suggested Change
			</div>
		</div>
	);

	// Create a positioned container and portal the overlay into it
	const containerStyle = {
		position: 'relative',
		pointerEvents: 'none',
	};

	// Check if we need to add positioning to the block element
	const blockComputedStyle = window.getComputedStyle( paragraphContent );
	const isPositioned = blockComputedStyle.position !== 'static';
	
	if ( ! isPositioned ) {
		// Add relative positioning to the parent block element
		const originalPosition = blockElement.style.position;
		blockElement.style.position = 'relative';
		
		// Clean up on unmount
		return createPortal(
			<div style={ containerStyle }>
				{ overlayContent }
			</div>,
			paragraphContent,
			`suggestion-overlay-${blockClientId}`
		);
	}

	return createPortal(
		<div style={ containerStyle }>
			{ overlayContent }
		</div>,
		paragraphContent,
		`suggestion-overlay-${blockClientId}`
	);
}

/**
 * Higher-order component that adds visual suggestion overlays to paragraph blocks
 */
export function withSuggestionVisualOverlay( WrappedComponent ) {
	return function SuggestionVisualOverlayComponent( props ) {
		const { clientId, name } = props;
		
		// Only apply to paragraph blocks
		if ( name !== 'core/paragraph' ) {
			return <WrappedComponent { ...props } />;
		}
		
		return (
			<>
				<WrappedComponent { ...props } />
				<SuggestionVisualOverlay blockClientId={ clientId } />
			</>
		);
	};
}

export default SuggestionVisualOverlay;