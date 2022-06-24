var app_table;
var this_is_server;
var export_results_open = false;

function isNumberKey(txt, evt) {
  var charCode = (evt.which) ? evt.which : evt.keyCode;
  if (charCode == 46) {
    //Check if the text already contains the . character
    if (txt.value.endsWith('.')) {
      return false;
    } else {
      return true;
    }
  } else {
    if (charCode > 31 &&
      (charCode < 48 || charCode > 57))
      return false;
  }
  return true;
}

function save_settings () {
    var settings = {}

    $('input.settings').each(function(){
        settings[$(this).attr('id')] = $(this).val()
    });

    settings['known_apps'] = {}

    $('table#known_apps tr').each(function(){
        var uwp_name = $(this).find('input.uwp_name').val();
        var disp_name = $(this).find('input.disp_name').val();

        if (uwp_name && disp_name) {
            settings['known_apps'][uwp_name] = disp_name;
        }
    })

    $(".host_name_display").text($("#host_name").val());
    if (this_is_server){
        $(".this_port_disp").text($("#server_port").val());
        $(".that_device_ip_address").text($("#client_ip").val());
    }
    else {
        $(".this_port_disp").text($("#client_port").val());
    }


    
    window.api.send("save_settings", settings)
}

function reset_settings () {
    window.api.send("reset_settings")
}

function open_settings_page(){
    var blanket = document.getElementById('settings-dialog-blanket');
    var dialog = document.getElementById('settings_page');
    blanket.style.display = ''
    dialog.style.display = ''

    document.getElementsByTagName('body')[0].style.overflow = 'hidden'
}

function open_srm(){
    window.api.send("start_srm");
}

function open_results_page(){
    $("#results_page").fadeIn(300);
    $("#results-dialog-blanket").fadeIn(300);

    document.getElementsByTagName('body')[0].style.overflow = 'hidden'
}

/*------------------------------------------------------
Close message log
------------------------------------------------------*/
function close_settings_page(){

    var blanket = document.getElementById('settings-dialog-blanket');
    var dialog = document.getElementById('settings_page');
    blanket.style.display = 'none'
    dialog.style.display = 'none'

    document.getElementsByTagName('body')[0].style.overflow = ''
}

function close_results_page(){

    $("#results_page").fadeOut(150);
    $("#results-dialog-blanket").fadeOut(150);

    document.getElementsByTagName('body')[0].style.overflow = ''
    export_results_open = false;
}

function init_inputs() {
    $("input.settings").on('input', function(){
        save_settings();
    });
}

function export_selected_apps() {
    console.log('Exporting')
    var selectedData = app_table.getSelectedData();
    window.api.send("export_selected_apps", selectedData);
    show_loading_screen('Exporting applications...');
}

function init_app_table(app_list_path) {
    var tabledata = window.tabulator.get_table_data(app_list_path);

    var constructor = {
        height:'calc(100% - 70px - 80px)', // set height of table (in CSS or here), this enables the Virtual DOM and improves render speed dramatically (can be any valid css height value)
        layout:"fitColumns", //fit columns to width of table (optional)
        columns:[ //Define Table Columns
            {formatter:"rowSelection", titleFormatter:"rowSelection", headerSort:false, width:22, hozAlign:"center", headerHozAlign:"center", resizable:false, vertAlign:"middle"},
            {title:"Name", field:"DisplayName", vertAlign:"middle", width:220, editor:"input"},
            {title:"Command", field:"command", vertAlign:"middle"},
            {title:"Install Location", field:"InstallLocation", vertAlign:"middle"},
        ],
        data: tabledata
    }

    app_table = window.tabulator.app_table("#app_list_table", constructor);

    $("div.device_info_parent").slideUp(150);
    $("div#main_content").addClass('minimized');
    setTimeout(() => {
        $(".app_list_component").fadeIn(150);
    }, 500)

    hide_loading_screen();
}

function show_loading_screen(text) {
    $("div#loading_screen #current_status").text(text);
    $("div#loading_screen").fadeIn(150);
}

function hide_loading_screen() {
    $("div#loading_screen").fadeOut(150);
}

function load_app_list() {
    window.api.send("request_load_app_list");
}

function fetch_apps() {
    window.api.send("fetch_apps");
    show_loading_screen('Fetching installed applications...')
    $(".app_list_component").fadeOut(150);
}

function connect_to_server() {
    console.log('Attempting to connect to server');
    window.api.send("start_host");
}

function sync_to_client() {
    console.log('Syncing to client');
    window.api.send("sync_to_client");
    close_results_page();
    show_loading_screen('Syncing...')
}

function add_known_app() {
    var new_row_html = `
    <tr>
        <td><input class="known_app uwp_name" type="text"></td>
        <td><input class="known_app disp_name" type="text"></td>
        <td><button class="delete_known_app_row">&#10005;</button></td>
    </tr>
    `;
    $('table#known_apps > tbody:last-child').append(new_row_html);

    // Add click handlers for x buttons
    $('table#known_apps > tbody:last-child').find("button.delete_known_app_row").on("click", function(){
        $(this).closest('tr').remove();
        save_settings();
    });

    // Add input handlers
    $('table#known_apps > tbody:last-child').find("input.known_app").on('input', function(){
        save_settings();
    });
}

function init() {
    data = {
        is_server: false
    }
    if (navigator.platform.includes('Linux')) {
        $(".client").show();
        $(".server").hide();
    }
    else {
        $(".server").show();
        $(".client").hide();
        data.is_server = true;
    }
    this_is_server = data.is_server;
    window.api.send("main_init", data);

    
    // Add click handlers for folder buttons
    $("button.get_path").on("click", function(){
        // Get ID of corresponding input
        var input = $(this).parent().find('input.settings').attr('id');

        // Send open dialog command back to main, with the input ID
        data = {
            input_id: input,
            is_file: $(this).hasClass('file') 
        }
        window.api.send("get_path", data);
      });

    // Add click handlers for go-to buttons
    $("button.go_to_dir").on("click", function(){
        // Get path of corresponding input
        var path = $(this).parent().find('input.settings').val();
        window.api.open_dir(path);
      });

      $('#app_list_table').hide();
      init_inputs();
}

init();

window.api.receive("load_settings", (data) => {
    console.log('Received load_settings from main')
    for (let setting in data){
        switch(setting) {
            case 'known_apps':
                $("table#known_apps tr:not(:first)").remove();
                for (let app in data[setting]) {
                    var new_row_html = `
                        <tr>
                            <td><input class="known_app uwp_name" type="text" value="${app}"></td>
                            <td><input class="known_app disp_name" type="text" value="${data[setting][app]}"></td>
                            <td><button class="delete_known_app_row">&#10005;</button></td>
                        </tr>
                        `;
                    $('table#known_apps > tbody:last-child').append(new_row_html);

                    // Add click handlers for x buttons
                    $("button.delete_known_app_row").on("click", function(){
                        $(this).closest('tr').remove();
                        save_settings();
                    });
                    
                    // Add input handlers
                    $("input.known_app").on('input', function(){
                        save_settings();
                    });
                }
                break;
            default:
                var setting_element = $('#' + setting);
                setting_element.val(data[setting])
                break;
        }
    }

    $(".host_name_display").text($("#host_name").val());
    $(".that_device_ip_address ").text($("#client_ip").val());

});

window.api.receive("fromMain", (data) => {
    console.log(`Received "${data}" from main process`);

    window.app_handler.fetch_apps();

});

window.api.receive("device_name", (data) => {
    console.log(`Received device_name from main process`);
    $(".that_device_name").text(data);
});

window.api.receive("connection_status", (data) => {
    console.log(`Received "connection_status" from main process`);

    if (data.is_server){
        if (data.connected && data.games_avail){
            $('button#sync_to_client').fadeIn(150);
            if (export_results_open){
                $('button#export_sync_to_client').fadeIn(150);
            }
            else{
                $('button#export_sync_to_client').fadeOut(150);
            }
        }
        else {
            $('button#sync_to_client').fadeOut(150);
            $('button#export_sync_to_client').fadeOut(150);
        }
    }
    if (data.connected){
        $('.connection_status').text('Connected');
        $('.connection_status').addClass('connected');
    }
    else {
        $('.connection_status').text('Searching...');
        $('.connection_status').removeClass('connected');
    }

});

window.api.receive("tx_status", (success) => {
    console.log(`Received "tx_status" from main process`);
    if (success){
        hide_loading_screen();
    }
});

window.api.receive("toggle_client_server", (data) => {
    console.log(`Received "toggle_client_server" from main process`);
    $('.client').toggle();
    $('.server').toggle();
});

window.api.receive("fetch_result", (result_data) => {
    console.log(`Received "fetch_result" from main process`);
    console.log(result_data);
    setTimeout(() => {
        hide_loading_screen();
        if (this_is_server){
            if (result_data.code == 0) {
                init_app_table(result_data.app_list_path);
            }
            else {
                $("#results_content").empty();
                $("#results_content").append("<p id=\"results_message\">" + result_data.message + "</p>");
                $("#open_srm").hide();
                $("#results_page").removeClass("success");
                $("#results_page").addClass("failure");

                open_results_page();
            }

        }
    }, 500)
});

window.api.receive("export_result", (result_data) => {
    console.log(`Received "export_result" from main process`);
    console.log(result_data);
    setTimeout(() => {
        hide_loading_screen();
        if (this_is_server){
            $("#results_content").empty();
            $("#results_content").append("<p id=\"results_message\">" + result_data.message + "</p>");
            $("#open_srm").hide();
            $("#results_page").removeClass("failure");
            $("#results_page").removeClass("success");

            console.log(result_data.code);

            if (result_data.code == 0){
                for (let g in result_data.games){
                    $("#results_content").append("<p class=\"results_game_entry\">&#x2022; " + result_data.games[g] + "</p>");
                }
                $("#results_page").addClass("success");
                export_results_open = true;
            }
            else {
                $("#results_page").addClass("failure");
            }

            open_results_page();
        }
    }, 1000)
});

window.api.receive("sync_start", (data) => {
    console.log(`Received "sync_start" from main process`);
    show_loading_screen("Syncing...");
    close_results_page();
    close_settings_page();
});

window.api.receive("sync_result", (result_data) => {
    console.log(`Received "sync_result" from main process`);
    setTimeout(() => {
        hide_loading_screen();
            $("#results_content").empty();
            $("#results_content").append("<p id=\"results_message\">" + result_data.message + "</p>");
            $("#open_srm").hide();
            $("#results_page").removeClass("failure");
            $("#results_page").removeClass("success");

            if (result_data.success){
                for (let g in result_data.synced_games){
                    $("#results_content").append("<p class=\"results_game_entry\">&#x2022; " + result_data.synced_games[g] + "</p>");
                }
                $("#results_page").addClass("success");
                if (!this_is_server){
                    if (result_data.srm_loc_valid) {
                        $("#open_srm").show();
                    }
                }
            }
            else {
                $("#results_page").addClass("failure");
            }

            open_results_page();
    }, 1000)
});

window.api.receive("cpu_count", (data) => {
    $('input#thread_cnt').attr({'max': data});
});

window.api.receive("init_from_main", (data) => {
    
    $('input#thread_cnt').attr({'max': data.cpu_count});
    $(".this_device_name").text(data.device_name);
    $(".this_device_ip_address").text(data.ip_address);
    
    if (data.is_server){
        $(".that_device_ip_address").text(data.client_ip);
        if (data.setting_validities.client_ip){
            $(".that_device_ip_address").removeClass("invalid");        
        }
        else{
            $(".that_device_ip_address").addClass("invalid");        
        }

        $(".this_port_disp").text(data.server_port);
    }
    else {
        $(".this_port_disp").text(data.client_port);
    }

    if (data.load_visible){
        $("button#load_apps").show();
    }

});

window.api.receive("load_app_list", (app_list_path) => {
    console.log('Received load_app_list from main');
    init_app_table(app_list_path);
    // var checkedBoxes = document.querySelectorAll('.tabulator-cell input:checked');
    document.getElementById("export_selected_apps").disabled = true;
});


window.api.receive("open_settings_page", (data) => {
    console.log(`Received "open_settings_page" from main process`);
    open_settings_page();
});

window.api.receive("settings_validities", (data) => {
    console.log(`Received "settings_validities" from main process`);

    for (let setting in data) {
        var $input_element = $('input#' + setting);
        if (data[setting]) {
            $input_element.removeClass('invalid');
        }
        else {
            $input_element.addClass('invalid');
        }
    }

    if (data.client_ip){
        $(".that_device_ip_address").removeClass("invalid");        
    }
    else{
        $(".that_device_ip_address").addClass("invalid");        
    }

});

window.api.receive("got_path", (data) => {
    console.log('Received got_path from main');
    $target_input = $("#" + data.input_id);
    $target_input.val(data.dir);
    save_settings();
});



/*------------------------------------------------------------------------------------------
        @SECTION: Dark mode
------------------------------------------------------------------------------------------*/

    /*------------------------------------------------------
    Init dark mode
    ------------------------------------------------------*/
    function init_dark_mode(){
        /*--------------------------------------------------
        Check to see if we need to load different theme
        --------------------------------------------------*/
        if (document.documentElement.getAttribute("data-theme") == "dark"){
            $('#dark-mode-btn').addClass('active');
        }
    }

    /*------------------------------------------------------
    Toggle dark mode
    ------------------------------------------------------*/
    function toggle_dark(){
        $('#dark-mode-btn').toggleClass('active');
        if( $('#dark-mode-btn').hasClass('active') ){
            localStorage.setItem('theme', 'dark');
            document.documentElement.setAttribute('data-theme', 'dark');
        } else {
            localStorage.setItem('theme', 'light');
            document.documentElement.setAttribute('data-theme', 'light');
        }

        update_table_css();
    }