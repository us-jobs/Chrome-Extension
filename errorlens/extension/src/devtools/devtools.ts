chrome.devtools.panels.create(
  "ErrorLens",
  "/icons/icon16.png",
  "panel.html", // Relative to devtools.html in actual output
  (_panel) => {
    console.log("ErrorLens panel created");
  }
);

(chrome.devtools as any).console.onMessage.addListener((message: any, level: any) => {
  if (level === "error" || level === "warning") {
    chrome.runtime.sendMessage({
      type: "CONSOLE_MESSAGE",
      payload: {
        text: message,
        level: level,
        timestamp: Date.now(),
        url: chrome.devtools.inspectedWindow.tabId
      }
    });
  }
});

// Trigger debugger attachment when DevTools opens
chrome.runtime.sendMessage({
  type: "ATTACH_DEBUGGER",
  tabId: chrome.devtools.inspectedWindow.tabId
});
