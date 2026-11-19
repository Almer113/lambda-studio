' Start the Lambda Studio server with no console window: double-click it, or point a Startup
' folder shortcut at it to start the server at logon. It runs scripts/server-control.mjs start, which does nothing
' if the server is already running and logs to data\server.log in the app folder.
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
appDir = fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName))
sh.CurrentDirectory = appDir
sh.Run "node scripts\server-control.mjs start", 0, False
