/**
 * WordPress dependencies
 */
import { Button, Icon, Tooltip } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { image, plus } from '@wordpress/icons';
import { privateApis as blockEditorPrivateApis } from '@wordpress/block-editor';
import { unlock } from '../../lock-unlock';

import CropContextSpy from './CropContextSpy';

const { ImageEditingProvider, Cropper } = unlock( blockEditorPrivateApis );

export default function ImagePanel({
  isExpanded,
  isStudio,
  tool,
  setIsStudio,
  playFLIP,
  isImageSelected,
  frameRef,
  imgRef,
  annotateRef,
  onBaseImageLoad,
  imgNatural,
  setCropPercent,
  setDirtyCrop,
  zoomUI,
  aspectUI,
  setZoomRef,
  setAspectRef,
  setZoomUI,
  setAspectUI,
  handleReplaceOnCanvas,
  handleReplaceInChat,
  onAnnotatePointerDown,
  isGenerating,
}) {
  return (
    <div className={`editor-chat-sidebar__image${ isImageSelected ? ' editor-chat-sidebar__image--has-selection' : '' }`}>
      <div className="editor-chat-sidebar__image-frame" ref={ frameRef }>
          <img
            ref={ imgRef }
            onLoad={ onBaseImageLoad }
            className="editor-chat-sidebar__image-tag"
            src="https://images.unsplash.com/photo-1502085671122-2d218cd434e6?q=80&w=1200&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
            alt={ __( 'Placeholder image' ) }
            style={ { display: tool === 'crop' ? 'none' : 'block' } }
            data-state={ isGenerating ? 'generating' : undefined }
            className={`editor-chat-sidebar__image-tag${ isGenerating ? ' is-generating' : '' }`}
          />

          { isExpanded && isStudio && tool === 'crop' && (
            <div className="editor-chat-sidebar__cropper">
              <ImageEditingProvider
                id={ undefined }
                url={ imgRef.current?.src }
                naturalWidth={ imgNatural.w }
                naturalHeight={ imgNatural.h }
                onSaveImage={ () => {} }
                onFinishEditing={ () => {} }
              >
                <Cropper
                  url={ imgRef.current?.src }
                  width={ frameRef.current?.clientWidth || undefined }
                  height={ frameRef.current?.clientHeight || undefined }
                  naturalWidth={ imgNatural.w }
                  naturalHeight={ imgNatural.h }
                  borderProps={ { className: 'editor-chat-sidebar__wp-crop' } }
                />
                <CropContextSpy
                  onCropChange={ ( percent ) => {
                    setCropPercent( percent );
                    setDirtyCrop( true );
                  } }
                  onContext={ ( { zoom, aspect, setZoom, setAspect } ) => {
                    if ( typeof zoom === 'number' ) setZoomUI( Math.max( 1, Math.min( 3, zoom / 100 ) ) );
                    setAspectUI( aspect );
                    setZoomRef.current = setZoom;
                    setAspectRef.current = setAspect;
                  } }
                />
              </ImageEditingProvider>
            </div>
          ) }

          {/* Overlay actions positioned inside the image frame */}
          <Tooltip text={ __( 'Open in Image Studio' ) }>
            <Button
              className="editor-chat-sidebar__image-action"
              icon={ <Icon icon={ image } /> }
              label={ __( 'Open in Image Studio' ) }
              onClick={ () => { setIsStudio( true ); playFLIP( true ); } }
              tooltipPosition="top"
            />
          </Tooltip>

          { isImageSelected && (
            <Tooltip text={ __( 'Replace on Canvas' ) }>
              <Button
                className="editor-chat-sidebar__replace-action"
                icon={ <Icon icon={ plus } /> }
                label={ __( 'Replace on Canvas' ) }
                onClick={ handleReplaceOnCanvas }
                tooltipPosition="top"
              />
            </Tooltip>
          ) }

          { isExpanded && isStudio && tool === 'annotate' && (
            <canvas
              ref={ annotateRef }
              className="editor-chat-sidebar__annotate"
              onPointerDown={ onAnnotatePointerDown }
              width={ frameRef.current?.clientWidth || 0 }
              height={ frameRef.current?.clientHeight || 0 }
            />
          ) }
      </div>
    </div>
  );
}
