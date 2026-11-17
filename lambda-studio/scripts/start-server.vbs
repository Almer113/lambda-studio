' Start the Lambda Studio server (scripts/serve.mjs) with no console window.
' A shortcut to this file in the Windows Startup folder starts it at logon.
' The log goes to %LOCALAPPDATA%\LambdaStudio\server.log.
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
appDir = fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName))
logDir = sh.ExpandEnvironmentStrings("%LOCALAPPDATA%") & "\LambdaStudio"
If Not fso.FolderExists(logDir) Then fso.CreateFolder(logDir)
sh.CurrentDirectory = appDir
sh.Run "cmd /c node scripts\serve.mjs >> """ & logDir & "\server.log"" 2>&1", 0, False
