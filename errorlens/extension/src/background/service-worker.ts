async function attachDebugger(tabId: number) {
  if (!tabId) return;
  try {
    await chrome.debugger.attach({ tabId }, "1.3");
    await chrome.debugger.sendCommand({ tabId }, "Runtime.enable");
    await chrome.debugger.sendCommand({ tabId }, "Console.enable");
    console.log(`ErrorLens: Debugger attached to tab ${tabId}`);
  } catch (e) {
    if ((e as Error).message.includes("Cannot attach to this target")) {
        console.warn("ErrorLens: Could not attach debugger to an internal / restricted page.");
    } else {
        console.error("ErrorLens Debugger attach failed:", e);
    }
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "ATTACH_DEBUGGER" && message.tabId) {
    attachDebugger(message.tabId);
    sendResponse({ success: true });
  }
});

chrome.debugger.onEvent.addListener((source, method, params: any) => {
  if (method === "Runtime.consoleAPICalled" && params.type === "error") {
    const errorData = {
      type: "DEBUGGER_ERROR",
      payload: {
        message: params.args?.[0]?.value || params.args?.[0]?.description || "Unknown error logged.",
        stackTrace: params.stackTrace?.callFrames?.map((frame: any) => ({
          functionName: frame.functionName,
          url: frame.url,
          lineNumber: frame.lineNumber,
          columnNumber: frame.columnNumber
        })) || [],
        timestamp: Date.now(),
        tabId: source.tabId
      }
    };
    
    // Store in session and optionally notify active panel
    if (chrome.storage && chrome.storage.session) {
      chrome.storage.session.set({ latestError: errorData });
    }
    
    chrome.runtime.sendMessage(errorData).catch(() => {
        // Ignored. Panel is likely not open yet.
    });
  }
});

chrome.debugger.onEvent.addListener((source, method, params: any) => {
  if (method === "Runtime.exceptionThrown") {
    const exception = params.exceptionDetails;
    const errorData = {
      type: "UNCAUGHT_EXCEPTION",
      payload: {
        message: exception.exception?.description || exception.text,
        stackTrace: exception.stackTrace?.callFrames?.map((frame: any) => ({
          functionName: frame.functionName,
          url: frame.url,
          lineNumber: frame.lineNumber,
          columnNumber: frame.columnNumber
        })) || [],
        url: exception.url,
        lineNumber: exception.lineNumber,
        timestamp: Date.now(),
        tabId: source.tabId
      }
    };
    
    if (chrome.storage && chrome.storage.session) {
        chrome.storage.session.set({ latestError: errorData });
    }
    chrome.runtime.sendMessage(errorData).catch(() => {
        // Ignored
    });
  }
});
