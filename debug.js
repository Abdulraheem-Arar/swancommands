// analyze3Parameters.js
const vscode = require('vscode');
const cp = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');




function activate(context) {
    function detectSwiftDocument(document) {
        if (document && document.languageId === 'swift') {
            //vscode.window.showInformationMessage('Swift file detected: ' + document.fileName);
            vscode.commands.executeCommand('swancommands.debug')
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

    // Detect already open Swift files when the extension is activated
    vscode.workspace.textDocuments.forEach(detectSwiftDocument);

    
}

function deactivate() {
   
}

module.exports = { activate, deactivate };
