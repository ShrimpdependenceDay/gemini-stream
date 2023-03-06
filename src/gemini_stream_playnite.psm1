

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

function AddGameToSunshineApps([Playnite.SDK.Models.Game]$game, [String]$apps_path)
{
    # Get the current applications from Sunshine
    $sunshine_apps = Get-Content -Raw $apps_path | ConvertFrom-Json

    # If the number of apps is zero, the json file will have an empty
    # string instead of an array for some reason. If we run into that,
    # update the sunshine_apps reference to a new, empty apps list object
    if( $sunshine_apps.apps.length -eq 0 ){
        $new_sunshine_apps = New-Object -TypeName SunshineAppList -ArgumentList $sunshine_apps.env
        $sunshine_apps = $new_sunshine_apps
    }

    # Check to see if the current game is already in the applications list
    if( -not $sunshine_apps.apps.name -or -not $sunshine_apps.apps.name.contains($game.name) ){
        # Application was not found, so add it
        Write-Host $game.name "not in list of sunshine apps"
        $__logger.Info($game.name+" not in list of sunshine apps")
        $command = $PlayniteApi.Paths.ApplicationPath+"\Playnite.DesktopApp.exe --start "+$game.id
        $my_sunshine_app = New-Object -TypeName SunshineApp -ArgumentList $game.name, $command
        $my_sunshine_app | Add-Member -NotePropertyName 'image-path' -NotePropertyValue "" # (this is done this way because of the '-' in image-path)
        [System.Collections.ArrayList]$sunshine_app_list = $sunshine_apps.apps
        $sunshine_app_list.Add($my_sunshine_app)
        $sunshine_apps.apps = $sunshine_app_list

        # Write the updated Sunshine apps .json
        $sunshine_apps | ConvertTo-Json -depth 32| set-content $apps_path
    }
    else{
        $__logger.Info($game.name+" found in list of sunshine apps")
        Write-Host $game.name "found in list of sunshine apps"
    }
}

function GeminiStreamExport()
{
    param(
        $scriptMainMenuItemActionArgs
    )

    class SunshineAppList {

        $env =  @{}
        [System.Collections.ArrayList]$apps = @()

        SunshineAppList () {}
        SunshineAppList ($Env)
        {
            $this.env = $Env
        }
    }

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

    # Get our Gemini Stream config
    $gs_config_path = Join-Path -Path $env:APPDATA -ChildPath "Gemini Stream/config.json"
    if(Test-Path -Path $gs_config_path -PathType Leaf)
    {
        $__logger.Info("Located config at: "+$gs_config_path)
        $gs_config = Get-Content -Raw $gs_config_path | ConvertFrom-Json
    }
    else {
        # Some default config
        $gs_config = New-Object PSObject
        $gs_config | Add-Member Noteproperty -Name sunshine_apps -value "C:/Program Files/Sunshine/config/apps.json"
        $gs_config | Add-Member Noteproperty -Name client_ip -value "192.168.0.0" # UPDATE THIS IF NECESSARY
        $gs_config | Add-Member Noteproperty -Name server_port -value "5056"
    }

    # All filter sources
    $sources = "Xbox", "Ubisoft Connect"

    foreach( $source in $sources )
    {
        # Create filter and fetch games
        $filter = new-object Playnite.SDK.Models.FilterPresetSettings
        $filter.IsInstalled = "True"
        $filter.Source = $source
        $filtered_games = $PlayniteApi.Database.GetFilteredGames($filter)

        # For each game that the filter returns, call the function
        # to add the game to the Sunshine apps list
        foreach( $game in $filtered_games)
        {
            try {
                AddGameToSunshineApps -game $game -apps_path $gs_config.sunshine_apps
            }
            catch {
                $e = $_.Exception
                $line = $_.InvocationInfo.ScriptLineNumber
                $msg = $e.Message
                $__logger.Info("Caught exception: $e at $line")
                break
            }
        }
    }


    # Read in the final list of applications, and populate the Gemini Stream Sync request
    $sunshine_apps = Get-Content -Raw $gs_config.sunshine_apps | ConvertFrom-Json
    $sync_req = New-Object GeminiSyncRequest
    foreach( $game in $sunshine_apps.apps)
    {
        $sync_req.games.Add($game.name)
    }

    # If there was at least one application in the Sunshine apps list,
    # attempt to synchronize with the client device
    if( $sync_req.games.length -gt 0 )
    {
        $games_joined = $sync_req.games -join "`r`n" | Out-String

        # $gs_config.server_port = "5056"
        $connected = $false

        # Try to connect to the client device. If an exception is
        # thrown here, we failed to connect. This can mean the IP
        # address/port are invalid, or the client device isn't currently
        # running Gemini Stream
        try{
            $tcpConnection = New-Object System.Net.Sockets.TcpClient($gs_config.client_ip, $gs_config.server_port)
            $tcpStream = $tcpConnection.GetStream()
            $reader = New-Object System.IO.StreamReader($tcpStream)
            $writer = New-Object System.IO.StreamWriter($tcpStream)
            $writer.AutoFlush = $true
            $connected = $true
            $__logger.Info("Connected to "+$gs_config.client_ip+":"+$gs_config.server_port)
        }
        catch [System.Management.Automation.MethodInvocationException]{
            $__logger.Info($_)
            $PlayniteApi.Dialogs.ShowErrorMessage("Failed to connect to "+$gs_config.client_ip+":"+$gs_config.server_port)
        }

        # If we connected successfully, send the sync request
        # to the client, then close the connection.
        if ($connected -and $tcpConnection.Connected)
        {
            $__logger.Info("Syncing the following games:`r`n"+$games_joined)
            $sync_json = $sync_req | ConvertTo-Json -depth 32
            $writer.WriteLine($sync_json) | Out-Null
            $reader.Close()
            $writer.Close()
            $tcpConnection.Close()
            $PlayniteApi.Dialogs.ShowMessage("Synchronized the following applications:`r`n"+$games_joined)
        }
    }
}

function GetMainMenuItems()
{
    param(
        $getMainMenuItemsArgs
    )

    # If Gemini Stream config doesn't exist, don't show menu item
    $gs_config_path = Join-Path -Path $env:APPDATA -ChildPath "Gemini Stream/config.json"
    if(-not (Test-Path -Path $gs_config_path -PathType Leaf))
    {
        $__logger.Info("Could not find Gemini Stream config at "+$gs_config_path)
        return
    }

    $menuItem = New-Object Playnite.SDK.Plugins.ScriptMainMenuItem
    $menuItem.Description = "Gemini Stream"
    $menuItem.FunctionName = "GeminiStreamExport"
    $menuItem.MenuSection = "@"
    return $menuItem
}