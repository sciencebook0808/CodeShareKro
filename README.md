Goal: Write a complete, production-ready Arduino-style sketch for an ESP8266 (NodeMCU / ESP-12E) that implements an offline-capable RFID door access system with environmental sensors, an OLED status display, and full Blynk mobile integration (real-time values, control widgets, user management, email & push notifications, and a serial terminal mirrored to Blynk). The code must be robust (non-blocking, watchdog-safe), recover gracefully from peripheral errors (e.g., reset/re-init RC522 on failures), and persist user data locally in JSON so door unlocking works offline.

HARDWARE / PIN MAP (fixed — do not change):

RC522 RFID (SPI):

SDA / SS -> D8 (GPIO15)

SCK       -> D5 (GPIO14)

MOSI      -> D7 (GPIO13)

MISO      -> D6 (GPIO12)

RST       -> NOT CONNECTED (no hardware reset pin required)

VCC -> 3.3V, GND -> GND


OLED (I2C 128x32 or 128x64; 1.2" is fine):

SDA -> D2 (GPIO4)

SCL -> D1 (GPIO5)

VCC -> 3.3V, GND -> GND


MQ-135 Gas sensor:

AO -> A0 (use proper scaling in code and note measured voltage -> AQI mapping)

Heater / VCC -> 5V, GND -> GND


Relay (active-LOW to unlock door):

IN -> D4 (GPIO2) (active LOW; set HIGH at boot to keep locked)

VCC -> 5V coil supply (common GND required)


DHT22:

DATA -> D0 (GPIO16)

VCC -> 3.3V, GND -> GND



HIGH-LEVEL FEATURE REQUIREMENTS

1. Startup / OLED behavior

On ESP boot, show single-screen message on the OLED:

First line: Welcome to Quantum Resort for 2 seconds, then immediately update to the main real-time dashboard screen.


Main OLED dashboard layout (single page, refresh every ~1s):

Top-left: status text Quantum Resort followed inline by one symbol representing connectivity:

X → WiFi NOT connected

W → WiFi connected (Blynk disconnected)

WB → WiFi + Blynk both connected


Top-right (same top line after status symbol): show DHT22 temperature and humidity succinctly (e.g., 25.4°C 56%).

Next to or below this on the top area: show MQ135 → convert sensor reading to an AQI numeric value and a text label. Display AQI: <value> and short category (Good / Moderate / Poor / Very Poor / Hazardous).

Use EPA-like bands tuned for Indian context: 0–100 Good, 101–200 Moderate, 201–300 Poor, 301–500 Very Poor, >500 Hazardous. If AQI > 500 trigger immediate alerts.


Bottom-right corner: door status LOCKED or UNLOCKED.

When an RFID access event occurs, show a temporary overlay message that replaces the main data area for ~3–6 seconds:

If card registered: display Welcome, <Name> and <Designation> with a greeting variant depending on time of day, and show Door OPENING while relay activates; then show Door CLOSED after auto-close.

If card not registered: display CARD NOT REGISTERED — ACCESS DENIED.



All OLED text must be readable; use clear fonts and avoid overflowing lines.



2. RFID flow and door control

Continuous scanning mode during normal operation (unless Learn Mode enabled).

If a registered card is presented:

Display user name & designation on OLED as above.

Activate relay (digitalWrite D4 LOW) for a configurable duration (default 5 seconds), then de-activate (digitalWrite D4 HIGH).

Log access locally (timestamp, user id, name, method = RFID) into an access history (circular buffer) and to Blynk.

Update Blynk UI with last-accessed user details and time, and push a Blynk notification and email with the access summary.


If card is not registered:

Show ACCESS DENIED on OLED, log event (timestamp, card UID) and send a Blynk notification that an unregistered card was scanned (but avoid spamming notifications).


Allow unlocking from Blynk mobile app via a secure button (press-and-hold or confirmation). When Blynk unlock is used, log method = BLYNK.



3. User management (offline-first)

Users are stored on-device in JSON format using a filesystem that survives reset (SPIFFS or LittleFS).

Each user object must include: uid (RFID UID string), name, designation, permission (boolean unlock allowed), added_by (method: SERIAL or BLYNK), timestamp_added.

UI for adding users:

Blynk: Provide a dedicated Learn Mode toggle widget. In Learn Mode:

When an RFID card is scanned, the Blynk interface receives the raw UID automatically in a datastream and opens inputs (Name, Designation, Permission toggle). The user fills them and then taps Save. The ESP accepts that payload and stores the user JSON locally.

After saving, the device exits Learn Mode automatically and resumes normal scanning.

When a new user is added via Blynk, the system should send an email with user details and the method of adding.


Serial Monitor: The serial terminal (USB) must accept commands to add users. Provide a simple interactive command or one-line command format to add a user (UID, name, designation, permission). When a user is added over serial, the same email notification is sent (if online) and an appropriate Blynk update occurs. The Blynk terminal must mirror serial messages (two-way).


Provide the ability to remove a user from both Blynk UI (list widget or table) and Serial. Removing should update local JSON and push to Blynk.



4. Blynk integration and datastreams (required names & widgets)

Provide clear mapping of Blynk datastream names and recommended widget types (agent decides exact pin-to-virtual pin mapping). At minimum include:

V_TEMP – value display (temperature)

V_HUM – value display (humidity)

V_AQI – value display (AQI numeric) + text label for band

V_DOOR – LED or labeled status (LOCKED/UNLOCKED)

V_LAST_USER – Label / Value showing last-access name & time

V_LEARN_MODE – Toggle widget to enable/disable learn mode

V_ADD_USER_UID – Read-only field auto-filled when learn mode captures UID

V_ADD_USER_NAME, V_ADD_USER_DESG, V_ADD_USER_ALLOW – Input widgets for saving new user

V_UNLOCK_REQ – Button (with confirmation) to unlock door remotely

V_SERIAL – Terminal widget that mirrors USB Serial and accepts typed commands

V_USERS_LIST – List or Table widget showing registered users (UID + name + permission) with remove option

V_ALERTS – Push notifications and email triggers (when AQI > 500, when user added, when unregistered card used)


Provide concrete examples of the Blynk JSON payload structure for adding a user (what the ESP expects on virtual pins).

Blynk must be able to operate in offline mode gracefully — local operations (unlock by registered card) must not require cloud connectivity.



5. Serial monitor & Blynk terminal sync

Mirror all Serial.println output to the Blynk Terminal widget and vice versa. Commands typed into the Blynk Terminal stream should be fed to the same command parser as USB serial.

Support these serial commands (examples):

ADDUID <UID> <Name> <Desig> <1|0> → adds user with permission flag

DELUID <UID> → delete user

LIST → prints all users and their allowed permission

LEARN ON / LEARN OFF

UNLOCK → triggers the relay open for configured duration


Ensure command parsing is robust and returns clear success / error messages both on USB serial and Blynk terminal.



6. Email & Notifications

On user added (both SERIAL and BLYNK), send an email containing: UID, Name, Designation, method-of-adding, timestamp.

On AQI crossing > 500 (Hazardous), send immediate email and push notification to Blynk subscribers; also show persistent alert on OLED until acknowledged.

When a registered user unlocks via RFID or Blynk, send a Blynk push notification with user and time summary and update V_LAST_USER.

If the agent prefers SMTP vs. Blynk email widget, they may implement both; use secure storage for any required credentials.



7. AQI conversion and thresholds

Provide a simple conversion from MQ-135 analog outputs to an approximate AQI numeric scale; document in code comments the mapping and any calibration config variables.

Use the categorical thresholds listed above (0–100 Good, 101–200 Moderate, 201–300 Poor, 301–500 Very Poor, >500 Hazardous).

When AQI enters a new category, update OLED and Blynk state and optionally send a push/email on category Hazardous.



8. User experience specifics

When WiFi / Blynk connectivity changes, update the OLED symbol inline (X / W / WB) in real time.

The OLED must always show the current sensor values (DHT + AQI) when idle.

Last-access details appear in Blynk V_LAST_USER and a short history buffer (local + shown in Blynk list).

When in Learn Mode, the OLED should display LEARN MODE: READY and show the captured UID after a card is scanned, until user completes save on Blynk or cancels.



9. Persistence and syncing

Store users and a configurable history buffer in JSON using the filesystem (LittleFS or SPIFFS). Provide functions to export/import this JSON to/from Blynk (so remote backups are possible).

On connectivity gain (WiFi/Blynk reconnected), sync local logs and newly added users with the cloud (upload user additions if any and push missed events).



10. Security & safety

Require manual confirmation (Blynk push confirmation or a PIN typed on Blynk) to enable remote unlock (prevent accidental clicks). Provide a configuration option for this.

Avoid storing plain-text wifi or SMTP passwords in code; instead treat them as config values and show how the sketch reads them from a config.h or a JSON file (agent may implement secure handling in code).

Debounce card read events to avoid duplicate trigger when a card is presented for >1s.



11. Operational parameters & configuration

Provide easy-to-edit constants at top of sketch:

Relay active duration (default 5 sec)

Sensor sampling intervals (DHT every 2 s; MQ-135 every 5 s; OLED refresh every 1 s)

Blynk heartbeat interval

Max number of users stored locally

Email recipients list


All constants should be clearly labeled and documented in code comments.




DELIVERABLES (what the agent must return)

1. A fully working Arduino sketch (single file or well-structured multi-file) that implements the above. It must compile on standard Arduino/PlatformIO toolchains for ESP8266.


2. A sample config.example (no secrets) that lists required Blynk tokens, WiFi placeholders, SMTP placeholders, and other configuration entries.


3. A text file describing the complete Blynk project:

Virtual pin mapping,

Recommended widgets and their configuration (e.g., Terminal on V_SERIAL, Button on V_UNLOCK_REQ with mode = push, list widget settings),

Exact datastream names and JSON payload examples for ADD USER and SYNC.



4. The JSON schema for local user storage and an example JSON file with two sample users.


5. A short user manual (max 1 page) describing:

How to enable Learn Mode via Blynk and Serial, and how the workflow looks to add a user

How to unlock from Blynk (safeguards)

How to interpret AQI categories & OLED symbols



6. Minimal but robust logging on Serial and Blynk Terminal (give sample outputs).


7. A note listing any third-party libraries used (names + suggested versions).



Constraints & style

The agent may choose libraries but the code must be non-blocking, call yield() or ESP.wdtFeed() appropriately and manage WiFi/Blynk reconnect without resetting the device.

Keep the code readable, well-commented around core logic (user storage, learn mode, RFID handling, Blynk handlers).

The agent must not include hardware build steps; assume the reader knows how to connect the specified peripherals to the pins listed.



---

Output format request from agent

Provide the code files in a single archive or as inline sections (main sketch first), followed by the Blynk project description, sample JSON, and the one-page manual.

Also list test steps (short) the developer should run to verify (e.g., test RFID read -> expected OLED message; test adding user via Blynk -> expected email and JSON update). Keep test steps concise.


DHT22: D0 (GPIO16) for DATA

Relay (active LOW) controlling door lock: D4 (GPIO2) — driving IN on relay module (digitalWrite LOW = unlock)

Common ground across all modules.


> The delivered sketch must use these pins exactly. Agent may assume the relays’ IN accepts 3.3V logic and that RFID/OLED run at 3.3V.




---

HIGH-LEVEL FEATURES (required)

1. Startup OLED sequence

On boot show a welcome message: Welcome to Quantum Resort on OLED.

Below that show whether RFID reader is detected/connected: display RFID: Connected or RFID: Not connected.

On the top/next line display: Quantum Resort followed immediately by a small symbol showing connection state:

X symbol = WiFi NOT connected

W symbol = WiFi connected only

WB symbol = WiFi + Blynk BOTH connected


Next to connection symbol show DHT22 sensor reading (temperature & humidity) and MQ135 AQI value (or computed index) in realtime.

In the lower-right corner show Door: Locked or Door: Unlocked depending on relay state.



2. OLED layout & dynamic updates

The OLED should continuously show the four things at a glance:

Top line: Quantum Resort + connectivity symbol shorthand (X / W / WB)

Immediately next to top line (same horizontal area if space): DHT22 values and AQI value label (e.g., T:25.4C H:60% AQI:145)

Middle area: show last access / current card status (e.g., Last: Rahul (Staff) or Card not registered - ACCESS DENIED)

Bottom-right: Door: Locked/Unlocked


On registered-card detection, show Name & Designation and a greeting message for a few seconds before returning to normal live sensor view.



3. RFID behavior

System scans continuously for tags.

If tag UID is registered in local JSON DB → treat as authorized:

Show user Name & Designation on OLED with a greeting (e.g., Welcome Rahul (Staff)), update OLED last-access area immediately.

Unlock the door by writing LOW to relay pin (D4) for a configurable duration (suggest default 5 seconds), then re-lock by writing HIGH.

Update Blynk with last-access record and send Blynk push notification and also send an email to a configured address with details: UID, Name, Designation, timestamp, and method of adding (if this was part of a learn flow recently).


If tag UID is not registered → display Card not registered - ACCESS DENIED on OLED and log it in Blynk last-access history (no unlock, no email).



4. User Management (learn mode & offline JSON storage)

Implement a local user DB stored in device non-volatile storage (SPIFFS/LittleFS or filesystem) as JSON. The DB should persist across reboots and be consulted when scanning tags (offline operation).

Support adding & removing users via:

Blynk app: full UI flow (details below) — must support enabling Learn Mode, scanning a card to capture UID, entering Name & Designation in Blynk widget fields, and saving to ESP JSON. After save, Learn Mode auto-turns OFF and device resumes normal scanning.

Serial Monitor (USB) and Blynk Serial Terminal: accept the same commands to add/remove users (see Command API below). When adding via serial, include a mode where agent prompts or receives UID/Name/Designation and saves to JSON.


User JSON structure example (agent must use JSON format; agent chooses exact field names but must include): UID (hex string), name, designation, added_by (Blynk/Serial), timestamp, permissions (boolean for unlock).

Removing user: by UID or by selecting from a list in Blynk.



5. Blynk Integration & Widgets / Datastreams

Create and document the exact Blynk virtual pin names/IDs and datastream names to be used.

Required Blynk widgets and expected virtual pins:

Display / Value widgets:

V1 Temperature (DHT22) — numeric

V2 Humidity (DHT22) — numeric

V3 AQI (MQ135 computed) — numeric

V4 Door Status (locked/unlocked) — text indicator or LED widget

V5 Last Access (table / value) — show last UID, Name, Designation, timestamp


Buttons / Switches:

V10 Learn Mode Toggle (ON = enable Learn Mode for adding users). When enabled, next scanned RFID is captured.

V11 Manual Unlock button (momentary) — unlocks door for configured seconds


Terminal / Serial:

V20 Blynk Serial Terminal — mirrored to hardware USB Serial and accepts commands for add/remove/list users. Commands should be documented (e.g., ADD, REMOVE, LIST, LEARN ON, LEARN OFF).


List / Table:

V30 Users list / table — allow selecting a saved user for removal or viewing details (agent may use available Blynk widgets best fit).


Notification & Email:

Use Blynk Notification Widget for push notifications (e.g., access events).

Use Blynk Email Widget to send emails on new user add and on hazardous AQI alerts. Email must include: UID, Name, Designation, method of adding (Blynk/Serial), and timestamp.



Document exact mapping of each virtual pin used by the sketch and what the widget should do.

Ensure the Blynk UI state is synchronized with device: e.g., when a new user is added by serial, Blynk’s user list must update automatically or notify the app.



6. Serial Monitor & Bidirectional Serial on Blynk

Mirror hardware Serial (USB) to Blynk Serial Terminal V20 and vice versa.

Commands accepted on either interface include:

LEARN ON — enable learn mode

LEARN OFF — disable learn mode

ADD UID,Name,Designation — adds user (immediately saves JSON)

REMOVE UID — remove user

LIST — print all users

STATUS — print WiFi/Blynk/RFID/DHT/A0/door status


When commands are issued via Blynk terminal, the device must respond back into Blynk terminal and into hardware serial.



7. Offline-first & Sync behavior

Core access control must work offline (no WiFi/Blynk) using the device JSON user DB.

When Blynk connection becomes available and a user was added offline, sync mode must upload the new user info to Blynk list/table (or at least update the last-access record and send a notification/email as soon as online).

Connectivity icons on OLED must update live (X / W / WB).



8. Security & Permission model

Each user entry must have a permission boolean controlling whether that UID may unlock door.

Blynk UI should allow setting/revoking permission for any user.

When the user scans a card, the system must check permission flag; if false, show Access denied both on OLED and Blynk.



9. Notifications & Email rules

Send email on:

New user added (include UID, Name, Designation, timestamp, method of adding).

Hazardous AQI: when calculated AQI exceeds 500 (mark as HAZARDOUS) send email and Blynk push notification.


In addition send Blynk push notifications for:

Successful unlock events (Name & UID & time)

Unauthorized access attempts


Log all notification events to a persistent access log (small ring buffer or file) and expose “Last Access” info to Blynk.



10. AQI computation & thresholds

Convert MQ135 analog readings to a simple AQI-like index. The agent can design a mapping/calibration function (they may assume simple linear or LUT). But must implement the thresholds:

0–100 → Good

101–200 → Moderate

201–300 → Poor

301–400 → Very Poor

401–500 → Severe

> 500 → Hazardous (this should trigger emails/alerts)




Display AQI classification on OLED and on Blynk. If AQI > 500 mark prominently as HAZARDOUS.



11. Robustness & fault handling

If RFID read fails repeatedly, reinitialize the RC522 (soft re-init) without rebooting the ESP.

If DHT read fails, retry a couple times then show -- or Error on OLED/Blynk.

Watchdog-friendly code: do not block long in loop; use yields/delays appropriately. Processing heavy tasks (email send, Blynk sync) must not block critical RFID scanning or Blynk heartbeats.

The sketch must handle filesystem failure gracefully (warn on serial/Blynk and continue in read-only mode).



12. UX specifics: Learn Mode flow

Blynk: user toggles V10 to enable Learn Mode.

Device then displays Learn Mode: Scan Card on OLED and on Blynk UI (text or popup).

When a card is scanned in Learn Mode:

Auto-capture UID and populate temporary fields in Blynk UI (virtual pins) so mobile user can enter Name and Designation.

Provide a Save widget/button in Blynk which sends the entered data to the device.

On Save, device persists JSON, turns off Learn Mode, updates user list in Blynk, sends email describing the addition, and displays a success message on OLED (e.g., User Saved: Rahul - Staff).


Serial terminal must support LEARN ON and allow entering name/designation to save.



13. Outputs & logs required from agent Deliver a single-file Arduino sketch that:

Compiles with standard Arduino IDE or PlatformIO for ESP8266.

Uses widely used libraries only (agent chooses appropriate ones) but must include a short header list of required libraries at the top of the sketch.

Contains clear comments for each major block explaining behavior and virtual pin mappings.

Contains a short README header block explaining:

Blynk virtual pin mapping (V1, V2, etc.) and recommended widgets to add to the Blynk project

How learn mode works (no wiring instructions)

JSON user structure (example)

Serial command list


Must be robust and production-ready (reinit on failures, safe-default pin states, no relay activation during boot).



14. Deliver the Blynk datastreams & widget suggestions (explicit mapping)

Provide a clear list mapping each Virtual Pin to function and recommended widget:

V1 → Temperature (Value)

V2 → Humidity (Value)

V3 → AQI (Value + Color-coded LED or Gauge)

V4 → Door Status (LED or Value)

V5 → Last Access (Label or Value)

V10 → Learn Mode toggle (Switch)

V11 → Manual Unlock (Button - push)

V20 → Serial Terminal (Terminal widget)

V30 → Users List (Table)

V99 → Email trigger (used internally; agent may call Blynk.email or Blynk.notify)


The agent must specify exact format of payloads sent to each Virtual Pin.



15. Edge cases & constraints

If WiFi is connected but Blynk is not, show W on OLED. If both connected show WB.

If a user is added via Blynk while offline, queue the notification/email and send when connection restored.

The agent must ensure relay default state at boot is HIGH so the door remains locked.





---

DELIVERY FORMAT (what agent must return)

A single .ino (or .cpp .h as single-file sketch) with:

Top comment block: required libraries and the mapping of V pins & hardware pins.

Implemented behavior described above.

Comments inline for major flows (learn mode, RFID handling, Blynk handlers, serial handlers, filesystem save/load).


A small README header inside the file describing how Blynk project should be assembled (widget types + V pins + brief explanation).

No instructions about wiring or power — only mention pins and what they are used for (as above).



---

Extra optional (nice-to-have)

A Blynk table export / CSV dump of the local user DB when requested via serial or Blynk button.

A small rotating animation or indicator on OLED during network/Blynk reconnection attempts.

A configurable unlock duration (user-editable via Blynk).



---

Constraints / Do not include

Do NOT provide explicit hardware wiring step-by-step instructions or photos; this prompt is only for specifying what to build and which pins to use.

Do NOT hardcode any sensitive credentials. Use placeholders or clearly-marked fields for BLYNK_AUTH_TOKEN, WIFI_SSID, WIFI_PASS, and EMAIL recipient.



---

If you understand, please produce exactly:

1. The complete prompt above (which you should pass to the code-generation agent), and


2. Ask the agent to reply with: “I will deliver a single-file Arduino sketch and an in-file README describing the Blynk widgets and virtual pin mappings.”

