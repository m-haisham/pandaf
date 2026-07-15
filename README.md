# Hummingbird CLI

## Overview

**Hummingbird CLI** is an internal command-line tool designed to streamline interactions with the Hummingbird development stack. This tool simplifies starting, stopping, and managing projects/containers, whether globally or on a per-project basis. It provides a consistent interface for developers working within the stack.

## Features

- Run commands globally across all projects or target specific projects/services.
- Supports interactive and non-interactive modes.
- Adjustable verbosity for debugging (`-v`, `-vv`, etc).
- Built-in commands for managing, starting, stopping, and restarting projects and services.
- Database dump and restore for MySQL.
- Snapshot and restore of project state (code and database).
- Branch management and checkout across all projects.
- Configuration management via CLI.
- Aliases for common developer tools (Node, npm, yarn, PHP, Composer, Artisan, PHPUnit).
- Fallthrough for custom/external commands.

## Installation

Ensure the tool is properly installed and accessible from your terminal. For internal use only, follow the company’s installation guidelines.

## Usage

The CLI provides multiple commands and subcommands to manage the stack. Below is a guide to the available options.

### Global Options

```bash
USAGE:
    hbt [OPTIONS] <COMMAND>

OPTIONS:
    -v, --verbose             Increase verbosity for debugging purposes (repeatable).
    -n, --non-interactive     Run the command in non-interactive mode (dangerous).
    -h, --help                Show help information.
    --version                 Show the version.
```

### Commands

#### Top-Level Commands

- **start**  
  Start the development environment and check for potential issues.

- **stop**  
  Stop the development environment and check for potential issues.

- **doctor**  
  Check your configuration for potential issues.

- **setup**  
  Set up the development environment.

- **branch**  
  List current branches across all projects.

- **checkout [--branch <branch>] [--migrate]**  
  Checkout a branch across all projects.  
  - `--branch <branch>`: The branch to check out (optional, defaults to current project branch).  
  - `--migrate`: Migrate the database after checking out.

- **dump --key <key>**  
  Dump MySQL databases.  
  - `key`: A unique key to identify the dump.

- **restore --key <key>**  
  Restore MySQL databases.  
  - `key`: A unique key for the restore.

- **config [key] [value]**  
  Set or get a configuration value.  
  - If no key is provided, all config values are shown.  
  - If only key is provided, shows the value.  
  - If both key and value are provided, sets the value.

- **redis [args...]**  
  Run redis commands (advanced, raw passthrough).

#### Snapshot Commands

- **snapshot create [--include-repositories repo1,repo2,...] [--generate-patch] [--include-databases db1,db2,...]**  
  Create a snapshot of the project.  
  - `--include-repositories`: Only include specified repositories.  
  - `--generate-patch`: Generate a patch file for current changes.  
  - `--include-databases`: Only include specified databases.

- **snapshot restore --path <path>**  
  Restore a snapshot from a file.  
  - `--path`: Path to the snapshot file.

#### Global Project Commands

Affect all projects in the stack:

- **all up [args...]**  
  Start all projects.

- **all down [args...]**  
  Stop all projects.

- **all restart [args...]**  
  Restart all projects.

- **all git [args...]**  
  Run a git command for all projects.

- **all artisan [args...]**  
  Run an artisan command for all projects.

#### Project-Specific Commands

Run commands for individual projects or services. Supported projects include:  
`traefik`, `infra`, `gateway`, `rates`, `search`, `operations`, `foundation`, `products`, `api`, `app`, `nest`

Example usage:

```bash
hbt rates up
```

Each project supports the following subcommands:

- **up [args...]**  
  Start the project.

- **down [args...]**  
  Stop the project.

- **restart [args...]**  
  Restart the project.

- **shell [args...]**  
  Start an interactive shell in the project.

- **node [args...]**  
  Alias for running Node.js commands.

- **npm [args...]**  
  Alias for running npm commands.

- **yarn [args...]**  
  Alias for running yarn commands.

- **php [args...]**  
  Alias for running PHP commands.

- **artisan [args...]**  
  Alias for running Laravel Artisan commands.

- **composer [args...]**  
  Alias for running Composer commands.

- **phpunit [args...]**  
  Alias for running PHPUnit commands.

- **dump [--key <key>]**  
  Dump the project’s database.  
  - `key` (optional): A unique key for the dump.

- **restore --path <path>**  
  Restore the project’s database.  
  - `path`: The path to the dump file.

#### Fallthrough Commands

The CLI also supports custom external commands. These are passed as raw arguments:

```bash
hbt some-custom-command arg1 arg2
```

## Examples

1. Start a specific project:

   ```bash
   hbt rates up
   ```

2. Restart all projects:

   ```bash
   hbt all restart
   ```

3. Dump a project database with a specific key:

   ```bash
   hbt app dump --key=my-database-key
   ```

4. Restore a project database from a file:

   ```bash
   hbt app restore --path=./dumps/my-dump.sql
   ```

5. Create a snapshot including only specific repositories and databases:

   ```bash
   hbt snapshot create --include-repositories=api,app --include-databases=main,logs
   ```

6. Restore from a snapshot file:

   ```bash
   hbt snapshot restore --path=./snapshots/snap-2024-06-01.tar.gz
   ```

7. Checkout a branch and run migrations:

   ```bash
   hbt checkout --branch feature/new-api --migrate
   ```

8. Set a configuration value:

   ```bash
   hbt config SOME_KEY some_value
   ```

9. Increase verbosity for debugging:

   ```bash
   hbt -vvv app up
   ```

## License

This tool is proprietary and intended for internal use only. Do not distribute without authorization.
