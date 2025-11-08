/**
 * WordPress dependencies
 */
import { chevronDown, chevronUp } from '@wordpress/icons';
import { Button, Icon } from '@wordpress/components';
import { useState, useCallback, useRef } from '@wordpress/element';

/**
 * Internal dependencies
 */
import { PatternCategoryPreviews } from './pattern-category-previews';
import { PatternsFilter } from './patterns-filter';

function CategoryAccordionItem( {
	category,
	isExpanded,
	onToggle,
	rootClientId,
	onInsert,
} ) {
	const [ patternSyncFilter, setPatternSyncFilter ] = useState( 'all' );
	const [ patternSourceFilter, setPatternSourceFilter ] = useState( 'all' );
	const scrollContainerRef = useRef();

	const onSetPatternSyncFilter = useCallback(
		( value ) => {
			setPatternSyncFilter( value );
		},
		[ setPatternSyncFilter ]
	);

	const onSetPatternSourceFilter = useCallback(
		( value ) => {
			setPatternSourceFilter( value );
		},
		[ setPatternSourceFilter ]
	);

	return (
		<div className="block-editor-inserter__category-accordion-item">
			<div className="block-editor-inserter__category-accordion-header-wrapper">
				<Button
					className="block-editor-inserter__category-accordion-header"
					onClick={ () => onToggle( category ) }
					aria-expanded={ isExpanded }
				>
					<span className="block-editor-inserter__category-accordion-title">
						{ category.label }
					</span>
					<Icon icon={ isExpanded ? chevronUp : chevronDown } />
				</Button>
				{ isExpanded && (
					<PatternsFilter
						patternSyncFilter={ patternSyncFilter }
						patternSourceFilter={ patternSourceFilter }
						setPatternSyncFilter={ onSetPatternSyncFilter }
						setPatternSourceFilter={ onSetPatternSourceFilter }
						scrollContainerRef={ scrollContainerRef }
						category={ category }
					/>
				) }
			</div>
			{ isExpanded && (
				<div className="block-editor-inserter__category-accordion-content">
					<PatternCategoryPreviews
						rootClientId={ rootClientId }
						onInsert={ onInsert }
						category={ category }
						showTitlesAsTooltip
						hideHeader
						patternSyncFilter={ patternSyncFilter }
						patternSourceFilter={ patternSourceFilter }
						scrollContainerRef={ scrollContainerRef }
					/>
				</div>
			) }
		</div>
	);
}

export default CategoryAccordionItem;
