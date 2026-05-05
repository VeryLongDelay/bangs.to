export function notifySW(type: string) {
  navigator.serviceWorker.controller?.postMessage({ type });
  void navigator.serviceWorker.getRegistration().then(registration => {
    registration?.active?.postMessage({ type });
  });
}
