import { IWebviewChannel } from '../webview-host/common';
import { WebviewPanelManager } from '../webview-host/webview-manager';
import { ipcRenderer } from 'electron';

export class ElectronWebviewChannel implements IWebviewChannel {

  private handlers = new Map();
  focusIframeOnCreate?: boolean | undefined;
  ready?: Promise<void> | undefined;
  fakeLoad: boolean = false;
  private isInDevelopmentMode = false;

  constructor() {
    window.addEventListener('message', (e) => {
      if (e.data && (e.data.command === 'onmessage' || e.data.command === 'do-update-state')) {
        // Came from inner iframe
        this.postMessage(e.data.command, e.data.data);
        return;
      }

      const channel = e.data.channel;
      const handler = this.handlers.get(channel);
      if (handler) {
        handler(e, e.data.data);
      } else {
        console.log('no handler for ', e);
      }
    });

    this.ready = new Promise(async (resolve) => {
      // TODO 等待service worker完成  未来资源使用service worker时需要加入
      resolve();
    });

    this.onMessage('devtools-opened', () => {
      this.isInDevelopmentMode = true;
    });
  }

  postMessage(channel, data?) {
    ipcRenderer.sendToHost(channel, data);
  }

  onMessage(channel, handler) {
    ipcRenderer.on(channel, handler);
  }

  onIframeLoaded(newFrame) {
    // newFrame.contentWindow.onbeforeunload = () => {
    //   if (this.isInDevelopmentMode) { // Allow reloads while developing a webview
    //     this.postMessage('do-reload');
    //     return false;
    //   }
    //   // Block navigation when not in development mode
    //   console.log('prevented webview navigation');
    //   return false;
    // };
  }
}

/* tslint:disable */
new WebviewPanelManager(new ElectronWebviewChannel());
/* tslint:enable */
