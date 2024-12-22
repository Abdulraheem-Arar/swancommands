const vscode = require('vscode');
const cp = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

let isDeactivated = false; 
let disposables = [];

function activate(context) {

    if (isDeactivated) {
        console.log("Activation stopped because deactivate was called.");
        return; // Stop execution if deactivated
    }

    function detectSwiftDocument(document) {
        if (document && document.languageId === 'swift') {
            //vscode.window.showInformationMessage('Swift file detected: ' + document.fileName);
            vscode.commands.executeCommand('swancommands.cryptoAnalysis')
        }
    }

    // Detect when a Swift file is opened or active editor changes
    const activeEditorListener = vscode.window.onDidChangeActiveTextEditor((editor,document) => {
        if (editor) {
            detectSwiftDocument(document)
        }
    });
    disposables.push(activeEditorListener);

    const saveDocumentListener = vscode.workspace.onDidSaveTextDocument(document => {
            detectSwiftDocument(document)
    });
  disposables.push(saveDocumentListener);

    // Detect already open Swift files when the extension is activated
    vscode.workspace.textDocuments.forEach(detectSwiftDocument);

    disposables.forEach(disposable => context.subscriptions.push(disposable));

}

function deactivate() {
    disposables.forEach(disposable => disposable.dispose());
    disposables = []; // Clear the disposables array
}

module.exports = { activate, deactivate };
