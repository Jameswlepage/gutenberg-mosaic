/**
 * External dependencies
 */
import clsx from 'clsx';

/**
 * WordPress dependencies
 */
import {
	__experimentalHStack as HStack,
	__experimentalTruncate as Truncate,
	privateApis as componentsPrivateApis,
} from '@wordpress/components';
import { forwardRef, useState, useRef, useEffect } from '@wordpress/element';
import { Icon, lockSmall as lock, pinSmall, unseen } from '@wordpress/icons';
import { SPACE, ENTER } from '@wordpress/keycodes';
import { useSelect, useDispatch } from '@wordpress/data';
import { hasBlockSupport } from '@wordpress/blocks';

/**
 * Internal dependencies
 */
import BlockIcon from '../block-icon';
import useBlockDisplayInformation from '../use-block-display-information';
import useBlockDisplayTitle from '../block-title/use-block-display-title';
import ListViewExpander from './expander';
import { useBlockLock } from '../block-lock';
import useListViewImages from './use-list-view-images';
import { store as blockEditorStore } from '../../store';
import { unlock } from '../../lock-unlock';

const { Badge } = unlock( componentsPrivateApis );

function ListViewBlockSelectButton(
	{
		className,
		block: { clientId },
		onClick,
		onContextMenu,
		onMouseDown,
		onToggleExpanded,
		tabIndex,
		onFocus,
		onDragStart,
		onDragEnd,
		draggable,
		isExpanded,
		ariaDescribedBy,
		isSelectedInList,
	},
	ref
) {
	const [ isEditing, setIsEditing ] = useState( false );
	const [ editedTitle, setEditedTitle ] = useState( '' );
	const inputRef = useRef( null );

	const blockInformation = useBlockDisplayInformation( clientId );
	const blockTitle = useBlockDisplayTitle( {
		clientId,
		context: 'list-view',
	} );
	const { isLocked } = useBlockLock( clientId );
	const { updateBlockAttributes } = useDispatch( blockEditorStore );
	const { canToggleBlockVisibility, isBlockHidden, blockName, blockAttributes, isContentOnly } =
		useSelect(
			( select ) => {
				const { getBlockName, getBlockAttributes, getBlockEditingMode } = select( blockEditorStore );
				const { isBlockHidden: _isBlockHidden } = unlock(
					select( blockEditorStore )
				);
				return {
					canToggleBlockVisibility: hasBlockSupport(
						getBlockName( clientId ),
						'blockVisibility',
						true
					),
					isBlockHidden: _isBlockHidden( clientId ),
					blockName: getBlockName( clientId ),
					blockAttributes: getBlockAttributes( clientId ),
					isContentOnly: getBlockEditingMode( clientId ) === 'contentOnly',
				};
			},
			[ clientId ]
		);
	const shouldShowLockIcon = isLocked && ! isContentOnly;
	const shouldShowBlockVisibilityIcon =
		canToggleBlockVisibility && isBlockHidden;
	const isSticky = blockInformation?.positionType === 'sticky';
	const images = useListViewImages( { clientId, isExpanded } );

	// Focus input when editing starts
	useEffect( () => {
		if ( isEditing && inputRef.current ) {
			inputRef.current.focus();
			inputRef.current.select();
		}
	}, [ isEditing ] );

	// The `href` attribute triggers the browser's native HTML drag operations.
	// When the link is dragged, the element's outerHTML is set in DataTransfer object as text/html.
	// We need to clear any HTML drag data to prevent `pasteHandler` from firing
	// inside the `useOnBlockDrop` hook.
	const onDragStartHandler = ( event ) => {
		event.dataTransfer.clearData();
		onDragStart?.( event );
	};

	/**
	 * @param {KeyboardEvent} event
	 */
	function onKeyDown( event ) {
		if ( isEditing ) {
			return; // Let the input handle its own keyboard events
		}
		if ( event.keyCode === ENTER || event.keyCode === SPACE ) {
			onClick( event );
		}
	}

	function handleDoubleClick( event ) {
		event.preventDefault();
		event.stopPropagation();
		setEditedTitle( blockAttributes?.metadata?.name || blockTitle );
		setIsEditing( true );
	}

	function handleInputKeyDown( event ) {
		if ( event.key === 'Enter' ) {
			event.preventDefault();
			saveTitle();
		} else if ( event.key === 'Escape' ) {
			event.preventDefault();
			setIsEditing( false );
		}
	}

	function handleInputBlur() {
		saveTitle();
	}

	function saveTitle() {
		if ( editedTitle && editedTitle !== blockTitle ) {
			updateBlockAttributes( clientId, {
				metadata: {
					...blockAttributes?.metadata,
					name: editedTitle,
				},
			} );
		}
		setIsEditing( false );
	}

	return (
		<a
			className={ clsx(
				'block-editor-list-view-block-select-button',
				className
			) }
			onClick={ onClick }
			onContextMenu={ onContextMenu }
			onKeyDown={ onKeyDown }
			onMouseDown={ onMouseDown }
			ref={ ref }
			tabIndex={ tabIndex }
			onFocus={ onFocus }
			onDragStart={ onDragStartHandler }
			onDragEnd={ onDragEnd }
			draggable={ draggable }
			href={ `#block-${ clientId }` }
			aria-describedby={ ariaDescribedBy }
			aria-expanded={ isExpanded }
		>
			<ListViewExpander onClick={ onToggleExpanded } />
			<BlockIcon
				icon={ blockInformation?.icon }
				showColors
				context="list-view"
			/>
			<HStack
				alignment="center"
				className="block-editor-list-view-block-select-button__label-wrapper"
				justify="flex-start"
				spacing={ 1 }
				onDoubleClick={ handleDoubleClick }
			>
				<span className="block-editor-list-view-block-select-button__title">
					{ isEditing ? (
						<input
							ref={ inputRef }
							type="text"
							value={ editedTitle }
							onChange={ ( e ) => setEditedTitle( e.target.value ) }
							onKeyDown={ ( e ) => {
								e.stopPropagation();
								handleInputKeyDown( e );
							} }
							onBlur={ handleInputBlur }
							onClick={ ( e ) => e.stopPropagation() }
							onMouseDown={ ( e ) => e.stopPropagation() }
							className="block-editor-list-view-block-select-button__title-input"
							style={ {
								width: '100%',
								border: 'none',
								background: 'transparent',
								font: 'inherit',
								padding: 0,
								margin: 0,
								outline: 'none',
								color: isSelectedInList ? '#fff' : 'inherit',
							} }
						/>
					) : (
						<Truncate ellipsizeMode="auto">{ blockTitle }</Truncate>
					) }
				</span>
				{ blockInformation?.anchor && (
					<span className="block-editor-list-view-block-select-button__anchor-wrapper">
						<Badge className="block-editor-list-view-block-select-button__anchor">
							{ blockInformation.anchor }
						</Badge>
					</span>
				) }
				{ isSticky && (
					<span className="block-editor-list-view-block-select-button__sticky">
						<Icon icon={ pinSmall } />
					</span>
				) }
				{ images.length ? (
					<span
						className="block-editor-list-view-block-select-button__images"
						aria-hidden
					>
						{ images.map( ( image, index ) => (
							<span
								className="block-editor-list-view-block-select-button__image"
								key={ image.clientId }
								style={ {
									backgroundImage: `url(${ image.url })`,
									zIndex: images.length - index, // Ensure the first image is on top, and subsequent images are behind.
								} }
							/>
						) ) }
					</span>
				) : null }
				{ shouldShowBlockVisibilityIcon && (
					<span className="block-editor-list-view-block-select-button__block-visibility">
						<Icon icon={ unseen } />
					</span>
				) }
				{ shouldShowLockIcon && (
					<span className="block-editor-list-view-block-select-button__lock">
						<Icon icon={ lock } />
					</span>
				) }
			</HStack>
		</a>
	);
}

export default forwardRef( ListViewBlockSelectButton );
