/**
 * Internal dependencies
 */
import { useEntityRecordsWithPermissions } from './hooks/use-entity-records';
import {
	useActiveUsers,
	useActiveCollaborators,
	useGetAbsolutePositionIndex,
} from './hooks/use-post-editor-awareness-state';
import { RECEIVE_INTERMEDIATE_RESULTS } from './utils';
import { getSyncManager } from './sync';
import { lock } from './lock-unlock';

export const privateApis = {};
lock( privateApis, {
	useActiveUsers,
	useEntityRecordsWithPermissions,
	RECEIVE_INTERMEDIATE_RESULTS,
	getSyncManager,
	useActiveCollaborators,
	useGetAbsolutePositionIndex,
} );
