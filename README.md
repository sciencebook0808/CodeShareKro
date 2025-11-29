# CodeShareKro

Produce one Arduino/ESP8266-compatible sketch (single file) that runs an access-control & environment-monitoring system named Quantum Resort, integrates with Blynk (mobile app) for remote control/monitoring, supports offline operation (local JSON user DB), and drives an OLED display for local status.


---

TARGET HARDWARE & PIN ASSIGNMENT (use exactly these pins)

Board: ESP8266 (NodeMCU / ESP-12E devboard)

RC522 RFID: SPI on hardware SPI pins

SCK → D5 (GPIO14)

MOSI → D7 (GPIO13)

MISO → D6 (GPIO12)

SDA/SS → D8 (GPIO15)

RST → NOT CONNECTED (module will work without it)


OLED I²C (1.2")

SDA → D2 (GPIO4)

SCL → D1 (GPIO5)


MQ-135 gas sensor: A0 (raw analog reading must be converted to AQI-like value in sketch)

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

