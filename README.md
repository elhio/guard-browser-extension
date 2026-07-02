<div align="center">
  <h1>
    <img src="./src/assets/guard.svg" width="100" alt="Guard Logo"><br>
    Guard
  </h1>
  <p><em>A browser extension to detect deepfakes and any other visual content you choose to filter out, right on the webpage</em></p>
  <p>
    <a href="https://www.gnu.org/licenses/agpl-3.0"><img src="https://img.shields.io/badge/License-AGPL%20v3-blue.svg" alt="License: AGPL v3"></a>
    <a href="https://wxt.dev/"><img src="https://img.shields.io/badge/Built%20with-WXT-2b6cb0.svg" alt="Built with WXT"></a>
    <a href="https://github.com/elhio/guard-browser-extension/fork"><img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs Welcome"></a>
  </p>
</div>

## Features

* **[Feature 1]:** *(Coming Soon)*
* **[Feature 2]:** *(Coming Soon)*

## Installation

### From Extension Stores

* [Chrome Web Store](#) *(Coming Soon)*
* [Firefox Add-ons](#) *(Coming Soon)*

### Manual Installation (Unpacked)

If you want to install the latest version manually or test it locally:

1. Download the latest release from the [Releases page](https://github.com/yourusername/yourrepo/releases) or build it from source (see below).
2. **Chrome/Edge/Brave:**
   * Go to `chrome://extensions/`
   * Enable **Developer mode** in the top right corner.
   * Click **Load unpacked** and select the generated `/.output/chrome-mv3` directory.
3. **Firefox:**
   * Go to `about:debugging#/setup`
   * Click **Load Temporary Add-on...**
   * Select the `manifest.json` file inside the `/.output/firefox-mv2` directory.

## Development

This project is built using [WXT](https://wxt.dev/), the Next-gen Web Extension Framework. 

### Prerequisites

* [Node.js](https://nodejs.org/) (v18 or higher recommended)
* `npm`, `yarn`, or `pnpm`

### Setup

1. Clone the repository:
    ```bash
    git clone https://github.com/elhio/guard-browser-extension.git
    cd guard-browser-extension
    ```
   
2. Copy the example environment file:
    ```bash
    cp .env.example .env
    ```

3. Install dependencies:
    ```bash
    npm install # or yarn install / pnpm install
    ```

4. Start the development server (loads the extension in a fresh browser profile):
    ```bash
    npm run dev
    ```

5. Build for production:
    ```bash
    npm run build
    ```

## Contributing

We welcome contributions! Please note that all contributors must sign our automated CLA. Read more in our 
[Contributing Guide](CONTRIBUTING.md).

## License

This project is licensed under the GNU Affero General Public License v3.0 (AGPL-3.0) - see the [LICENSE](LICENSE) file 
for details.
