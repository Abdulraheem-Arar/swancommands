// analyze3Parameters.js
const vscode = require('vscode');
const cp = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');


let characterChangeCount = 0;
const CHANGE_THRESHOLD = 40;

function activate(context) {
    function detectSwiftDocument(document) {
        if (document && document.languageId === 'swift') {
            //vscode.window.showInformationMessage('Swift file detected: ' + document.fileName);
            vscode.commands.executeCommand('swancommands.taintAnalysis')
        }
    }

    // Detect when a Swift file is opened or active editor changes
    vscode.window.onDidChangeActiveTextEditor((editor,document) => {
        if (editor) {
            detectSwiftDocument(document)
        }
    });
    
    vscode.workspace.onDidSaveTextDocument(document => {
            detectSwiftDocument(document)
    });
    
    vscode.workspace.onDidChangeTextDocument(event => {
        const changes = event.contentChanges;
        //console.log(changes)
        changes.forEach(change => {
            characterChangeCount += change.text.length;
        });

        if (characterChangeCount >= CHANGE_THRESHOLD) {
            characterChangeCount = 0; // Reset counter after reaching the threshold
            vscode.commands.executeCommand('swancommands.taintAnalysis')// Run your analysis
        }
    });

    // Detect already open Swift files when the extension is activated
    vscode.workspace.textDocuments.forEach(detectSwiftDocument);

   
}

function deactivate() {
   
}

module.exports = { activate, deactivate };
