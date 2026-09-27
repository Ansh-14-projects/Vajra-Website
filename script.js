/* =========================================================
   VAJRA WEB BLUETOOTH CONTROL SYSTEM
   ANSH'S DRONE 🚁⚡

   BLE:
   Service = 12345678-1234-1234-1234-1234567890ab
   RX      = 12345678-1234-1234-1234-1234567890ac
   TX      = 12345678-1234-1234-1234-1234567890ad
========================================================= */


/* =========================================================
   BLE UUIDS
========================================================= */

const SERVICE_UUID =
    "12345678-1234-1234-1234-1234567890ab";

const RX_UUID =
    "12345678-1234-1234-1234-1234567890ac";

const TX_UUID =
    "12345678-1234-1234-1234-1234567890ad";


/* =========================================================
   BLE VARIABLES
========================================================= */

let bleDevice = null;
let bleServer = null;
let bleService = null;

let rxCharacteristic = null;
let txCharacteristic = null;

let bleConnected = false;

const encoder = new TextEncoder();
const decoder = new TextDecoder();


/* =========================================================
   FLIGHT STATE
========================================================= */

let armed = false;

let motors = {
    M1: 900,
    M2: 900,
    M3: 900,
    M4: 900
};

let telemetry = {
    roll: 0,
    pitch: 0,
    gyroX: 0,
    gyroY: 0,
    gyroZ: 0,
    battery: 11.1
};


/* =========================================================
   DOM
========================================================= */

const loginPage =
    document.getElementById("loginPage");

const app =
    document.getElementById("app");

const loginButton =
    document.getElementById("loginButton");

const loginError =
    document.getElementById("loginError");

const username =
    document.getElementById("username");

const password =
    document.getElementById("password");

const connectBleButton =
    document.getElementById("connectBleButton");

const disconnectBleButton =
    document.getElementById("disconnectBleButton");

const logoutButton =
    document.getElementById("logoutButton");

const bleBadge =
    document.getElementById("bleBadge");

const armedBadge =
    document.getElementById("armedBadge");

const armButton =
    document.getElementById("armButton");

const stopButton =
    document.getElementById("stopButton");

const systemIndicator =
    document.getElementById("systemIndicator");

const logContainer =
    document.getElementById("logContainer");

const clearLogsButton =
    document.getElementById("clearLogsButton");


/* =========================================================
   LOGIN
========================================================= */

loginButton.addEventListener("click", login);

password.addEventListener("keydown", function(event) {

    if (event.key === "Enter") {
        login();
    }

});


username.addEventListener("keydown", function(event) {

    if (event.key === "Enter") {
        login();
    }

});


function login() {

    const user =
        username.value.trim();

    const pass =
        password.value.trim();


    if (user === "VAJRA" && pass === "VAJRA") {

        loginPage.classList.add("hidden");

        app.classList.remove("hidden");

        addLog(
            "AUTH",
            "VAJRA operator authentication successful"
        );

        systemIndicator.textContent =
            "SYSTEM READY";

        startSimulation();

    } else {

        loginError.textContent =
            "INVALID OPERATOR ID OR ACCESS KEY";

    }

}


/* =========================================================
   NAVIGATION
========================================================= */

const navButtons =
    document.querySelectorAll(".nav-button");

const views =
    document.querySelectorAll(".view");


navButtons.forEach(button => {

    button.addEventListener("click", function() {

        const target =
            button.dataset.view;

        navButtons.forEach(btn => {
            btn.classList.remove("active");
        });

        button.classList.add("active");

        views.forEach(view => {
            view.classList.remove("active-view");
        });

        const targetView =
            document.getElementById(target);

        if (targetView) {
            targetView.classList.add("active-view");
        }

        if (target === "telemetry") {
            resizeChart();
        }

    });

});


/* =========================================================
   LOGGING
========================================================= */

function addLog(type, message) {

    if (!logContainer) {
        return;
    }

    const entry =
        document.createElement("div");

    entry.className =
        "log-entry";

    const time =
        new Date().toLocaleTimeString();

    entry.innerHTML = `
        <span class="log-time">${time}</span>
        <span class="log-type">${escapeHtml(type)}</span>
        <span class="log-message">${escapeHtml(message)}</span>
    `;

    logContainer.prepend(entry);

}


function escapeHtml(value) {

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

}


clearLogsButton.addEventListener("click", function() {

    logContainer.innerHTML = "";

    addLog(
        "SYSTEM",
        "Log buffer cleared"
    );

});


/* =========================================================
   BLE SUPPORT CHECK
========================================================= */

async function checkBluetoothSupport() {

    if (!window.isSecureContext) {

        addLog(
            "BLE ERROR",
            "Website is not running in a secure context"
        );

        systemIndicator.textContent =
            "HTTPS REQUIRED";

        return false;
    }


    if (!navigator.bluetooth) {

        addLog(
            "BLE ERROR",
            "Web Bluetooth is not supported by this browser"
        );

        systemIndicator.textContent =
            "BLE UNSUPPORTED";

        return false;
    }


    try {

        if (navigator.bluetooth.getAvailability) {

            const available =
                await navigator.bluetooth.getAvailability();

            if (!available) {

                addLog(
                    "BLE ERROR",
                    "Bluetooth is unavailable on this device/browser"
                );

                systemIndicator.textContent =
                    "BLUETOOTH UNAVAILABLE";

                return false;
            }

        }

    } catch (error) {

        addLog(
            "BLE",
            "Could not determine Bluetooth availability"
        );

    }


    return true;
}


/* =========================================================
   CONNECT BLE
========================================================= */

connectBleButton.addEventListener(
    "click",
    connectBLE
);


async function connectBLE() {

    addLog(
        "BLE",
        "CONNECT BLE button pressed"
    );

    systemIndicator.textContent =
        "OPENING BLUETOOTH...";


    const supported =
        await checkBluetoothSupport();

    if (!supported) {

        alert(
            "Web Bluetooth is unavailable.\n\n" +
            "Use a supported browser such as Chrome or Edge " +
            "and open the website using HTTPS."
        );

        return;
    }


    try {

        addLog(
            "BLE",
            "Opening Bluetooth device chooser..."
        );


        /*
         * IMPORTANT:
         * This call is directly inside the button
         * event chain so the browser keeps the
         * required user activation.
         */

        bleDevice =
            await navigator.bluetooth.requestDevice({

                filters: [
                    {
                        name: "Ansh's Drone VAJRA 🚁⚡"
                    },
                    {
                        namePrefix: "VAJRA"
                    }
                ],

                optionalServices: [
                    SERVICE_UUID
                ]

            });


        if (!bleDevice) {

            throw new Error(
                "No Bluetooth device selected"
            );
        }


        addLog(
            "BLE",
            "Selected device: " +
            (bleDevice.name || "Unknown")
        );


        bleDevice.addEventListener(
            "gattserverdisconnected",
            handleBLEDisconnected
        );


        systemIndicator.textContent =
            "CONNECTING GATT...";


        addLog(
            "BLE",
            "Connecting to GATT server..."
        );


        if (!bleDevice.gatt) {

            throw new Error(
                "This Bluetooth device does not expose GATT"
            );
        }


        bleServer =
            await bleDevice.gatt.connect();


        addLog(
            "BLE",
            "GATT connection established"
        );


        bleService =
            await bleServer.getPrimaryService(
                SERVICE_UUID
            );


        addLog(
            "BLE",
            "VAJRA service found"
        );


        rxCharacteristic =
            await bleService.getCharacteristic(
                RX_UUID
            );


        txCharacteristic =
            await bleService.getCharacteristic(
                TX_UUID
            );


        addLog(
            "BLE",
            "RX and TX characteristics found"
        );


        /*
         * TX is ESP32 → website.
         */

        await txCharacteristic.startNotifications();


        txCharacteristic.addEventListener(
            "characteristicvaluechanged",
            handleBLENotification
        );


        addLog(
            "BLE",
            "Telemetry notifications enabled"
        );


        bleConnected = true;

        updateBLEUI();


        systemIndicator.textContent =
            "VAJRA BLE CONNECTED";


        addLog(
            "BLE",
            "VAJRA connected successfully"
        );


        /*
         * Tell ESP32 that the website is ready.
         */

        await sendCommand(
            "VAJRA:HELLO"
        );


    } catch (error) {

        console.error(
            "VAJRA BLE ERROR:",
            error
        );


        bleConnected = false;

        updateBLEUI();


        systemIndicator.textContent =
            "BLE CONNECTION FAILED";


        addLog(
            "BLE ERROR",
            getBLEErrorMessage(error)
        );


        /*
         * Do not show an ugly browser error.
         * Give the user a useful message.
         */

        alert(
            "VAJRA BLE CONNECTION FAILED\n\n" +
            getBLEErrorMessage(error)
        );

    }

}


/* =========================================================
   BLE ERROR MESSAGE
========================================================= */

function getBLEErrorMessage(error) {

    if (!error) {
        return "Unknown Bluetooth error";
    }


    if (error.name === "NotFoundError") {

        return (
            "No VAJRA device was selected.\n" +
            "Make sure the ESP32-C3 is powered and advertising."
        );

    }


    if (error.name === "SecurityError") {

        return (
            "Bluetooth permission was blocked.\n" +
            "Check browser permissions and HTTPS."
        );

    }


    if (error.name === "NetworkError") {

        return (
            "Could not connect to the VAJRA GATT server.\n" +
            "Make sure the ESP32-C3 is powered."
        );

    }


    if (error.name === "NotSupportedError") {

        return (
            "This browser/device does not support the required BLE feature."
        );

    }


    return (
        error.message ||
        error.name ||
        "Unknown Bluetooth error"
    );

}


/* =========================================================
   DISCONNECT
========================================================= */

disconnectBleButton.addEventListener(
    "click",
    disconnectBLE
);


async function disconnectBLE() {

    try {

        if (
            bleDevice &&
            bleDevice.gatt &&
            bleDevice.gatt.connected
        ) {

            bleDevice.gatt.disconnect();

        }

    } catch (error) {

        console.error(error);

    }


    bleConnected = false;

    rxCharacteristic = null;
    txCharacteristic = null;
    bleService = null;
    bleServer = null;

    updateBLEUI();


    systemIndicator.textContent =
        "BLE DISCONNECTED";


    addLog(
        "BLE",
        "VAJRA BLE disconnected"
    );

}


/* =========================================================
   BLE DISCONNECTED EVENT
========================================================= */

function handleBLEDisconnected() {

    bleConnected = false;

    rxCharacteristic = null;
    txCharacteristic = null;
    bleService = null;
    bleServer = null;

    updateBLEUI();


    systemIndicator.textContent =
        "BLE DISCONNECTED";


    addLog(
        "BLE",
        "VAJRA device disconnected"
    );


    /*
     * Always return motors to safe website state.
     */

    forceStopMotors();

}


/* =========================================================
   BLE UI
========================================================= */

function updateBLEUI() {

    if (bleConnected) {

        bleBadge.textContent =
            "● BLE CONNECTED";

        bleBadge.classList.remove(
            "disconnected"
        );

        bleBadge.classList.add(
            "connected"
        );


        connectBleButton.classList.add(
            "hidden"
        );

        disconnectBleButton.classList.remove(
            "hidden"
        );

    } else {

        bleBadge.textContent =
            "● BLE OFFLINE";

        bleBadge.classList.remove(
            "connected"
        );

        bleBadge.classList.add(
            "disconnected"
        );


        connectBleButton.classList.remove(
            "hidden"
        );

        disconnectBleButton.classList.add(
            "hidden"
        );

    }

}


/* =========================================================
   BLE SEND
========================================================= */

async function sendCommand(command) {

    addLog(
        "TX",
        command
    );


    if (!bleConnected) {

        addLog(
            "TX",
            "BLE offline - command not transmitted"
        );

        return false;
    }


    if (!rxCharacteristic) {

        addLog(
            "BLE ERROR",
            "RX characteristic is unavailable"
        );

        return false;
    }


    try {

        const data =
            encoder.encode(command + "\n");


        if (
            rxCharacteristic.properties &&
            rxCharacteristic.properties.writeWithoutResponse
        ) {

            await rxCharacteristic.writeValueWithoutResponse(
                data
            );

        } else {

            await rxCharacteristic.writeValue(
                data
            );

        }


        return true;

    } catch (error) {

        console.error(
            "BLE WRITE ERROR:",
            error
        );


        addLog(
            "BLE ERROR",
            "TX failed: " +
            (error.message || error)
        );


        return false;
    }

}


/* =========================================================
   BLE NOTIFICATION
========================================================= */

function handleBLENotification(event) {

    try {

        const text =
            decoder.decode(event.target.value);


        const lines =
            text.split(/\r?\n/);


        lines.forEach(line => {

            const message =
                line.trim();


            if (!message) {
                return;
            }


            addLog(
                "RX",
                message
            );


            parseTelemetry(message);

        });


    } catch (error) {

        console.error(
            "Notification parsing error:",
            error
        );

    }

}


/* =========================================================
   TELEMETRY PARSER
========================================================= */

/*
Expected ESP32 message:

TEL,ROLL,PITCH,GX,GY,GZ,BATTERY

Example:

TEL,2.30,-1.20,0.04,-0.02,0.10,11.35
*/

function parseTelemetry(message) {

    if (!message.startsWith("TEL,")) {
        return;
    }


    const parts =
        message.split(",");


    if (parts.length < 7) {
        return;
    }


    const roll =
        Number(parts[1]);

    const pitch =
        Number(parts[2]);

    const gx =
        Number(parts[3]);

    const gy =
        Number(parts[4]);

    const gz =
        Number(parts[5]);

    const battery =
        Number(parts[6]);


    if (!Number.isNaN(roll)) {
        telemetry.roll = roll;
    }

    if (!Number.isNaN(pitch)) {
        telemetry.pitch = pitch;
    }

    if (!Number.isNaN(gx)) {
        telemetry.gyroX = gx;
    }

    if (!Number.isNaN(gy)) {
        telemetry.gyroY = gy;
    }

    if (!Number.isNaN(gz)) {
        telemetry.gyroZ = gz;
    }

    if (!Number.isNaN(battery)) {
        telemetry.battery = battery;
    }


    updateTelemetryUI();

}


/* =========================================================
   TELEMETRY UI
========================================================= */

function updateTelemetryUI() {

    document.getElementById(
        "rollValue"
    ).textContent =
        telemetry.roll.toFixed(1) + "°";


    document.getElementById(
        "pitchValue"
    ).textContent =
        telemetry.pitch.toFixed(1) + "°";


    document.getElementById(
        "telemetryRoll"
    ).textContent =
        telemetry.roll.toFixed(1) + "°";


    document.getElementById(
        "telemetryPitch"
    ).textContent =
        telemetry.pitch.toFixed(1) + "°";


    document.getElementById(
        "gyroX"
    ).textContent =
        telemetry.gyroX.toFixed(2);


    document.getElementById(
        "gyroY"
    ).textContent =
        telemetry.gyroY.toFixed(2);


    document.getElementById(
        "gyroZ"
    ).textContent =
        telemetry.gyroZ.toFixed(2);


    document.getElementById(
        "batteryValue"
    ).textContent =
        telemetry.battery.toFixed(2) + " V";


    document.getElementById(
        "rollPid"
    ).textContent =
        telemetry.roll.toFixed(2);


    document.getElementById(
        "pitchPid"
    ).textContent =
        telemetry.pitch.toFixed(2);


    /*
     * Rotate artificial horizon.
     */

    const horizon =
        document.getElementById("horizon");


    horizon.style.transform =
        `rotate(${-telemetry.roll}deg) translateY(${telemetry.pitch * 2}px)`;


    addChartPoint(
        telemetry.roll,
        telemetry.pitch
    );

}


/* =========================================================
   ARM / DISARM
========================================================= */

armButton.addEventListener(
    "click",
    toggleArm
);


async function toggleArm() {

    if (!armed) {

        /*
         * IMPORTANT:
         * Website does NOT directly control
         * motors. ESP32 must implement the
         * actual safety logic.
         */

        const success =
            await sendCommand(
                "VAJRA:START"
            );


        if (success || !bleConnected) {

            armed = true;

            armedBadge.textContent =
                "● ARMED";

            armedBadge.classList.remove(
                "disarmed"
            );

            armedBadge.classList.add(
                "armed"
            );

            armButton.textContent =
                "DISARM";

            addLog(
                "FLIGHT",
                "ARM / START command issued"
            );

        }

    } else {

        await sendCommand(
            "VAJRA:STOP"
        );


        armed = false;

        armedBadge.textContent =
            "● DISARMED";

        armedBadge.cla
