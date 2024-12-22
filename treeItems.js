const vscode = require('vscode');
const sharedState = require('./sharedState');



class ErrorItem extends vscode.TreeItem {
    constructor(label, message, urls) {
        // Call the parent constructor with the error label
        super(label, urls?.length > 1
            ? vscode.TreeItemCollapsibleState.Collapsed 
            : vscode.TreeItemCollapsibleState.None
        );

        this.tooltip = message;// Tooltip shows the error message
        this.children = []; // Initialize the children array
        

        if (urls?.length === 1) {
            // If there's only one URL, attach a command directly
            this.command = this.createCommand(urls[0]);
        } else if (urls?.length > 1){
            // Create child items for each URL
            this.children = urls.map((url) => this.createUrlChildItem(url));
        }
    }

    // Helper to create a child TreeItem for a URL
    createUrlChildItem(url) {
        const child = new vscode.TreeItem(
            url,
            vscode.TreeItemCollapsibleState.None // Child items are not expandable
        );
        child.command = this.createCommand(url); // Attach navigation command
        child.tooltip = `Navigate to: ${url}`; // Add a tooltip for clarity
        return child;
    }

    // Helper to create a navigation command
    createCommand(url) {
        let filePath, line, col;

        const match = url.match(/^(.*):(\d+):(\d+)$/);
        if (match) {
            const [_, matchedFilePath, lineStr, colStr] = match;
            filePath = matchedFilePath;
            line = parseInt(lineStr, 10) - 1; // Convert to 0-based index
            col = parseInt(colStr, 10) - 1; 
        } else {
            console.error("URL format is invalid:", url);
            return null; // Return null if the URL does not match the expected pattern
        }

        return {
            command: "vscode.open", // VSCode's built-in file-opening command
            title: "Open Error Location",
            arguments: [
                vscode.Uri.file(filePath),
                { selection: new vscode.Range(new vscode.Position(line, col), new vscode.Position(line , col )) }
            ]
        };
    }
}


class SwanTreeDataProvider {

    constructor(parentLabel) {
        this.parentLabel = parentLabel;
        this.errors = [];
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }

    getTreeItem(element) {
        return element;
    }

    getChildren(element) {
        if (!element) {
            let children = [];
    
            if (this.parentLabel === "Run Analysis") {
                if (this.shouldShowAnalysis()) {
                    // Add the children of 'Settings' directly to the root level
                    children = children.concat( this.createParentItem("Run Analysis", [
                        "Analysis options"
                    ]).children); // Only include the children, not the parent item itself
                }

            } else if (this.parentLabel === "View Results") {
                if (this.shouldShowResults()) {
                    // Add the children of 'Settings' directly to the root level
                    children = children.concat(this.createParentItem("View Results", [
                        "Analysis Summary",
                        "Detailed Logs",
                    
                    ]).children); // Only include the children, not the parent item itself
                }
            } else if (this.parentLabel === "Settings") {
                if (this.shouldShowSettings()) {
                    // Add the children of 'Settings' directly to the root level
                    children = children.concat(this.createParentItem("Settings", [
                        "General Settings",
                        "Taint Analysis spec",
                        "Typestate Analysis spec",
                        "Reset settings to defaults",
                        "Help"
                    ]).children); // Only include the children, not the parent item itself
                }
            } else if (this.parentLabel === "Errors" && this.errors.length>0) {
                children = this.errors;
            }
            console.log("Returning children: ", children);

            return children;
        } else {
            return element.children || [];
        }
    }

    createParentItem(label, childrenLabels) {
        const parent = new vscode.TreeItem(
            label,
            vscode.TreeItemCollapsibleState.Collapsed
        );
        parent.children = childrenLabels.map((childLabel) => {
            const item = new vscode.TreeItem(childLabel, vscode.TreeItemCollapsibleState.None);
            if (childLabel === 'Analysis options') {
                item.command = {
                    command: `swancommands.menu`, // A generic command for all analysis types
                    title: `Run ${childLabel}`, // Optional: add title for clarity
                };
            } else if(childLabel === 'Detailed Logs' ){
                item.command = {
                    command: `swancommands.${childLabel}`, // Adjusting the command string
                    title: `Run ${childLabel}`, // Optional: add title for clarity
                };
            } else if (childLabel === "Taint Analysis spec") {
                // Show current path in description
                item.description = sharedState.taintAnalysisUserPath || "No path set";
                item.command = {
                    command: `swancommands.setTaintAnalysisSpec`, // Command to handle setting the spec
                    title: "Set Analysis Spec",
                };
            }else if (childLabel === "Help") {
                // Show current path in description
                item.command = {
                    command: `swancommands.help`, // Command to handle setting the spec
                    title: "Set Analysis Spec",
                };
            }
            else if (childLabel === "General Settings") {
                // Show current path in description
                item.command = {
                    command: `swancommands.openSettings`, // Command to handle setting the spec
                    title: "open the vs code settings for the extension",
                };
            }else if (childLabel === "Typestate Analysis spec") {
                // Show current path in description
                item.description = sharedState.typestateAnalysisUserPath || "No path set";
                item.command = {
                    command: `swancommands.setTypestateAnalysisSpec`, // Command to handle setting the spec
                    title: "Set Analysis Spec",
                };
            }else if (childLabel === "Reset settings to defaults") {
                // Show current path in description
                item.command = {
                    command: `swancommands.defaults`, // Command to handle setting the spec
                    title: "Reset Settings ",
                };
            }
            return item; // Ensure each item is returned from map
        });
        return parent;
    }

    addError(label,message,urls) {
        const error = new ErrorItem(label,message,urls);
        console.log('Adding error:', error);
        this.errors.push(error);
        this.refresh();
    }

    removeError(label) {
        // Remove the error with the specified label
        this.errors = this.errors.filter((error) => error.label !== label);
        this.refresh();
    }

    // Clear all errors
    clearErrors() {
        this.errors = [];
        this.refresh();
    }

    // Refresh the TreeView
    refresh() {
        this._onDidChangeTreeData.fire();
    }

    shouldShowSettings() {
        // Your condition to decide when to show 'Settings' children
        return true; // Change this to control visibility
    }
    shouldShowResults(){
        return true;
    }
    shouldShowAnalysis(){
        return true;
    }
}


module.exports = { SwanTreeDataProvider, ErrorItem };