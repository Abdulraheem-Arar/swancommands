const vscode = require('vscode');
const runCallGraph = require('./callgraph');
const runTypestate = require('./typestateanalysis');
const runTaint = require('./taintanalysis');
const runCrypto = require('./cryptoanalysis');
const treeItems = require('./treeItems');
const path = require('path');
const fs = require('fs');
const cp = require('child_process');
const sharedState = require('./sharedState');


let currentModule;
let boolForceCache = false, boolDebug = false, boolCallGraph = false, boolInvalidateCache = false, boolNames = false, boolDot = false, boolProbe = false, boolSingle = false;
let isPathValid = false;
let isTaintPathValid = false;
let isTypestatePathValid = false;
let swiftcPath = "";
let driverJarPath = "";
let swanSpmPath = "";

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
    //initialize the paths to what they were previously set to 
    initializePaths()

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
            'typestateAnalysisSpecPath': '',
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

    function initializePaths(){
        //taint path initialization
        validatePath('taint')
        sharedState.taintAnalysisUserPath = config.get("taintAnalysisSpecPath", "");
        settingsProvider.refresh();
        //vscode.window.showInformationMessage(`Taint Analysis Spec path updated to: ${sharedState.taintAnalysisUserPath}`);
        //typestate path initialization 
        validatePath('typestate')
        sharedState.typestateAnalysisUserPath = config.get("typestateAnalysisSpecPath", "");
        settingsProvider.refresh();
        //vscode.window.showInformationMessage(`Typestate Analysis Spec path updated to: ${sharedState.typestateAnalysisUserPath}`);
        //swiftc path initialization
        validatePath('swiftc');
        //vscode.window.showInformationMessage(`swan-swiftc path updated to: ${swiftcPath}`);
        //driver.jar path initialization
        validatePath('driver');
        //vscode.window.showInformationMessage(`driver.jar path updated to: ${driverJarPath}`);
        //swan-spm.py path initialization
        validatePath('swan-spm');
        //vscode.window.showInformationMessage(`swan-spm.py path updated to: ${swanSpmPath}`);
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
    
    const setAnalysisSpec = vscode.commands.registerCommand("swancommands.setAnalysisPath", async (context) => {
      console.log('updating the path to taint analysis')
    
        let Path = '';
        if (context==='taint'){
            Path = sharedState.taintAnalysisUserPath ? sharedState.taintAnalysisUserPath : "";
        } else if (context==='typestate'){
        Path = sharedState.typestateAnalysisUserPath ? sharedState.typestateAnalysisUserPath : ""
        }    
        
        const input = await vscode.window.showInputBox({
            prompt: "Enter the path to the Analysis Spec",
            value: Path,
             // Pre-fill with the current value if available
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
        if (context === 'taint'){
            sharedState.taintAnalysisUserPath = trimmedInput;
        } else if (context ==='typestate'){
            sharedState.typestateAnalysisUserPath = trimmedInput;
        }

        // Update the settings
        const config = vscode.workspace.getConfiguration("swan");
        if (context === 'taint'){
            await config.update("taintAnalysisSpecPath", trimmedInput, vscode.ConfigurationTarget.Global);
        settingsProvider.refresh();
        vscode.window.showInformationMessage(`Taint Analysis Spec path set to: ${trimmedInput}`);
        } else if (context ==='typestate'){
            await config.update("typestateAnalysisSpecPath", trimmedInput, vscode.ConfigurationTarget.Global);
        settingsProvider.refresh();
        vscode.window.showInformationMessage(`Typestate Analysis Spec path set to: ${trimmedInput}`);
        }
       
        }
    })

    // Listen for configuration changes
    vscode.workspace.onDidChangeConfiguration((event) => {
        const config = vscode.workspace.getConfiguration("swan");
        if (event.affectsConfiguration("swan.taintAnalysisSpecPath")) {
            validatePath('taint')
            sharedState.taintAnalysisUserPath = config.get("taintAnalysisSpecPath", "");
            settingsProvider.refresh();
            vscode.window.showInformationMessage(`Taint Analysis Spec path updated to: ${sharedState.taintAnalysisUserPath}`);
        } else if (event.affectsConfiguration("swan.typestateAnalysisSpecPath")) {
            validatePath('typestate')
            sharedState.typestateAnalysisUserPath = config.get("typestateAnalysisSpecPath", "");
            settingsProvider.refresh();
            vscode.window.showInformationMessage(`Typestate Analysis Spec path updated to: ${sharedState.typestateAnalysisUserPath}`);
        } else if (event.affectsConfiguration("swan.forceCacheRead")) {
             boolForceCache = config.get("forceCacheRead", "");
            vscode.window.showInformationMessage(`force cache read updated to: ${boolForceCache}`);
        }  else if (event.affectsConfiguration("swan.debug")) {
             boolDebug = config.get("debug", false);
            vscode.window.showInformationMessage(`Debug updated to: ${boolDebug}`);
        } else if (event.affectsConfiguration("swan.callGraph")) {
             boolCallGraph = config.get("callGraph", false);
            vscode.window.showInformationMessage(`Call Graph updated to: ${boolCallGraph}`);
        } else if (event.affectsConfiguration("swan.invalidateCache")) {
             boolInvalidateCache = config.get("invalidateCache", false);
            vscode.window.showInformationMessage(`Invalidate Cache updated to: ${boolInvalidateCache}`);
        } else if (event.affectsConfiguration("swan.names")) {
             boolNames = config.get("names", false);
            vscode.window.showInformationMessage(`Names updated to: ${boolNames}`);
        } else if (event.affectsConfiguration("swan.dot")) {
             boolDot = config.get("dot", false);
            vscode.window.showInformationMessage(`DOT updated to: ${boolDot}`);
        } else if (event.affectsConfiguration("swan.probe")) {
             boolProbe = config.get("probe", false);
            vscode.window.showInformationMessage(`Probe updated to: ${boolProbe}`);
        } else if (event.affectsConfiguration("swan.single")) {
             boolSingle = config.get("single", false);
            vscode.window.showInformationMessage(`Single-Threaded Execution updated to: ${boolSingle}`);
        } else if (event.affectsConfiguration('swan.swiftcPath')) {
              validatePath('swiftc');
              vscode.window.showInformationMessage(`swan-swiftc path updated to: ${swiftcPath}`);
        } else if (event.affectsConfiguration('swan.swan-Driver')) {
              validatePath('driver');
              vscode.window.showInformationMessage(`driver.jar path updated to: ${driverJarPath}`);
      } else if(event.affectsConfiguration('swan.swan-spm')){
        validatePath('swan-spm');
        vscode.window.showInformationMessage(`swan-spm.py path updated to: ${swanSpmPath}`);
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
  } else if (type ==="swan-spm"){
    Path = config.get('swan-spm',"");
  } else if (type ==='taint'){
    Path = config.get('taintAnalysisSpecPath')
  } else if (type === 'typestate'){
    Path = config.get('typestateAnalysisSpecPath')
  }

    console.log(`the path inputted is ${Path}` )

    const trimmedValue = Path.trim(); // Remove any extra spaces

    if (!Path || trimmedValue === "") {
        vscode.window.showErrorMessage(`Path to ${type} cannot be empty please input the correct path`);
        if (type ==='typestate'){
            isTypestatePathValid = false;
        } else if (type ==='taint'){
            isTaintPathValid = false;
        } else {
            isPathValid = false;
        }
        
    } else if (!trimmedValue.includes("/")){  // Check if the path contains slashes
        vscode.window.showErrorMessage("The path must contain at least one slash ('/')"); 
        if (type ==='typestate'){
            isTypestatePathValid = false;
        } else if (type ==='taint'){
            isTaintPathValid = false;
        } else {
            isPathValid = false;
        }
        
    } else {
        if (type ==='typestate'){
            isTypestatePathValid = true;
        } else if (type ==='taint'){
            isTaintPathValid = true;
        } else {
            isPathValid = true;
            if (type === "swiftc"){
                swiftcPath = Path;
              } else if (type ==="driver"){
                driverJarPath = Path;
              } else if (type ==="swan-spm"){
                swanSpmPath = Path;
              }
        }
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

    const showOutputChannel = vscode.commands.registerCommand('swancommands.DetailedLogs', function () {
        if (!isOutputChannel){
            outputChannel.show(true);
            isOutputChannel = true;
        } else {
            vscode.commands.executeCommand('workbench.action.closePanel');
            isOutputChannel = false;
        }
        
    })

    const clearErrors = vscode.commands.registerCommand('swancommands.clearErrors', (label) => {
        errorsProvider.clearErrors(); // Call the clear error method
    });

    const helpMenu = vscode.commands.registerCommand('swancommands.help', (label) => {
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

    const openSettingsCommand = vscode.commands.registerCommand(
        "swancommands.openSettings",
        () => {
          vscode.commands.executeCommand(
            "workbench.action.openSettings",
            "swan"
          );
        }
      );


    function handleBooleans(command){
        let Booleans = [boolForceCache, boolDebug, boolCallGraph, boolInvalidateCache, boolNames, boolDot, boolProbe, boolSingle];

        if (Booleans[0]) { // boolForceCache
            command = command + ' -f ';
        }
        if (Booleans[1]) { // boolDebug
            command = command + ' -d ';
        }
        if (Booleans[2]) { // boolCallGraph
            command = command + ' -g ';
        }
        if (Booleans[3]) { // boolInvalidateCache
            command = command + ' -i ';
        }
        if (Booleans[4]) { // boolNames
            command = command + ' -n ';
        }
        if (Booleans[5]) { // boolDot
            command = command + ' -o ';
        }
        if (Booleans[6]) { // boolProbe
            command = command + ' -r ';
        }
        if (Booleans[7]) { // boolSingle
            command = command + ' -s ';
        }
        return command
    }

    const runAnalysis = vscode.commands.registerCommand('swancommands.runAnalysis', function (context) {

        if (!isPathValid){
            vscode.window.showErrorMessage('the path provided for one of the analysis drivers is not valid')
            return
        } else if (context ==='taint' && !isTaintPathValid){
            vscode.window.showErrorMessage('the path provided for the taint analysis specification file is not valid')
            return
        } else if (context ==='typestate' && !isTypestatePathValid){
            vscode.window.showErrorMessage('the path provided for the typestate analysis specification file is not valid')
            return
        }

		// The code you place here will be executed every time your command is executed
		const activeEditor = vscode.window.activeTextEditor;

        let boolCommands ='';
        boolCommands = handleBooleans(boolCommands)
        vscode.window.showInformationMessage(`added command is now ${boolCommands}`)

        let type = context;
        
        let userPath = ''; 
        let command = '';
        if (type==='taint'){
            userPath = sharedState.taintAnalysisUserPath;
            command = '-t'
        } else if (type === 'typestate') {
            userPath = sharedState.typestateAnalysisUserPath;
            command = '-e';
        } else if (type === 'crypto'){
            userPath = '';
            command = '--crypto'
        } else if (type === 'callGraph'){
            userPath = '';
            command = '-g'
        }

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

                cp.exec(`cd ${folderPath} &&  ${swiftcPath} ${fileName}`, (error, stdout, stderr) => { 
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
                                    cp.exec(`cd ${folderPath} && java -jar ${driverJarPath} ${command} ${userPath} ${boolCommands} swan-dir/ `, (error, stdout, stderr) => { 
                                        if (error) {
                                            outputChannel.appendLine(`Error: ${stderr}`);
                                        } else {
                                            outputChannel.appendLine(`Output: ${stdout || "No output returned from the script."}`);
                                            if(type !='callGraph'){
                                                outputChannel.appendLine(`running the analysis on a single file`)
                                                try {
                                                    const resultFilePath = path.join(folderPath, 'swan-dir', `${type}-results.json`);
                                                    fs.readFile(resultFilePath, 'utf8', (err, data) => {
                                                    if (err) {
                                                       outputChannel.appendLine(`Error reading ${type}-results.json: ${err.message}`);
                                                    } else {
                                                        try {
                                                            const jsonData = JSON.parse(data);
                                                            outputChannel.appendLine(`${type} Results:`);
                                                            outputChannel.appendLine(JSON.stringify(jsonData, null, 2));
                                                            let diagnostics = []
                                                            let urls=[];
                                                            let titles = [];
                                                            if(type === 'taint' && jsonData[0].paths && jsonData[0].paths.length>0){
                                                                let advice = jsonData[0].advice;
                                                                jsonData[0].paths.forEach((item)=>{
                                                                    titles= [];
                                                                    urls =[];
                                                                    titles.push(item.source.name)
                                                                    titles.push(item.sink.name)
                                                                    item.path.forEach((path)=>{
                                                                        urls.push(path)
                                                                            const match = path.match(/^(.*):(\d+):(\d+)$/);
                                                                            if (match) {
                                                                            const [_, filePath, lineStr, colStr] = match;
                                                                            const line = parseInt(lineStr, 10) - 1; // Convert to 0-based index
                                                                            const col = parseInt(colStr, 10) - 1;  // Convert to 0-based index

                                                                            const range = new vscode.Range(new vscode.Position(line, col), new vscode.Position(line , col ));
                                                                            const diagnostic = new vscode.Diagnostic(range, `${type} analysis flagged this: ${advice}`, vscode.DiagnosticSeverity.Warning); 
                                                                            diagnostics.push(diagnostic) 
                                                                            }
                                                                            const activeEditor = vscode.window.activeTextEditor;
                                                                            if (activeEditor) {
                                                                            diagnosticCollection.set(activeEditor.document.uri, diagnostics)
                                                                        }
                                                                        });
                                                                        try {
                                                                            console.log("Calling addError with:", jsonData[0].name, jsonData[0].description,titles, urls);
                                                                            errorsProvider.addError(jsonData[0].name, jsonData[0].description, titles, urls);
                                                                            console.log("just added the error");
                                                                        } catch (err) {
                                                                            console.error("Error while adding error to errorsProvider:", err);
                                                                        }
                                                            })
                                                            } else if (type === 'typestate' && jsonData[0].errors && jsonData[0].errors.length>0){
                                                                let advice = jsonData[0].advice;
                                                                jsonData[0].errors.forEach((error)=>{
                                                                    let path = folderPath + '/' + error.pos ;
                                                                    urls.push(path)
                                                                    titles.push(error.message)
                                                                    const match = path.match(/^(.*):(\d+):(\d+)$/);
                                                                    if (match) {
                                                                      const [_, filePath, lineStr, colStr] = match;
                                                                      const line = parseInt(lineStr, 10) - 1; // Convert to 0-based index
                                                                      const col = parseInt(colStr, 10) - 1;  // Convert to 0-based index
                                                                      const range = new vscode.Range(new vscode.Position(line, col), new vscode.Position(line , col ));
                                                                      const diagnostic = new vscode.Diagnostic(range, `${type} analysis flagged this : ${advice}`, vscode.DiagnosticSeverity.Warning); 
                                                                      diagnostics.push(diagnostic) 
                                                                    }
                                                                    const activeEditor = vscode.window.activeTextEditor;
                                                                    if (activeEditor) {
                                                                    diagnosticCollection.set(activeEditor.document.uri, diagnostics)
                                                                }
                                                                });
                                                                try {
                                                                    console.log("Calling addError with:", jsonData[0].name, jsonData[0].description,titles, urls);
                                                                    errorsProvider.addError(jsonData[0].name, jsonData[0].description,titles, urls);
                                                                    console.log("just added the error");
                                                                } catch (err) {
                                                                    console.error("Error while adding error to errorsProvider:", err);
                                                                }
                                                            }
                                                            
                                                        } catch (parseErr) {
                                                            outputChannel.appendLine(`Error parsing ${type}-results.json: ${parseErr.message}`);
                                                        }
                                                    }
                                                });
                                                  
                                                        
    
                                                } catch (parseErr) {
                                                    console.error('Error parsing JSON:', parseErr.message);
                                                }
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

                    cp.exec(`cd ${packageSwiftDirectory} && swift package clean`,(error, stdout, stderr)=>{
                        if (error){
                            console.log('Error removing .build folder:', stderr)
                        } else {
                            console.log('.build folder removed successfully.');
                        }
                    })
                    
               
              cp.exec(`cd ${packageSwiftDirectory} &&  python3 ${swanSpmPath}`, (error, stdout, stderr) => { 
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
                                    cp.exec(`cd ${packageSwiftDirectory} && java -jar ${driverJarPath} ${command} ${userPath} ${boolCommands} swan-dir/ `, (error, stdout, stderr) => { 
                                        if (error) {
                                            outputChannel.appendLine(`Error: ${stderr}`);
                                        } else {
                                            outputChannel.appendLine(`Output: ${stdout || "No output returned from the script."}`);
                                            if (type !='callGraph'){
                                                try {
                                                    const resultFilePath = path.join(packageSwiftDirectory, 'swan-dir', `${type}-results.json`);
                                                fs.readFile(resultFilePath, 'utf8', (err, data) => {
                                                    if (err) {
                                                        outputChannel.appendLine(`Error reading ${type}-results.json: ${err.message}`);
                                                    } else {
                                                        try {
                                                            const jsonData = JSON.parse(data);
                                                            outputChannel.appendLine(`${type} Results:`);
                                                            outputChannel.appendLine(JSON.stringify(jsonData, null, 2));
                                                            let diagnostics = [];
                                                            let urls=[];
                                                            let titles = [];
                                                            if(type === 'taint' && jsonData[0].paths && jsonData[0].paths.length>0){
                                                                let advice = jsonData[0].advice;
                                                                jsonData[0].paths.forEach((item)=>{
                                                                    titles= [];
                                                                    urls =[];
                                                                    titles.push(item.source.name)
                                                                    titles.push(item.sink.name)
                                                                    item.path.forEach((path)=>{
                                                                        urls.push(path)
                                                                            const match = path.match(/^(.*):(\d+):(\d+)$/);
                                                                            if (match) {
                                                                            const [_, filePath, lineStr, colStr] = match;
                                                                            const line = parseInt(lineStr, 10) - 1; // Convert to 0-based index
                                                                            const col = parseInt(colStr, 10) - 1;  // Convert to 0-based index

                                                                            const range = new vscode.Range(new vscode.Position(line, col), new vscode.Position(line , col ));
                                                                            const diagnostic = new vscode.Diagnostic(range, `${type} analysis flagged this: ${advice}`, vscode.DiagnosticSeverity.Warning); 
                                                                            diagnostics.push(diagnostic) 
                                                                            }
                                                                            const activeEditor = vscode.window.activeTextEditor;
                                                                            if (activeEditor) {
                                                                            diagnosticCollection.set(activeEditor.document.uri, diagnostics)
                                                                        }
                                                                        });
                                                                        try {
                                                                            console.log("Calling addError with:", jsonData[0].name, jsonData[0].description,titles, urls);
                                                                            errorsProvider.addError(jsonData[0].name, jsonData[0].description, titles, urls);
                                                                            console.log("just added the error");
                                                                        } catch (err) {
                                                                            console.error("Error while adding error to errorsProvider:", err);
                                                                        }
                                                                })
                                                            } else if (type === 'typestate' && jsonData[0].errors && jsonData[0].errors.length>0){
                                                                let advice = jsonData[0].advice;
                                                                jsonData[0].errors.forEach((error)=>{
                                                                    let path = folderPath + '/' + error.pos ;
                                                                    urls.push(path)
                                                                    titles.push(error.message)
                                                                    const match = path.match(/^(.*):(\d+):(\d+)$/);
                                                                    if (match) {
                                                                      const [_, filePath, lineStr, colStr] = match;
                                                                      const line = parseInt(lineStr, 10) - 1; // Convert to 0-based index
                                                                      const col = parseInt(colStr, 10) - 1;  // Convert to 0-based index
                                                                      const range = new vscode.Range(new vscode.Position(line, col), new vscode.Position(line , col ));
                                                                      const diagnostic = new vscode.Diagnostic(range, `${type} analysis flagged this: ${advice}`, vscode.DiagnosticSeverity.Warning); 
                                                                      diagnostics.push(diagnostic) 
                                                                    }
                                                                    const activeEditor = vscode.window.activeTextEditor;
                                                                    if (activeEditor) {
                                                                    diagnosticCollection.set(activeEditor.document.uri, diagnostics)
                                                                }
                                                                });
                                                                try {
                                                                    console.log("Calling addError with:", jsonData[0].name, jsonData[0].description,titles, urls);
                                                                    errorsProvider.addError(jsonData[0].name, jsonData[0].description, titles, urls);
                                                                    console.log("just added the error");
                                                                } catch (err) {
                                                                    console.error("Error while adding error to errorsProvider:", err);
                                                                }
                                                            }
                                                            
                                                        } catch (parseErr) {
                                                            outputChannel.appendLine(`Error parsing ${type}-results.json: ${parseErr.message}`);
                                                        }
                                                    }
                                                });
                                                  
                                                        
    
                                                } catch (parseErr) {
                                                    console.error('Error parsing JSON:', parseErr.message);
                                                }
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
	context.subscriptions.push(resetToDefaultSettings,openSettingsCommand, helpMenu ,clearErrors,setAnalysisSpec,showOutputChannel,runAnalysis,disposable,diagnosticCollection,{ dispose: deactivateCurrentModule });
}

function deactivate() {
    if (currentModule && currentModule.deactivate) {
        currentModule.deactivate();
    }
}

module.exports = { activate, deactivate};
