const vscode = require('vscode');
const runCallGraph = require('./callgraph');
const runTypestate = require('./typestateanalysis');
const runTaint = require('./taintanalysis');
const runCrypto = require('./cryptoanalysis');
const runDebug = require('./debug');
const treeItems = require('./treeItems');
const path = require('path');
const fs = require('fs');
const cp = require('child_process');
const sharedState = require('./sharedState');


let currentModule;




function activate(context) {
    
    const runAnalysisProvider = new treeItems.SwanTreeDataProvider("Run Analysis");
    const viewResultsProvider = new treeItems.SwanTreeDataProvider("View Results");
    const settingsProvider = new treeItems.SwanTreeDataProvider("Settings");
    const errorsProvider = new treeItems.SwanTreeDataProvider("Errors");

    // Register the TreeView for each section under the "swanAnalysisView" container
    vscode.window.registerTreeDataProvider('runAnalysisView', runAnalysisProvider);
    vscode.window.registerTreeDataProvider('viewResultsView', viewResultsProvider);
    vscode.window.registerTreeDataProvider('settingsView', settingsProvider);
    vscode.window.registerTreeDataProvider('errorsView', errorsProvider);

    console.log('Extension is now active!');

    // Reset settings to their defaults
    resetSettingsToDefaults();

    function resetSettingsToDefaults() {
        const config = vscode.workspace.getConfiguration('swan');
    
        // Default values for all settings
        const defaults = {
            'forceCacheRead': false,
            'debug': false,
            'callGraph': false,
            'invalidateCache': false,
            'names': false,
            'dot': false,
            'probe': false,
            'single': false,
            'taintAnalysisSpecPath': '',
            'typestateAnalysisSpecPath': ''
        };
    
        // Reset each setting to its default value
        for (const [key, defaultValue] of Object.entries(defaults)) {
            config.update(key, defaultValue, vscode.ConfigurationTarget.Global)
                .then(() => {
                    console.log(`Reset ${key} to its default value: ${defaultValue}`);
                })
                .catch((err) => {
                    console.error(`Error resetting ${key}: ${err}`);
                });
        }
        settingsProvider.refresh();
    
        vscode.window.showInformationMessage('SWAN settings have been reset to their default values.');
    }
    const resetToDefaultSettings = vscode.commands.registerCommand('swancommands.defaults', function () {
        resetSettingsToDefaults();
    })

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
    
    const setTaintAnalysisSpec = vscode.commands.registerCommand("swancommands.setTaintAnalysisSpec", async () => {
      console.log('updating the path to taint analysis')
    
        
        const input = await vscode.window.showInputBox({
            prompt: "Enter the path to the Analysis Spec",
            value: sharedState.taintAnalysisUserPath ? sharedState.taintAnalysisUserPath : "", // Pre-fill with the current value if available
            placeHolder: "/path/to/your/spec.json", // Provide a placeholder for when no value is pre-filled
            validateInput: (value) => {
                if (!value || value.trim() === "") {
                    return "Path cannot be empty.";
                }

                const trimmedValue = value.trim(); // Remove any extra spaces

         // Check if the path contains slashes
         if (!trimmedValue.includes("/")) {
            return "The path must contain at least one slash ('/').";
         }

                return null;
            }
        });

        if (input && typeof input ==='string') {
            const trimmedInput = input.trim();

        // Update the global variable
        sharedState.taintAnalysisUserPath = trimmedInput;

        // Update the settings
        const config = vscode.workspace.getConfiguration("swan");
        await config.update("taintAnalysisSpecPath", trimmedInput, vscode.ConfigurationTarget.Global);
        settingsProvider.refresh();
        vscode.window.showInformationMessage(`Taint Analysis Spec path set to: ${trimmedInput}`);
        }
    })
    
    const setTypestateAnalysisSpec = vscode.commands.registerCommand("swancommands.setTypestateAnalysisSpec", async () => {
        const input = await vscode.window.showInputBox({
            prompt: "Enter the path to the Analysis Spec",
            value: sharedState.typestateAnalysisUserPath ? sharedState.typestateAnalysisUserPath : "", // Pre-fill with the current value if available
            placeHolder: "/path/to/your/spec.json", // Provide a placeholder for when no value is pre-filled
            validateInput: (value) => {
                if (!value || value.trim() === "") {
                    return "Path cannot be empty.";
                }

                const trimmedValue = value.trim(); // Remove any extra spaces

         // Check if the path contains slashes
         if (!trimmedValue.includes("/")) {
            return "The path must contain at least one slash ('/').";
         }

                return null;
            }
        });

        if (input && typeof input ==='string') {
            const trimmedInput = input.trim();

        // Update the global variable
        sharedState.typestateAnalysisUserPath = trimmedInput;

        // Update the settings
        const config = vscode.workspace.getConfiguration("swan");
        await config.update("typestateAnalysisSpecPath", trimmedInput, vscode.ConfigurationTarget.Global);
        settingsProvider.refresh();
        vscode.window.showInformationMessage(`Typestate Analysis Spec path set to: ${trimmedInput}`);
        }
    })
    // Listen for configuration changes
    vscode.workspace.onDidChangeConfiguration((event) => {
        const config = vscode.workspace.getConfiguration("swan");
        if (event.affectsConfiguration("swan.taintAnalysisSpecPath")) {
            sharedState.taintAnalysisUserPath = config.get("taintAnalysisSpecPath", "");
            settingsProvider.refresh();
            vscode.window.showInformationMessage(`Taint Analysis Spec path updated to: ${sharedState.taintAnalysisUserPath}`);
        } else if (event.affectsConfiguration("swan.typestateAnalysisSpecPath")) {
            sharedState.typestateAnalysisUserPath = config.get("typestateAnalysisSpecPath", "");
            settingsProvider.refresh();
            vscode.window.showInformationMessage(`Typestate Analysis Spec path updated to: ${sharedState.typestateAnalysisUserPath}`);
        } else if (event.affectsConfiguration("swan.forceCacheRead")) {
            const boolForceCache = config.get("forceCacheRead", "");
            vscode.window.showInformationMessage(`force cache read updated to: ${boolForceCache}`);
        }  else if (event.affectsConfiguration("swan.debug")) {
            const boolDebug = config.get("debug", false);
            vscode.window.showInformationMessage(`Debug updated to: ${boolDebug}`);
        } else if (event.affectsConfiguration("swan.callGraph")) {
            const boolCallGraph = config.get("callGraph", false);
            vscode.window.showInformationMessage(`Call Graph updated to: ${boolCallGraph}`);
        } else if (event.affectsConfiguration("swan.invalidateCache")) {
            const boolInvalidateCache = config.get("invalidateCache", false);
            vscode.window.showInformationMessage(`Invalidate Cache updated to: ${boolInvalidateCache}`);
        } else if (event.affectsConfiguration("swan.names")) {
            const boolNames = config.get("names", false);
            vscode.window.showInformationMessage(`Names updated to: ${boolNames}`);
        } else if (event.affectsConfiguration("swan.dot")) {
            const boolDot = config.get("dot", false);
            vscode.window.showInformationMessage(`DOT updated to: ${boolDot}`);
        } else if (event.affectsConfiguration("swan.probe")) {
            const boolProbe = config.get("probe", false);
            vscode.window.showInformationMessage(`Probe updated to: ${boolProbe}`);
        } else if (event.affectsConfiguration("swan.single")) {
            const boolSingle = config.get("single", false);
            vscode.window.showInformationMessage(`Single-Threaded Execution updated to: ${boolSingle}`);
        } else if (event.affectsConfiguration('swan.swiftcPath')) {
              validatePath('swiftc');
        } else if (event.affectsConfiguration('swan.swan-Driver')) {
            validatePath('driver');
      } else if(event.affectsConfiguration('swan.swan-spm')){
        validatePath('swan-spm');
      }
        
    });

    
function validatePath(type) {
  const config = vscode.workspace.getConfiguration('swan');
  console.log('I am being called')
  let Path='';
  if (type === "swiftc"){
    Path = config.get('swiftcPath',"");
  } else if (type ==="driver"){
    Path = config.get('swan-Driver',"");
  }else if (type ==="swan-spm"){
    Path = config.get('swan-spm',"");
  }

console.log(`the path inputted is ${Path}` )

    if (!Path || Path.trim() === "") {
        vscode.window.showErrorMessage('Path cannot be empty please input the correct path');
    }

    const trimmedValue = Path.trim(); // Remove any extra spaces

   // Check if the path contains slashes
    if (!trimmedValue.includes("/")) {
    vscode.window.showErrorMessage("The path must contain at least one slash ('/')"); 
   } 

   if (Path && typeof Path ==='string') {
    const trimmedInput = Path.trim();
   }
}
    

    let activeEditor = vscode.window.activeTextEditor;
    if(activeEditor){
        detectSwiftDocument(activeEditor.document)
    
    }
   
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

    const clearErrors = vscode.commands.registerCommand('swancommands.clearErrors', (label) => {
        errorsProvider.clearErrors(); // Call the removeError method
    });

    const helpMenu = vscode.commands.registerCommand('swancommands.help', (label) => {
        const driverJarPath = '/home/abdulraheem/swanNewBuild/swan/lib/driver.jar'
        cp.exec(`java -jar ${driverJarPath} -help`, (error, stdout, stderr) => {
            // Handle standard output
            if (stdout) {
                outputChannel.append(stdout); // Append standard output to the channel
            }
    
            // Handle error output
            if (stderr) {
                outputChannel.appendLine(`stderr: ${stderr}`); // Append errors to the channel
            }
    
            // Handle execution errors (e.g., command not found)
            if (error) {
                outputChannel.appendLine(`Error: ${error.message}`);
            }
        });
    });
   
   
   /* vscode.commands.registerCommand('swancommands.toggleForceCacheRead', () => {
        const config = vscode.workspace.getConfiguration();
        const currentValue = config.get('swan.forceCacheRead');
        config.update('swan.forceCacheRead', !currentValue, true).then(() => {
            vscode.window.showInformationMessage(
                `Force Cache Read is now ${!currentValue ? 'enabled' : 'disabled'}.`
            );
        });
    });
    */

    const openSettingsCommand = vscode.commands.registerCommand(
        "swancommands.openSettings",
        () => {
          vscode.commands.executeCommand(
            "workbench.action.openSettings",
            "swan"
          );
        }
      );

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
     
            errorsProvider.addError("Error 1", "This is the first error.",null);
         
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
                                    cp.exec(`cd ${folderPath} && java -jar ${driverJarPath} -e ${typeStateAnalysisPath} swan-dir/ `, (error, stdout, stderr) => { 
                                        if (error) {
                                            outputChannel.appendLine(`Error: ${stderr}`);
                                        } else {
                                           outputChannel.appendLine(`running the analysis on a single file`)
                                                try {
                                                    const resultFilePath = path.join(folderPath, 'swan-dir', 'typestate-results.json');
                                                fs.readFile(resultFilePath, 'utf8', (err, data) => {
                                                    if (err) {
                                                        outputChannel.appendLine(`Error reading typestate-results.json: ${err.message}`);
                                                    } else {
                                                        try {
                                                            const jsonData = JSON.parse(data);
                                                            outputChannel.appendLine('typestate Results:');
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
                                                                      const diagnostic = new vscode.Diagnostic(range, `typestate analysis flagged this`, vscode.DiagnosticSeverity.Warning); 
                                                                      diagnostics.push(diagnostic) 
                                                                    }
                                                                    const activeEditor = vscode.window.activeTextEditor;
                                                                    if (activeEditor) {
                                                                    diagnosticCollection.set(activeEditor.document.uri, diagnostics)
                                                                }
                                                                });
                                                            }
                                                        } catch (parseErr) {
                                                            outputChannel.appendLine(`Error parsing typestate-results.json: ${parseErr.message}`);
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
         const taintAnalysisPath = '/home/abdulraheem/codeForMeeting/swancommands/specifications/taint.json'
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
                                    cp.exec(`cd ${folderPath} && java -jar ${driverJarPath} -t ${sharedState.taintAnalysisUserPath? sharedState.taintAnalysisUserPath : taintAnalysisPath} swan-dir/ `, (error, stdout, stderr) => { 
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
                                                            let urls=[];
                                                            if(jsonData[0].paths && jsonData[0].paths.length>0){
                                                                jsonData[0].paths[0].path.forEach((path)=>{
                                                                    urls.push(path)
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
                                                            console.log("Calling addError with:", jsonData[0].name,jsonData[0].description,urls);
                                                            errorsProvider.addError(jsonData[0].name,jsonData[0].description,urls); 
                                                            console.log("just added the error")
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
                                    cp.exec(`cd ${packageSwiftDirectory} && java -jar ${driverJarPath} -t ${sharedState.taintAnalysisUserPath? sharedState.taintAnalysisUserPath : taintAnalysisPath} swan-dir/ `, (error, stdout, stderr) => { 
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
                                                            let diagnostics = [];
                                                            let urls=[];
                                                            if(jsonData[0].paths && jsonData[0].paths.length>0){
                                                                jsonData[0].paths[0].path.forEach((path)=>{
                                                                urls.push(path)
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
                                                                try {
                                                                    console.log("Calling addError with:", jsonData[0].name, jsonData[0].description, urls);
                                                                    errorsProvider.addError(jsonData[0].name, jsonData[0].description, urls);
                                                                    console.log("just added the error");
                                                                } catch (err) {
                                                                    console.error("Error while adding error to errorsProvider:", err);
                                                                }
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
		const activeEditor = vscode.window.activeTextEditor;
        const swiftcPath = '/home/abdulraheem/buildingSwan/swan/lib/swan-swiftc'
        const driverJarPath = '/home/abdulraheem/swanNewBuild/swan/lib/driver.jar'
        
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


	context.subscriptions.push(resetToDefaultSettings,openSettingsCommand, helpMenu ,clearErrors,deleteError,setTypestateAnalysisSpec, setTaintAnalysisSpec,createDebug,runCryptoAnalysis,showOutputChannel,runTaintAnalysis,runTypeStateAnalysis,createCallGraph,disposable,diagnosticCollection,{ dispose: deactivateCurrentModule });
}

function deactivate() {
    if (currentModule && currentModule.deactivate) {
        currentModule.deactivate();
    }
}

module.exports = { activate, deactivate};
