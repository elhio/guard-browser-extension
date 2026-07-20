# Contributing to Guard

Thank you for considering contributing to Guard! We welcome contributions from everyone, whether it’s fixing 
bugs, adding new features, optimizing detection, or improving documentation.

The following is a set of guidelines for contributing to this repository.

## The Contributor License Agreement (CLA)

Before we can merge your first Pull Request, you will need to sign our Contributor License Agreement.

Don't worry, the process is fully automated! When you open your first Pull Request, our CLA bot will automatically 
comment on it with instructions. You will simply need to reply to that comment to sign the agreement. You only have to 
do this once.

## Getting Started

Before you start writing code, make sure your development environment is set up properly.

0. Fork the repository to your own GitHub account.

1. Install prerequisites: Ensure you have Node.js (v22 or higher recommended) and Xcode (if working on Apple platforms) 
installed.

2. Clone your fork: `git clone [https://github.com/YOUR_USERNAME/guard-browser-extension.git](https://github.com/YOUR_USERNAME/guard-browser-extension.git)`

3. Install dependencies: `npm install` (or yarn / pnpm)

For detailed instructions on running the local development servers for Chrome/Firefox or setting up the Safari Xcode 
project, please refer to the Development section in our `README.md`.

## Branching Strategy

To keep the repository organized, please use descriptive branch names based on the type of work you are doing:

* **Features:** `feature/add-blur-filter` or `feat/safari-ui-update`
* **Bug Fixes:** `fix/badge-icon-state`
* **Documentation:** `docs/update-readme`

Always branch off of the `main` branch, and make sure your fork is up to date before starting new work.

## Development, Linting & Testing

Please ensure your changes pass all code quality checks and tests before opening a Pull Request.

### Code Quality & Types

Run the linter and type-checker to ensure your code complies with our standards:

```bash
# check typescript types without emitting files
npm run compile

# run eslint to check for code issues
npm run lint

# automatically fix linting issues where possible
npm run lint:fix
```

### Running Tests

We use Vitest for unit testing and Playwright for end-to-end (E2E) testing. Please add or update tests whenever you 
introduce new features or fix bugs.

```bash
# run unit tests once
npm run test

# run unit tests in watch mode during development
npm run test:watch

# build the extension and run e2e browser tests
npm run test:e2e

# run E2E tests with the interactive playwright ui
npm run test:e2e:ui
```

### Apple Native Apps (Xcode)

* Make sure your project compiles successfully for both macOS and iOS targets in Xcode.
* Do not commit unnecessary Xcode user data files (`xcuserdata`).

## Submitting a Pull Request

When you are ready to submit your code, open a Pull Request (PR) against the main branch of the original repository.

Please include the following in your PR description:

* **The Problem:** What issue does this PR solve? (Link to an existing Issue if applicable).
* **The Solution:** A brief explanation of how you solved it.
* **Testing:** How did you test your changes? Mention if unit or E2E tests were added, and specify which browsers you tested 
on.
* **Screenshots:** If your PR changes the user interface, please attach "Before" and "After" screenshots.

Once submitted, a maintainer will review your code. We may request some changes before merging, but we will always be 
respectful and constructive!

## Reporting Bugs & Requesting Features

If you aren't writing code but found a bug or have a feature idea, please open an Issue!

* Provide as much detail as possible, including your browser version and OS.
* If it's a visual bug, include screenshots.
* If an image was flagged incorrectly, please provide feedback by verifying the result against one of our verification 
models (offered through API endpoints), clicking the `Mark incorrect` button in the drop-down menu, and filling out the 
pop-up questionnaire.