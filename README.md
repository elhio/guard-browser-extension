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

**🛡️ Multi-Layered Content Moderation:** Automatically checks web images as you browse to find AI-made, violent, or 
sexual content before you see them.

**⚡ Fast Local Inference:** Runs a lightweight AI classification model entirely on-device using ONNX Runtime 
and WebAssembly. To save system resources, you can disable the AI model and rely on instant C2PA metadata checks.

**🌐 Deep Scan Verification:** Not sure about a local result? Click the “Verify” button on the badge to send the image 
to our advanced API models for a highly accurate secondary verification.

**⚙️ Granular Control:** Toggle specific detection tasks (e.g., turn off violence detection but keep AI detection), 
choose how the extension reacts to flagged content (mark, blur, or hide), or whitelist specific websites.

## Installation

### From Extension Stores

* [Chrome Web Store](#) *(Coming Soon)*
* [Firefox Add-ons](#) *(Coming Soon)*
* [App Store](#) *(Coming Soon)*

### Manual Installation (Unpacked)

If you want to install the latest version manually or test it locally:

1. Download the latest release from the [Releases page](https://github.com/elhio/guard-browser-extension/releases) or build it from source (see below).
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

* [Node.js](https://nodejs.org/) (v22 or higher recommended)
* `npm`, `yarn`, or `pnpm`
* *For Safari / Apple development:* A Mac running a recent version of macOS and [Xcode](https://developer.apple.com/xcode/)

### Setup: Web Extension (Chrome, Firefox)

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

### Setup: iOS & macOS Apps (Safari Extension)

Development for Apple platforms (including the Safari extension) is handled through Xcode using the dedicated `apple` 
directory.

1. Clone the repository (if you haven't already):
    ```bash
    git clone [https://github.com/elhio/guard-browser-extension.git](https://github.com/elhio/guard-browser-extension.git)
    cd guard-browser-extension
    ```

2. Build the extension itself. Xcode bundles the output of this command — it does **not** run it for you:
    ```bash
    npm install
    npm run build:safari
    ```
   
3. Navigate into the `apple` directory:
    ```bash
    cd apple
    ```

4. Open the project in Xcode. You can do this by double-clicking the Xcode project file or running the following command 
in your terminal:
    ```bash
    open .
    ```

5. Select your target device (e.g., "My Mac" or an iOS Simulator) from the Xcode toolbar.
6. Click the **Run** button (or press `Cmd + R`) to build and run the native app and its bundled Safari extension.


## Contributing

We welcome contributions! Please note that all contributors must sign our automated CLA. Read more in our 
[Contributing Guide](CONTRIBUTING.md).

## License

This project is licensed under the GNU Affero General Public License v3.0 (AGPL-3.0) - see the [LICENSE](LICENSE) file 
for details.
