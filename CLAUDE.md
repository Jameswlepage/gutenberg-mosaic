# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is the **WordPress Gutenberg project** - the official repository for WordPress's block editor. Gutenberg is a React-based editor that introduces a modular approach to content creation using blocks. It's a monorepo managed with Lerna containing 90+ packages for different editor functionality.

## Development Commands

**IMPORTANT: NEVER run `npm run dev` or `npm start` - the development server is already running. These commands will conflict with the existing process.**

### Building and Development
- `npm run build` - Create production build
- `npm run build:packages` - Build all packages

### Testing
- `npm test` - Run linting and unit tests
- `npm run test:unit` - Run Jest unit tests only
- `npm run test:unit:watch` - Run unit tests in watch mode
- `npm run test:e2e` - Run end-to-end tests with Playwright
- `npm run test:e2e:debug` - Run e2e tests with UI for debugging
- `npm run test:php` - Run PHP unit tests
- `npm run test:native` - Run React Native tests

### Linting and Quality
- `npm run lint` - Run all linting (JS, CSS, lockfile, tsconfig, package.json)
- `npm run lint:js` - Run JavaScript/TypeScript linting
- `npm run lint:js:fix` - Auto-fix JavaScript/TypeScript issues
- `npm run lint:css` - Run CSS/SCSS linting
- `npm run format` - Format code using wp-prettier

### Environment Setup
- `npm run env` or `wp-env` - Manage local WordPress environment
- `npm run env start` - Start local WordPress with the plugin
- Requirements: Docker Desktop for wp-env

### Documentation and Storybook
- `npm run docs:build` - Build all documentation
- **Note**: Avoid starting Storybook dev server as development processes are already running

## Architecture Overview

### Monorepo Structure
- **packages/** - 90+ independent packages (components, data, blocks, etc.)
- **docs/** - Comprehensive documentation for contributors and developers
- **test/** - E2E tests, unit tests, and test utilities
- **lib/** - PHP backend integration code
- **packages/block-editor/** - Core block editor components and logic
- **packages/edit-*/** - Editor interfaces (edit-post, edit-site, edit-widgets)
- **packages/components/** - Reusable UI components
- **packages/data/** - State management and data layer

### Key Packages
- **@wordpress/block-editor** - Core block editor functionality
- **@wordpress/components** - UI component library
- **@wordpress/data** - State management (similar to Redux)
- **@wordpress/blocks** - Block registration and management
- **@wordpress/core-data** - WordPress data entities and REST API integration
- **@wordpress/edit-post** - Post editor interface
- **@wordpress/edit-site** - Site editor for Full Site Editing

### Build System
- Uses **webpack** for bundling with custom configuration
- **TypeScript** for type checking with incremental compilation
- **Lerna** for monorepo package management
- **wp-scripts** - WordPress-specific webpack/babel tooling
- Supports both development and production builds

### Data Flow
- Uses **@wordpress/data** for state management (Redux-like)
- Block editor state managed through selectors and actions
- REST API integration for WordPress data (posts, users, settings)
- Supports undo/redo functionality across all editor operations

### Testing Strategy
- **Jest** for unit testing with React Testing Library
- **Playwright** for end-to-end testing (replacing Puppeteer)
- **PHP Unit** tests for server-side functionality
- **React Native** testing for mobile editor
- Extensive snapshot testing for UI components

## Development Guidelines

### Code Organization
- Each package has its own build process and dependencies
- Follow existing patterns when adding new components or hooks
- Use TypeScript for new code where possible
- Component stories should be added to Storybook for UI components

### Common Patterns
- **Higher-Order Components (HOCs)** for adding editor functionality
- **Hooks** extensively used for state management and side effects
- **SlotFill** pattern for extensible UI areas
- **Block supports** system for adding common block features

### WordPress Integration
- Plugin integrates with WordPress through PHP files in `lib/`
- Experimental features can be enabled through `lib/experimental/`
- Block registration connects JavaScript definitions to PHP rendering

### Mobile Support
- React Native version maintained in parallel
- Native-specific files use `.native.js` extension
- Shared components have both web and native implementations

## Testing Your Changes

1. **Local Environment**: Use `wp-env start` to test in WordPress
2. **Unit Tests**: Run `npm run test:unit` for your changes
3. **E2E Tests**: Use `npm run test:e2e` to test full workflows
4. **Linting**: Always run `npm run lint` before committing
5. **Type Checking**: Ensure `npm run build:package-types` passes

## Performance Considerations

- Bundle size is closely monitored
- Code splitting used extensively
- Lazy loading for editor components
- React concurrent features utilized
- Performance tests run in CI/CD pipeline

## Contributing Workflow

- Fork and clone the repository
- Create feature branches from `trunk` (main branch)
- Install dependencies with `npm install`
- Make changes and test thoroughly
- Ensure all linting and tests pass
- Submit pull requests to `trunk` branch