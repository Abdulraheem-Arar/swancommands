# Swan 

Swan is a static analysis tool used to analyze swift code , this Visual Studio Code extension is designed to streamline workflows for using the SWAN tool.

## Features
- Automatically detect Swift files.
- Provide commands for running SWAN analysis.
- Display analysis results directly in VS Code.

## Installation
1. Search for "Swan Commands" in the Visual Studio Code Marketplace.
2. Click `Install`.
3. Open the extension and go to general settings
4. Then provide the absolute paths for the driver.jar, swan-spm.py and swan-swiftc files after you have built the swan tool locally

## Usage
1. Open a Swift project in VS Code.
2. Provide the absolute path to your specification file for either taint or typestate analysis 
2. Use the menu to select an analysis option or use the command palette (`Ctrl+Shift+P` or `Cmd+Shift+P`) to find and execute Swan Commands.
---


