Option Explicit

Dim fileSystem, shell, scriptDirectory, projectDirectory
Dim nodePath, servicePath, commandLine

If WScript.Arguments.Count < 1 Then WScript.Quit 2

Set fileSystem = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")

scriptDirectory = fileSystem.GetParentFolderName(WScript.ScriptFullName)
projectDirectory = fileSystem.GetParentFolderName(scriptDirectory)
nodePath = WScript.Arguments(0)
servicePath = fileSystem.BuildPath(projectDirectory, "src\local-service.js")

shell.CurrentDirectory = projectDirectory
commandLine = Chr(34) & nodePath & Chr(34) & " " & Chr(34) & servicePath & Chr(34)

' Window style 0 keeps the Node service completely hidden. Waiting keeps the
' Scheduled Task state tied to the lifetime of the local service.
WScript.Quit shell.Run(commandLine, 0, True)
