/**
 * wpos.js is part of Wallace Point of Sale system (WPOS)
 *
 * wpos.js Provides core functions for the admin dashboard.
 *
 * WallacePOS is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation; either
 * version 3.0 of the License, or (at your option) any later version.
 *
 * WallacePOS is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
 * Lesser General Public License for more details:
 * <https://www.gnu.org/licenses/lgpl.html>
 *
 * @package    wpos
 * @copyright  Copyright (c) 2014 WallaceIT. (https://wallaceit.com.au)
 * @author     Michael B Wallace <micwallace@gmx.com>
 * @since      Class created 15/1/13 12:01 PM
 */

function changehash(hash) {
    document.location.hash = hash;
}

function setActiveMenuItem(secname) {
    // remove active from previous
    $(".nav-list li").removeClass('active');
    $(".submenu li").removeClass('active');
    // add active to clicked
    var li = $('a[href="#!' + secname + '"]').parent('li');
    $(li).addClass('active');
    // set the parent item if its a submenu
    if ($(li).parent('ul').hasClass('submenu')) {
        $(li).parent('ul').parent('li').addClass('active');
    }
}

var WPOS;
//On load page, init the timer which check if the there are anchor changes
$(function () {
    // initiate WPOS object
    WPOS = new WPOSAdmin();
    // init
    WPOS.isLogged();
    // dev/demo quick login
    if (document.location.host == "demo.wallacepos.com" || document.location.host == "alpha.wallacepos.com") {
        $("#logindiv").append('<button class="btn btn-primary btn-sm" onclick="$(\'#loguser\').val(\'admin\');$(\'#logpass\').val(\'admin\'); WPOS.login();">Demo Login</button>');
    }
    WPOS.print.loadPrintSettings();
});

function WPOSAdmin() {
    // AJAX PAGE LOADER FUNCTIONS
    var currentAnchor = '0';
    var currentsec = '';
    var lastAnchor = null;
    this.loggeduser = null;
    // Are there anchor changes, if there are, calculate request and send
    this.checkAnchor = function () {
        //Check if it has changes
        if ((currentAnchor != document.location.hash)) {
            lastAnchor = currentAnchor;
            currentAnchor = document.location.hash;
            if (currentAnchor) {
                var splits = currentAnchor.substring(2).split('&');
                //Get the section
                sec = splits[0];
                // has the section changed
                if (sec == currentsec && currentAnchor.indexOf('&query') != -1) {
                    // load some subcontent
                } else {
                    // if we are leaving realtime dash, close socket connection
                    if (currentsec == "realtime") {
                        WPOS.stopSocket();
                    }
                    // set new current section
                    currentsec = sec;
                    // set menu items active
                    setActiveMenuItem(sec);
                    // close mobile menu
                    if ($("#menu-toggler").is(":visible")) {
                        $("#sidebar").removeClass("display");
                    }
                    // start the loader
                    WPOS.util.showLoader();
                    //Creates the  string callback. This converts the url URL/#! &amp;amp;id=2 in URL/?section=main&amp;amp;id=2
                    delete splits[0];
                    //Create the params string
                    var params = splits.join('&');
                    //Send the ajax request
                    WPOS.loadPageContent(params);
                }
            } else {
                WPOS.goToHome();
            }
        }
    };
    var timerId;
    this.startPageLoader = function () {
        timerId = setInterval("WPOS.checkAnchor();", 300);
    };
    this.stopPageLoader = function () {
        currentAnchor = '0';
        clearInterval(timerId);
    };
    this.loadPageContent = function (query) {
        var contenturl;
        if (sec == "faq") {
            contenturl = "https://wallacepos.com/content/faq.php"
        } else {
            contenturl = "content/" + sec + ".php";
        }
        $.get(contenturl, query, function (data) {
            if (data == "AUTH") {
                WPOS.sessionExpired();
            } else {
                $("#maincontent").html(data);
            }
        }, "html");
    };
    this.goToHome = function () {
        if (curuser.isadmin == 1 || (curuser.sections.dashboard == "both" || curuser.sections.dashboard == "both")) {
            changehash("!dashboard");
        } else {
            if (curuser.sections.dashboard == "realtime") {
                changehash("!realtime");
            } else {
                // load the first allowed section
                var secval;
                for (var i in curuser.sections) {
                    debugger;
                    if (i != "access" && i != "dashboard") {
                        secval = curuser.sections[i];
                        if (secval > 0) {
                            changehash("!" + i);
                            return;
                        }
                    }
                }
            }
        }
    };
    var curuser = "";
    // authentication
    this.isLogged = function () {
        WPOS.util.showLoader();
        getLoginStatus(function (user) {
            if (user != false) {
                if (user.isadmin == 1 || (user.sections != null && user.sections.access != 'no')) {
                    curuser = user;
                    WPOS.loggeduser = user;
                    WPOS.initAdmin();
                } else {
                    swal({
                        type: 'error',
                        title: 'Oops...',
                        text: 'You do not have permission to enter this area'
                    });

                }
            }
            $('#loadingdiv').hide();
            $('#logindiv').show();
            $("#loginbutton").removeAttr('disabled', 'disabled');
            WPOS.util.hideLoader();
        });

    };

    function getLoginStatus(callback) {
        return WPOS.getJsonDataAsync("hello", callback);
    }

    var sessionTimer = null;

    function startSessionCheck() {
        if (sessionTimer == null) {
            sessionTimer = setInterval(startSessionCheck, 630000);
            return;
        }
        getLoginStatus(function (user) {
            if (user == false)
                WPOS.sessionExpired();
        });
    }

    function stopSessionCheck() {
        clearInterval(sessionTimer);
        sessionTimer = null;
    }

    function showLoginDiv(message) {
        if (message) {
            $("#login-banner-txt").text(message);
            $("#login-banner").show();
        } else {
            $("#login-banner").hide();
        }
        $('#loginmodal').show();
    }

    function hideLoginDiv() {
        $('#loginmodal').hide();
        $('#loadingdiv').hide();
        $('#logindiv').show();
        $("#loginbutton").removeAttr('disabled', 'disabled');
    }

    this.login = function () {
        WPOS.util.showLoader();
        performLogin();
    };

    function performLogin() {
        WPOS.util.showLoader();
        var loginbtn = $('#loginbutton');
        // disable login button
        $(loginbtn).attr('disabled', 'disabled');
        $(loginbtn).val('Proccessing');
        // auth is currently disabled on the php side for ease of testing. This function, however will still run and is currently used to test session handling.
        // get form values
        var userfield = $("#loguser");
        var passfield = $("#logpass");
        var username = userfield.val();
        var password = passfield.val();
        // hash password
        password = WPOS.util.SHA256(password);
        // authenticate
        WPOS.sendJsonDataAsync("auth", JSON.stringify({username: username, password: password}), function (user) {
            if (user !== false) {
                if (user.isadmin == 1 || (user.sections != null && user.sections.access != 'no')) {
                    curuser = user;
                    WPOS.initAdmin();
                } else {
                    swal({
                        type: 'error',
                        title: 'Oops...',
                        text: 'You do not have permission to enter this area'
                    });

                }
            }
            passfield.val('');
            WPOS.util.hideLoader();
            $(loginbtn).val('Login');
            $(loginbtn).removeAttr('disabled', 'disabled');
        });
    }

    this.logout = function () {
        //  var answer = confirm("Are you sure you want to logout?");

        swal({
            title: 'LogOut',
            text: "Are you sure you want to logout",
            type: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Yes, Log Out!'
        }).then(function (result) {
            if (result.value) {

                WPOS.util.showLoader();
                performLogout();
                setTimeout(
                    function () {
                        swal('Logged Out!', 'You have been succesfully logged out', 'success');
                    }, 200);

            }
        });


    };

    function performLogout() {
        WPOS.util.showLoader();
        WPOS.stopSocket();
        WPOS.stopPageLoader();
        stopSessionCheck();
        WPOS.getJsonData("logout");
        showLoginDiv();
        WPOS.util.hideLoader();
    }

    this.sessionExpired = function () {
        WPOS.stopPageLoader();
        WPOS.stopSocket();
        showLoginDiv("Your session has expired, please login again.");
        WPOS.util.hideLoader();
    };
    this.initAdmin = function () {
        // hide unallowed sections
        hidePermSections();
        // Load needed config
        fetchConfigTable();
        WPOS.startPageLoader();
        startSessionCheck();
        hideLoginDiv();
    };

    function hidePermSections() {
        // hide/show settings
        if (curuser.isadmin == 1) {
            $(".privmenuitem").show();
            return;
        } else {
            $("#menusettings").hide();
        }
        // hide/show dashboard
        var dash = $("#menudashboard");
        var real = $("#menurealtime");
        switch (curuser.sections.dashboard) {
            case "both":
                dash.show();
                real.show();
                break;
            case "standard":
                dash.show();
                real.hide();
                break;
            case "realtime":
                dash.hide();
                real.show();
                break;
            case "none":
                dash.hide();
                real.hide();
                break;
        }
        // hide/show sections
        curuser.sections.reports > 0 ? $("#menureports").show() : $("#menureports").hide();
        curuser.sections.graph > 0 ? $("#menugraph").show() : $("#menugraph").hide();
        curuser.sections.sales > 0 ? $("#menusales").show() : $("#menusales").hide();
        curuser.sections.invoices > 0 ? $("#menuinvoices").show() : $("#menuinvoices").hide();
        curuser.sections.expenses > 0 ? $("#menuexpenses").show() : $("#menuexpenses").hide();
        curuser.sections.items > 0 ? $("#menuitems").show() : $("#menuitems").hide();
        curuser.sections.stock > 0 ? $("#menustock").show() : $("#menustock").hide();
        curuser.sections.suppliers > 0 ? $("#menusuppliers").show() : $("#menusuppliers").hide();
        curuser.sections.customers > 0 ? $("#menucustomers").show() : $("#menucustomers").hide();
        // hide parent items menu if no submenu items visible
        if ((curuser.sections.items == 0 && curuser.sections.stock == 0) && (curuser.sections.suppliers == 0 && curuser.sections.customers == 0)) {
            $("#menuparentitems").hide();
        } else {
            $("#menuparentitems").show();
        }
    }

    // data handling functions
    this.getJsonData = function (action) {
        return getJsonData(action)
    };

    function getJsonData(action) {
        // send request to server
        var response = $.ajax({
            url: "/api/" + action,
            type: "GET",
            dataType: "text",
            timeout: 10000,
            cache: false,
            async: false
        });
        if (response.status == "200") {
            var json = JSON.parse(response.responseText);
            var errCode = json.errorCode;
            var err = json.error;
            if (err == "OK") {
                // echo warning if set
                if (json.hasOwnProperty('warning')) {
                    swal({
                        type: 'error',
                        title: 'Oops...',
                        text: json.warning
                    });

                }
                return json.data;
            } else {
                if (errCode == "auth") {
                    WPOS.sessionExpired();
                    return false;
                } else {
                    swal({
                        type: 'error',
                        title: 'Oops...',
                        text: err
                    });

                    return false;
                }
            }
        }
        swal({
            type: 'error',
            title: 'Oops...',
            text: "There was an error connecting to the server: \n" + response.statusText
        });

        return false;
    }

    this.getJsonDataAsync = function (action, callback) {
        // send request to server
        try {
            $.ajax({
                url: "/api/" + action,
                type: "GET",
                dataType: "json",
                timeout: 10000,
                cache: false,
                success: function (json) {
                    var errCode = json.errorCode;
                    var err = json.error;
                    if (err == "OK") {
                        // echo warning if set
                        if (json.hasOwnProperty('warning')) {
                            swal({
                                type: 'error',
                                title: 'Oops...',
                                text: json.warning
                            });

                        }
                        if (callback)
                            callback(json.data);
                    } else {
                        if (errCode == "auth") {
                            WPOS.sessionExpired();
                            return false;
                        }
                        swal({
                            type: 'error',
                            title: 'Oops...',
                            text: err
                        });

                        if (callback)
                            callback(false);
                    }
                },
                error: function (jqXHR, status, error) {
                    swal({
                        type: 'error',
                        title: 'Oops...',
                        text: error
                    });

                    if (callback)
                        callback(false);
                }
            });
        } catch (ex) {
            swal({
                type: 'error',
                title: 'Oops...',
                text: "Exception: " + ex
            });

            if (callback)
                callback(false);
        }
    };

    this.sendJsonData = function (action, data) {
        // send request to server
        var response = $.ajax({
            url: "/api/" + action,
            type: "POST",
            data: {data: data},
            dataType: "text",
            timeout: 10000,
            cache: false,
            async: false
        });
        if (response.status == "200") {
            var json = JSON.parse(response.responseText);
            if (json == null) {
                swal({
                    type: 'error',
                    title: 'Oops...',
                    text: "Error: The response that was returned from the server could not be parsed!"
                });

                return false;
            }
            var errCode = json.errorCode;
            var err = json.error;
            if (err == "OK") {
                // echo warning if set
                if (json.hasOwnProperty('warning')) {
                    swal({
                        type: 'error',
                        title: 'Oops...',
                        text: json.warning
                    });

                }
                return json.data;
            } else {
                if (errCode == "auth") {
                    WPOS.sessionExpired();
                    return false;
                } else {
                    swal({
                        type: 'error',
                        title: 'Oops...',
                        text: err
                    });

                    return false;
                }
            }
        }
        swal({
            type: 'error',
            title: 'Oops...',
            text: "There was an error connecting to the server: \n" + response.statusText
        });

        return false;
    };

    this.sendJsonDataAsync = function (action, data, callback, errorCallback) {
        // send request to server
        try {
            $.ajax({
                url: "/api/" + action,
                type: "POST",
                data: {data: data},
                dataType: "json",
                timeout: 10000,
                cache: false,
                success: function (json) {
                    var errCode = json.errorCode;
                    var err = json.error;
                    if (err == "OK") {
                        // echo warning if set
                        if (json.hasOwnProperty('warning')) {
                            swal({
                                type: 'error',
                                title: 'Oops...',
                                text: json.warning
                            });

                        }
                        callback(json.data);
                    } else {
                        if (errCode == "auth") {
                            WPOS.sessionExpired();
                        } else {
                            if (typeof errorCallback == "function")
                                return errorCallback(json.error);
                            swal({
                                type: 'error',
                                title: 'Oops...',
                                text: err
                            });

                        }
                        callback(false);
                    }
                },
                error: function (jqXHR, status, error) {
                    if (typeof errorCallback == "function")
                        return errorCallback(error);

                    swal({
                        type: 'error',
                        title: 'Oops...',
                        text: error
                    });

                    callback(false);
                }
            });
            return true;
        } catch (ex) {
            if (typeof errorCallback == "function")
                return errorCallback(error.message);

            swal({
                type: 'error',
                title: 'Oops...',
                text: ex.message
            });

            callback(false);
            return false;
        }
    };

    this.uploadFile = function (event, callback) {
        event.stopPropagation(); // Stop stuff happening
        event.preventDefault(); // Totally stop stuff happening
        WPOS.util.showLoader();
        var files = event.target.files;
        // Create a formdata object and add the files
        var fd = new FormData();
        fd.append("file", files[0]);
        $.ajax({
            url: '/api/file/upload',
            type: 'POST',
            data: fd,
            cache: false,
            dataType: 'json',
            processData: false, // Don't process the files
            contentType: false, // Set content type to false as jQuery will tell the server its a query string request
            success: function (data, textStatus, jqXHR) {
                var errCode = data.errorCode;
                var err = data.error;
                if (err == 'OK') {
                    // Success so call function to process the form
                    callback(data.data);
                } else {
                    if (errCode == "auth") {
                        WPOS.sessionExpired();
                        return false;
                    } else {
                        swal({
                            type: 'error',
                            title: 'Oops...',
                            text: err
                        });

                        return false;
                    }
                }
                // hide loader
                WPOS.util.hideLoader();
                return true;
            },
            error: function (jqXHR, textStatus, errorThrown) {
                // Handle errors here
                swal({
                    type: 'error',
                    title: 'Oops...',
                    text: "There was an error connecting to the server: \n" + response.statusText
                });

                // hide loader
                WPOS.util.hideLoader();
            }
        });
    };

    // function for event source processes
    this.startEventSourceProcess = function (url, dataCallback, errorCallback) {
        if (typeof (EventSource) === "undefined") {
            swal({
                type: 'error',
                title: 'Oops...',
                text: "Your browser does not support EventSource, please update your browser to continue."
            });

            return;
        }
        showModalLoader();
        var jsonStream = new EventSource(url);
        jsonStream.onmessage = function (e) {
            var message = JSON.parse(e.data);
            if (message.hasOwnProperty('error') || message.hasOwnProperty('result'))
                jsonStream.close();

            if (typeof dataCallback == "function")
                dataCallback(message);
        };
        jsonStream.onerror = function (e) {
            jsonStream.close();
            console.log("Stream closed on error");
            if (typeof errorCallback == "function")
                errorCallback(e);
        }
    };

    // socket control
    // Websocket updates & commands
    var socket = null;
    var socketon = false;
    var authretry = false;
    this.startSocket = function () {
        if (socket === null) {
            var proxy = this.getConfigTable().general.feedserver_proxy;
            var port = this.getConfigTable().general.feedserver_port;
            var socketPath = window.location.protocol + '//' + window.location.hostname + (proxy == false ? ':' + port : '');
            socket = io.connect(socketPath);
            socketon = true;
            socket.on('connect_error', socketError);
            socket.on('reconnect_error', socketError);
            socket.on('error', socketError);

            socket.on('updates', function (data) {
                switch (data.a) {
                    case "devices":
                        onlinedev = JSON.parse(data.data);
                        populateOnlineDevices(onlinedev);
                        break;

                    case "sale":
                        //alert(data.data);
                        processIncomingSale(data.data);
                        break;

                    case "regreq":
                        socket.emit('reg', {deviceid: 0, username: curuser.username});
                        break;

                    case "config":
                        if (data.type == "deviceconfig") {
                            if (data.data.hasOwnProperty('a')) {
                                if (data.data.a == "removed")
                                    delete WPOS.devices[data.id];
                            } else {
                                WPOS.devices[data.data.id] = data.data;
                                WPOS.locations[data.data.locationid] = {name: data.data.locationname};
                            }
                        }
                        break;

                    case "error":
                        if (!authretry && data.data.hasOwnProperty('code') && data.data.code == "auth") {
                            authretry = true;
                            WPOS.stopSocket();
                            var result = WPOS.getJsonData('auth/websocket');
                            if (result === true) {
                                WPOS.startSocket();
                                return;
                            }
                        }
                        swal({
                            type: 'error',
                            title: 'Oops...',
                            text: data.data.message
                        });

                        break;
                }
                //alert(data.a);
            });
        } else {
            // This should never happen, kept for historic purposes
            socket.connect();
        }
    };

    function socketError() {
        if (socketon) // A fix for mod_proxy_wstunnel causing error on disconnect
            swal({
                type: 'error',
                title: 'Oops...',
                text: "Update feed could not be connected, \nyou will not receive realtime updates!"
            });

        socketon = false;
        authretry = false;
        //socket = null;
    }

    this.stopSocket = function () {
        if (socket !== null) {
            socketon = false;
            authretry = false;
            socket.disconnect();
            socket = null;
        }
    };

    window.onbeforeunload = function () {
        socketon = false;
    };

    // data & config
    var configtable;

    this.devices = null;
    this.locations = null;
    this.users = null;

    function fetchConfigTable() {
        configtable = getJsonData("adminconfig/get");
        WPOS.devices = configtable.devices;
        WPOS.locations = configtable.locations;
        WPOS.users = configtable.users;
    }

    this.getConfigTable = function () {
        if (configtable == null) {
            return false;
        }
        return configtable;
    };

    this.setConfigSet = function (key, data) {
        configtable[key] = data;
    };

    this.getTaxTable = function () {
        if (configtable == null) {
            return false;
        }
        return configtable.tax;
    };

    this.putTaxTable = function (taxtable) {
        configtable.tax = taxtable;
        this.transactions.refreshTaxSelects();
    };

    this.updateConfig = function (key, data) {
        key = key.split("~");
        switch (key.length) {
            case 1:
                configtable[key[0]] = data;
                return;
            case 2:
                configtable[key[0]][key[1]] = data;
                return;
            case 3:
                configtable[key[0]][key[1]][key[2]] = data;
                return;
        }
    };

    // CSV export functions
    this.initSave = function (filename, data) {
        var dlelem = $('#dlelem');
        dlelem.attr('href', 'data:text/csv;charset=utf8,' + encodeURIComponent(data)).attr('download', filename + '.csv');
        $('#dlemem').ready(function () {
            $('#dlelem').get(0).click();
        });
    };

    this.table2CSV = function (el) {

        var csvData = [];

        //header
        var tmpRow = []; // construct header avalible array

        $(el).find('th').each(function () {
            if (!$(this).hasClass('noexport')) tmpRow[tmpRow.length] = formatData($(this).html());
        });

        row2CSV(tmpRow);

        // actual data
        $(el).find('tr').each(function () {
            var tmpRow = [];
            $(this).find('td').each(function () {
                if (!$(this).hasClass('noexport')) tmpRow[tmpRow.length] = formatData($(this).text());
            });
            tmpRow = row2CSV(tmpRow);
            if (tmpRow != null)
                csvData[csvData.length] = tmpRow;
        });

        return csvData.join('\n');
    };

    this.data2CSV = function (headers, fields, data) {

        var csvData = [];

        //header
        csvData[csvData.length] = row2CSV(headers);

        for (var i in data) {
            if (data.hasOwnProperty(i)) {
                var record = data[i];
                var tmpRow = [];
                for (var x = 0; x < fields.length; x++) {
                    var key = fields[x];
                    if (typeof key === 'object') {
                        tmpRow[tmpRow.length] = formatData(key.func(record[key.key], record));
                    } else {
                        if (record.hasOwnProperty(key)) {
                            tmpRow[tmpRow.length] = formatData(record[key]);
                        } else {
                            tmpRow[tmpRow.length] = '';
                        }
                    }
                }
                tmpRow = row2CSV(tmpRow);
                if (tmpRow != null)
                    csvData[csvData.length] = tmpRow;
            }
        }

        return csvData.join('\n');

    };

    function row2CSV(tmpRow) {
        var tmp = tmpRow.join(''); // to remove any blank rows
        // alert(tmp);
        if (tmpRow.length > 0 && tmp != '') {
            return tmpRow.join(",");
        }
        return null;
    }

    function formatData(input) {
        if (typeof input === 'number')
            return input;

        if (typeof input === 'object')
            input = JSON.stringify(input);
        // replace " with â€œ
        var regexp = new RegExp(/["]/g);
        var output = input.replace(regexp, '""');
        //HTML
        regexp = new RegExp(/\<[^\<]+\>/g);
        output = output.replace(regexp, "");
        if (output == "") return '';
        return '"' + output + '"';
    }


    // Print init
    // Local Config
    this.setLocalConfigValue = function (key, value) {
        setLocalConfigValue(key, value);
    };

    this.getLocalConfig = function () {
        return getLocalConfig();
    };

    function getLocalConfig() {
        var lconfig = localStorage.getItem("wpos_lconfig");
        if (lconfig == null || lconfig == undefined) {
            // put default config here.
            var defcon = {
                keypad: true,
                bank: {
                    enabled: false,
                    receipts: true,
                    provider: 'tyro',
                    merchrec: 'ask',
                    custrec: 'ask'
                }
            };
            updateLocalConfig(defcon);
            return defcon;
        }
        return JSON.parse(lconfig);
    }

    function setLocalConfigValue(key, value) {
        var data = localStorage.getItem("wpos_lconfig");
        if (data == null) {
            data = {};
        } else {
            data = JSON.parse(data);
        }
        data[key] = value;
        updateLocalConfig(data);
        if (key == "keypad") {
            setKeypad(false);
        }
    }

    function updateLocalConfig(configobj) {
        localStorage.setItem("wpos_lconfig", JSON.stringify(configobj));
    }

    var configtable;

    this.getConfigTable = function () {
        if (configtable == null) {
            loadConfigTable();
        }
        return configtable;
    };

    this.refreshConfigTable = function () {
        fetchConfigTable2();
    };

    this.isOrderTerminal = function () {
        if (configtable == null) {
            loadConfigTable();
        }
        return configtable.hasOwnProperty('deviceconfig') && configtable.deviceconfig.type == "order_register";
    };

    /**
     * Fetch device settings from the server using UUID
     * @return boolean
     */
    function fetchConfigTable2(callback) {
        var data = {};
        data.uuid = getDeviceUUID();
        return WPOS.sendJsonDataAsync("config/get", JSON.stringify(data), function (data) {
            if (data) {
                //console.log(data);
                if (data == "removed" || data == "disabled") { // return false if dev is disabled
                    if (data == "removed")
                        removeDeviceUUID();
                    if (callback) {
                        callback(false);
                        return;
                    }
                } else {
                    configtable = data;
                    localStorage.setItem("wpos_config", JSON.stringify(data));
                    setAppCustomization();
                }
            }
            if (callback)
                callback(data);
        });
    }

    function loadConfigTable() {
        var data = localStorage.getItem("wpos_config");
        if (data != null) {
            configtable = JSON.parse(data);
            return true;
        }
        configtable = {};
        return false;
    }

    function updateConfig(key, data) {
        console.log("Processing config (" + key + ") update");
        //console.log(data);

        if (key == 'item_categories')
            return updateCategory(data);

        if (key == "deviceconfig") {
            if (data.id == configtable.deviceid) {
                if (data.hasOwnProperty('a') && (data.a == "removed" || data.a == "disabled")) {
                    // device removed
                    if (data.a == "removed")
                        removeDeviceUUID();
                    logout();

                    swal({
                        type: 'error',
                        title: 'Oops...',
                        text: 'This device has been " + data.a + " by the administrator,\ncontact your device administrator for help.'
                    });

                    return;
                }
                // update root level config values
                configtable.devicename = data.name;
                configtable.locationname = data.locationname;
                populateDeviceInfo();
            } else {
                if (data.data.hasOwnProperty('a')) {
                    if (data.data.a == "removed")
                        delete configtable.devices[data.id];
                } else {
                    configtable.devices[data.id] = data;
                    configtable.locations[data.locationid] = {name: data.locationname};
                }
                return;
            }
        }

        configtable[key] = data; // write to current data
        localStorage.setItem("wpos_config", JSON.stringify(configtable));
        setAppCustomization();
    }

    function updateCategory(value) {
        if (typeof value === 'object') {
            configtable.item_categories[value.id] = value;
        } else {
            if (typeof value === 'string') {
                var ids = value.split(",");
                for (var i = 0; i < ids.length; i++) {
                    delete configtable.item_categories[ids[i]];
                }
            } else {
                delete configtable.item_categories[value];
            }
        }
        WPOS.items.generateItemGridCategories();
        localStorage.setItem("wpos_config", JSON.stringify(configtable));
    }

    /**
     * Returns the current devices UUID
     * @returns {String, Null} String if set, null if not
     */
    function getDeviceUUID() {
        // return the devices uuid; if null, the device has not been setup or local storage was cleared
        return localStorage.getItem("wpos_devuuid");
    }

    function setAppCustomization() {
        // initialize terminal mode (kitchen order views)
        if (configtable.hasOwnProperty('deviceconfig') && configtable.deviceconfig.type == "order_register") {
            $(".order_terminal_options").show();
            WPOS.sales.resetSalesForm();
        } else {
            $(".order_terminal_options").hide();
            $("#itemtable .order_row").remove(); // clears order row already in html
        }
        // setup checkout watermark
        var url = WPOS.getConfigTable().general.bizlogo;
        $("#watermark").css("background-image", "url('" + url + "')");
    }

    // Load globally accessable objects
    this.util = new WPOSUtil();
    this.transactions = new WPOSTransactions();
    this.customers = new WPOSCustomers();
    this.print = new WPOSPrint();
}