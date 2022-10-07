# Rapid Time Tracker

Rapid Time Tracker is an ultra-lightweight time tracker operating on a local text file.
- **Fast**: Intelligent fuzzy search enables rapid entry input.
- **Logical**: Recorded activities are fully hierarchical, with visualizations capturing time-spending patterns at any scale.
- **Privacy first**: Data is stored in a local editor-friendly txt file, which can be managed in any way you'd prefer.

---

![main-screenshot](screenshots/main.png)

---

## Table of Contents
- [Getting Started](#getting-started)
  - [Download binary](#download-binary)
  - [Building the binary yourself](#building-the-binary-yourself)
  - [Development build](#development-build)
- [Basic Usage](#basic-usage)
- [Advanced Usage](#advanced-usage)

---

## Getting Started

Rapid Time Tracker is built with [Electron React Boilerplate](https://github.com/electron-react-boilerplate/electron-react-boilerplate). Windows, macOS, and Linux are all supported.

### Download binary
Grab the latest binary from the [releases page](https://github.com/TommyX12/rapid-time-tracker/releases).

### Building the binary yourself

If you want to build the library from source:

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

If you want to run a live-reload debug build for development:

```bash
npm start
```

## Basic Usage

To add your first record:
- Open Rapid Time Tracker
- Click `New` to create a new data file (.txt)
- Click `Add` on the top left
- Enter a new action name
- Press `shift + enter` to create the new action, press `enter` again to confirm
- Press `enter`, modify duration (e.g. your preferred unit), press `enter` again to add the record.

### Opening a data file

When using the time tracker for the first time, simply create a new data file or open an existing one from the welcome page. The data file will be a txt file that you can freely edit and move (see the [data file](#the-data-file) section).

### Recording time

In Rapid Time Tracker, an **action** means an activity whose time is being tracked. A **record** means a particular session of this activity.

A record consists of:
- The action (i.e. activity) that is being done
- The time when the action finished
- The duration of the action in this session (can be in any unit you want, most commonly *hours*)

Click the `Add` button to add a new record.

![add](screenshots/add.png)

Use the record dialog to enter the information. See the [fuzzy finder](#the-fuzzy-finder) section for tips and advanced usage.

![add-record](screenshots/add-record.png)

To create a new action for this record, type a name for the action into the input box. You can also type a hierarchical name (e.g. `entertainment: games: minecraft`), separated by `:`. Once you typed the name, **press `shift + enter`** to create a new action with this name, then `enter` again to confirm.

![new-action](screenshots/new-action.png)

Once an action is selected/created, press enter (while the input box is active) to confirm. Change the duration of the record if needed, then press enter again to finally create the record.

#### Note on hierarchy

Records can only be created for **leaf** actions, which are actions with no children. If an action is no longer leaf, a new child called `other` will be automatically created and all existing records on the parent will be moved to it.

### Visualization

#### Timeline

The timeline (on the left side) allows you to view records in chronological order. Use mouse wheel scrolling to move across timeline. You can also click on the records to edit them.

#### Tree

The tree (on the right side) allows you to view the total recorded amount for each action, in a hierarchical structure. Records for child actions, e.g. `entertainment: games: minecraft`, automatically count towards records for ancestors (e.g. `entertainment` and `entertainment: games`).

You can click on the actions to edit them.

![tree](screenshots/tree.png)

To view the total recorded amounts in a given period of time, use the date range toolbar on the top. You can also select the units (e.g. `Per day`, `Per week`, `Percentage`) to display instead of the total.

![date-range](screenshots/date-range.png)

A block-visualization of the record times is shown on the right most side, with vertical height of the blocks corresponding to the total recorded duration for the action. You can hover on the blocks to see the exact amounts (depending on the unit option) for the particular action.

![bar](screenshots/bar.png)

## Advanced Usage

### The fuzzy finder

### The data file
