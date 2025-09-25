/**
 * WordPress dependencies
 */
import { privateApis as blockEditorPrivateApis } from '@wordpress/block-editor';
import { unlock } from '../../lock-unlock';

const { useImageEditingContext } = unlock( blockEditorPrivateApis );

export default function CropContextSpy({ onCropChange, onContext }) {
  const { crop, zoom, aspect, setZoom, setAspect } = useImageEditingContext();
  if ( onCropChange ) onCropChange( crop );
  if ( onContext ) onContext( { zoom, aspect, setZoom, setAspect } );
  return null;
}

