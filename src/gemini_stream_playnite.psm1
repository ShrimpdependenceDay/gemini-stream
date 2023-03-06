

function OnApplicationStarted()
{
    $__logger.Info("OnApplicationStarted")
}

function OnApplicationStopped()
{
    $__logger.Info("OnApplicationStopped")
}

function OnLibraryUpdated()
{
    $__logger.Info("OnLibraryUpdated")
}

function OnGameStarting()
{
    param($evnArgs)
    $__logger.Info("OnGameStarting $($evnArgs.Game)")
}

function OnGameStarted()
{
    param($evnArgs)
    $__logger.Info("OnGameStarted $($evnArgs.Game)")
}

function OnGameStopped()
{
    param($evnArgs)
    $__logger.Info("OnGameStopped $($evnArgs.Game) $($evnArgs.ElapsedSeconds)")
}

function OnGameInstalled()
{
    param($evnArgs)
    $__logger.Info("OnGameInstalled $($evnArgs.Game)")
}

function OnGameUninstalled()
{
    param($evnArgs)
    $__logger.Info("OnGameUninstalled $($evnArgs.Game)")
}

function OnGameSelected()
{
    param($gameSelectionEventArgs)
    $__logger.Info("OnGameSelected $($gameSelectionEventArgs.OldValue) -> $($gameSelectionEventArgs.NewValue)")
}

function AddGameToSunshineApps([Playnite.SDK.Models.Game]$game)
{
    $sunshine_apps = Get-Content -Raw "C:\Program Files\Sunshine\config\apps.json" | ConvertFrom-Json

    if( $sunshine_apps.apps.length -eq 0 -or -not $sunshine_apps.apps.name.contains($game.name) ){
        Write-Host $game.name "not in list of sunshine apps"
        $__logger.Info($game.name+" not in list of sunshine apps")
        $command = $PlayniteApi.Paths.ApplicationPath+"\Playnite.DesktopApp.exe --start "+$game.id
        $my_sunshine_app = New-Object -TypeName SunshineApp -ArgumentList $game.name, $command
        $my_sunshine_app | Add-Member -NotePropertyName 'image-path' -NotePropertyValue ""

        [System.Collections.ArrayList]$sunshine_app_list = $sunshine_apps.apps
        $sunshine_app_list.Add($my_sunshine_app)
        $sunshine_apps.apps = $sunshine_app_list
        $sunshine_apps | ConvertTo-Json -depth 32| set-content "C:\Program Files\Sunshine\config\apps.json"
    }
    else{
        $__logger.Info($game.name+" found in list of sunshine apps")
        Write-Host $game.name "found in list of sunshine apps"
    }
    return $game.name
}

function DisplayGameCount69()
{
    param(
        $scriptMainMenuItemActionArgs
    )

    class SunshineApp {

        [String]$name
        [String]$output = ""
        [String]$cmd = ""
        [System.Collections.ArrayList]$detached = @()

        SunshineApp () {}
        SunshineApp ([String]$Name, [String]$detached_command)
        {
            $this.name = $Name
            $this.detached.Add($detached_command)
        }
    }

    class GeminiSyncRequest {
        [String]$id = "GEMINI_SYNC_REQUEST"
        [System.Collections.ArrayList]$games = @()

        GeminiSyncRequest () {}
    }

    $filter = new-object Playnite.SDK.Models.FilterPresetSettings ; $filter.IsInstalled = "True" ; $filter.Source = "Xbox" ; $filtered_games = $PlayniteApi.Database.GetFilteredGames($filter)

    $sync_req = New-Object GeminiSyncRequest
    foreach( $game in $filtered_games)
    {
        $game_to_sync = AddGameToSunshineApps($game)
        $sync_req.games.Add($game_to_sync)
    }

    if( $sync_req.games.length -gt 0 )
    {
        $games_joined = $sync_req.games -join "`r`n" | Out-String
        $__logger.Info("Syncing the following games:`r`n"+$games_joined)


        $FTPServer = "192.168.68.152"
        $FTPPort = "5056"

        $connected = $false

        while (-not $connected) {
            try{
                $tcpConnection = New-Object System.Net.Sockets.TcpClient($FTPServer, $FTPPort)
                $tcpStream = $tcpConnection.GetStream()
                $reader = New-Object System.IO.StreamReader($tcpStream)
                $writer = New-Object System.IO.StreamWriter($tcpStream)
                $writer.AutoFlush = $true
                $connected = $true
            }
            catch [System.Management.Automation.MethodInvocationException]{
                "Not connected"
            }
        }

        # $buffer = new-object System.Byte[] 1024
        # $encoding = new-object System.Text.AsciiEncoding

        while ($tcpConnection.Connected)
        {
            # while ($tcpStream.DataAvailable)
            # {
            #     $rawresponse = $reader.Read($buffer, 0, 1024)
            #     $response = $encoding.GetString($buffer, 0, $rawresponse)
            # }

            if ($tcpConnection.Connected)
            {
                # Write-Host -NoNewline "prompt> "
                # $command = Read-Host

                # if ($command -eq "escape")
                # {
                #     break
                # }

                $sync_json = $sync_req | ConvertTo-Json -depth 32
                $writer.WriteLine($sync_json) | Out-Null
                break
            }
            start-sleep -Milliseconds 500
        }

        $reader.Close()
        $writer.Close()
        $tcpConnection.Close()
    }

    # $filtered_games_joined = $filtered_games.Name -join "`r`n" | Out-String

    # $PlayniteApi.Dialogs.ShowMessage($filtered_games_joined)
}

function GetMainMenuItems()
{
    param(
        $getMainMenuItemsArgs
    )

    $menuItem = New-Object Playnite.SDK.Plugins.ScriptMainMenuItem
    $menuItem.Description = "Show Game Count 69"
    $menuItem.FunctionName = "DisplayGameCount69"
    $menuItem.MenuSection = "@"
    return $menuItem
}