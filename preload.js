const { contextBridge, ipcRenderer } = require('electron');

// 向渲染进程暴露安全的 API
contextBridge.exposeInMainWorld('yazz_api', {
  // 导航功能
  navigateTo: (url) => ipcRenderer.invoke('navigate-to', url),
  goBack: () => ipcRenderer.invoke('browser-go-back'),
  goForward: () => ipcRenderer.invoke('browser-go-forward'),
  reload: () => ipcRenderer.invoke('browser-reload'),
  goHome: () => ipcRenderer.invoke('browser-home'),
  toggleDevTools: () => ipcRenderer.invoke('browser-devtools'),

  // 监听主进程事件
  onUpdateNavigation: (callback) => {
    ipcRenderer.on('update-navigation', callback);
  },
  
  // 移除监听器
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  }
});

// window.addEventListener('DOMContentLoaded', () => {
//   const replaceText = (selector, text) => {
//     const element = document.getElementById(selector)
//     if (element) element.innerText = text
//   }

//   for (const type of ['chrome', 'node', 'electron']) {
//     replaceText(`${type}-version`, process.versions[type])
//   }
// });