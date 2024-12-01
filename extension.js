const vscode = require('vscode');
const runCallGraph = require('./callgraph');
const runTypestate = require('./typestateanalysis');
const runTaint = require('./taintanalysis');
const runCrypto = require('./cryptoanalysis');
const runDebug = require('./debug');
const path = require('path');
const fs = require('fs');
const cp = require('child_process');

let currentModule;


class ErrorItem extends vscode.TreeItem {
    constructor(label,message, collapsibleState) {
        // Call the parent class constructor with the label and collapsible state
        super(label, collapsibleState);

        this.tooltip = message; // Tooltip to show the full error message
        this.description = message; 
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
                        "callGraph",
                    "typeStateAnalysis",
                    "taintAnalysis",
                    "cryptoAnalysis",
                    "debug"
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
                        "Advanced Settings"
                    ]).children); // Only include the children, not the parent item itself
                }
            } else if (this.parentLabel === "Errors" && this.errors.length > 0) {
                children = this.errors;
            }
    
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
            if (label === 'Run Analysis') {
                item.command = {
                    command: `swancommands.runActivityBar`, // A generic command for all analysis types
                    arguments: [childLabel],
                    title: `Run ${childLabel}`, // Optional: add title for clarity
                };
            } else if(childLabel === 'Detailed Logs'){
                item.command = {
                    command: `swancommands.${childLabel}`, // Adjusting the command string
                    title: `Run ${childLabel}`, // Optional: add title for clarity
                };
            }
            return item; // Ensure each item is returned from map
        });
        return parent;
    }

    addError(label,message) {
        const error = new ErrorItem(label,message, vscode.TreeItemCollapsibleState.None);
        this.errors.push(error);
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


function activate(context) {
    
    const runAnalysisProvider = new SwanTreeDataProvider("Run Analysis");
    const viewResultsProvider = new SwanTreeDataProvider("View Results");
    const settingsProvider = new SwanTreeDataProvider("Settings");
    const errorsProvider = new SwanTreeDataProvider("Errors");

    // Register the TreeView for each section under the "swanAnalysisView" container
    vscode.window.registerTreeDataProvider('runAnalysisView', runAnalysisProvider);
    vscode.window.registerTreeDataProvider('viewResultsView', viewResultsProvider);
    vscode.window.registerTreeDataProvider('settingsView', settingsProvider);
    vscode.window.registerTreeDataProvider('errorsView', errorsProvider);


    console.log('Extension is now active!');

   let diagnosticCollection = vscode.languages.createDiagnosticCollection('analyzeMethods')

    const analysisOptions = [
        { label: 'run taint analysis on your current code file', value: 'taint' },
        { label: 'run typestate analysis on your current code file', value: 'typestate' },
        { label: 'create the call graph for your current code file', value: 'callgraph' },
        { label: "analyze the use of crypto API's", value: 'crypto' },
        { label: "create the debug files in the swan-dir/", value: 'debug' },
    ];

    const disposable = vscode.commands.registerCommand('swancommands.menu', function () {
		showAnalysisOptions()
		// Display a message box to the user
		//vscode.window.showInformationMessage('Hello World from swift detect 3!');
	});

    function detectSwiftDocument(document) {
        if (document && document.languageId === 'swift') {
            showAnalysisOptions()
        }
    }
    
const document = vscode.window.activeTextEditor.document;
    detectSwiftDocument(document)
    
    function showAnalysisOptions() {
        vscode.window.showQuickPick(analysisOptions, { placeHolder: 'Select an analysis option' }).then(selection => {
            if (selection) {
                deactivateCurrentModule(); // Deactivate any currently active module
                // Activate the selected module
                if (selection.value === 'taint') {
                    currentModule = runTaint;
                    currentModule.activate(context);
                } else if (selection.value === 'typestate') {
                    currentModule = runTypestate;
                    currentModule.activate(context);
                } else if (selection.value === 'callgraph') {
                    currentModule = runCallGraph;
                    currentModule.activate(context);
                } else if (selection.value === 'crypto') {
                    currentModule = runCrypto;
                    currentModule.activate(context);
                }else if (selection.value === 'debug') {
                    currentModule = runDebug;
                    currentModule.activate(context);
                }
            }
        });
    }

    const runAnalysisCommand = vscode.commands.registerCommand('swancommands.runActivityBar', (childLabel) => {
        activateActivityBarOption(childLabel);
    });

    function activateActivityBarOption(selection){
        deactivateCurrentModule();
        if (selection === 'taintAnalysis') {
            currentModule = runTaint;
            currentModule.activate(context);
        } else if (selection === 'typeStateAnalysis') {
            currentModule = runTypestate;
            currentModule.activate(context);
        } else if (selection === 'callGraph') {
            currentModule = runCallGraph;
            currentModule.activate(context);
        } else if (selection === 'cryptoAnalysis') {
            currentModule = runCrypto;
            currentModule.activate(context);
        }else if (selection.value === 'debug') {
            currentModule = runDebug;
            currentModule.activate(context);
        }
    }

    function deactivateCurrentModule() {
        if (currentModule && currentModule.deactivate) {
            currentModule.deactivate();
        }
        currentModule = null;
    }
    
    const outputChannel = vscode.window.createOutputChannel('Swan Analysis');
    outputChannel.clear();
    let isOutputChannel = false; 

    const showOutputChannel = vscode.commands.registerCommand('swancommands.Detailed Logs', function () {
        if (!isOutputChannel){
            outputChannel.show(true);
            isOutputChannel = true;
        } else {
            vscode.commands.executeCommand('workbench.action.closePanel');
            isOutputChannel = false;
        }
        
    })


    const createCallGraph = vscode.commands.registerCommand('swancommands.callGraph', function () {
		// The code you place here will be executed every time your command is executed
		const activeEditor = vscode.window.activeTextEditor;
        const swiftcPath = '/home/abdulraheem/buildingSwan/swan/lib/swan-swiftc'
        const driverJarPath = '/home/abdulraheem/swanNewBuild/swan/lib/driver.jar'
		// Display a message box to the user


        if (activeEditor) {
            const filePath = activeEditor.document.fileName;
            const folderPath = path.dirname(filePath);
            const fileName = path.basename(filePath);

         // Show a message that the file is running
         vscode.window.showInformationMessage('Running: ' + filePath);
      
         // Opens the output channel in the editor

            errorsProvider.addError("Error 1", "This is the first error.");
         
             // Function to find the directory containing `Package.swift`
             function findPackageSwiftDirectory(currentPath) {
                const packageSwiftPath = path.join(currentPath, 'Package.swift');
                if (fs.existsSync(packageSwiftPath)) {
                    return currentPath; // Found the directory
                }
                const parentPath = path.dirname(currentPath);
                if (parentPath === currentPath) {
                    return null; // Reached the root directory
                }
                return findPackageSwiftDirectory(parentPath); // Recursively search the parent directory
            }
    
            const packageSwiftDirectory = findPackageSwiftDirectory(folderPath);
    
            if (!packageSwiftDirectory) {
                treeDataProvider.addError('Could not find Package.swift', ' if you are in an spm project make sure you have your cursor in the file you want to analyse');
                
                cp.exec(`cd ${folderPath} && /home/abdulraheem/swanNewBuild/swan/lib/swan-swiftc ${fileName}`, (error, stdout, stderr) => { 
                    if (error) {
                        outputChannel.appendLine(`Error: running swftc ${stderr}`);
                    } else{
                        setTimeout(() => {
                            fs.readdir(`${folderPath}/swan-dir`, (err, files) => {
                                if (err) outputChannel.appendLine(`Error reading swan-dir: ${err.message}`);
                                else outputChannel.appendLine(`Files in swan-dir: ${files.join(', ')}`);
                                
                                // Proceed with the command only if files are present
                                if (files.length > 0) {
                                    cp.exec(`cd ${folderPath} && java -jar ${driverJarPath} swan-dir/ -g`, (error, stdout, stderr) => { 
                                        if (error) {
                                            outputChannel.appendLine(`Error: running driver.jar ${stderr}`);
                                        } else {
                                            outputChannel.appendLine(`Output: ${stdout || "No output returned from the script."}`);
                                        }
                                    });
                                } else {
                                    outputChannel.appendLine("No files found in swan-dir after timeout.");
                                }
                            });
                        }, 1000);
                    }
                });
            } else{
                const buildFolderPath = path.join(packageSwiftDirectory, '.build');

            
                if (fs.existsSync(buildFolderPath)) {
                    fs.rm(buildFolderPath, { recursive: true, force: true }, (err) => {
                        if (err) {
                            console.error('Error removing .build folder:', err);
                        } else {
                            console.log('.build folder removed successfully.');
                        }
                    });
                } else {
                    console.log('.build folder does not exist in:', buildFolderPath);
                }
                vscode.window.showInformationMessage(`Package.swift found at: ${packageSwiftDirectory}`);
    
                
               
              cp.exec(`cd ${packageSwiftDirectory} && python3 /home/abdulraheem/swanNewBuild/swan/tests/swan-spm.py`, (error, stdout, stderr) => { 
                    if (error) {
                        outputChannel.appendLine(`Error: running swftc ${stderr}`);
                    } else{
                        setTimeout(() => {
                            fs.readdir(`${packageSwiftDirectory}/swan-dir`, (err, files) => {
                                if (err) outputChannel.appendLine(`Error reading swan-dir: ${err.message}`);
                                else outputChannel.appendLine(`Files in swan-dir: ${files.join(', ')}`);
                                
                                // Proceed with the command only if files are present
                                if (files.length > 0) {
                                    cp.exec(`cd ${packageSwiftDirectory} && java -jar ${driverJarPath} swan-dir/ -g`, (error, stdout, stderr) => { 
                                        if (error) {
                                            outputChannel.appendLine(`Error: running driver.jar ${stderr}`);
                                        } else {
                                            outputChannel.appendLine(`Output: ${stdout || "No output returned from the script."}`);
                                        }
                                    });
                                } else {
                                    outputChannel.appendLine("No files found in swan-dir after timeout.");
                                }
                            });
                        }, 1000);
                    }
                });
            }       
        } else {
            vscode.window.showWarningMessage('No active editor with an open file.');
        }
		vscode.window.showInformationMessage('Hello World from swift detect 3!');
	});

    const createDebug = vscode.commands.registerCommand('swancommands.debug', function () {
		// The code you place here will be executed every time your command is executed
		const activeEditor = vscode.window.activeTextEditor;
        const swiftcPath = '/home/abdulraheem/buildingSwan/swan/lib/swan-swiftc'
        const driverJarPath = '/home/abdulraheem/swanNewBuild/swan/lib/driver.jar'
		// Display a message box to the user


        if (activeEditor) {
            const filePath = activeEditor.document.fileName;
            const folderPath = path.dirname(filePath);
            const fileName = path.basename(filePath);

         // Show a message that the file is running
         vscode.window.showInformationMessage('Running: ' + filePath);
      
         // Opens the output channel in the editor


         
             // Function to find the directory containing `Package.swift`
             function findPackageSwiftDirectory(currentPath) {
                const packageSwiftPath = path.join(currentPath, 'Package.swift');
                if (fs.existsSync(packageSwiftPath)) {
                    return currentPath; // Found the directory
                }
                const parentPath = path.dirname(currentPath);
                if (parentPath === currentPath) {
                    return null; // Reached the root directory
                }
                return findPackageSwiftDirectory(parentPath); // Recursively search the parent directory
            }
    
            const packageSwiftDirectory = findPackageSwiftDirectory(folderPath);
    
            if (!packageSwiftDirectory) {
                treeDataProvider.addError('Could not find Package.swift', ' if you are in an spm project make sure you have your cursor in the file you want to analyse');
                
                cp.exec(`cd ${folderPath} && /home/abdulraheem/swanNewBuild/swan/lib/swan-swiftc ${fileName}`, (error, stdout, stderr) => { 
                    if (error) {
                        outputChannel.appendLine(`Error: running swftc ${stderr}`);
                    } else{
                        setTimeout(() => {
                            fs.readdir(`${folderPath}/swan-dir`, (err, files) => {
                                if (err) outputChannel.appendLine(`Error reading swan-dir: ${err.message}`);
                                else outputChannel.appendLine(`Files in swan-dir: ${files.join(', ')}`);
                                
                                // Proceed with the command only if files are present
                                if (files.length > 0) {
                                    cp.exec(`cd ${folderPath} && java -jar ${driverJarPath} swan-dir/ -d`, (error, stdout, stderr) => { 
                                        if (error) {
                                            outputChannel.appendLine(`Error: running driver.jar ${stderr}`);
                                        } else {
                                            outputChannel.appendLine(`Output: ${stdout || "No output returned from the script."}`);
                                        }
                                    });
                                } else {
                                    outputChannel.appendLine("No files found in swan-dir after timeout.");
                                }
                            });
                        }, 1000);
                    }
                });
            } else{
                const buildFolderPath = path.join(packageSwiftDirectory, '.build');

            
                if (fs.existsSync(buildFolderPath)) {
                    fs.rm(buildFolderPath, { recursive: true, force: true }, (err) => {
                        if (err) {
                            console.error('Error removing .build folder:', err);
                        } else {
                            console.log('.build folder removed successfully.');
                        }
                    });
                } else {
                    console.log('.build folder does not exist in:', buildFolderPath);
                }
                vscode.window.showInformationMessage(`Package.swift found at: ${packageSwiftDirectory}`);
    
                
               
              cp.exec(`cd ${packageSwiftDirectory} && python3 /home/abdulraheem/swanNewBuild/swan/tests/swan-spm.py`, (error, stdout, stderr) => { 
                    if (error) {
                        outputChannel.appendLine(`Error: running swftc ${stderr}`);
                    } else{
                        setTimeout(() => {
                            fs.readdir(`${packageSwiftDirectory}/swan-dir`, (err, files) => {
                                if (err) outputChannel.appendLine(`Error reading swan-dir: ${err.message}`);
                                else outputChannel.appendLine(`Files in swan-dir: ${files.join(', ')}`);
                                
                                // Proceed with the command only if files are present
                                if (files.length > 0) {
                                    cp.exec(`cd ${packageSwiftDirectory} && java -jar ${driverJarPath} swan-dir/ -d`, (error, stdout, stderr) => { 
                                        if (error) {
                                            outputChannel.appendLine(`Error: running driver.jar ${stderr}`);
                                        } else {
                                            outputChannel.appendLine(`Output: ${stdout || "No output returned from the script."}`);
                                        }
                                    });
                                } else {
                                    outputChannel.appendLine("No files found in swan-dir after timeout.");
                                }
                            });
                        }, 1000);
                    }
                });
            }       
        } else {
            vscode.window.showWarningMessage('No active editor with an open file.');
        }
		vscode.window.showInformationMessage('Hello World from swift detect 3!');
	});




    const runTypeStateAnalysis = vscode.commands.registerCommand('swancommands.typeStateAnalysis', function () {
        const activeEditor = vscode.window.activeTextEditor;
        const swiftcPath = '/home/abdulraheem/buildingSwan/swan/lib/swan-swiftc';
        const driverJarPath = '/home/abdulraheem/swanNewBuild/swan/lib/driver.jar';
        const typeStateAnalysisPath = '/home/abdulraheem/swancommands/specifications/simpleTypestate.json';
    
        if (activeEditor) {
            const filePath = activeEditor.document.fileName;
            let folderPath = path.dirname(filePath);
            const fileName = path.basename(filePath);

            


            // Function to find the directory containing `Package.swift`
            function findPackageSwiftDirectory(currentPath) {
                const packageSwiftPath = path.join(currentPath, 'Package.swift');
                if (fs.existsSync(packageSwiftPath)) {
                    return currentPath; // Found the directory
                }
                const parentPath = path.dirname(currentPath);
                if (parentPath === currentPath) {
                    return null; // Reached the root directory
                }
                return findPackageSwiftDirectory(parentPath); // Recursively search the parent directory
            }
    
            const packageSwiftDirectory = findPackageSwiftDirectory(folderPath);
    
            if (!packageSwiftDirectory) {
                vscode.window.showErrorMessage('Could not find Package.swift in the directory hierarchy.');

                cp.exec(`cd ${folderPath} &&  /home/abdulraheem/swanNewBuild/swan/lib/swan-swiftc ${fileName}`, (error, stdout, stderr) => { 
                    if (error) {
                        outputChannel.appendLine(`Error: ${stderr}`);
                    } else{
                        setTimeout(() => {
                            fs.readdir(`${folderPath}/swan-dir`, (err, files) => {
                                if (err) {
                                    outputChannel.appendLine(`Error reading swan-dir: ${err.message}`);
                                   }
                                   else {
                                     outputChannel.appendLine(`Files in swan-dir: ${files.join(', ')}`);
                                    }
                                // Proceed with the command only if files are present
                                if (files.length > 0) {
                                    cp.exec(`cd ${folderPath} && java -jar ${driverJarPath} -e ${typeStateAnalysisPath} swan-dir/ `, (error, stdout, stderr) => { 
                                        if (error) {
                                            outputChannel.appendLine(`Error: ${stderr}`);
                                        } else {
                                           outputChannel.appendLine(`running the analysis on a single file`)
                                                try {
                                                    const resultFilePath = path.join(folderPath, 'swan-dir', 'taint-results.json');
                                                fs.readFile(resultFilePath, 'utf8', (err, data) => {
                                                    if (err) {
                                                        outputChannel.appendLine(`Error reading taint-results.json: ${err.message}`);
                                                    } else {
                                                        try {
                                                            const jsonData = JSON.parse(data);
                                                            outputChannel.appendLine('taint Results:');
                                                            outputChannel.appendLine(JSON.stringify(jsonData, null, 2));
                                                            let diagnostics = []
                                                            if(jsonData[0].paths && jsonData[0].paths.length>0){
                                                                jsonData[0].paths[0].path.forEach((path)=>{
                                                                    const match = path.match(/^(.*):(\d+):(\d+)$/);
                                                                    if (match) {
                                                                      const [_, filePath, lineStr, colStr] = match;
                                                                      const line = parseInt(lineStr, 10) - 1; // Convert to 0-based index
                                                                      const col = parseInt(colStr, 10) - 1;  // Convert to 0-based index
            
                                                                      const range = new vscode.Range(new vscode.Position(line, col), new vscode.Position(line , col ));
                                                                      const diagnostic = new vscode.Diagnostic(range, `taint analysis flagged this`, vscode.DiagnosticSeverity.Warning); 
                                                                      diagnostics.push(diagnostic) 
                                                                    }
                                                                    const activeEditor = vscode.window.activeTextEditor;
                                                                    if (activeEditor) {
                                                                    diagnosticCollection.set(activeEditor.document.uri, diagnostics)
                                                                }
                                                                });
                                                            }
                                                        } catch (parseErr) {
                                                            outputChannel.appendLine(`Error parsing taint-results.json: ${parseErr.message}`);
                                                        }
                                                    }
                                                });
                                                  
                                                        
    
                                                } catch (parseErr) {
                                                    console.error('Error parsing JSON:', parseErr.message);
                                                }
                                            
                                        }
                                    });
                                } else {
                                   outputChannel.appendLine("No files found in swan-dir after timeout.");
                                }
                            });
                        }, 1000);
                    }
                });
            }else{
                const buildFolderPath = path.join(packageSwiftDirectory, '.build');

            
                if (fs.existsSync(buildFolderPath)) {
                    fs.rm(buildFolderPath, { recursive: true, force: true }, (err) => {
                        if (err) {
                            console.error('Error removing .build folder:', err);
                        } else {
                            console.log('.build folder removed successfully.');
                        }
                    });
                } else {
                    console.log('.build folder does not exist in:', buildFolderPath);
                }
    
                vscode.window.showInformationMessage(`Package.swift found at: ${packageSwiftDirectory}`);
                
        
                const fileName = path.basename(filePath);
                vscode.window.showInformationMessage('Running: ' + filePath);
                outputChannel.show(true);
                
        
                cp.exec(`cd ${packageSwiftDirectory} && python3 /home/abdulraheem/swanNewBuild/swan/tests/swan-spm.py`, (error, stdout, stderr) => {
                    if (error) {
                        outputChannel.appendLine(`Error creating the SIL file: ${stderr}`);
                    } else {
                        setTimeout(() => {
                            fs.readdir(`${packageSwiftDirectory}/swan-dir`, (err, files) => {
                                if (err) {
                                    outputChannel.appendLine(`Error reading swan-dir: ${err.message}`);
                                } else {
                                    // Proceed with the command only if files are present
                                    if (files.length > 0) {
                                        cp.exec(`cd ${packageSwiftDirectory} && java -jar ${driverJarPath} -e ${typeStateAnalysisPath} swan-dir/`, (error, stdout, stderr) => {
                                            if (error) {
                                                outputChannel.appendLine(`Error: ${stderr}`);
                                            } else {
                                                const resultFilePath = path.join(packageSwiftDirectory, 'swan-dir', 'typestate-results.json');
                                                fs.readFile(resultFilePath, 'utf8', (err, data) => {
                                                    if (err) {
                                                        outputChannel.appendLine(`Error reading typestate-results.json: ${err.message}`);
                                                    } else {
                                                        try {
                                                            const jsonData = JSON.parse(data);
                                                            outputChannel.appendLine('Typestate Results:');
                                                            outputChannel.appendLine(JSON.stringify(jsonData, null, 2));
                                                        } catch (parseErr) {
                                                            outputChannel.appendLine(`Error parsing typestate-results.json: ${parseErr.message}`);
                                                        }
                                                    }
                                                });
                                            }
                                        });
                                    } else {
                                        outputChannel.appendLine('No files found in swan-dir after timeout.');
                                    }
                                }
                            });
                        }, 1000);
                    }
                });
            } 
            
        }else {
                vscode.window.showWarningMessage('No active editor with an open file.');
            }
            
    
        vscode.window.showInformationMessage('Hello World from swift detect 3!');
    });

    const runTaintAnalysis = vscode.commands.registerCommand('swancommands.taintAnalysis', function () {
		// The code you place here will be executed every time your command is executed
		const activeEditor = vscode.window.activeTextEditor;
        const swiftcPath = '/home/abdulraheem/buildingSwan/swan/lib/swan-swiftc'
        const driverJarPath = '/home/abdulraheem/swanNewBuild/swan/lib/driver.jar'
         const taintAnalysisPath = '/home/abdulraheem/swanNewBuild/swan/specifications/examples/taint.json'
		// Display a message box to the user
        if (activeEditor) {
            const filePath = activeEditor.document.fileName;
            const folderPath = path.dirname(filePath);
            const fileName = path.basename(filePath);

            
            
            function findPackageSwiftDirectory(currentPath) {
                const packageSwiftPath = path.join(currentPath, 'Package.swift');
                console.log(`Checking: ${currentPath}`);
                if (fs.existsSync(packageSwiftPath)) {
                    return currentPath; // Found the directory
                }
                const parentPath = path.dirname(currentPath);
                if (parentPath === currentPath) {
                    return null; // Reached the root directory
                }
                return findPackageSwiftDirectory(parentPath); // Recursively search the parent directory
            }
    
            const packageSwiftDirectory = findPackageSwiftDirectory(folderPath);

            vscode.window.showInformationMessage('Running: ' + filePath);
    
            if (!packageSwiftDirectory) {
                vscode.window.showInformationMessage('Could not find Package.swift in the directory hierarchy.');

                cp.exec(`cd ${folderPath} &&  /home/abdulraheem/swanNewBuild/swan/lib/swan-swiftc ${fileName}`, (error, stdout, stderr) => { 
                    if (error) {
                        outputChannel.appendLine(`Error: ${stderr}`);
                    } else{
                        setTimeout(() => {
                            fs.readdir(`${folderPath}/swan-dir`, (err, files) => {
                                if (err) {
                                   outputChannel.appendLine(`Error reading swan-dir: ${err.message}`);
                                   }
                                   else {
                                     outputChannel.appendLine(`Files in swan-dir: ${files.join(', ')}`);
                                    }
                                // Proceed with the command only if files are present
                                if (files.length > 0) {
                                    cp.exec(`cd ${folderPath} && java -jar ${driverJarPath} -t ${taintAnalysisPath} swan-dir/ `, (error, stdout, stderr) => { 
                                        if (error) {
                                            outputChannel.appendLine(`Error: ${stderr}`);
                                        } else {
                                           outputChannel.appendLine(`running the analysis on a single file`)
                                                try {
                                                    const resultFilePath = path.join(folderPath, 'swan-dir', 'taint-results.json');
                                                fs.readFile(resultFilePath, 'utf8', (err, data) => {
                                                    if (err) {
                                                       outputChannel.appendLine(`Error reading taint-results.json: ${err.message}`);
                                                    } else {
                                                        try {
                                                            const jsonData = JSON.parse(data);
                                                            outputChannel.appendLine('taint Results:');
                                                            outputChannel.appendLine(JSON.stringify(jsonData, null, 2));
                                                            let diagnostics = []
                                                            if(jsonData[0].paths && jsonData[0].paths.length>0){
                                                                jsonData[0].paths[0].path.forEach((path)=>{
                                                                    const match = path.match(/^(.*):(\d+):(\d+)$/);
                                                                    if (match) {
                                                                      const [_, filePath, lineStr, colStr] = match;
                                                                      const line = parseInt(lineStr, 10) - 1; // Convert to 0-based index
                                                                      const col = parseInt(colStr, 10) - 1;  // Convert to 0-based index
            
                                                                      const range = new vscode.Range(new vscode.Position(line, col), new vscode.Position(line , col ));
                                                                      const diagnostic = new vscode.Diagnostic(range, `taint analysis flagged this`, vscode.DiagnosticSeverity.Warning); 
                                                                      diagnostics.push(diagnostic) 
                                                                    }
                                                                    const activeEditor = vscode.window.activeTextEditor;
                                                                    if (activeEditor) {
                                                                    diagnosticCollection.set(activeEditor.document.uri, diagnostics)
                                                                }
                                                                });
                                                            }
                                                        } catch (parseErr) {
                                                            outputChannel.appendLine(`Error parsing taint-results.json: ${parseErr.message}`);
                                                        }
                                                    }
                                                });
                                                  
                                                        
    
                                                } catch (parseErr) {
                                                    console.error('Error parsing JSON:', parseErr.message);
                                                }
                                            
                                        }
                                    });
                                } else {
                                   outputChannel.appendLine("No files found in swan-dir after timeout.");
                                }
                            });
                        }, 1000);
                    }
                });
            
            } else {
                const buildFolderPath = path.join(packageSwiftDirectory, '.build');

            
                if (fs.existsSync(buildFolderPath)) {
                    fs.rm(buildFolderPath, { recursive: true, force: true }, (err) => {
                        if (err) {
                            console.error('Error removing .build folder:', err);
                        } else {
                            console.log('.build folder removed successfully.');
                        }
                    });
                } else {
                    console.log('.build folder does not exist in:', buildFolderPath);
                }
    
                // Show a message that the file is running
               
               
              cp.exec(`cd ${packageSwiftDirectory} &&  python3 /home/abdulraheem/swanNewBuild/swan/tests/swan-spm.py`, (error, stdout, stderr) => { 
                    if (error) {
                        outputChannel.appendLine(`Error: ${stderr}`);
                    } else{
                        setTimeout(() => {
                            fs.readdir(`${packageSwiftDirectory}/swan-dir`, (err, files) => {
                                if (err) {
                                   outputChannel.appendLine(`Error reading swan-dir: ${err.message}`);
                                   }
                                   else {
                                     outputChannel.appendLine(`Files in swan-dir: ${files.join(', ')}`);
                                    }
                                // Proceed with the command only if files are present
                                if (files.length > 0) {
                                    cp.exec(`cd ${packageSwiftDirectory} && java -jar ${driverJarPath} -t ${taintAnalysisPath} swan-dir/ `, (error, stdout, stderr) => { 
                                        if (error) {
                                            outputChannel.appendLine(`Error: ${stderr}`);
                                        } else {
                                            outputChannel.appendLine(`Output: ${stdout || "No output returned from the script."}`);
                                                try {
                                                    const resultFilePath = path.join(packageSwiftDirectory, 'swan-dir', 'taint-results.json');
                                                fs.readFile(resultFilePath, 'utf8', (err, data) => {
                                                    if (err) {
                                                        outputChannel.appendLine(`Error reading taint-results.json: ${err.message}`);
                                                    } else {
                                                        try {
                                                            const jsonData = JSON.parse(data);
                                                            outputChannel.appendLine('taint Results:');
                                                            outputChannel.appendLine(JSON.stringify(jsonData, null, 2));
                                                            let diagnostics = []
                                                            if(jsonData[0].paths && jsonData[0].paths.length>0){
                                                                jsonData[0].paths[0].path.forEach((path)=>{
                                                                    const match = path.match(/^(.*):(\d+):(\d+)$/);
                                                                    if (match) {
                                                                      const [_, filePath, lineStr, colStr] = match;
                                                                      const line = parseInt(lineStr, 10) - 1; // Convert to 0-based index
                                                                      const col = parseInt(colStr, 10) - 1;  // Convert to 0-based index
            
                                                                      const range = new vscode.Range(new vscode.Position(line, col), new vscode.Position(line , col ));
                                                                      const diagnostic = new vscode.Diagnostic(range, `taint analysis flagged this`, vscode.DiagnosticSeverity.Warning); 
                                                                      diagnostics.push(diagnostic) 
                                                                    }
                                                                    const activeEditor = vscode.window.activeTextEditor;
                                                                    if (activeEditor) {
                                                                    diagnosticCollection.set(activeEditor.document.uri, diagnostics)
                                                                }
                                                                });
                                                            }
                                                        } catch (parseErr) {
                                                            outputChannel.appendLine(`Error parsing taint-results.json: ${parseErr.message}`);
                                                        }
                                                    }
                                                });
                                                  
                                                        
    
                                                } catch (parseErr) {
                                                    console.error('Error parsing JSON:', parseErr.message);
                                                }
                                            
                                        }
                                    });
                                } else {
                                   outputChannel.appendLine("No files found in swan-dir after timeout.");
                                }
                            });
                        }, 1000);
                    }
                });
            }  
            
        } else {
            vscode.window.showWarningMessage('No active editor with an open file.');
        }
		vscode.window.showInformationMessage('Hello World from swift detect 3!');
	});

    const runCryptoAnalysis = vscode.commands.registerCommand('swancommands.cryptoAnalysis', function () {
		// The code you place here will be executed every time your command is executed
		const activeEditor = vscode.window.activeTextEditor;
        const swiftcPath = '/home/abdulraheem/buildingSwan/swan/lib/swan-swiftc'
        const driverJarPath = '/home/abdulraheem/swanNewBuild/swan/lib/driver.jar'
        
		// Display a message box to the user
        if (activeEditor) {
            const filePath = activeEditor.document.fileName;
            const folderPath = path.dirname(filePath);
            const fileName = path.basename(filePath);

            
            
            function findPackageSwiftDirectory(currentPath) {
                const packageSwiftPath = path.join(currentPath, 'Package.swift');
                console.log(`Checking: ${currentPath}`);
                if (fs.existsSync(packageSwiftPath)) {
                    return currentPath; // Found the directory
                }
                const parentPath = path.dirname(currentPath);
                if (parentPath === currentPath) {
                    return null; // Reached the root directory
                }
                return findPackageSwiftDirectory(parentPath); // Recursively search the parent directory
            }
    
            const packageSwiftDirectory = findPackageSwiftDirectory(folderPath);

            vscode.window.showInformationMessage('Running: ' + filePath);
            outputChannel.show(); // Opens the output channel in the editor
    
            if (!packageSwiftDirectory) {
                vscode.window.showInformationMessage('Could not find Package.swift in the directory hierarchy.');

                cp.exec(`cd ${folderPath} &&  /home/abdulraheem/swanNewBuild/swan/lib/swan-swiftc ${fileName}`, (error, stdout, stderr) => { 
                    if (error) {
                        outputChannel.appendLine(`Error: ${stderr}`);
                    } else{
                        setTimeout(() => {
                            fs.readdir(`${folderPath}/swan-dir`, (err, files) => {
                                if (err) {
                                   outputChannel.appendLine(`Error reading swan-dir: ${err.message}`);
                                   }
                                   else {
                                     outputChannel.appendLine(`Files in swan-dir: ${files.join(', ')}`);
                                    }
                                // Proceed with the command only if files are present
                                if (files.length > 0) {
                                    cp.exec(`cd ${folderPath} && java -jar ${driverJarPath} --crypto swan-dir/ `, (error, stdout, stderr) => { 
                                        if (error) {
                                            outputChannel.appendLine(`Error: ${stderr}`);
                                        } else {
                                           outputChannel.appendLine(`running the analysis on a single file`)
                                                try {
                                                    const resultFilePath = path.join(folderPath, 'swan-dir', 'crypto-results.json');
                                                fs.readFile(resultFilePath, 'utf8', (err, data) => {
                                                    if (err) {
                                                       outputChannel.appendLine(`Error reading crypto-results.json: ${err.message}`);
                                                    } else {
                                                        try {
                                                            const jsonData = JSON.parse(data);
                                                            outputChannel.appendLine('crypto Results:');
                                                            outputChannel.appendLine(JSON.stringify(jsonData, null, 2));
                                                            let diagnostics = []
                                                            if(jsonData[0].paths && jsonData[0].paths.length>0){
                                                                jsonData[0].paths[0].path.forEach((path)=>{
                                                                    const match = path.match(/^(.*):(\d+):(\d+)$/);
                                                                    if (match) {
                                                                      const [_, filePath, lineStr, colStr] = match;
                                                                      const line = parseInt(lineStr, 10) - 1; // Convert to 0-based index
                                                                      const col = parseInt(colStr, 10) - 1;  // Convert to 0-based index
            
                                                                      const range = new vscode.Range(new vscode.Position(line, col), new vscode.Position(line , col ));
                                                                      const diagnostic = new vscode.Diagnostic(range, `crypto analysis flagged this`, vscode.DiagnosticSeverity.Warning); 
                                                                      diagnostics.push(diagnostic) 
                                                                    }
                                                                    const activeEditor = vscode.window.activeTextEditor;
                                                                    if (activeEditor) {
                                                                    diagnosticCollection.set(activeEditor.document.uri, diagnostics)
                                                                }
                                                                });
                                                            }
                                                        } catch (parseErr) {
                                                            outputChannel.appendLine(`Error parsing crypto-results.json: ${parseErr.message}`);
                                                        }
                                                    }
                                                });
                                                  
                                                        
    
                                                } catch (parseErr) {
                                                    console.error('Error parsing JSON:', parseErr.message);
                                                }
                                            
                                        }
                                    });
                                } else {
                                   outputChannel.appendLine("No files found in swan-dir after timeout.");
                                }
                            });
                        }, 1000);
                    }
                });
            
            } else {
                const buildFolderPath = path.join(packageSwiftDirectory, '.build');

            
                if (fs.existsSync(buildFolderPath)) {
                    fs.rm(buildFolderPath, { recursive: true, force: true }, (err) => {
                        if (err) {
                            console.error('Error removing .build folder:', err);
                        } else {
                            console.log('.build folder removed successfully.');
                        }
                    });
                } else {
                    console.log('.build folder does not exist in:', buildFolderPath);
                }
    
                // Show a message that the file is running
               
               
              cp.exec(`cd ${packageSwiftDirectory} &&  python3 /home/abdulraheem/swanNewBuild/swan/tests/swan-spm.py`, (error, stdout, stderr) => { 
                    if (error) {
                        outputChannel.appendLine(`Error: ${stderr}`);
                    } else{
                        setTimeout(() => {
                            fs.readdir(`${packageSwiftDirectory}/swan-dir`, (err, files) => {
                                if (err) {
                                   outputChannel.appendLine(`Error reading swan-dir: ${err.message}`);
                                   }
                                   else {
                                     outputChannel.appendLine(`Files in swan-dir: ${files.join(', ')}`);
                                    }
                                // Proceed with the command only if files are present
                                if (files.length > 0) {
                                    cp.exec(`cd ${packageSwiftDirectory} && java -jar ${driverJarPath} --crypto swan-dir/ `, (error, stdout, stderr) => { 
                                        if (error) {
                                            outputChannel.appendLine(`Error: ${stderr}`);
                                        } else {
                                            outputChannel.appendLine(`Output: ${stdout || "No output returned from the script."}`);
                                                try {
                                                    const resultFilePath = path.join(packageSwiftDirectory, 'swan-dir', 'crypto-results.json');
                                                fs.readFile(resultFilePath, 'utf8', (err, data) => {
                                                    if (err) {
                                                        outputChannel.appendLine(`Error reading crypto-results.json: ${err.message}`);
                                                    } else {
                                                        try {
                                                            const jsonData = JSON.parse(data);
                                                            outputChannel.appendLine('crypto Results:');
                                                            outputChannel.appendLine(JSON.stringify(jsonData, null, 2));
                                                            let diagnostics = []
                                                            if(jsonData[0].paths && jsonData[0].paths.length>0){
                                                                jsonData[0].paths[0].path.forEach((path)=>{
                                                                    const match = path.match(/^(.*):(\d+):(\d+)$/);
                                                                    if (match) {
                                                                      const [_, filePath, lineStr, colStr] = match;
                                                                      const line = parseInt(lineStr, 10) - 1; // Convert to 0-based index
                                                                      const col = parseInt(colStr, 10) - 1;  // Convert to 0-based index
            
                                                                      const range = new vscode.Range(new vscode.Position(line, col), new vscode.Position(line , col ));
                                                                      const diagnostic = new vscode.Diagnostic(range, `crypto analysis flagged this`, vscode.DiagnosticSeverity.Warning); 
                                                                      diagnostics.push(diagnostic) 
                                                                    }
                                                                    const activeEditor = vscode.window.activeTextEditor;
                                                                    if (activeEditor) {
                                                                    diagnosticCollection.set(activeEditor.document.uri, diagnostics)
                                                                }
                                                                });
                                                            }
                                                        } catch (parseErr) {
                                                            outputChannel.appendLine(`Error parsing crypto-results.json: ${parseErr.message}`);
                                                        }
                                                    }
                                                });
                                                  
                                                        
    
                                                } catch (parseErr) {
                                                    console.error('Error parsing JSON:', parseErr.message);
                                                }
                                            
                                        }
                                    });
                                } else {
                                   outputChannel.appendLine("No files found in swan-dir after timeout.");
                                }
                            });
                        }, 1000);
                    }
                });
            }  
            
        } else {
            vscode.window.showWarningMessage('No active editor with an open file.');
        }
		vscode.window.showInformationMessage('Hello World from swift detect 3!');
	});


	context.subscriptions.push(createDebug,runAnalysisCommand,runCryptoAnalysis,showOutputChannel,runTaintAnalysis,runTypeStateAnalysis,createCallGraph,disposable,diagnosticCollection,{ dispose: deactivateCurrentModule });
}

function deactivate() {
    if (currentModule && currentModule.deactivate) {
        currentModule.deactivate();
    }
}

module.exports = { activate, deactivate };
