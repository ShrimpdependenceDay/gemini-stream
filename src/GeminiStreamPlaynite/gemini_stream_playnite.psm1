# Add comma separated platform sources here to
# include games other than Game Pass games (e.g. "Xbox", "Steam", "Epic")
$global:sources = "Xbox"

# Path to Gemini Stream config. This is where this script
# will pull settings from if the path is valid.
# Otherwise, the global values below will be used.
$global:gs_config_path = Join-Path -Path $env:APPDATA -ChildPath "Gemini Stream/config.json"

# These values will be used if a Gemini Stream
# config could not be found at the default location.
# Update them if you don't want to use the Gemini Stream config,
# otherwise, don't worry about them.
$global:apps_location = "C:/Program Files/Sunshine/config/apps.json"
$global:client_ip = "192.168.0.0"
$global:port = "5056"


############################################################################
# You might not want to touch anything after this, but you do what you
# want. I'm not a cop.
############################################################################

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

    [System.Collections.ArrayList]$sunshine_app_list = $sunshine_apps.apps
    $add_game = $true
    $command = $PlayniteApi.Paths.ApplicationPath+"\Playnite.DesktopApp.exe --start "+$game.id

    foreach( $sunshine_app in $sunshine_app_list )
    {
        # If we found the game, update the detached command
        if( $sunshine_app.name -eq $game.name )
        {
            $__logger.Info('Updating detached command for '+$game.name)
            [System.Collections.ArrayList]$detached = @()
            $detached.Add($command)
            $sunshine_app.detached = $detached
            $add_game = $false
        }
    }

    if( $add_game )
    {
        # Application was not found, so add it
        $__logger.Info('Adding '+$game.name+" to list of sunshine apps")
        $my_sunshine_app = New-Object -TypeName SunshineApp -ArgumentList $game.name, $command
        [System.Collections.ArrayList]$sunshine_app_list = $sunshine_apps.apps
        $sunshine_app_list.Add($my_sunshine_app)
        $sunshine_apps.apps = $sunshine_app_list
    }

    # Write the updated Sunshine apps .json
    $sunshine_apps_str = $sunshine_apps | ConvertTo-Json -depth 32
    $sunshine_apps_str = $sunshine_apps_str.replace('image_path', 'image-path')
    $sunshine_apps_str | set-content $apps_path
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
        [String]$image_path = ""
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
    if(Test-Path -Path $global:gs_config_path -PathType Leaf)
    {
        $__logger.Info("Located config at: "+$global:gs_config_path)
        $gs_config = Get-Content -Raw $global:gs_config_path | ConvertFrom-Json
    }
    else {
        # Some default config
        $gs_config = New-Object PSObject
        $gs_config | Add-Member Noteproperty -Name sunshine_apps -value $global:apps_location
        $gs_config | Add-Member Noteproperty -Name client_ip -value $global:client_ip
        $gs_config | Add-Member Noteproperty -Name server_port -value $global:port
    }

    foreach( $source in $global:sources )
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
        $games_joined = $sync_req.games -join "`r`n`t" | Out-String

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
            $dialog_result = $PlayniteApi.Dialogs.ShowMessage(
                "The following applications are ready to be imported:`r`n`t"+$games_joined+"`r`n`r`nApplication List:`r`n"+$gs_config.sunshine_apps+"`r`n`r`nOpen directory now?",
                "Export Complete",
                "YesNo"
            )
            if( $dialog_result -eq "Yes" )
            {
                $app_list_dir = Split-Path -parent $gs_config.sunshine_apps
                $__logger.Info("App list located at "+$app_list_dir)
                Invoke-Item $app_list_dir
            }
        }

        # If we connected successfully, send the sync request
        # to the client, then close the connection.
        if ($connected -and $tcpConnection.Connected)
        {
            $__logger.Info("Syncing the following games:`r`n`t"+$games_joined)
            $sync_json = $sync_req | ConvertTo-Json -depth 32
            $writer.WriteLine($sync_json) | Out-Null
            $reader.Close()
            $writer.Close()
            $tcpConnection.Close()

            # We're not even going to check for a response from
            # the client, because we're 100% sure the sync was successful
            # and there's no chance anything could've gone wrong ;)
            $PlayniteApi.Dialogs.ShowMessage("Synchronized the following applications:`r`n`t"+$games_joined)
        }
    }
}

function GetMainMenuItems()
{
    param(
        $getMainMenuItemsArgs
    )

    $menuItem = New-Object Playnite.SDK.Plugins.ScriptMainMenuItem
    $menuItem.Description = "Gemini Stream"
    $menuItem.FunctionName = "GeminiStreamExport"
    $menuItem.MenuSection = "@"
    return $menuItem
}