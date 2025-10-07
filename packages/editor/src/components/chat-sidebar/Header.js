/**
 * WordPress dependencies
 */
import {
  Button,
  Icon,
  Tooltip,
  DropdownMenu,
  MenuItem,
  __unstableAnimatePresence as AnimatePresence,
} from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { close, crop, rotateLeft, moreVertical, chevronRight } from '@wordpress/icons';

export default function Header({
  isExpanded,
  isStudio,
  setIsStudio,
  playFLIP,
  tool,
  zoomUI,
  aspectUI,
  setZoomRef,
  setAspectRef,
  setZoomUI,
  setAspectUI,
  setDirtyCrop,
  handleToggleCrop,
  handleToggleAnnotate,
  isDirty,
  handleSave,
  onCloseChat,
}) {
  const dur = 0.28;
  const ease = [0.6, 0, 0.4, 1];

  return (
    <div className="editor-chat-sidebar__header">
      { isExpanded && isStudio && (
        <div className="editor-chat-sidebar__leading">
          <Button
            className="editor-chat-sidebar__icon-button"
            label={ __( 'Exit Image Studio' ) }
            icon={ <Icon icon={ chevronRight } /> }
            onClick={ () => {
              setIsStudio( false );
              playFLIP( false );
            } }
          />
        </div>
      ) }

      <AnimatePresence initial={ false }>
        <div
          key={ isExpanded && isStudio ? 'studio' : 'generate' }
          className="editor-chat-sidebar__title"
        >
          { isExpanded && isStudio ? (
            <span className="editor-chat-sidebar__title-row">
              <svg
                className="editor-chat-sidebar__jetpack"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 480 480"
                width="16"
                height="16"
                aria-hidden="true"
                focusable="false"
              >
                <path d="M252.1 447.56S387.8 188.22 387.35 187.9c.44.32-145.7-.23-146.15-.54.45.3-1.2-161.78-1.2-161.78s-24.73.55-25.16.24c.43.3-130.88 262.4-131.32 262.1.44.3 131.75-.25 131.32-.56.43.3 9.23 156.9 8.8 156.6.43.3 28.45 3.6 28.45 3.6z" fill="#fff"/>
                <path d="M240 0C107.63 0 0 107.63 0 240s107.63 240 240 240 240-107.63 240-240S372.37 0 240 0zm-12.37 279.85H108.1L227.62 47.18v232.67zm24.28 152.52V199.7h119.55L251.9 432.36z" fill="#00be28"/>
              </svg>
              { __( 'Image Studio' ) }
            </span>
          ) : (
            __( 'Generate' )
          ) }
        </div>
      </AnimatePresence>

      <div className="editor-chat-sidebar__actions">
        { isExpanded && isStudio && (
          <div className="editor-chat-sidebar__studio-tools">
            <Button
              className="editor-chat-sidebar__icon-button"
              label={ __( 'Crop' ) }
              onClick={ handleToggleCrop }
              aria-pressed={ tool === 'crop' }
              icon={ <Icon icon={ crop } /> }
            />
            <Button
              className="editor-chat-sidebar__icon-button"
              label={ __( 'Rotate' ) }
              onClick={ () => {} }
              aria-pressed={ false }
              icon={ <Icon icon={ rotateLeft } /> }
            />
            { tool === 'crop' && (
              <>
                <input
                  className="editor-chat-sidebar__zoom"
                  type="range"
                  min="1"
                  max="3"
                  step="0.05"
                  value={ zoomUI }
                  onChange={ ( e ) => {
                    const v = parseFloat( e.target.value );
                    setZoomUI( v );
                    setDirtyCrop( true );
                    if ( setZoomRef.current ) setZoomRef.current( Math.round( v * 100 ) );
                  } }
                  aria-label={ __( 'Zoom' ) }
                />
                <Button
                  className="editor-chat-sidebar__icon-button"
                  onClick={ () => {
                    setAspectUI( 1 );
                    setDirtyCrop( true );
                    if ( setAspectRef.current ) setAspectRef.current( 1 );
                  } }
                  aria-pressed={ aspectUI === 1 }
                >
                  1:1
                </Button>
                <Button
                  className="editor-chat-sidebar__icon-button"
                  onClick={ () => {
                    const a = 4 / 3;
                    setAspectUI( a );
                    setDirtyCrop( true );
                    if ( setAspectRef.current ) setAspectRef.current( a );
                  } }
                  aria-pressed={ aspectUI === 4 / 3 }
                >
                  4:3
                </Button>
                <Button
                  className="editor-chat-sidebar__icon-button"
                  onClick={ () => {
                    setAspectUI( undefined );
                    setDirtyCrop( true );
                    if ( setAspectRef.current ) setAspectRef.current( undefined );
                  } }
                  aria-pressed={ aspectUI === undefined }
                >
                  Free
                </Button>
              </>
            ) }
            <Button
              className="editor-chat-sidebar__icon-button"
              label={ __( 'Annotate' ) }
              onClick={ handleToggleAnnotate }
              aria-pressed={ tool === 'annotate' }
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
                <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zm2.92 2.33H5v-.92l9.06-9.06.92.92L5.92 19.58zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" fill="currentColor" />
              </svg>
            </Button>
            <Button
              className="editor-chat-sidebar__save"
              variant="primary"
              disabled={ ! isDirty }
              onClick={ handleSave }
            >
              { __( 'Save' ) }
            </Button>
            <DropdownMenu icon={ moreVertical } label={ __( 'More options' ) }>
              { ( { onClose } ) => (
                <>
                  <MenuItem
                    onClick={ () => {
                      // Stub: Open in classic editor
                      onClose();
                    } }
                  >
                    { __( 'Open in Classic Image Editor' ) }
                  </MenuItem>
                </>
              ) }
            </DropdownMenu>
          </div>
        ) }
        <Button
          className="editor-chat-sidebar__icon-button"
          label={ __( 'Close chat' ) }
          icon={ <Icon icon={ close } /> }
          onClick={ onCloseChat }
        />
      </div>
    </div>
  );
}
