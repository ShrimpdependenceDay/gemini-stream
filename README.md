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
- [Steam ROM Manager] - Fetch game artwork and add games to Steam (tested with version 2.3.40)

## Installation

1. Install and configure Moonlight
    - [Host PC setup](https://github.com/moonlight-stream/moonlight-docs/wiki/Setup-Guide#quick-setup-instructions)
    - Moonlight for Steam Deck client can be found in the Discover Software Center (view on [Flathub](https://flathub.org/apps/details/com.moonlight_stream.Moonlight))
2. Install and configure [Sunshine](https://github.com/LizardByte/Sunshine#readme) on the host PC
3. Download [Steam ROM Manager] AppImage on Steam Deck
4. Download and run Windows installer from latest Gemini Stream [release]
5. Download Gemini Stream AppImage from latest Gemini Stream release on Steam Deck
    - The AppImage needs to be [made executable](https://discourse.appimage.org/t/how-to-run-an-appimage/80) after download.
6. *Optional* - As of version 0.3.2, a [Playnite](https://playnite.link/) extension is included with the latest Gemini Stream [release].
   - To install the extension, extract the GeminiStreamPlaynite archive to your Playnite extensions path (default will be C:\Users\\\<user>\AppData\Local\Playnite\Extensions\GeminiStreamPlaynite), then Reload Scripts in Playnite (F12).


## Configuration
Both the server and client applications have some settings that need to be configured before the application will work correctly.

#### **Server**
| Setting | Description |
| ------ | ------ |
| Client IP Address | IP Address of client device |
| Port | Port to use for in-network communication with client device |
| Stream host | Host with which Moonlight will communicate to stream games. Options are Sunshine (default) and NVIDIA GameStream. Note: [GameStream service is ending](https://nvidia.custhelp.com/app/answers/detail/a_id/5436/~/gamestream-end-of-service-notification).  |
| Shield Apps path | GameStream host only. Folder which Nvidia's Shield streaming software watches for game shortcuts |
| Sunshine Apps path | Sunshine host only. Path to Sunshine's JSON list of applications. |
| Resolution Switching | Sunshine host only. When enabled, the host machine's primary display will automatically switch to the Start resolution at stream start and End resolution at stream end.|
| Known applications | A list of UWP application names and Display Names.<br/>Sometimes, application Display Names cannot be correctly retrieved, so they are defined under this setting.<br/>For example, SystemEraSoftworks.29415440E1269 is the "Name" of ASTRONEER. |

#### **Client**
| Setting | Description |
| ------ | ------ |
| Port | Port to use for in-network communication with host device |
| Moonlight host name | Name of the streaming host, as it appears in Moonlight.<br/> **NOTE:** This can sometimes be a truncated version of the actual host's name, so be sure and check that what is configured matches up with what is shown in Moonlight. |
| Moonlight options | List of options to be appended to the command to start streaming via Moonlight.<br/>For full set of options, run **Moonlight.exe stream -h** from the Moonlight installation directory |
| Steam ROM Manager configurations | Path to Steam ROM Manager userConfigurations.json file which contains parser configuration info |

## Usage
### **Standard**
1. Open Gemini Stream on both host and client
2. Configure settings for host and client. Default settings will work for many options, but IP address and host name at a minimum will need to be initialized.
    - If configured correctly and devices can communicate over the local network, the client device should show "Connected" under the host device information
3. On host, select "Fetch installed apps" (or "Load installed apps" if you just want to load the previously fetched list of applications)
4. Once the list of installed applications is visibile, select the desired applications you want to make streamable, and select "Export selected apps"
    > Note for Sunshine: After the export is complete, you may need to restart Sunshine on the host machine and Moonlight on the client machine in order for Moonlight to detect the newly exported games. You can restart Sunshine from the Troubleshooting tab at https://localhost:47990/.
5. If the host and client devices are connected, a blue "Sync" button should appear when streamable applications are available. Select it to send data on the streamable applications over to the client
6. On the client, close Steam if it is running, and open Steam ROM Manager. Verify that there is a Gemini Stream parser configuration.
7. Within Steam ROM Manager, select the Preview tab, then Generate app list.
8. Provided the applications previously synchronized show up in the app list preview, select "Save app list" to add your streamable games to Steam and complete the process
9. You can now return to Game Mode, and your newly added games should show up under the Streaming category
    - This category can be modified by updating the Steam ROM Manager "Steam category" for the Gemini Stream parser

### **Playnite Extension**
The Gemini Stream [Playnite] extension is **completely optional**, and was primarily created to introduce streaming via Sunshine into the wide array of features and integrations that Playnite has to offer. One of the major benefits to utilizing the extension is the ability to make games installed from other libraries (e.g. Steam, Uplay, Epic) streamable alongside Game Pass games. If Playnite can launch it, you should be able to stream it. Some have argued that Gemini Stream is unnecessary because you can just stream Playnite from the client device with Moonlight, but personally, I prefer using the native UI and separate controller profiles that Steam has to offer.

To take advantage of the Playnite extension:
1. Download the GeminiStreamPlaynite archive from the latest [release] assets
2. Extract the archive to your Playnite extensions directory
3. To configure the extension, open the gemini_stream_playnite.psm1 script you just extracted in a code editor and make any changes necessary to the parameters at the top of the file.
    - The extension will mainly pull config data from Gemini Stream settings, so you shouldn't have to worry about changing much here, if anything
    - The main thing you may want to configure is the libraries whose games the extension will add to Sunshine for streaming. The default behavior is Game Pass games only.
4. Reload scripts in Playnite (F12)
5. Open Gemini Stream on the client and **close** it on the host
6. Run the extension (Menu > Extensions > Gemini Stream)
7. The script will run, filtering any installed games from the configured libraries, and add them to the list of Sunshine streamable applications with a command to launch Playnite with each game's ID
     - After the export is complete, restart Sunshine from the Troubleshooting tab at https://localhost:47990/.
9. Once this is complete, the script will attempt to send the updated list of streamable games to the Gemini Stream instance running on the client
   - If this fails, check that the configured IP address & port are correct
   - If you still can't connect, you can just copy the application list from Sunshine (default "C:\Program Files\Sunshine\config\apps.json") manually to the client, then load it from Gemini Stream using **File > Import application list**
10. The remaining process is the same as the Standard process from step 6 and onward from the previous section
11. Resolution Switching can also be applied to games streaming using Playnite by enabling the setting in Gemini Stream after the Playnite extension has been run. Toggling off then on may be required.

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
   [Playnite]: <https://playnite.link/>
   [release]: <https://github.com/ShrimpdependenceDay/gemini-stream/releases>
