/**
 * Shared utilities for collaborator presence styling.
 */

const COLOR_PALETTE = [
	'#3858E9', // blueberry
	'#B42AED', // purple
	'#E33184', // pink
	'#F3661D', // orange
	'#ECBD3A', // yellow
	'#97FE17', // green
	'#00FDD9', // teal
	'#37C5F0', // cyan
];

function hashString( value ) {
	let hash = 0;
	for ( let i = 0; i < value.length; i++ ) {
		hash = ( hash << 5 ) - hash + value.charCodeAt( i );
		hash |= 0;
	}
	return Math.abs( hash );
}

export function getStableCollaboratorColor( user, fallback = '#1e1e1e' ) {
	const clientIdValue = user?.clientId;
	const clientId =
		clientIdValue === undefined || clientIdValue === null
			? ''
			: String( clientIdValue );
	if ( clientId.startsWith( 'gemini-ai' ) ) {
		return '#1a73e8';
	}

	const userInfo = user?.userInfo;
	const seed = userInfo?.id ?? userInfo?.slug;

	if ( seed !== undefined && seed !== null && seed !== '' ) {
		const index = hashString( String( seed ) ) % COLOR_PALETTE.length;
		return COLOR_PALETTE[ index ];
	}

	return userInfo?.color || fallback;
}
