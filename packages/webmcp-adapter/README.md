# WebMCP Adapter

WebMCP adapter for exposing WordPress abilities as browser tools.

This package provides a layered WebMCP surface backed by the Abilities API:

-   `wp-discover-abilities`
-   `wp-get-ability-info`
-   `wp-execute-ability`

By default, abilities are exposed only when:

-   `meta.mcp.public === true`
-   optional `meta.mcp.context` rules match the current WordPress page context (`pagenow`, `adminpage`, `typenow`, URL query vars)

## Installation

Install the module:

```bash
npm install @wordpress/webmcp-adapter --save
```

_This package assumes that your code will run in an ES2015+ environment. If you're using an environment that has limited or no support for such language features and/or APIs, you should include the polyfill shipped in `@wordpress/babel-preset-default` in your code._

## Prerequisites

-   Abilities must already be registered in `@wordpress/abilities` (for example via `@wordpress/core-abilities` in wp-admin).
-   The browser must support `navigator.modelContext`.

## Usage

Importing the package registers tools automatically when `navigator.modelContext` is available:

```js
import '@wordpress/webmcp-adapter';
```

You can also register explicitly and override exposure, naming, and confirmation behavior:

```js
import { registerAbilitiesWebMCPAdapter } from '@wordpress/webmcp-adapter';

registerAbilitiesWebMCPAdapter( {
	isAbilityExposed: ( ability, wpContext ) => {
		return (
			Boolean( ability?.meta?.mcp?.public ) && wpContext.screen === 'post'
		);
	},
	requestConfirmation: async ( { confirmationLevel, agent } ) => {
		if ( confirmationLevel === 'none' ) {
			return true;
		}

		if ( typeof agent?.requestUserInteraction !== 'function' ) {
			return false;
		}

		return agent.requestUserInteraction( () => {
			return window.confirm( 'Allow this ability execution?' );
		} );
	},
} );
```

You can also define context rules directly in ability metadata:

```js
meta: {
	mcp: {
		public: true,
		context: {
			screens: [ 'post', 'site-editor' ],
			postTypes: [ 'post', 'page' ],
			query: {
				post: [ '123', '456' ],
			},
		},
	},
}
```

## API

### `registerAbilitiesWebMCPAdapter( options? ): boolean`

Registers layered abilities tools with `navigator.modelContext`.

Returns `false` when WebMCP is unavailable in the current browser.

### `createAbilitiesWebMcpTools( options? ): WebMcpTool[]`

Returns the layered tool definitions without registering them.

### `getWordPressWebMcpContext(): WordPressWebMcpContext`

Returns WP context derived from globals and URL query vars.

### `doesAbilityMatchWpContext( ability, wpContext ): boolean`

Returns whether `ability.meta.mcp.context` matches the current WP context.

### `isAbilityPublicForAgents( ability ): boolean`

Default exposure predicate used by the adapter (`meta.mcp.public === true`).

### `getAbilityConfirmationLevel( ability ): 'none' | 'default' | 'destructive'`

Determines confirmation level from ability annotations:

-   `readonly` -> `'none'`
-   `destructive` -> `'destructive'`
-   otherwise -> `'default'`

## Contributing to this package

This is an individual package that's part of the Gutenberg project. The project is organized as a monorepo. It's made up of multiple self-contained software packages, each with a specific purpose. The packages in this monorepo are published to [npm](https://www.npmjs.com/) and used by [WordPress](https://make.wordpress.org/core/) as well as other software projects.

To find out more about contributing to this package or Gutenberg as a whole, please read the project's main [contributor guide](https://github.com/WordPress/gutenberg/tree/HEAD/CONTRIBUTING.md).

<br /><br /><p align="center"><img src="https://s.w.org/style/images/codeispoetry.png?1" alt="Code is Poetry." /></p>
