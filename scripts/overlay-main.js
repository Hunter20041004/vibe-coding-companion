#!/usr/bin/env node
import electron from "electron";
import { launchOverlayWindow } from "../src/overlay-main-runtime.js";

const { app, BrowserWindow, screen } = electron;

let overlayWindow;

app.whenReady().then(() => {
  return launchOverlayWindow({ BrowserWindow, screen }).then((runtime) => {
    overlayWindow = runtime.overlayWindow;
  });
});

app.on("window-all-closed", () => {
  app.quit();
});
