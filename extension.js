// The module 'vscode' contains the VS Code extensibility API



// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const cp = require('child_process');
const path = require('path');
const fs = require('fs');
// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "swancommands" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with  registerCommand
	// The commandId parameter must match the command field in package.json
	const disposable = vscode.commands.registerCommand('swancommands.helloWorld', function () {
		// The code you place here will be executed every time your command is executed

		// Display a message box to the user
		vscode.window.showInformationMessage('Hello World from swanCommands!');
	});

	const runCallGraph = vscode.commands.registerCommand('swancommands.callGraph', function () {
		// The code you place here will be executed every time your command is executed
		const activeEditor = vscode.window.activeTextEditor;
        const swiftcPath = '/home/abdulraheem/buildingSwan/swan/lib/swan-swiftc'
        const driverJarPath = '/home/abdulraheem/buildingSwan/swan/lib/driver.jar'
		// Display a message box to the user
        if (activeEditor) {
            const filePath = activeEditor.document.fileName;
            const folderPath = path.dirname(filePath);
            const fileName = path.basename(filePath);
            // Show a message that the file is running
            vscode.window.showInformationMessage('Running: ' + filePath);
            const outputChannel = vscode.window.createOutputChannel('Swan Analysis');
            outputChannel.show(); // Opens the output channel in the editor

            
           
          cp.exec(`cd ${folderPath} && ${swiftcPath} -- ${fileName}`, (error, stdout, stderr) => { 
                if (error) {
                    outputChannel.appendLine(`Error: ${stderr}`);
                } else{
                    setTimeout(() => {
                        fs.readdir(`${folderPath}/swan-dir`, (err, files) => {
                            if (err) outputChannel.appendLine(`Error reading swan-dir: ${err.message}`);
                            else outputChannel.appendLine(`Files in swan-dir: ${files.join(', ')}`);
                            
                            // Proceed with the command only if files are present
                            if (files.length > 0) {
                                cp.exec(`cd ${folderPath} && java -jar ${driverJarPath} swan-dir/ -g`, (error, stdout, stderr) => { 
                                    if (error) {
                                        outputChannel.appendLine(`Error: ${stderr}`);
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
            
        } else {
            vscode.window.showWarningMessage('No active editor with an open file.');
        }
		vscode.window.showInformationMessage('Hello World from swift detect 3!');
	});



    const runTaintAnalysis = vscode.commands.registerCommand('swancommands.taintAnalysis', function () {
		// The code you place here will be executed every time your command is executed
		const activeEditor = vscode.window.activeTextEditor;
        const swiftcPath = '/home/abdulraheem/buildingSwan/swan/lib/swan-swiftc'
        const driverJarPath = '/home/abdulraheem/buildingSwan/swan/lib/driver.jar'
         const taintAnalysisPath = '/home/abdulraheem/buildingSwan/swan/specifications/examples/taint-args.json'
		// Display a message box to the user
        if (activeEditor) {
            const filePath = activeEditor.document.fileName;
            const folderPath = path.dirname(filePath);
            const fileName = path.basename(filePath);
            // Show a message that the file is running
            vscode.window.showInformationMessage('Running: ' + filePath);
            const outputChannel = vscode.window.createOutputChannel('Swan Analysis');
            outputChannel.show(); // Opens the output channel in the editor

            
           
          cp.exec(`cd ${folderPath} && ${swiftcPath} -- ${fileName}`, (error, stdout, stderr) => { 
                if (error) {
                    outputChannel.appendLine(`Error: ${stderr}`);
                } else{
                    setTimeout(() => {
                        fs.readdir(`${folderPath}/swan-dir`, (err, files) => {
                            if (err) {
                                outputChannel.appendLine(`Error reading swan-dir: ${err.message}`);}
                               else {
                                 //outputChannel.appendLine(`Files in swan-dir: ${files.join(', ')}`);
                                }
                            // Proceed with the command only if files are present
                            if (files.length > 0) {
                                cp.exec(`cd ${folderPath} && java -jar ${driverJarPath} -t ${taintAnalysisPath} swan-dir/ `, (error, stdout, stderr) => { 
                                    if (error) {
                                        outputChannel.appendLine(`Error: ${stderr}`);
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
            
        } else {
            vscode.window.showWarningMessage('No active editor with an open file.');
        }
		vscode.window.showInformationMessage('Hello World from swift detect 3!');
	});

    const runTypeStateAnalysis = vscode.commands.registerCommand('swancommands.typeStateAnalysis', function () {
		// The code you place here will be executed every time your command is executed
		const activeEditor = vscode.window.activeTextEditor;
        const swiftcPath = '/home/abdulraheem/buildingSwan/swan/lib/swan-swiftc'
        const driverJarPath = '/home/abdulraheem/buildingSwan/swan/lib/driver.jar'
         const typeStateAnalysisPath = '/home/abdulraheem/swancommands/specifications/simpleTypestate.json'
		// Display a message box to the user
        if (activeEditor) {
            const filePath = activeEditor.document.fileName;
            const folderPath = path.dirname(filePath);
            const fileName = path.basename(filePath);
            // Show a message that the file is running
            vscode.window.showInformationMessage('Running: ' + filePath);
            const outputChannel = vscode.window.createOutputChannel('Swan Analysis');
            outputChannel.show(); // Opens the output channel in the editor

            
           
          cp.exec(`cd ${folderPath} && ${swiftcPath} -- ${fileName}`, (error, stdout, stderr) => { 
                if (error) {
                    outputChannel.appendLine(`Error creating the SIL file: ${stderr}`);
                } else{
                    setTimeout(() => {
                        fs.readdir(`${folderPath}/swan-dir`, (err, files) => {
                            if (err) {
                                outputChannel.appendLine(`Error reading swan-dir: ${err.message}`);}
                               else {
                                 //outputChannel.appendLine(`Files in swan-dir: ${files.join(', ')}`);
                                }
                            // Proceed with the command only if files are present
                            if (files.length > 0) {
                                cp.exec(`cd ${folderPath} && java -jar ${driverJarPath} -e ${typeStateAnalysisPath} swan-dir/ `, (error, stdout, stderr) => { 
                                    if (error) {
                                        outputChannel.appendLine(`Error: ${stderr}`);
                                    } else {
                                        //outputChannel.appendLine(`Output: ${stdout || "No output returned from the script."}`);
                                    // Parse and display the typestate-results.json file
                                    const resultFilePath = path.join(folderPath, 'swan-dir', 'typestate-results.json');
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
                                outputChannel.appendLine("No files found in swan-dir after timeout.");
                            }
                        });
                    }, 1000);
                }
            });
            
        } else {
            vscode.window.showWarningMessage('No active editor with an open file.');
        }
		vscode.window.showInformationMessage('Hello World from swift detect 3!');
	});
	context.subscriptions.push(disposable,runTaintAnalysis,runCallGraph,runTypeStateAnalysis);
}

// This method is called when your extension is deactivated
function deactivate() {}

module.exports = {
	activate,
	deactivate
}
