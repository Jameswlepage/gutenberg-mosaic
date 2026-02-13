export interface CollaboratorPresenceInfo {
	name: string;
	color: string;
	avatar_urls?: Record< string | number, string >;
}

export interface CollaboratorPresenceItem {
	clientId: string | number;
	collaboratorInfo: CollaboratorPresenceInfo;
	isConnected: boolean;
}
