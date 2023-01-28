# Gemini Stream
[Discord](https://discord.gg/9fJM8JFRud)

Gemini Stream is a game streaming companion utility which simplifies the process of streaming Xbox Game Pass for PC games from a host desktop to a client.
Currently, Gemini Stream is intended for use with the [Valve Steam Deck](https://store.steampowered.com/steamdeck), but more generic clients may be supported in the future.

## Tech

Gemini Stream uses a number of open source projects to work properly:
- [node.js]
- [jQuery]
- [electron](https://www.electronjs.org/)
- [electron-forge](https://www.electronforge.io/)
- [electron-builder](https://www.electron.build/)
- others

## Dependencies
Gemini Stream requires the support of the following software for the full streaming experience:
- [Moonlight] - Streaming client (tested with version 4.3.1)
- [Sunshine] - Streaming host (tested with v0.18.1)
- [Steam ROM Manager] - Fetch game artwork and add games to Steam

## Installation

1. Install and configure Moonlight
    - [Host PC setup](https://github.com/moonlight-stream/moonlight-docs/wiki/Setup-Guide#quick-setup-instructions)
    - Moonlight for Steam Deck client can be found in the Discover Software Center (view on [Flathub](https://flathub.org/apps/details/com.moonlight_stream.Moonlight))
2. Install and configure [Sunshine](https://github.com/LizardByte/Sunshine#readme) on the host PC
3. Download [Steam ROM Manager] AppImage on Steam Deck
4. Download and run Windows installer from latest Gemini Stream release
5. Download Gemini Stream AppImage from latest Gemini Stream release on Steam Deck
    - The AppImage needs to be [made executable](https://discourse.appimage.org/t/how-to-run-an-appimage/80) after download.

## Configuration
Both the server and client applications have some settings that need to be configured before the application will work correctly.

#### Server
| Setting | Description |
| ------ | ------ |
| Client IP Address | IP Address of client device |
| Port | Port to use for in-network communication with client device |
| Stream host | Host with which Moonlight will communicate to stream games. Options are Sunshine (default) and NVIDIA GameStream. Note: [GameStream service is ending](https://nvidia.custhelp.com/app/answers/detail/a_id/5436/~/gamestream-end-of-service-notification).  |
| Sunshine Apps path | Sunshine host only. Path to Sunshine's JSON list of applications. |
| Shield Apps path | GameStream host only. Folder which Nvidia's Shield streaming software watches for game shortcuts |
| Known applications | A list of UWP application names and Display Names.<br/>Sometimes, application Display Names cannot be correctly retrieved, so they are defined under this setting.<br/>For example, SystemEraSoftworks.29415440E1269 is the "Name" of ASTRONEER. |

#### Client
| Setting | Description |
| ------ | ------ |
| Port | Port to use for in-network communication with host device |
| Moonlight host name | Name of the streaming host, as it appears in Moonlight.<br/> **NOTE:** This can sometimes be a truncated version of the actual host's name, so be sure and check that what is configured matches up with what is shown in Moonlight. |
| Moonlight options | List of options to be appended to the command to start streaming via Moonlight.<br/>For full set of options, run **Moonlight.exe stream -h** from the Moonlight installation directory |

## Usage
1. Open Gemini Stream on both host and client
2. Configure settings for host and client. Default settings will work for many options, but IP address at a minimum will need to be initialized.
    - If configured correctly and devices can communicate over the local network, the client device should show "Connected" under the host device information
3. On host, select "Fetch installed apps" (or "Load installed apps" if you just want to load the previously fetched list of applications)
4. Once the list of installed applications is visibile, select the desired applications you want to make streamable, and select "Export selected apps"
    - After the export is complete, you may need to restart Sunshine on the host machine and Moonlight on the client machine in order for Moonlight to detect the newly exported games.
5. If the host and client devices are connected, a blue "Sync" button should appear when streamable applications are available. Select it to send data on the streamable applications over to the client
6. On the client, close Steam if it is running, and open Steam ROM Manager. Verify that there is a Gemini Stream configuration.
7. Within Steam ROM Manager, select the Preview tab, then Generate app list.
8. Provided the applications previously synchronized show up in the app list preview, select "Save app list" to add your streamable games to Steam and complete the process


## Development notes
To get started, clone repository, then run
```sh
npm install
```

To start application, run
```sh
npm start
```

To package the application, use command
```sh
npm run dist
```
> Note: This will need to be done both on Windows to create the installer and Linux to create the client AppImage



## License

MIT

   [node.js]: <http://nodejs.org>
   [jQuery]: <http://jquery.com>
   [Moonlight]: <https://moonlight-stream.org/>
   [Steam ROM Manager]: <https://github.com/SteamGridDB/steam-rom-manager/releases>
   [Sunshine]: <https://github.com/LizardByte/Sunshine>
