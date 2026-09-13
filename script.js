/* =========================================================
   VAJRA WEBSITE JAVASCRIPT
   ========================================================= */


/* ================= LOGIN ================= */

function login() {

    const username =
        document.getElementById("username").value.trim();

    const password =
        document.getElementById("password").value;

    const message =
        document.getElementById("loginMessage");


    if (username === "VAJRA" && password === "VAJRA") {

        document.getElementById("loginPage")
            .classList.add("hidden");

        document.getElementById("dashboardPage")
            .classList.remove("hidden");

        addLog("Login successful.");

    } else {

        message.textContent =
            "INVALID USERNAME OR PASSWORD";

    }
}


function logout() {

    disconnectBLE();

    document.getElementById("dashboardPage")
        .classList.add("hidden");

    document.getElementById("loginPage")
        .classList.remove("hidden");

    document.getElementById("username").value = "";
    document.getElementById("password").value = "";
    document.getElementById("loginMessage").textContent = "";
}


/* ================= NAVIGATION ================= */

function showSection(sectionId) {

    const sections =
        document.querySelectorAll(".section");

    sections.forEach(section => {
        section.classList.remove("active-section");
    });

    document.getElementById(sectionId)
        .classList.add("active-section");
}


/* ================= BLE ================= */

const SERVICE_UUID =
    "12345678-1234-1234-1234-1234567890ab";

const RX_UUID =
    "12345678-1234-1234-1234-1234567890ac";

const TX_UUID =
    "12345678-1234-1234-1234-1234567890ad";


let bluetoothDevice = null;
let rxCharacteristic = null;
let txCharacteristic = null;


async function connectBLE() {

    try {

        if (!navigator.bluetooth) {

            alert(
                "Web Bluetooth is not supported in this browser."
            );

            return;
        }


        addLog("Opening Bluetooth device chooser...");


        bluetoothDevice =
            await navigator.bluetooth.requestDevice({

                acceptAllDevices: true,

                optionalServices: [
                    SERVICE_UUID
                ]

            });


        addLog(
            "Selected device: " +
            bluetoothDevice.name
        );


        bluetoothDevice.addEventListener(
            "gattserverdisconnected",
            onBLEDisconnected
        );


        const server =
            await bluetoothDevice.gatt.connect();


        addLog("BLE GATT connected.");


        const service =
            await server.getPrimaryService(SERVICE_UUID);


        rxCharacteristic =
            await service.getCharacteristic(RX_UUID);


        txCharacteristic =
            await service.getCharacteristic(TX_UUID);


        await txCharacteristic.startNotifications();


        txCharacteristic.addEventListener(
            "characteristicvaluechanged",
            handleBLEData
        );


        setBLEStatus(true);

        addLog("VAJRA connected successfully.");

    } catch (error) {

        console.error(error);

        addLog(
            "BLE connection error: " +
            error.message
        );

        setBLEStatus(false);
    }
}


function onBLEDisconnected() {

    addLog("VAJRA BLE disconnected.");

    rxCharacteristic = null;
    txCharacteristic = null;

    setBLEStatus(false);
}


function disconnectBLE() {

    try {

        if (bluetoothDevice &&
            bluetoothDevice.gatt.connected) {

            bluetoothDevice.gatt.disconnect();
        }

    } catch (error) {

        console.error(error);
    }


    rxCharacteristic = null;
    txCharacteristic = null;

    setBLEStatus(false);
}


function setBLEStatus(connected) {

    const status =
        document.getElementById("bleStatus");

    if (connected) {

        status.className =
            "status connected";

        status.innerHTML =
            '<span class="status-dot"></span>CONNECTED';

    } else {

        status.className =
            "status disconnected";

        status.innerHTML =
            '<span class="status-dot"></span>DISCONNECTED';
    }
}


/* ================= BLE SEND ================= */

async function sendCommand(command) {

    addLog("TX → " + command);


    if (!rxCharacteristic) {

        addLog("Not connected to VAJRA.");

        return;
    }


    try {

        const encoder =
            new TextEncoder();

        const data =
            encoder.encode(command);


        await rxCharacteristic.writeValue(data);

    } catch (error) {

        addLog(
            "TX error: " +
            error.message
        );

    }
}


/* ================= START / STOP ================= */

async function stopAll() {

    await sendCommand("VAJRA:STOP");

    resetAllJoysticks();

    [1, 2, 3, 4].forEach(number => {

        const slider =
            document.getElementById(
                "m" + number + "Slider"
            );

        slider.value = 900;

        motorSliderChanged(number);

    });
}


/* ================= MOTOR CONTROL ================= */

function motorSliderChanged(number) {

    const slider =
        document.getElementById(
            "m" + number + "Slider"
        );

    const valueElement =
        document.getElementById(
            "m" + number + "Value"
        );


    valueElement.textContent =
        slider.value + " µs";
}


async function sendMotor(number) {

    const slider =
        document.getElementById(
            "m" + number + "Slider"
        );


    const value =
        Number(slider.value);


    await sendCommand(
        "VAJRA:M" +
        number +
        " " +
        value +
        "us"
    );
}


/* ================= JOYSTICKS ================= */

let joystickState = {

    throttle: 0,
    yaw: 0,
    pitch: 0,
    roll: 0

};


let joystickTimer = null;


function setupJoystick(
    joystickId,
    stickId,
    type
) {

    const joystick =
        document.getElementById(joystickId);

    const stick =
        document.getElementById(stickId);


    let active = false;


    function move(clientX, clientY) {

        const rect =
            joystick.getBoundingClientRect();


        const centerX =
            rect.left + rect.width / 2;

        const centerY =
            rect.top + rect.height / 2;


        let x =
            clientX - centerX;

        let y =
            clientY - centerY;


        const maxDistance =
            rect.width * 0.35;


        const distance =
            Math.sqrt(
                x * x +
                y * y
            );


        if (distance > maxDistance) {

            const scale =
                maxDistance / distance;

            x *= scale;
            y *= scale;
        }


        stick.style.left =
            "calc(50% + " +
            x +
            "px)";

        stick.style.top =
            "calc(50% + " +
            y +
            "px)";


        const normalizedX =
            Math.round(
                (x / maxDistance) * 100
            );

        const normalizedY =
            Math.round(
                (y / maxDistance) * 100
            );


        if (type === "left") {

            joystickState.yaw =
                clamp(
                    normalizedX,
                    -100,
                    100
                );


            let throttle =
                -normalizedY;


            throttle =
                clamp(
                    throttle,
                    -100,
                    100
                );


            /*
                Throttle only uses 0..100.
                Pulling downward = more throttle.
            */

            joystickState.throttle =
                clamp(
                    ((throttle + 100) / 2),
                    0,
                    100
                );


            document.getElementById(
                "throttleValue"
            ).textContent =
                joystickState.throttle;


            document.getElementById(
                "yawValue"
            ).textContent =
                joystickState.yaw;

        }


        if (type === "right") {

            joystickState.roll =
                clamp(
                    normalizedX,
                    -100,
                    100
                );


            joystickState.pitch =
                clamp(
                    -normalizedY,
                    -100,
                    100
                );


            document.getElementById(
                "rollValue"
            ).textContent =
                joystickState.roll;


            document.getElementById(
                "pitchValue"
            ).textContent =
                joystickState.pitch;

        }


        sendJoystickCommand();
    }


    function release() {

        active = false;

        stick.style.left = "50%";
        stick.style.top = "50%";


        if (type === "left") {

            joystickState.throttle = 0;
            joystickState.yaw = 0;

            document.getElementById(
                "throttleValue"
            ).textContent = "0";

            document.getElementById(
                "yawValue"
            ).textContent = "0";

        } else {

            joystickState.pitch = 0;
            joystickState.roll = 0;

            document.getElementById(
                "pitchValue"
            ).textContent = "0";

            document.getElementById(
                "rollValue"
            ).textContent = "0";

        }


        sendJoystickCommand();
    }


    joystick.addEventListener(
        "pointerdown",
        event => {

            active = true;

            joystick.setPointerCapture(
                event.pointerId
            );

            move(
                event.clientX,
                event.clientY
            );
        }
    );


    joystick.addEventListener(
        "pointermove",
        event => {

            if (!active) {
                return;
            }

            move(
                event.clientX,
                event.clientY
            );
        }
    );


    joystick.addEventListener(
        "pointerup",
        release
    );


    joystick.addEventListener(
        "pointercancel",
        release
    );


    joystick.addEventListener(
        "lostpointercapture",
        () => {
            if (active) {
                release();
            }
        }
    );
}


function clamp(value, min, max) {

    return Math.max(
        min,
        Math.min(max, value)
    );
}


function sendJoystickCommand() {

    const command =
        "VAJRA:JOY," +
        joystickState.throttle +
        "," +
        joystickState.yaw +
        "," +
        joystickState.pitch +
        "," +
        joystickState.roll;


    if (!joystickTimer) {

        joystickTimer =
            setTimeout(
                async () => {

                    joystickTimer = null;

                    await sendCommand(command);

                },
                50
            );
    }
}


function resetAllJoysticks() {

    joystickState = {

        throttle: 0,
        yaw: 0,
        pitch: 0,
        roll: 0

    };


    document.getElementById(
        "leftStick"
    ).style.left = "50%";

    document.getElementById(
        "leftStick"
    ).style.top = "50%";


    document.getElementById(
        "rightStick"
    ).style.left = "50%";

    document.getElementById(
        "rightStick"
    ).style.top = "50%";


    document.getElementById(
        "throttleValue"
    ).textContent = "0";

    document.getElementById(
        "yawValue"
    ).textContent = "0";

    document.getElementById(
        "pitchValue"
    ).textContent = "0";

    document.getElementById(
        "rollValue"
    ).textContent = "0";
}


/* ================= TELEMETRY ================= */

function handleBLEData(event) {

    try {

        const decoder =
            new TextDecoder();

        const line =
            decoder.decode(
                event.target.value
            ).trim();


        addLog("RX ← " + line);


        if (!line.startsWith("TEL,")) {
            return;
        }


        const data =
            line.split(",");


        /*
            Expected 18 fields:

            0  TEL
            1  roll
            2  pitch
            3  gx
            4  gy
            5  gz
            6  m1
            7  m2
            8  m3
            9  m4
            10 rollP
            11 rollI
            12 rollD
            13 rollPID
            14 pitchP
            15 pitchI
            16 pitchD
            17 pitchPID
        */


        if (data.length < 18) {
            return;
        }


        const roll =
            Number(data[1]);

        const pitch =
            Number(data[2]);

        const gx =
            Number(data[3]);

        const gy =
            Number(data[4]);

        const gz =
            Number(data[5]);

        const m1 =
            Number(data[6]);

        const m2 =
            Number(data[7]);

        const m3 =
            Number(data[8]);

        const m4 =
            Number(data[9]);

        const rollPID =
            Number(data[13]);

        const pitchPID =
            Number(data[17]);


        document.getElementById(
            "attitudeRoll"
        ).textContent =
            roll.toFixed(2) + "°";


        document.getElementById(
            "attitudePitch"
        ).textContent =
            pitch.toFixed(2) + "°";


        document.getElementById(
            "telRoll"
        ).textContent =
            roll.toFixed(2);


        document.getElementById(
            "telPitch"
        ).textContent =
            pitch.toFixed(2);


        document.getElementById(
            "telGx"
        ).textContent =
            gx.toFixed(2);


        document.getElementById(
            "telGy"
        ).textContent =
            gy.toFixed(2);


        document.getElementById(
            "telGz"
        ).textContent =
            gz.toFixed(2);


        document.getElementById(
            "telM1"
        ).textContent =
            m1;


        document.getElementById(
            "telM2"
        ).textContent =
            m2;


        document.getElementById(
            "telM3"
        ).textContent =
            m3;


        document.getElementById(
            "telM4"
        ).textContent =
            m4;


        document.getElementById(
            "telRollPID"
        ).textContent =
            rollPID.toFixed(2);


        document.getElementById(
            "telPitchPID"
        ).textContent =
            pitchPID.toFixed(2);

    } catch (error) {

        console.error(
            "Telemetry parse error:",
            error
        );
    }
}


/* ================= LOGS ================= */

function addLog(message) {

    const box =
        document.getElementById("logsBox");


    if (!box) {
        return;
    }


    const time =
        new Date().toLocaleTimeString();


    const line =
        document.createElement("div");


    line.textContent =
        "[" +
        time +
        "] " +
        message;


    box.appendChild(line);


    box.scrollTop =
        box.scrollHeight;
}


function clearLogs() {

    document.getElementById(
        "logsBox"
    ).innerHTML = "";
}


/* ================= STARTUP ================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        setupJoystick(
            "leftJoystick",
            "leftStick",
            "left"
        );


        setupJoystick(
            "rightJoystick",
            "rightStick",
            "right"
        );


        setBLEStatus(false);

        addLog(
            "VAJRA website initialized."
        );
    }
);
