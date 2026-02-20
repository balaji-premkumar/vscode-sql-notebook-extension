# SQL Notebook for VS Code

A VS Code extension that brings Azure Data Studio-style SQL notebook functionality to Visual Studio Code. Execute SQL queries in Jupyter-style notebook cells with full connection management, an object explorer, and result rendering.

## Features

- **SQL Notebooks (`.sqlnb`)** -- Jupyter-style notebooks with a dedicated SQL kernel
- **SQL Kernel for Jupyter Notebooks (`.ipynb`)** -- Use the SQL kernel inside standard Jupyter notebooks alongside Python, R, etc.
- **Connection Editor** -- Full webview form to add, edit, and test connections with validation
- **Connection Management** -- Add connections manually, edit existing ones, or import from the MSSQL extension
- **Object Explorer** -- Hierarchical tree view of servers, databases, tables, views, stored procedures, functions, and columns
- **Server Groups** -- Organize connections into named groups with drag-and-drop support
- **Multi-Connection Groups** -- Open query windows or notebooks with all connections in a group at once
- **Result Rendering** -- HTML table output with Copy-as-CSV, row counts, and execution time
- **Active Connection Display** -- Status bar and notebook toolbar show the currently selected server and database

---

## Installation

### From Source (Development)

1. **Prerequisites**
   - [Node.js](https://nodejs.org/) v18 or later
   - [Visual Studio Code](https://code.visualstudio.com/) v1.75 or later
   - Git (optional)

2. **Clone and install dependencies**

   ```bash
   cd sql-notebook
   npm install
   ```

3. **Build the extension**

   ```bash
   npm run compile
   ```

4. **Launch in VS Code**

   - Open the `sql-notebook` folder in VS Code
   - Press **F5** to launch the Extension Development Host
   - The extension will be active in the new VS Code window

### Package as VSIX (Portable Install)

1. **Install the packaging tool**

   ```bash
   npm install -g @vscode/vsce
   ```

2. **Build and package**

   ```bash
   npm run package
   vsce package
   ```

3. **Install the VSIX**

   - In VS Code, open the Command Palette (`Ctrl+Shift+P`)
   - Run **Extensions: Install from VSIX...**
   - Select the generated `.vsix` file

---

## Getting Started

### 1. Add a Database Connection

Open the **SQL Notebook** sidebar (database icon in the Activity Bar) and click the **+** button to add a connection. This opens the **Connection Editor** form where you can configure:

- **Connection Name** -- A friendly label for the connection
- **Server Address** and **Port** -- The SQL Server hostname and port (default 1433)
- **Default Database** -- The database to connect to initially
- **Authentication** -- SQL Login (username/password) or Windows Authentication
- **Encryption Options** -- Encrypt connection and trust server certificate toggles
- **Test Connection** -- Validate connectivity before saving

You can also **Import from MSSQL Extension** if the [MSSQL extension](https://marketplace.visualstudio.com/items?itemName=ms-mssql.mssql) is installed.

Connections are stored locally and passwords are saved securely using VS Code's built-in SecretStorage.

### 2. Edit a Connection

Right-click any connection in the Object Explorer and select **Edit Connection** to reopen the Connection Editor form with the existing values pre-filled. Update any fields and save.

### 3. Create a SQL Notebook

**Option A: New `.sqlnb` file**

- Open the Command Palette (`Ctrl+Shift+P`) and run **SQL Notebook: New Notebook**
- Or create a file with the `.sqlnb` extension

**Option B: Open the included sample**

- Open `sample.sqlnb` from the project folder

### 4. Select a Connection and Database

- Click the **server name** in the status bar (bottom-right) to select an active connection
- Click the **database name** next to it to switch databases
- Or use the notebook toolbar buttons at the top of any open notebook

### 5. Execute SQL Cells

- Write SQL in a code cell
- Click the **Run** button (or press `Shift+Enter`) to execute
- Results appear as an HTML table below the cell with row count, execution time, and a Copy-as-CSV button

---

## Using the SQL Kernel with Jupyter Notebooks (.ipynb)

The extension registers a standalone **SQL (SQL Notebook)** kernel that can be used with standard Jupyter notebooks. This allows you to run SQL cells inside `.ipynb` files alongside other kernels.

### Setup

1. Open any `.ipynb` file in VS Code (requires the [Jupyter extension](https://marketplace.visualstudio.com/items?itemName=ms-toolsai.jupyter))
2. Click the **kernel selector** in the top-right corner of the notebook
3. Select **SQL (SQL Notebook)** from the list of available kernels
4. Set your active connection using the status bar or Command Palette (`SQL Notebook: Select Active Connection`)

### How It Works

- The SQL kernel shares the same connection manager as `.sqlnb` notebooks
- Any connection you add or import is available to both notebook types
- The active connection and database apply across all open notebooks
- Results render identically in both notebook types (HTML tables with Copy-as-CSV)

### Example: Mixed-Language Notebook

You can create a Jupyter notebook that uses different kernels for different cells:

1. Create a new `.ipynb` file
2. Add a SQL cell, select the **SQL (SQL Notebook)** kernel, and query your database
3. Switch kernels to Python for data analysis on the results
4. Switch back to SQL for additional queries

> **Note:** Each SQL cell executes as an independent batch. Variables declared in one cell (e.g., `DECLARE @x`) are not available in subsequent cells. Use permanent tables or global temp tables (`##temp`) to share data between cells.

---

## Object Explorer

The sidebar tree view provides a hierarchical view of your connected servers:

```
Server Groups
  +-- Group Name
  |     +-- Server Connection
  |           +-- Databases
  |                 +-- DatabaseName
  |                       +-- Tables
  |                       |     +-- dbo.TableName
  |                       |           +-- Columns (with data types)
  |                       +-- Views
  |                       +-- Stored Procedures
  |                       +-- Functions
  +-- Ungrouped Connections
        +-- Server Connection
```

### Right-Click Context Menu -- Connections

Right-click on a **connection** node for:
- **Edit Connection** -- Open the Connection Editor form to modify server, credentials, or other settings
- **Server Properties** -- View server version, edition, memory, CPU count, and more
- **New Query** -- Open a `.sql` file pre-configured with the connection details
- **New Notebook** -- Create a new `.sqlnb` notebook pre-configured with the connection and database
- **Move to Group** -- Assign the connection to a server group
- **Remove Connection** -- Delete the connection

### Right-Click Context Menu -- Server Groups

Right-click on a **group** (folder) node for:
- **Add Connection to Group** -- Open the Connection Editor to create a new connection that is automatically assigned to this group
- **New Query (All Connections)** -- Opens one SQL query tab per connection in the group, each pre-filled with connection details (server, database, connection name)
- **New Notebook (All Connections)** -- Creates a single notebook containing sections for every connection in the group, with a markdown header and SQL cell per connection
- **Rename Group** -- Change the group name
- **Remove Group** -- Delete the group (connections are ungrouped, not deleted)

### Multi-Connection Groups

Server groups support working with multiple connections simultaneously:

1. **Create a group** using the folder icon in the Object Explorer toolbar
2. **Add connections** to the group via drag-and-drop or the "Add Connection to Group" right-click option
3. **Right-click the group** and choose:
   - **New Query (All Connections)** to open a separate query editor tab for each connection in the group
   - **New Notebook (All Connections)** to create a notebook with dedicated sections for each connection

This is useful when you need to run the same query across multiple servers (e.g., comparing staging vs. production) or document queries against a set of related databases.

> **Note:** Only one connection can be active at a time. When working with a multi-connection notebook, switch the active connection via the status bar or command palette before executing cells for a different server.

### Drag and Drop

- Drag connections into groups to organize them
- Drag connections out of groups to ungroup them

---

## Commands

### Command Palette

| Command | Description |
|---|---|
| `SQL Notebook: New Notebook` | Create a new `.sqlnb` notebook |
| `SQL Notebook: Add Connection` | Open the Connection Editor form to add a new connection |
| `SQL Notebook: Select Active Connection` | Choose the active connection for query execution |
| `SQL Notebook: Select Database` | Switch the active database |
| `SQL Notebook: Import Connection from MSSQL Extension` | Import a connection from the MSSQL extension |
| `SQL Notebook: Create Server Group` | Create a new server group |
| `SQL Notebook: Refresh Connections` | Refresh the object explorer tree |

### Context Menu -- Connections (right-click)

| Command | Description |
|---|---|
| Edit Connection | Open the Connection Editor to modify this connection |
| Server Properties | View server version, edition, and system info |
| New Query | Open a `.sql` editor tab for this connection |
| New Notebook | Create a `.sqlnb` notebook for this connection |
| Move to Group | Assign this connection to a server group |
| Remove Connection | Delete this connection |

### Context Menu -- Groups (right-click)

| Command | Description |
|---|---|
| Add Connection to Group | Create a new connection assigned to this group |
| New Query (All Connections) | Open one query tab per connection in the group |
| New Notebook (All Connections) | Create a notebook with sections for all connections |
| Rename Group | Change the group name |
| Remove Group | Delete the group (connections are kept) |

---

## Development

### Build

```bash
npm run compile          # One-shot webpack build
npm run watch            # Webpack watch mode (rebuilds on file changes)
npm run package          # Production build with minification
```

### Launch Configurations

The project includes three launch configurations in `.vscode/launch.json`:

| Configuration | Description |
|---|---|
| **Run Extension** | Starts webpack in watch mode, then launches. Best for active development. |
| **Run Extension (Compile Only)** | One-shot build, then launches. Faster startup. |
| **Run Extension (No Build)** | Skips build entirely. Use when watch mode is already running. |

Press **F5** to launch with the default "Run Extension" configuration.

### Lint

```bash
npm run lint
```

---

## Requirements

- **VS Code** v1.75 or later
- **SQL Server** (any edition) or Azure SQL Database for query execution
- **MSSQL Extension** (optional) -- For importing existing connections from `ms-mssql.mssql`
- **Jupyter Extension** (optional) -- Required only if you want to use the SQL kernel inside `.ipynb` notebooks

---

## File Format

SQL Notebooks use the `.sqlnb` extension and store data as JSON:

```json
{
  "cells": [
    {
      "kind": "markup",
      "language": "markdown",
      "value": "# My Notebook"
    },
    {
      "kind": "code",
      "language": "sql",
      "value": "SELECT * FROM sys.databases;"
    }
  ],
  "metadata": {
    "connectionId": null
  }
}
```

---

## Known Limitations

- **No cross-cell variables** -- Each cell executes as an independent SQL batch. `DECLARE` variables and local temp tables (`#temp`) do not persist across cells. Use global temp tables (`##temp`) or permanent tables to share data.
- **Single active connection** -- All notebooks share the same active connection and database. Switching the connection affects all open notebooks.
- **SQL Server only** -- Currently supports Microsoft SQL Server and Azure SQL Database. PostgreSQL, MySQL, and other databases are not supported.
