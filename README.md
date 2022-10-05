# Rapid Time Tracker

Rapid Time Tracker is an ultra-lightweight time tracker operating on a local text file.
- **Fast**: Intelligent fuzzy search enables rapid entry input.
- **Logical**: Recorded activities are fully hierarchical, with visualizations capturing time-spending patterns at any scale.
- **Privacy first**: Data is stored in a single local text-editor friendly txt file, which can be managed in any way you'd prefer.

---

![main-screenshot](screenshots/main.png)

---

## Table of Contents
- [Getting Started](#getting-started)
  - [Download binary](#download-binary)
  - [Building the binary yourself](#building-the-binary-yourself)
  - [Development build](#development-build)
- [Usage](#usage)
  - [Basics](#basics)

---

## Getting Started

Rapid Time Tracker is built with [Electron React Boilerplate](https://github.com/electron-react-boilerplate/electron-react-boilerplate). Windows, macOS, and Linux are all supported.

### Download binary
Grab the latest binary from the [releases page](https://github.com/TommyX12/rapid-time-tracker/releases).

### Building the binary yourself

1. Clone the repository:
   ```bash
   git clone https://github.com/TommyX12/rapid-time-tracker.git
   ```
2. Enter the directory and install dependencies:
   ```bash
   cd rapid-time-tracker
   npm install
   ```
3. Build the binary:
   ```bash
   npm run package
   ```
   The built binary will be in `./release/build`.
  - **Mac**: Go to `./release/build`, and open the `.dmg` file.
  - **Windows**: Go to `./release/build`, and open the `.exe` file.

### Development build

To run a live-reload debug build:

```bash
npm start
```

## Usage

### Basics
