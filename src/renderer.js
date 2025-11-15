class BrowserRenderer {
    constructor() {
        this.webview = document.getElementById('webview');
        this.startPage = document.getElementById('start-page');
        this.urlInput = document.getElementById('url-input');
        this.quickSearch = document.getElementById('quick-search');
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupWebView();
        // this.updateNavigationButtons();
    }

    setupEventListeners() {
        // 导航按钮
        document.getElementById('back-btn').addEventListener('click', () => {
            if (this.webview.canGoBack()) {
                this.webview.goBack();
            }
        });

        document.getElementById('forward-btn').addEventListener('click', () => {
            if (this.webview.canGoForward()) {
                this.webview.goForward();
            }
        });

        document.getElementById('reload-btn').addEventListener('click', () => {
            this.webview.reload();
        });

        document.getElementById('home-btn').addEventListener('click', () => {
            this.showStartPage();
        });

        // 地址栏导航
        document.getElementById('go-btn').addEventListener('click', () => {
            this.navigateToUrl(this.urlInput.value);
        });

        this.urlInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.navigateToUrl(this.urlInput.value);
            }
        });

        // 快速搜索
        document.getElementById('quick-go').addEventListener('click', () => {
            this.navigateToUrl(this.quickSearch.value);
        });

        this.quickSearch.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.navigateToUrl(this.quickSearch.value);
            }
        });

        // 快速链接
        document.querySelectorAll('.quick-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                this.navigateToUrl(link.href);
            });
        });

        // 开发者工具
        document.getElementById('devtools-btn').addEventListener('click', () => {
            this.webview.openDevTools();
        });

        // 菜单按钮
        document.getElementById('menu-btn').addEventListener('click', () => {
            this.showContextMenu();
        });
    }

    setupWebView() {
        // 页面开始加载
        this.webview.addEventListener('load-start', () => {
            this.setLoading(true);
            this.updateStatus('页面加载中...');
        });

        // 页面加载完成
        this.webview.addEventListener('load-commit', (e) => {
            this.urlInput.value = e.url; // yazz
            console.log (e.url)
            console.log (e)
            this.updateStatus('页面加载完成');
        });

        // DOM 加载完成
        this.webview.addEventListener('dom-ready', () => {
            this.setLoading(false);
            this.updateNavigationButtons();
        });

        // 页面标题更新
        this.webview.addEventListener('page-title-updated', (e) => {
            document.title = `${e.title}`;
        });

        // 导航状态变化
        this.webview.addEventListener('did-navigate', () => {
            this.updateNavigationButtons();
            this.hideStartPage();
        });

        this.webview.addEventListener('did-navigate-in-page', () => {
            this.updateNavigationButtons();
        });

        // 加载错误
        this.webview.addEventListener('did-fail-load', (e) => {
            this.setLoading(false);
            if (e.errorCode !== -3) { // 忽略导航取消错误
                this.updateStatus(`加载失败: ${this.getErrorDescription(e.errorCode)}`);
            }
        });

        // 上下文菜单
        this.webview.addEventListener('context-menu', (e) => {
            e.preventDefault();
            this.showWebViewContextMenu(e);
        });
    }

    navigateToUrl(input) {
        let url = input.trim();
        
        if (!url) return;

        // 如果输入的不是完整的 URL，添加 https:// 前缀或进行搜索
        if (!url.includes('://')) {
            if (url.includes('.') && !url.includes(' ')) {
                url = 'https://' + url;
            } else {
                url = 'https://www.google.com/search?q=' + encodeURIComponent(url);
            }
        }

        // 确保有协议
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'https://' + url;
        }

        try {
            new URL(url); // 验证 URL 格式
            this.webview.src = url;
            this.urlInput.value = url;
            this.hideStartPage();
        } catch (e) {
            this.updateStatus('无效的 URL');
        }
    }

    showStartPage() {
        this.startPage.classList.remove('hidden');
        this.webview.classList.add('hidden');
        this.urlInput.value = '';
        this.updateStatus('就绪');
    }

    hideStartPage() {
        this.startPage.classList.add('hidden');
        this.webview.classList.remove('hidden');
    }

    setLoading(loading) {
        const navbar = document.querySelector('.navbar');
        if (loading) {
            navbar.classList.add('loading');
            this.updateStatus('加载中...');
        } else {
            navbar.classList.remove('loading');
        }
    }

    updateNavigationButtons() {
        document.getElementById('back-btn').disabled = !this.webview.canGoBack();
        document.getElementById('forward-btn').disabled = !this.webview.canGoForward();
    }

    updateStatus(message) {
        document.getElementById('status-text').textContent = message;
    }

    getErrorDescription(errorCode) {
        const errors = {
            '-2': '连接超时',
            '-3': 'URL 无效',
            '-6': '连接失败',
            '-105': '主机名无法解析',
            '-106': '连接被拒绝',
            '-324': '连接重置'
        };
        return errors[errorCode] || `错误代码: ${errorCode}`;
    }

    showContextMenu() {
        // 简单的上下文菜单实现
        const menu = [
            { label: '新建窗口', action: () => window.yazz_api?.newWindow() },
            { label: '重新加载', action: () => this.webview.reload() },
            { label: '开发者工具', action: () => this.webview.openDevTools() },
            { label: '查看页面源代码', action: () => this.webview.openDevTools() }
        ];

        // 这里可以集成 electron-context-menu 包获得更完整的功能
        console.log('显示上下文菜单');
    }

    showWebViewContextMenu(e) {
        // webview 内部的上下文菜单
        // 在实际应用中，可以使用 electron-context-menu 包
        console.log('WebView 上下文菜单', e);
    }
}

// 当 DOM 加载完成时初始化浏览器
document.addEventListener('DOMContentLoaded', () => {
    new BrowserRenderer();
});

// 处理键盘快捷键
document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + L 聚焦地址栏
    if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
        e.preventDefault();
        document.getElementById('url-input').focus();
        document.getElementById('url-input').select();
    }
    
    // F5 刷新
    if (e.key === 'F5') {
        e.preventDefault();
        document.getElementById('reload-btn').click();
    }
    
    // Ctrl/Cmd + R 刷新
    if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
        e.preventDefault();
        document.getElementById('reload-btn').click();
    }
});