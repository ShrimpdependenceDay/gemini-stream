// Includes
const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const Store = require('electron-store');
const { spawn, spawnSync } = require('child_process');
const fs = require("fs");
const os = require('os');
var net = require('net');
const assert = require('assert');
const ip = require('ip');
const { data } = require('jquery');
const { shell } = require('electron');

log(ip.address()); // my ip address
log(os.hostname());

// Shared variables
var this_is_server;
var connected = false;
var store = new Store();
var update_connection_prdc;
var usr_data_path = app.getPath('userData');
var save_settings_timeout = null;
var already_crashing;
var dev_env = !__dirname.includes("app.asar");
const DEV_MENU_STRING = "Dev";

// Stream client variables
var server;
var stream_client_ready = false;
var socket_clients = [];
const OPEN_MANIFESTS_STRING = "Open manifests directory";

// Stream server variables
var socket;
var cpu_count = os.cpus().length;
var app_data = process.env.LOCALAPPDATA || (process.platform == 'darwin' ? process.env.HOME + '/Library/Preferences' : process.env.HOME + "/.local/share");
app_data = app_data.replaceAll('\\', '/')
var app_list_path = path.resolve(usr_data_path, 'app_list.json');
var games_dir = path.resolve(usr_data_path, 'games');
var manifests_dir_path = path.resolve(usr_data_path, 'srm_manifests');
var srm_manifest_path = path.resolve(manifests_dir_path, 'gemini_stream_manifest.json');
var box_art_filname = 'box-art.png';
var box_art_path = path.resolve(__dirname, "icons", box_art_filname);
var log_open = false;
var app_list = [];
var current_apps = 0;
const GAMESTREAM_HOST = "NVIDIA GameStream";
const SUNSHINE_HOST = "Sunshine";
var valid_hosts = [ GAMESTREAM_HOST, SUNSHINE_HOST ];

// Default settings
var default_settings = {
  shield_apps_dir: path.join(app_data, 'NVIDIA Corporation', 'Shield Apps').replaceAll('\\', '/'),
  sunshine_apps: "C:/Program Files/Sunshine/config/apps.json",
  known_apps: {
    'Microsoft.SeaofThieves': 'Sea of Thieves',
    'Microsoft.DeltaPC': 'Gears of War: Ultimate Edition',
    'Microsoft.MinecraftUWP': 'Minecraft',
    'SystemEraSoftworks.29415440E1269': 'ASTRONEER',
    'FACEBOOK.317180B0BB486': 'Facebook Messenger'
  },
  host_name: '',
  moonlight_options: '--quit-after',
  client_ip: "192.168.x.x",
  server_port: 5056,
  client_port: 5056,
  srm_location: "/home/deck/.local/share/applications/SRM.desktop",
  stream_host: SUNSHINE_HOST,
  srm_configs: path.resolve(os.homedir(), '.config/steam-rom-manager/userData/userConfigurations.json')
}

// Current settings
var current_settings = {
  shield_apps_dir: null,
  sunshine_apps: "",
  known_apps: {},
  host_name: '',
  moonlight_options: '',
  client_ip: '',
  server_port: 0,
  client_port: 0,
  srm_location: "",
  stream_host: "",
  srm_configs: ''
}

// Settings validities
var setting_validities = {};

// Error handling
process.on('uncaughtException', function (error) {
  if(already_crashing){
    log("ALREADY CRASHING");
    return;
  }

  // TODO - Record connection errors in connection data somehow,
  // so when updated data is sent to the renderer, we can hide the
  // loading screen. As it is, the loading screen stays forever
  // if there is a connection error during sync

  if (error.code == 'ECONNREFUSED' ||
      error.code == 'EACCES' ||
      error.code == 'EINVAL' ||
      error.code == 'ECONNRESET' ||
      error.code == 'ECONNABORTED' ||
      error.code == 'ENETUNREACH' ||
      error.code == 'ELIFECYCLE' ||
      error.code == 'ENOTFOUND' ) {
    log('Client not available - ' + error.code);
    connected = false;
  }
  else if ( error.code == 'ERR_SOCKET_BAD_PORT'){
    setting_validities.server_port = false;
  }
  else {
    already_crashing = true;
    log("ERROR: " + error);
    log(error.stack);

    const messageBoxOptions = {
      type: "error",
      title: error.code,
      message: error.message
    };
    dialog.showMessageBoxSync(messageBoxOptions);

    // I believe it used to be the case that doing a "throw err;" here would
    // terminate the process, but now it appears that you have to use's Electron's
    // app module to exit (process.exit(1) seems to not terminate the process)
    app.exit(1);
  }
});

// Toolbar configuration
const toolbar_template = [
  {
    label: 'File',
    submenu: [
      {
        label: 'Settings',
        click: () => {
          mainWindow.webContents.send("open_settings_page");
        }
      },
      {
        label: 'Show Log',
        click: () => {
          create_debug_log();
        }
      },
      {
        label: OPEN_MANIFESTS_STRING,
        click: () => {
          spawn("dolphin", args=[manifests_dir_path]);
        }
      },
      { role: 'quit' }
    ]
  },
  {
    label: 'Help',
    submenu: [
      {
        label: 'About',
        click: () => {
          show_about();
        }
      },
      {
        label: 'Documentation',
        click: () => {
          shell.openExternal("https://github.com/ShrimpdependenceDay/gemini-stream#readme");
        }
      }
    ]
  }
]
const menu = Menu.buildFromTemplate(toolbar_template);
var manifests_item = menu.items[0].submenu.items.find(item => item.label === OPEN_MANIFESTS_STRING)
manifests_item.visible = false;
Menu.setApplicationMenu(menu);

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;
let debugWindow;

const createWindow = () => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    // width: 1250,
    // height: 750,
    minWidth: 1000,
    width: 1000,
    minHeight: 500,
    height: 500,
    // frame: false,
    x: 0,
    y: 50,
    webPreferences: {
      nodeIntegration: false, // is default value after Electron v5
      contextIsolation: true, // protect against prototype pollution
      enableRemoteModule: false, // turn off remote
      preload: path.join(__dirname, "preload.js")
    },
    icon: path.join(__dirname, "build", os.platform() === 'win32' ? 'icon.ico' : 'background.png'),
  });

  // and load the index.html of the app.
  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // Open the DevTools.
  if(dev_env){
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('close', function() {
    if (process.platform !== 'darwin') {
      app.quit();
    }
    app.exit();
  });

};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

app.on('before-quit', function() {
  if (!this_is_server){
    close_socket_server();
  }
  clearInterval(update_connection_prdc);
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (!this_is_server){
    close_socket_server();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// This function will output the lines from the script
// and will return the full combined output
// as well as exit code when it's done (using the callback).
function run_script(command, args, callback) {
  var child = spawn(command, args, {
      encoding: 'utf8',
      shell: true
  });
  // You can also use a variable to save the output for when the script closes later
  child.on('error', (error) => {
      dialog.showMessageBox({
          title: 'Title',
          type: 'warning',
          message: 'Error occured.\r\n' + error
      });
  });

  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (data) => {
      //Here is the output
      data=data.toString();
      console.log(data);
  });

  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (data) => {
      // Return some data to the renderer process with the mainprocess-response ID
      mainWindow.webContents.send('mainprocess-response', data);
      //Here is the output from the command
      console.log(data);
  });

  child.on('close', (code) => {
      //Here you can get the exit code of the script
      switch (code) {
          case 0:
              dialog.showMessageBox({
                  title: 'Title',
                  type: 'info',
                  message: 'End process.\r\n'
              });
              break;
      }

  });
  if (typeof callback === 'function')
      callback();
}

function add_manifests_menu_item(){
  if (!fs.existsSync(manifests_dir_path)){
    return;
  }
  var manifests_item = menu.items[0].submenu.items.find(item => item.label === OPEN_MANIFESTS_STRING)
  manifests_item.visible = true;
}

function create_debug_log(){
  if (log_open) {
    return;
  }

  // Create the browser window.
  debugWindow = new BrowserWindow({
    width: 750,
    height: 300,
    // frame: false,
    webPreferences: {
      nodeIntegration: false, // is default value after Electron v5
      contextIsolation: true, // protect against prototype pollution
      enableRemoteModule: false, // turn off remote
      preload: path.join(__dirname, "debug_preload.js")
    }
  });

  // and load the index.html of the app.
  debugWindow.loadFile(path.join(__dirname, 'debug_index.html'));

  debugWindow.setMenuBarVisibility(false)

  // Open the DevTools.
  if(dev_env){
    debugWindow.webContents.openDevTools();
  }

  log_open = true;

  debugWindow.on('close', function() { //   <---- Catch close event
    log_open = false;
  });

}

function log(message) {
  try {
    console.log(message);
    if (!log_open || !debugWindow){
      return;
    }
    var d = new Date();

    var dt_string = '[' + d.toLocaleString() + '] '
    debugWindow.webContents.send("message", dt_string + message);
  } catch (error) {

  }
}


// Get Display Name and list of IDs for the
// given application object
function get_display_name_and_id(app_object){
  return new Promise(function (resolve, reject) {
    // Command to get display name and IDs
    var combined_command = "$manifest = Get-AppxPackage '" + app_object.Name + "' |Get-AppxPackageManifest ; $displayName = $manifest.Package.Properties.DisplayName; $displayName ; $ids = $manifest.Package.Applications.Application.Id ; $ids ;"

    var all_data = "";
    var child_proc = spawn("powershell.exe", args=[combined_command]);

    // Join all data from powershell command
    child_proc.stdout.on("data",function(data){
      all_data = all_data + data.toString();
    });

    // Once the display name + ID process completes...
    child_proc.on("exit", function(code) {
      all_data = all_data.trim().split('\r\n');

      // Display name comes back in the first line,
      // IDs make up the rest
      var display_name = all_data[0]
      var apx_ids = all_data.slice(1);

      // If this is one of the configured known apps,
      // replace the display name with the pre-set string
      if (app_object.Name in current_settings.known_apps){
        display_name = current_settings.known_apps[app_object.Name];
      }

      // If the display name contains "ms-resouce", that almost
      // definitely means we didn't get a valid name back, so
      // set it to "~Unknown" (use the tilde for sorting)
      if (display_name.includes("ms-resource")){
        display_name = "~Unknown";
      }

      // Each ID we got back represents a command, so add an app
      // to the list of apps for each ID. The command is made up
      // of the PackageFamilyName and an ID separated by a !
      for (const id of apx_ids){
        var this_app = {
          Name: app_object.Name,
          InstallLocation: app_object.InstallLocation,
          PackageFamilyName: app_object.PackageFamilyName,
          ID: id,
          DisplayName: display_name,
          command: app_object.PackageFamilyName + "!" + id
        }
        app_list.push(this_app);
      }
      // Resolve this promise
      resolve(code);
    });

    // Reject promise on error
    child_proc.on("error", function (err) {
      reject(err);
    });

  });
}


// Fetch installed applications
function fetch_installed_apps(){
  // These are the keys we care about from the
  // Get-AppxPackage output
  const wanted_keys = [
      'Name',
      'PackageFamilyName',
      'InstallLocation'
  ]

  // If any of these strings show up in the Name field,
  // skip them. They're always system applications.
  const filters = [
      'Microsoft .Net Native',
      'Microsoft.NET',
      'Microsoft.VCLibs',
      'Microsoft.UI.',
      'Microsoft.Windows',
      'Microsoft.Advertising',
      'Microsoft.Services',
      'Microsoft.DirectX',
  ]

  // Init data to send to renderer
  var fetch_data = {
    code: 1,
    message: "",
    app_list_path: app_list_path
  }

  // Sometimes, Get-AppxPackage output breaks up
  // fields into multiple lines. This regex replaces
  // those line breaks with a space
  const rep_re = / *\n +/g;

  app_list = [];
  current_apps = 0;
  var all_data = "";
  var apx_list = [];
  var index = -1;

  // Start the command to get info on all installed apps,
  // and set the progress bar to indeterminate (>1)
  var child_proc = spawn("powershell.exe", args=["Get-AppxPackage"]);
  mainWindow.setProgressBar(2);
  child_proc.stdout.on("data",function(data){
      all_data = all_data + data.toString();
  });

  // Once the process finishes, we can parse out the data
  // to a JavaScript object
  child_proc.on("close", function(code) {
      var skip_item = false;

      // Split all data up by lines
      all_data = all_data.replaceAll(rep_re, " ");
      all_data = all_data.split("\r\n");

      for (const line of all_data) {
          // If there's no : in this line, skip it
          if (!line.includes(":")){
              continue;
          }

          // Lines are made up of a key value pair separated by
          // a colon. Colons also often appear in the value, so
          // only split the first one.
          var line_parts = line.split(/:/);
          var key = line_parts.shift().trim();
          var value = line_parts.join(":").trim();

          // If we don't care about this key, skip the line
          if (!wanted_keys.includes(key)){
              continue;
          }

          // If this is a Name field, add a new object to the
          // app list (unless this name is filtered)
          if (key == "Name"){
              skip_item = false;

              // If this application is filtered, set the
              // skip variable to true and skip this key
              for (const filt of filters){
                  if (value.includes(filt)){
                      skip_item = true;
                      break;
                  }
              }
              if (skip_item){
                  continue;
              }

              // Increment index and push a new object
              index += 1;
              apx_list.push({
                  Name: value
              });
          }
          else {
              // Don't record this if we're skipping this item
              if (skip_item) {
                  continue;
              }

              // for all other keys, just push the key value
              // pair at the current index
              apx_list[index][key] = value;
          }
      }

      // At this point, we have our list of all applications.
      // Now, we need to get the Display Names and IDs for
      // all of them.
      var startTime = performance.now();
      var all_promises = [];
      total_apps = apx_list.length;
      for (const app of apx_list){

        // Get a promise from the name & ID function for this app.
        var app_promise = get_display_name_and_id(app);
        app_promise.then(function(code) {
          log("Fetched " + app.Name);
          current_apps += 1;
          mainWindow.setProgressBar(current_apps/apx_list.length);
        })
        .catch(function(err){
          log("Get info failed - " + err + " - " + app);
        });

        // Add this promise to the collection of all promises
        all_promises.push(app_promise);
      }

      Promise.all(all_promises)
        .then(codes => {
          // All child processes are complete. Dump the apps to app_list.json
          // and clear the progress bar (<0)
          log("All child procs done");
          mainWindow.setProgressBar(-1);

          // Sort app list by display name, then dump the list
          // to app_list.json
          app_list.sort((a, b) => (a.DisplayName > b.DisplayName ? 1 : -1))
          fs.writeFile(app_list_path, JSON.stringify(app_list, null, 4), (err) => {
            if (err) {
              fetch_data.message = err;
              log(err);
              mainWindow.webContents.send("fetch_result", fetch_data);
              throw(err);
            }

            // Success! Send the result to the renderer
            log("Dumped app list to " + app_list_path);
            fetch_data.code = 0;
            mainWindow.webContents.send("fetch_result", fetch_data);
            var endTime = performance.now();
            log(`Fetch took ${endTime - startTime} milliseconds`);
          });
        })
        .catch(error => {
          // Failure... Send the bad news
          // Code should still be -1 from init
          mainWindow.setProgressBar(-1);
          log("Failure in child procs: " + error)
          fetch_data.message = error;
          mainWindow.webContents.send("fetch_result", fetch_data);
        });
  });

  return "";
}


function update_connection(){
  var data = {
    is_server: this_is_server,
    connected: connected,
    games_avail: false
  }

  // if this is the server, check if there are games available
  if (this_is_server) {

    var game_count = 0;

    // Get list of games in Sunshine apps
    if( current_settings.stream_host == SUNSHINE_HOST && setting_validities.sunshine_apps) {
      var sunshine_json = JSON.parse(fs.readFileSync(current_settings.sunshine_apps));
      game_count = sunshine_json.apps.length;
    }

    // Get list of shortcuts in Shield Apps
    else if( current_settings.stream_host == GAMESTREAM_HOST && setting_validities.shield_apps_dir) {
      var shield_apps_contents = fs.readdirSync(current_settings.shield_apps_dir);

      // For each item in the Shield Apps directory,
      // check to see if the application name was also found in
      // the list of Gemini simulated games. If so, it is probably
      // a game available for streaming, so we can push it to the client
      for (const item of shield_apps_contents){
        if (item.endsWith(".lnk")) {
          // var shield_app_game_name = item.split('.')[0]
          game_count += 1;
        }
      }
    }

    // If we have at least one game,
    // send message via socket. Pre-pend with sync request
    // so client knows exactly what this is
    if ( game_count > 0) {
      data.games_avail = true;
    }
  }

  mainWindow.webContents.send("connection_status", data);
  if (this_is_server){
    var port = current_settings.server_port;

    log("Connected: " + connected);

    if (connected) {
      return;
    }
    mainWindow.webContents.send("device_name", "");

    var host = current_settings.client_ip;
    socket.connect(port, host, function() {
      if (connected){
        return;
      }

      connected = true;
      data.connected = true;
      mainWindow.webContents.send("connection_status", data);
      log('Connected to ' + host + ':' + port);
    });
  }

  else {
    var port = current_settings.client_port;
    log('Connected: ' +  connected + ' Client ready: ' + stream_client_ready);
    if (stream_client_ready){
      return;
    }

    var host = '0.0.0.0';
    stream_client_ready = true;

    server = net.createServer(sock => {

      log(`connected: ${sock.remoteAddress}:${sock.remotePort}`);
      socket_clients.push(sock);
      connected = true;

      // Send client device name to host
      var conn_data = {
        id: "GEMINI_CONNECTION_DATA",
        device_name: os.hostname()
      }
      var conn_data_str = JSON.stringify(conn_data, null, 4);
      sock.write(conn_data_str);


      sock.on('data', (data) => {
        var data_str = data.toString();
        log(`${sock.remoteAddress}: ${data_str}`);
        if (data_str.includes("GEMINI_SYNC_REQUEST")){
          // Build initial sync data. This will be sent both
          // to the client's (this device's) renderer and
          // sent back to the server's renderer for display
          sync_data = {
            id: "GEMINI_SYNC_STATUS",
            success: true,
            message: "Success!",
            synced_games: [],
            srm_loc_valid: false
          }

          // Get JSON from socket message
          rx_data = JSON.parse(data_str);
          mainWindow.webContents.send("sync_start");

          // If the manifests directory doesn't exist, create it
          if (!fs.existsSync(manifests_dir_path)){
            fs.mkdir(manifests_dir_path, (err) => {
              if (err) {
                  console.error(err);
                  sync_data.success = false;
                  sync_data.message = "Failed to create manifests directory";
                  mainWindow.webContents.send("sync_result", sync_data);
                  return;
              }
              log('Manifests directory created successfully');
              add_manifests_menu_item();
              return;
            });
          }

          var manifest_data = [];

          // for each game in the received data
          for(var g in rx_data.games){
            // create game definition
            var game_def = {
              title: rx_data.games[g],
              target: "/usr/bin/flatpak",
              startIn: "/usr/bin/",
              launchOptions: "run --branch=stable --arch=x86_64 --command=moonlight com.moonlight_stream.Moonlight stream " + current_settings.moonlight_options + " " + current_settings.host_name + ` "${rx_data.games[g]}"`
            }

            // Add game definition to manifest data
            manifest_data.push(game_def);
          }// end for

          log("Manifest data:");
          log(JSON.stringify(manifest_data, null, 4));

          // Write manifest data to file
          fs.writeFile(srm_manifest_path, JSON.stringify(manifest_data, null, 4), (err) => {
            if (err) {
              log(err);
              sync_data.success = false;
              sync_data.message = "Failed to write manifests data";
              mainWindow.webContents.send("sync_result", sync_data);
              return;
            }
            log("Added synchronized games list to " + srm_manifest_path);
          });

          // If sync was successful, populate sync data indicating that fact
          if (sync_data.success) {
            sync_data.message = "Successfully synchronized the following applications:";
            sync_data.synced_games = rx_data.games;
            sync_data.srm_loc_valid = setting_validities['srm_location'];
          }

          // send sync result to renderer
          mainWindow.webContents.send("sync_result", sync_data);

          // Send sync result back to server
          var sync_data_str = JSON.stringify(sync_data, null, 4);
          sock.write(sync_data_str);
        }
      });

      sock.on('close', (data) => {
        log(`connection closed: ${sock.remoteAddress}:${sock.remotePort}`);
        connected = false;
        socket_clients.splice(socket_clients.indexOf(sock), 1);
      });

    }).listen(port, host);

  log(`Server listening on ${host}:${port}`);
  }
}


function init_socket_client(){
  socket = new net.Socket();
  socket.on('close', (data) => {
    connected = false;
    var rend_data = {
      is_server: true,
      connected: connected
    }
    mainWindow.webContents.send("connection_status", rend_data);
  });

  socket.on('data', (data) => {
    var data_str = data.toString();
    log('Received data:' + data_str);
    if (data_str.includes("GEMINI_SYNC_STATUS")) {
      var sync_data = JSON.parse(data_str);
      mainWindow.webContents.send("sync_result", sync_data);
    }
    else if (data_str.includes("GEMINI_CONNECTION_DATA")) {
      var conn_data = JSON.parse(data_str);
      mainWindow.webContents.send("device_name", conn_data.device_name);
    }
    else {
      var sync_data = {
        success: false
      }
      mainWindow.webContents.send("sync_result", sync_data);
    }
  });
}


function close_socket_server(){
  // destroy all socket_clients (this will emit the 'close' event above)
  for (var i in socket_clients) {
    socket_clients[i].destroy();
  }
  server.close(function () {
    log('server closed.');
    server.unref();
  });
  stream_client_ready = false;
}


// Get path from user
const get_user_path = async (input, is_file) => {

  // Set dialog properties based on whether we
  // need to get a file or directory
  if (is_file){
    var dialog_props = ['openFile'];
  }
  else{
    var dialog_props = ['openDirectory'];
  }

  const dialog_ret = await dialog.showOpenDialog(mainWindow, {
      // The Configuration object sets different properties on the Open File Dialog
    properties: dialog_props
  });

  if (dialog_ret.canceled){
    validate_settings(current_settings);
    return;
  }

  // Send selected path back to renderer, along with the
  // input ID we received, so renderer can assign the path correctly
  var data = {
    dir: dialog_ret.filePaths[0],
    input_id: input
  }

  // Send the path back to the renderer so it can update
  // the displayed path
  mainWindow.webContents.send("got_path", data);
}


// Validate settings
function validate_settings (settings) {

  // iterate over all settings
  for (let setting in settings) {

    // initialize validity to false
    setting_validities[setting] = false;

    // assert reminder for new config items
    assert.equal(11, Object.keys(default_settings).length);
    switch(setting) {
      // Shield Apps directory - must exist
      case 'shield_apps_dir':
        setting_validities[setting] = fs.existsSync(settings[setting]);
        break;

      // Sunshine apps.json - must exist and be called 'apps.json'
      case 'sunshine_apps':
        setting_validities[setting] = (fs.existsSync(settings[setting]) && settings[setting].endsWith('json') && settings[setting].includes("apps"));
        break;

      // Known applications - always valid
      case 'known_apps':
        setting_validities[setting] = true;
        break;

      // Moonlight options - always valid
      case 'moonlight_options':
        setting_validities[setting] = true;
        break;

      // Steam Rom Manager location - must exist
      case 'srm_location':
        setting_validities[setting] = (fs.existsSync(settings[setting]));
        break;

      // Moonlight host name - non-empty
      case 'host_name':
        setting_validities[setting] = settings[setting] != "";
        break;

      // Client IP address - numbers and periods
      case 'client_ip':
        const regexExp = /^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$/gi;

        setting_validities[setting] = regexExp.test(settings[setting]);
        break;

      // Server port - in range
      case 'server_port':
        setting_validities[setting] = (settings[setting] && settings[setting] >= 0 && settings[setting] <= 65535);
        log("Server port: " + settings[setting])
        break;

      // Client port - in range
      case 'client_port':
        setting_validities[setting] = (settings[setting] >= 0 && settings[setting] <= 65535);
        break;

      // Stream host - Sunshine or NVIDIA GameStream
      case 'stream_host':
        setting_validities[setting] = valid_hosts.includes(settings[setting]);
        break;

      // Steam Rom Manager configurations location - must exist
      case 'srm_configs':
        setting_validities[setting] = (fs.existsSync(settings[setting]));
        break;

      default:
        log('Did not validate ' + setting);
        break;
    }
  }
  mainWindow.webContents.send("settings_validities", setting_validities);
}

function show_about(){
  dialog.showMessageBox({
    title: `About ${app.getName()}`,
    message: `${app.getName()} ${app.getVersion()}`,
    // detail: `Created by ${pkg.author.name}`
    // icon: path.join(__dirname, '..', 'static/Icon.png'),
   });
}

function save_settings(args){
  log(JSON.stringify(args, null, 4));
  for (let setting in args) {
    // Save the current provided setting to the
    // config file, then store it in our current settings
    store.set(setting, args[setting]);

    // If this is a connection related setting and it
    // has changed, destroy connection so it will reconnect
    // on the next cycle
    if ( (setting == "server_port" || setting == "client_port" || setting == "client_ip") && args[setting] != current_settings[setting] ){
      if (this_is_server){
        log("Connection setting changed");
        socket.destroy();
      }
      else {
        close_socket_server();
      }
    }

    // If this is the SRM config location setting and it
    // has changed, call the function to add our parser
    if ( setting == "srm_configs" && args[setting] != current_settings[setting] ){
      if (!this_is_server){
        log("Steam ROM Manager config location changed - adding Gemini Stream parser");
        current_settings[setting] = args[setting]
        sync_srm_cnfg();
      }
    }

    current_settings[setting] = args[setting]
  }

  // Validate the new settings
  validate_settings(current_settings);

  log('Saved settings');
}

function sync_srm_cnfg() {
  var template = {
    parserType: "Manual",
    configTitle: "Gemini Stream",
    steamCategory: "${Streaming}",
    steamDirectory: path.resolve(os.homedir(), ".steam/steam"),
    romDirectory: "",
    executableArgs: "",
    executableModifier: "\"${exePath}\"",
    startInDirectory: "",
    titleModifier: "${fuzzyTitle}",
    imageProviders: [
        "SteamGridDB"
    ],
    onlineImageQueries: "${${fuzzyTitle}}",
    imagePool: "${fuzzyTitle}",
    defaultImage: "",
    defaultTallImage: "",
    defaultHeroImage: "",
    defaultLogoImage: "",
    defaultIcon: "",
    localImages: "",
    localTallImages: "",
    localHeroImages: "",
    localLogoImages: "",
    localIcons: "",
    userAccounts: {
        specifiedAccounts: null,
        skipWithMissingDataDir: true,
        useCredentials: false
    },
    executable: {
        path: "",
        shortcutPassthrough: false,
        appendArgsToExecutable: true
    },
    parserInputs: {
        manualManifests: manifests_dir_path
    },
    titleFromVariable: {
        limitToGroups: "",
        caseInsensitiveVariables: false,
        skipFileIfVariableWasNotFound: false,
        tryToMatchTitle: false
    },
    fuzzyMatch: {
        use: null,
        replaceDiacritics: true,
        removeCharacters: true,
        removeBrackets: true
    },
    imageProviderAPIs: {
        SteamGridDB: {
            nsfw: false,
            humor: false,
            styles: [],
            stylesHero: [],
            stylesLogo: [],
            stylesIcon: [],
            imageMotionTypes: [
                "static"
            ]
        }
    },
    parserId: "165557686157196861",
    version: 10
  }

  // If this is the server, return
  if (this_is_server){
    return;
  }

  // If the SRM user config file doesn't exist yet, create it
  if(!fs.existsSync(current_settings.srm_configs)){
    fs.mkdirSync(path.resolve(os.homedir(), '.config/steam-rom-manager/userData'), options={recursive: true});
    var srm_usr_cnfg = [];
  }
  else{
    // Open SRM user configs, try to find the Gemini Stream config,
    // and replace it with our template
    var srm_usr_cnfg = JSON.parse(fs.readFileSync(current_settings.srm_configs));

    var existing_cnfg = srm_usr_cnfg.find(cnfg => cnfg.configTitle === "Gemini Stream");
    if (existing_cnfg){
      log("Found existing SRM user config");
      return;
    }
  }

  // Add our template, update file
  srm_usr_cnfg.unshift(template);
  fs.writeFile(current_settings.srm_configs, JSON.stringify(srm_usr_cnfg, null, 4), (err) => {
    if (err) {
      log(err);
      throw(err);
    }
    log("Added Gemini Stream configuration to Steam ROM Manager");
    log(current_settings.srm_configs);
  });
}


/******************************************************************
*                     IPC HANDLING                                *
******************************************************************/
// Request from renderer for current settings
ipcMain.on("request_current_settings", (event, args) => {
  mainWindow.webContents.send("load_settings", current_settings);
});


// Request from renderer for app list
ipcMain.on("request_load_app_list", (event, args) => {
  mainWindow.webContents.send("load_app_list", app_list_path);
});


// Reset settings
ipcMain.on("reset_settings", (event, args) => {
  log('Received "reset_settings" command');

  save_settings(default_settings);

  // Have renderer reload default settings
  mainWindow.webContents.send("load_settings", current_settings);
});


// Open directory
ipcMain.on("open_dir", (event, dir) => {
  log('Received "open_dir" command');
  log("Opening " + dir.replaceAll('/', '\\'));
  shell.openPath(dir.replaceAll('/', '\\'))
});


// Open file
ipcMain.on("open_file", (event, target_file) => {
  log('Received "open_file" command');
  log("Opening " + target_file);
  if( this_is_server ){
    target_file = target_file.replaceAll('/', '\\');
  }
  shell.showItemInFolder(target_file)
});


// Main initialization
ipcMain.on("main_init", (event, data) => {
  log('Recieved "main_init" command');
  log('User data: ' + usr_data_path)

  // Get current settings from config file
  for (let setting in current_settings ){
    var fetched_setting_val = store.get(setting);

    // If a setting isn't in the config file,
    // set it to the default setting then save
    // the default setting to the config file.
    if (fetched_setting_val == undefined){
      store.set(setting, default_settings[setting]);
      current_settings[setting] = default_settings[setting];
    }
    else{
      current_settings[setting] = fetched_setting_val;
    }
  }

  validate_settings(current_settings);

  // If this is client and Moonlight host is not valid, open settings page
  if(!data.is_server && !setting_validities.host_name){
    mainWindow.webContents.send("open_settings_page");
  }

  // If this is server and client IP is not valid, open settings page
  if(data.is_server && !setting_validities.client_ip){
    mainWindow.webContents.send("open_settings_page");
  }

  // Send init command back to renderer
  init_data = {
    cpu_count: cpu_count,
    ip_address: ip.address(),
    device_name: os.hostname(),
    client_ip: current_settings.client_ip,
    server_port: current_settings.server_port,
    client_port: current_settings.client_port,
    load_visible: fs.existsSync(app_list_path),
    is_server: data.is_server,
    setting_validities: setting_validities
  }
  mainWindow.webContents.send("init_from_main", init_data);

  // Tell the renderer to load the current settings
  mainWindow.webContents.send("load_settings", current_settings);
  this_is_server = data.is_server;

  // If this is the stream server, initialize its socket
  if (this_is_server) {
    init_socket_client();
  }

  // Update connection every second
  update_connection_prdc = setInterval(function() {
    update_connection();
  }, 1000);

  if (this_is_server) {
      log('Server stuff');
  }
  else {
    log('Client stuff');
    sync_srm_cnfg();
    add_manifests_menu_item();
  }
});


// Generic to main command
ipcMain.on("toMain", (event, args) => {
  log(args)
  setTimeout(() => {
    mainWindow.webContents.send("fromMain", "some other data");
  }, 3000);
});

// Start Steam ROM Manager
ipcMain.on("start_srm", (event, args) => {
  if (fs.existsSync(current_settings['srm_location'])){
    spawn(current_settings["srm_location"]);
  }
});

// send list of streamable games to be saved on the client
ipcMain.on("sync_to_client", (event, args) => {
  log('Received sync_to_client command')
  var tx_games = []


    // Get list of games from Sunshine apps
    if( current_settings.stream_host == SUNSHINE_HOST && setting_validities.sunshine_apps) {
      var sunshine_json = JSON.parse(fs.readFileSync(current_settings.sunshine_apps));
      log(sunshine_json.apps.length);

      for (const game of sunshine_json.apps){
        tx_games.push(game.name)
      }
    }

    // Get list of shortcuts in Shield Apps
    else if( current_settings.stream_host == GAMESTREAM_HOST && setting_validities.shield_apps_dir) {
      var shield_apps_contents = fs.readdirSync(current_settings.shield_apps_dir);

      // For each item in the Shield Apps directory,
      // check to see if the application name was also found in
      // the list of Gemini simulated games. If so, it is probably
      // a game available for streaming, so we can push it to the client
      for (const item of shield_apps_contents){
        if (item.endsWith(".lnk")) {
          var shield_app_game_name = item.split('.')[0]
          tx_games.push(shield_app_game_name)
        }
      }
    }

  // If we have at least one game,
  // send message via socket. Pre-pend with sync request
  // so client knows exactly what this is
  if (tx_games.length > 0) {
    var tx_data = {
      id: "GEMINI_SYNC_REQUEST",
      games: tx_games
    }

    var tx_data_str = JSON.stringify(tx_data, null, 4);

    log('Games to transmit: ' + tx_games);
    socket.write(tx_data_str);
  }
  else {
    log('No games to sync');
    data = {
      success: true
    }
    mainWindow.webContents.send("sync_result", data);
  }
});


// Kick off a 1 second timer, at the end of which
// settings will be saved
ipcMain.on("save_settings", (event, args) => {
  log('Received "save_settings" command');

  // If we receive this command, clear the
  // current save_settings timer. Do this
  // so we aren't saving settings every
  // single time the user presses a key
  clearTimeout(save_settings_timeout);
  save_settings_timeout = setTimeout(() => {
    save_settings(args);
  }, 1000);

});


// Fetch installed Windows apps
ipcMain.on("fetch_apps", (event, args) => {
  log('Received "fetch_apps" from input');
  fetch_installed_apps();
});


// Get path from user
// 'args' is an object, where input_id is the ID of the input
// requesting the path, and is_file = True if file path is
// requested, and False if it is a directory.
// input_id is needed so, when a response is sent, we know
// which input to populate.
ipcMain.on("get_path", (event, args) => {
  log('Received "get_directory" from renderer ' + args.input_id);

  // Get path from user. Call external function because it must be async
  get_user_path(args.input_id, args.is_file);

});


// Take the provided list of applications and make
// them streamable
ipcMain.on("export_selected_apps", (event, selected_apps) => {
  var template = {
      name: "",
      output: "",
      cmd: "",
      detached: []
  };
  template["image-path"] = "";

  log('Received "export_selected_apps" from renderer');
  log(selected_apps);

  var export_data = {
    code: 1,
    message: "Successfully exported the following applications:",
    games: []
  }

  var index = 0;
  for (const application of selected_apps){
    index += 1;

    mainWindow.setProgressBar(index/selected_apps.length);

    // Remove invalid characters from game name
    const invalid = '<>:"/\|?*™'
    for (var char of invalid){
      application.DisplayName = application.DisplayName.replaceAll(char, '')
    }

    // Sunshine export
    if( current_settings.stream_host == SUNSHINE_HOST && setting_validities.sunshine_apps) {
      // Open Sunshine apps.json and see if the current game is already in the list
      var sunshine_json = JSON.parse(fs.readFileSync(current_settings.sunshine_apps));
      if (!sunshine_json.hasOwnProperty('apps') || !Array.isArray(sunshine_json.apps) ){
        sunshine_json.apps = [];
      }

      var existing_cnfg = sunshine_json.apps.find(cnfg => cnfg.name === application.DisplayName);
      if (existing_cnfg){
        // Found an existing config for this game, so just
        // update the detached command for it
        log("Found " + application.DisplayName + " in " + current_settings.sunshine_apps);
        existing_cnfg.detached = [ "explorer.exe shell:appsFolder\\" + application.command ]
      }
      else{
        // Did not find any existing config, so populate the template
        // and push it to the sunshine json
        template.name = application.DisplayName;
        template.detached = [ "explorer.exe shell:appsFolder\\" + application.command ];
        sunshine_json.apps.push(template)
      }

      // Write the updated JSON data
      fs.writeFileSync(current_settings.sunshine_apps, JSON.stringify(sunshine_json, null, 4), (err) => {
        if (err) {
          // We got an error, so pass that on to the renderer for display
          export_data.message = err;
          mainWindow.webContents.send("export_result", export_data);
          log(err);
          throw(err);
        }
        if (existing_cnfg){
          log("Updated Sunshine apps.json entry for " + application.DisplayName);
        }
        else{
          log("Added Sunshine apps.json entry for " + application.DisplayName);
        }
        log(current_settings.sunshine_apps);
      });
      export_data.games.push(application.DisplayName);
    }
    else if( current_settings.stream_host == SUNSHINE_HOST && !setting_validities.sunshine_apps) {
      export_data.message = "Invalid Sunshine apps path: " + current_settings.sunshine_apps;
      log(export_data.message);
      mainWindow.webContents.send("export_result", export_data);
      mainWindow.setProgressBar(-1);
      return;
    }

    // GameStream export
    else if( current_settings.stream_host == GAMESTREAM_HOST && setting_validities.shield_apps_dir) {
      // Create folder for game in games dir
      var this_game_dir = path.resolve(games_dir, application.DisplayName);
      fs.mkdirSync(this_game_dir, options={recursive: true});

      // Write bat file to start game in this game's directory
      var bat_path = path.resolve(this_game_dir, application.DisplayName + ".bat");
      fs.writeFile(bat_path, "explorer.exe shell:appsFolder\\" + application.command, (err) => {
        if (err) {
          log(err);
          export_data.message = err;
          mainWindow.webContents.send("export_result", export_data);
          throw(err);
        }
      });

      // Create the shortcut for this game in the Shield Apps directory
      var shortcut_path = path.resolve(current_settings.shield_apps_dir, application.DisplayName) + ".lnk"
      shell.writeShortcutLink(shortcut_path, {target: bat_path})

      // GeForce Experience also needs a game folder with box art in it to pick up shortcuts
      // Copy the default box-art.png to a new game folder for the app
      var shield_assets_dir = path.resolve(current_settings.shield_apps_dir, 'StreamingAssets');
      var game_asset_dir = path.resolve(shield_assets_dir, application.DisplayName)
      var game_box_art = path.resolve(game_asset_dir, box_art_filname)
      if (!fs.existsSync(shield_assets_dir)){
        // make assets directory
        fs.mkdirSync(shield_assets_dir, (err) => {
          if (err) {
              log(err);
              export_data.message = err;
              mainWindow.webContents.send("export_result", export_data);
              throw(err);
          }
        });
      }
      if (!fs.existsSync(game_asset_dir)){
        // make directory for this game
        fs.mkdirSync(game_asset_dir, (err) => {
          if (err) {
              log(err);
              export_data.message = err;
              mainWindow.webContents.send("export_result", export_data);
              throw(err);
          }
        });
      }
      fs.copyFileSync(box_art_path, game_box_art);
      export_data.games.push(application.DisplayName);
    }

  }

  // assign successful export data and send to renderer
  export_data.code = 0;
  mainWindow.webContents.send("export_result", export_data);
  mainWindow.setProgressBar(-1);
  validate_settings();
});
