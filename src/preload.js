const {
    contextBridge,
    ipcRenderer
} = require("electron");
const fs = require("fs");
const Tabulator = require('tabulator-tables');
const child_proc = require("child_process");


// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
    "api", {
        send: (channel, data) => {
            // whitelist channels
            let validChannels = [
                "get_path",
                "toMain",
                "start_ff",
                "save_settings",
                "main_init",
                "reset_settings",
                "request_current_settings",
                "request_load_app_list",
                "fetch_apps",
                "export_selected_apps",
                "start_host",
                "sync_to_client",
                "start_srm",
                "open_dir",
                "open_file"
            ];
            if (validChannels.includes(channel)) {
                ipcRenderer.send(channel, data);
            }
        },
        receive: (channel, func) => {
            let validChannels = [
                "fromMain",
                "load_settings",
                "got_path",
                "open_settings_page",
                "cpu_count",
                "settings_validities",
                "fetch_result",
                "export_result",
                "load_app_list",
                "toggle_client_server",
                "connection_status",
                "tx_status",
                "sync_start",
                "sync_result",
                "device_name",
                "init_from_main",
            ];
            if (validChannels.includes(channel)) {
                // Deliberately strip event as it includes `sender`
                ipcRenderer.on(channel, (event, ...args) => func(...args));
            }
        },
        open_dir: (dir, func) => {
            child_proc.exec('start "" "' + dir + '"')
        }

    }
);

// TODO - Save known app when user edits Display Name

contextBridge.exposeInMainWorld(
    "tabulator", {
        app_table: (container_selector, constructor) => {

            var new_table = new Tabulator(container_selector, constructor);
            new_table.on("rowSelected", function(row){
                var checkedBoxes = document.querySelectorAll('.tabulator-cell input:checked');
                document.getElementById("export_selected_apps").disabled = checkedBoxes.length == 0;
            });
            new_table.on("rowDeselected", function(row){
                var checkedBoxes = document.querySelectorAll('.tabulator-cell input:checked');
                document.getElementById("export_selected_apps").disabled = checkedBoxes.length == 0;
            });
            return new_table;
        },

        get_table_data: (app_list_path) => {
            var data = JSON.parse(fs.readFileSync(app_list_path));
            return data;
        },
    }
);
