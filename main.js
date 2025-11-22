const { app, BrowserWindow, Menu, shell, ipcMain, dialog, session, protocol } = require('electron');
const path = require('path');
const https = require('https');
const { URL } = require('url');
const HttpHandler = require('./http_handler');

class BrowserApp {
  constructor() {
    this.mainWindow = null;
    this.app = app;
    this.requestCache = new Map();
    this.http_handler = new HttpHandler();
    // 获取缓存目录
    console.log('用户数据目录:', app.getPath('userData'));
    console.log('缓存目录:', app.getPath('cache'));
    console.log('临时目录:', app.getPath('temp'));
    this.setupApp();
  }

  setupApp() {
    // 应用准备就绪
    this.app.whenReady().then(() => {
      this.createMainWindow();
      this.createMenu();
      this.setupIPC();

      // session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
      //   const data = this.http_handler.get_upload_data(details);
      //   if (data && data.length > 0) {
      //     console.log(`${Date.now()}_${details.id}_onBeforeRequest`, data);
      //   }
      //   // console.log(`${Date.now()}_${details.id}_onBeforeRequest`, details.url);
      //   // this.http_handler.handleHttpsRequest(details).then(() => {
      //   //   console.log('处理完成:', details.url.split('?')[0]);
      //   // }).catch((err) => {
      //   //   console.error('处理错误:', err);
      //   // });
      //   callback({ cancel: false });
      // });
      // session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
      //   const data = this.http_handler.get_upload_data(details);
      //   if (data && data.length > 0) {
      //     console.log(`${Date.now()}_${details.id}_onBeforeSendHeaders`, data);
      //   }
      //   // console.log(`${Date.now()}_${details.id}_onBeforeSendHeaders`, data);
      //   // this.http_handler.handleHttpsRequest(details).then(() => {
      //   //   console.log('处理完成:', details.url.split('?')[0]);
      //   // }).catch((err) => {
      //   //   console.error('处理错误:', err);
      //   // });
      //   callback({ requestHeaders: details.requestHeaders });
      // });
      session.defaultSession.webRequest.onSendHeaders((details) => {
        // const data = this.http_handler.get_upload_data(details);
        // if (data && data.length > 0) {
        //   console.log(`${Date.now()}_${details.id}_onSendHeaders`, data);
        // }
        // console.log(`${Date.now()}_${details.id}_onSendHeaders`, data);

        this.http_handler.handleHttpsRequest(details).then(() => {
          // console.log('保存完成:', details.url);
        }).catch((err) => {
          console.error('处理错误:', err);
        });
      });
      // session.defaultSession.webRequest.onCompleted((details) => {
      //   const data = this.http_handler.get_upload_data(details);
      //   if (data && data.length > 0) {
      //     console.log(`${Date.now()}_${details.id}_onCompleted`, data);
      //   }
      //   // console.log(`${Date.now()}_${details.id}_onCompleted`, data);
      // });
    });
    this.app.on('window-all-closed', () => {
      this.app.quit()
    });
    // this.app.commandLine.appendSwitch('remote-debugging-port', '9222');
    // this.app.commandLine.appendSwitch('remote-debugging-address', '0.0.0.0');
    // this.app.commandLine.appendSwitch('disable-web-security');
    // this.app.commandLine.appendSwitch('disable-features', 'SameSiteByDefaultCookies');
  }

  createMainWindow() {
    this.mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 800,
      minHeight: 600,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        enableRemoteModule: false,
        preload: path.join(__dirname, 'preload.js'),
        webSecurity: false,
        webviewTag: true
      },
      titleBarStyle: 'default'
    });

    // 加载主页面
    this.mainWindow.loadFile('src/index.html');
    // 开发模式下打开开发者工具
    if (process.argv.includes('--dev')) {
      this.mainWindow.webContents.openDevTools();
    }

    // 处理外部链接
    this.mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url);
      // return { action: 'open' };
      return { action: 'deny' };
    });

    // 监听页面标题变化
    this.mainWindow.webContents.on('page-title-updated', (event, title) => {
      this.mainWindow.setTitle(`${title}`);
    });
  }

  setupIPC() {
    // 处理导航事件
    ipcMain.handle('navigate-to', (event, url) => {
      if (this.mainWindow) {
        this.mainWindow.webContents.loadURL(url);
      }
    });

    // 处理前进后退
    ipcMain.handle('browser-go-back', () => {
      if (this.mainWindow && this.mainWindow.webContents.canGoBack()) {
        this.mainWindow.webContents.goBack();
      }
    });

    ipcMain.handle('browser-go-forward', () => {
      if (this.mainWindow && this.mainWindow.webContents.canGoForward()) {
        this.mainWindow.webContents.goForward();
      }
    });

    // 处理刷新
    ipcMain.handle('browser-reload', () => {
      if (this.mainWindow) {
        this.mainWindow.webContents.reload();
      }
    });

    // 处理主页
    ipcMain.handle('browser-home', () => {
      if (this.mainWindow) {
        this.mainWindow.loadFile('src/index.html');
      }
    });

    // 处理开发者工具
    ipcMain.handle('browser-devtools', () => {
      if (this.mainWindow) {
        this.mainWindow.webContents.toggleDevTools();
      }
    });
  }

  createMenu() {
    const template = [
      {
        label: '文件',
        submenu: [
          {
            label: '新建窗口',
            accelerator: 'CmdOrCtrl+N',
            click: () => {
              new BrowserApp().createMainWindow();
            }
          },
          {
            label: '关闭窗口',
            accelerator: 'CmdOrCtrl+W',
            role: 'close'
          },
          { type: 'separator' },
          {
            label: '退出',
            accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
            click: () => {
              this.app.quit();
            }
          }
        ]
      },
      {
        label: '编辑',
        submenu: [
          { label: '撤销', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
          { label: '重做', accelerator: 'Shift+CmdOrCtrl+Z', role: 'redo' },
          { type: 'separator' },
          { label: '剪切', accelerator: 'CmdOrCtrl+X', role: 'cut' },
          { label: '复制', accelerator: 'CmdOrCtrl+C', role: 'copy' },
          { label: '粘贴', accelerator: 'CmdOrCtrl+V', role: 'paste' },
          { label: '全选', accelerator: 'CmdOrCtrl+A', role: 'selectall' }
        ]
      },
      {
        label: '查看',
        submenu: [
          { label: '重新加载', accelerator: 'CmdOrCtrl+R', role: 'reload' },
          { label: '强制重新加载', accelerator: 'CmdOrCtrl+Shift+R', role: 'forceReload' },
          { label: '开发者工具', accelerator: 'F12', role: 'toggleDevTools' },
          { type: 'separator' },
          { label: '实际大小', accelerator: 'CmdOrCtrl+0', role: 'resetZoom' },
          { label: '放大', accelerator: 'CmdOrCtrl+Plus', role: 'zoomIn' },
          { label: '缩小', accelerator: 'CmdOrCtrl+-', role: 'zoomOut' },
          { type: 'separator' },
          { label: '全屏', accelerator: 'F11', role: 'togglefullscreen' }
        ]
      },
      {
        label: '历史',
        submenu: [
          {
            label: '后退',
            accelerator: 'Alt+Left',
            click: () => {
              if (this.mainWindow && this.mainWindow.webContents.canGoBack()) {
                this.mainWindow.webContents.goBack();
              }
            }
          },
          {
            label: '前进',
            accelerator: 'Alt+Right',
            click: () => {
              if (this.mainWindow && this.mainWindow.webContents.canGoForward()) {
                this.mainWindow.webContents.goForward();
              }
            }
          },
          {
            label: '主页',
            accelerator: 'Alt+Home',
            click: () => {
              if (this.mainWindow) {
                this.mainWindow.loadFile('src/index.html');
              }
            }
          }
        ]
      },
      {
        label: '帮助',
        submenu: [
          {
            label: '关于',
            click: () => {
              dialog.showMessageBox(this.mainWindow, {
                type: 'info',
                title: '关于',
                message: 'Electron 浏览器',
                detail: '一个使用 Electron 构建的简单浏览器\n版本 1.0.0'
              });
            }
          },
          {
            label: 'Test',
            click: () => {
              if (this.mainWindow) {
                this.mainWindow.loadURL('https://www.davidjones.com/search?q=Ultimate%20Cream');
              }
            }
          }
        ]
      }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
  }
}

// 启动应用
new BrowserApp();