# Block Comments System Architecture

## Overview

The Block Comments system in Gutenberg is a collaborative editing feature that allows users to add contextual comments to specific blocks during the content creation process. This is distinct from traditional WordPress post comments and is designed for editorial collaboration workflows.

## Core Architecture

### System Components

The Block Comments system operates on a multi-layered architecture:

- **Frontend**: React components in `/packages/editor/src/components/collab-sidebar/`
- **Backend**: PHP controllers and REST API extensions in `/lib/experimental/`
- **Data Layer**: WordPress core-data entities with custom comment type handling
- **Real-time Sync**: HTTP-based signaling server for collaborative features

### Data Flow

#### Comment Creation Flow
1. User selects a block and clicks "Add Comment"
2. System opens collaboration sidebar with comment form
3. On submission, creates comment with `type: 'block_comment'`
4. Associates comment ID with block via `blockCommentId` attribute
5. Updates block editor state and triggers re-render

#### Comment Display Flow
1. Editor loads all `block_comment` type comments for current post
2. Comments are filtered and organized into threaded structure
3. System builds block-to-comment mapping using `getCommentIdsFromBlocks`
4. Comments are sorted by block order and displayed in sidebar

## Key Components

### Frontend Components (`/packages/editor/src/components/collab-sidebar/`)

#### Core Components
- **`index.js`**: Main orchestrator component
  - Manages collaboration sidebar state
  - Coordinates comment CRUD operations
  - Handles block-to-comment associations via `blockCommentId` attribute
  - Implements comment threading and sorting logic

- **`comments.js`**: Comment display and interaction component
  - Renders threaded comment discussions
  - Handles comment resolution (approval status)
  - Manages reply functionality
  - Provides edit/delete operations with confirmation dialogs

- **`comment-form.js`**: Reusable form component for comment input
  - Handles text input with validation
  - Provides submit/cancel functionality
  - Used for both new comments and replies

- **`add-comment.js`**: New comment creation interface
  - Triggered when user selects a block without existing comments
  - Integrates with the comment form for new comment submission

#### UI Integration Components
- **`comment-button.js`**: Menu item integration for new comments
- **`comment-button-toolbar.js`**: Block toolbar integration for existing comments
- **`comment-author-info.js`**: Author information display
- **`utils.js`**: Utility functions for comment operations
- **`constants.js`**: System constants and configuration

### Backend Components (`/lib/experimental/`)

#### Core PHP Files
- **`block-comments.php`**: 
  - Defines `block_comment` as a custom comment type
  - Excludes block comments from WordPress admin comment queries
  - Handles avatar integration for block comments

- **`class-gutenberg-rest-comment-controller.php`**:
  - Extends WordPress REST Comments Controller
  - Provides enhanced permission checking for block comments
  - Enables creation of block comments via REST API

- **`synchronization.php`**:
  - Manages collaborative editing secrets
  - Integrates with the HTTP signaling server
  - Handles real-time synchronization setup

#### Real-time Infrastructure
- **`sync/class-gutenberg-http-signaling-server.php`**: HTTP signaling server
  - File-based message queue system
  - Topic-based pub/sub messaging
  - Client heartbeat/ping mechanism
  - Server-sent events for real-time updates

### Block Editor Integration (`/packages/block-editor/src/components/collab/`)

- **`block-comment-icon-slot.js`**: Icon slot for comment indicators
- **`block-comment-icon-toolbar-slot.js`**: Toolbar slot for comment buttons

## Data Structures

### Comment Entity
Block comments use the standard WordPress comment entity with these key fields:
- `id`: Comment identifier
- `content`: Comment text content
- `post`: Associated post ID
- `parent`: Parent comment ID (for threading)
- `type`: Set to `'block_comment'`
- `status`: Comment approval status ('hold', 'approved', 'trash')
- `author`: User ID of comment author
- `meta`: Additional metadata storage

### Block Integration
- **`blockCommentId`**: Custom block attribute added to all core blocks
- Links blocks to their associated comment threads
- Managed through block editor's `updateBlockAttributes` action

## REST API Integration

### Endpoints
- **`/wp/v2/comments`**: Standard WordPress comments endpoint
- Enhanced with block comment support through custom controller
- Supports filtering by `type=block_comment`
- Handles block comment-specific permissions

### Comment Operations
- **Create**: `POST /wp/v2/comments` with `comment_type: 'block_comment'`
- **Read**: `GET /wp/v2/comments?type=block_comment&post={postId}`
- **Update**: `PUT /wp/v2/comments/{id}` (content, status changes)
- **Delete**: `DELETE /wp/v2/comments/{id}`

## User Experience

### Adding Comments
1. User selects block in editor
2. "Add Comment" button appears in block toolbar (if no existing comment) or block menu
3. Clicking opens collaboration sidebar with comment form
4. User types comment and submits
5. Comment appears in sidebar with resolve/edit/delete options

### Managing Comments
1. Comments display in dedicated sidebar panel
2. Threading shows replies indented under parent comments
3. Active block's comment is highlighted
4. "Show more replies" interaction for collapsed threads
5. Resolve button marks comments as approved
6. Edit/delete options available via dropdown menu

### Comment Resolution
1. Comments start with `status: 'hold'` (pending)
2. Resolve button changes status to `'approved'`
3. Resolved comments show checkmark icon
4. Resolved comments are read-only

## Technical Implementation

### State Management
- Uses WordPress `@wordpress/data` stores
- `core-data` store for comment entities
- `block-editor` store for block attributes
- `editor` store for post-level data

### Performance Considerations
- Comment queries limited to 100 per page
- Efficient block-to-comment mapping via `getCommentIdsFromBlocks`
- Lazy loading of comment threads
- Optimized re-rendering with React keys

### Security
- Permission checks for comment creation/modification
- User authentication required for block comments
- Moderator capabilities for status changes
- Sanitization of comment content

## Real-time Features

### HTTP Signaling Server
- File-based message queue system
- Topic-based pub/sub messaging
- Client heartbeat/ping mechanism
- Automatic cleanup of old connections
- Server-sent events for real-time updates

### Collaborative Features
- Multi-user comment viewing
- Real-time comment updates
- Conflict resolution through server coordination
- User presence indicators

## Integration Points

### Block Editor Integration
- `blockCommentId` attribute injection via `addFilter`
- SlotFill pattern for toolbar/menu integration
- Block selection state integration
- Global styles context for theming

### WordPress Core Integration
- Extends native comment system
- Excludes block comments from admin comment screens
- Maintains compatibility with WordPress comment APIs
- Integrates with user avatar system

## Current Status & Limitations

### Experimental Status
- Feature is behind experiment flag
- Only available for non-published posts
- File-based storage for signaling server
- Single post scope for comments
- Basic signaling without full operational transformation

### Architecture Considerations
- Built for extensibility with SlotFill pattern
- Maintains separation between block comments and post comments
- Designed for editorial workflows rather than public commenting
- Integrates with WordPress permissions and user systems

## File Structure

```
packages/
├── editor/src/components/collab-sidebar/     # Main collaboration UI
├── block-editor/src/components/collab/       # Block integration
├── core-data/src/entity-types/comment.ts     # Comment data types
└── icons/src/library/comment*.js             # Comment-related icons

lib/experimental/
├── block-comments.php                        # Core PHP functionality
├── class-gutenberg-rest-comment-controller.php # REST API extensions
├── synchronization.php                       # Real-time sync setup
└── sync/class-gutenberg-http-signaling-server.php # Signaling server

test/
├── e2e/specs/editor/blocks/comments.spec.js  # E2E tests
├── integration/fixtures/blocks/              # Block fixtures
└── phpunit/blocks/render-comment*-test.php   # PHP tests
```

This architecture provides a solid foundation for collaborative editing workflows while maintaining integration with WordPress's existing comment system and the Gutenberg block editor framework.