import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  createOverlayPresenceController,
  parseMacForegroundOutput,
} from "./overlay-presence.js";
import {
  createOverlayWindowOptions,
  resolveOverlayUrl,
} from "./overlay-window.js";
import { createOverlayStateTracker } from "./overlay-state-tracker.js";
import { createOverlaySettingsTracker } from "./overlay-settings-tracker.js";

const execFileAsync = promisify(execFile);

export async function launchOverlayWindow({
  BrowserWindow,
  screen,
  env = process.env,
  createPresenceController = createOverlayPresenceController,
  createStateTracker = createOverlayStateTracker,
  createSettingsTracker = createOverlaySettingsTracker,
  detectForeground = detectMacForegroundApp,
}) {
  const workArea = screen.getPrimaryDisplay().workArea;
  const overlayWindow = new BrowserWindow(createOverlayWindowOptions({ workArea }));

  overlayWindow.setAlwaysOnTop(true, "floating");
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlayWindow.setIgnoreMouseEvents?.(true, { forward: true });
  await overlayWindow.loadURL(resolveOverlayUrl(env));

  const stateTracker = createStateTracker({
    eventUrl: env.EVENT_URL ?? "http://127.0.0.1:5174/events",
  });
  stateTracker.start();

  const settingsTracker = createSettingsTracker({
    settingsUrl: env.OVERLAY_SETTINGS_URL ?? "http://127.0.0.1:5174/settings/overlay",
  });
  settingsTracker.start();

  const presenceController = createPresenceController({
    overlayWindow,
    detectForeground,
    getOverlayState: stateTracker.current,
    getOverlayPlacement: stateTracker.placement,
    getOverlaySettings: settingsTracker.current,
  });
  presenceController.start();

  return { overlayWindow, presenceController, stateTracker, settingsTracker };
}

export async function detectMacForegroundApp({
  execFileImpl = execFileAsync,
  timeoutMs = 1000,
} = {}) {
  const script = `
    tell application "System Events"
      set frontProcess to first application process whose frontmost is true
      set appName to name of frontProcess
      set windowTitle to ""
      set xValue to ""
      set yValue to ""
      set widthValue to ""
      set heightValue to ""
      set regionLines to ""
      try
        set frontWindow to front window of frontProcess
        set windowTitle to name of frontWindow
        set windowPosition to position of frontWindow
        set windowSize to size of frontWindow
        set xValue to (item 1 of windowPosition) as string
        set yValue to (item 2 of windowPosition) as string
        set widthValue to (item 1 of windowSize) as string
        set heightValue to (item 2 of windowSize) as string
        try
          set tabChar to character id 9
          set capturedCount to 0
          set uiElements to entire contents of frontWindow
          repeat with uiElement in uiElements
            if capturedCount is greater than or equal to 18 then exit repeat
            try
              set roleValue to role of uiElement as string
              if roleValue is "AXTextArea" or roleValue is "AXTextField" or roleValue is "AXScrollArea" or roleValue is "AXWebArea" or roleValue is "AXGroup" then
                set uiPosition to position of uiElement
                set uiSize to size of uiElement
                set uiX to item 1 of uiPosition
                set uiY to item 2 of uiPosition
                set uiWidth to item 1 of uiSize
                set uiHeight to item 2 of uiSize
                if uiWidth is greater than or equal to 90 and uiHeight is greater than or equal to 48 then
                  set regionLines to regionLines & linefeed & "region" & tabChar & roleValue & tabChar & (uiX as string) & tabChar & (uiY as string) & tabChar & (uiWidth as string) & tabChar & (uiHeight as string)
                  set capturedCount to capturedCount + 1
                end if
              end if
            end try
          end repeat
        end try
      end try
      return appName & linefeed & windowTitle & linefeed & xValue & linefeed & yValue & linefeed & widthValue & linefeed & heightValue & regionLines
    end tell
  `;
  const { stdout } = await execFileImpl("osascript", ["-e", script], {
    timeout: timeoutMs,
  });

  return parseMacForegroundOutput(stdout);
}
