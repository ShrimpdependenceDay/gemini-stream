var scrolled_to_bottom = true;

function init() {
    $('#debug_log').on('scroll', chk_scroll);
}

function chk_scroll(e) {
    var elem = $(e.currentTarget);
    if (elem[0].scrollHeight - elem.scrollTop() == elem.outerHeight()) {
        scrolled_to_bottom = true;
    }
    else {
        scrolled_to_bottom = false;
    }
}

init();

window.api.receive("message", (message) => {
    console.log('Received message from main');
    $("#debug_log").append("<p>" + message + "</p>");

    if ($("#debug_log p").length > 1000){
        $("#debug_log").find('p:first').remove();
    }
    if (scrolled_to_bottom){
        $('#debug_log').scrollTop($('#debug_log')[0].scrollHeight);
    }
});
