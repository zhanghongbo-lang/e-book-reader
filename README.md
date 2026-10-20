# 电子书阅读器（E-Book Reader）

一款极简的本地 **TXT / EPUB** 阅读器桌面应用。核心体验一句话：**导入即读，读到哪记住哪。**

基于 Electron + React + TypeScript 构建，纯本地运行，不联网、无账号、无书城。

## 功能特性

- **文件导入**：通过文件对话框多选导入 TXT / EPUB 文件。
- **编码检测**：TXT 自动识别编码（UTF-8 BOM → 合法 UTF-8 → jschardet → GB18030 兜底），统一转码展示，中文不乱码。
- **书架**：展示书名 + 阅读进度（未读 / 已读），支持删除（同时删除本地文件与进度）。
- **阅读器**：全文连续滚动，虚拟滚动只渲染可见区域，大文件不卡顿。
- **阅读进度**：按**字符偏移**自动记忆（退出 / 返回时保存），下次打开回到上次位置。
- **目录**：TXT 通过正则识别「第 X 章」等章节标题；EPUB 优先使用内置目录（NCX / nav）。
- **文内搜索**：大小写不敏感，高亮全部命中，支持上一个 / 下一个跳转。
- **高亮与批注**：划词高亮、添加批注、批注管理，本地持久化。
- **阅读设置**：字号、行距可调；三种主题（浅色 / 米黄 / 深色）；四种字体（系统 / 衬线 / 无衬线 / 等宽）。
- **纯本地**：书籍列表、进度、批注均存为本地 JSON 文件。

## 技术栈

| 层 | 技术 |
|----|------|
| 桌面框架 | Electron |
| 构建工具 | electron-vite |
| UI | React 19 + TypeScript |
| 虚拟滚动 | @tanstack/react-virtual |
| 编码检测 / 解码 | jschardet + iconv-lite |
| EPUB 解包 | jszip |
| 测试 | Vitest |
| 打包 | electron-builder |

## 快速开始

### 环境要求

- Node.js 20+（建议使用最新 LTS）
- npm

### 安装依赖

```bash
npm install
```

### 开发运行

```bash
npm run dev
```

### 类型检查

```bash
npm run typecheck
```

### 运行测试

```bash
npm test
```

### 构建（编译到 `out/`）

```bash
npm run build
```

### 打包（生成安装包 / 免安装版）

```bash
# 打包 Windows 安装包（NSIS）
npm run dist:win

# 打包当前平台
npm run dist
```

产物输出到 `dist/` 目录：

- `dist/E-Book Reader Setup <版本>.exe` — 安装包
- `dist/win-unpacked/E-Book Reader.exe` — 免安装绿色版，双击即可运行

> 说明：为方便国内网络环境，Electron 与打包工具链已配置 npmmirror 镜像（见 `package.json` 的 `electronDownload.mirror` 与 `dist` 脚本）。

## 项目结构

```
e-book-reader/
├─ src/
│  ├─ main/                 # Electron 主进程
│  │  ├─ index.ts           # 窗口创建
│  │  ├─ ipc.ts             # IPC 处理器（导入 / 读取 / 进度 / 批注）
│  │  ├─ store.ts           # 书籍列表持久化（JSON）
│  │  ├─ annotations.ts     # 批注持久化（JSON）
│  │  └─ lib/
│  │     ├─ encoding.ts     # 编码检测与解码
│  │     ├─ normalize.ts    # 换行符归一化
│  │     ├─ chapters.ts     # TXT 章节识别
│  │     └─ epub.ts         # EPUB 解包与正文提取
│  ├─ preload/
│  │  └─ index.ts           # contextBridge 暴露白名单 API
│  ├─ renderer/             # 渲染进程（React）
│  │  └─ src/
│  │     ├─ pages/
│  │     │  ├─ Shelf.tsx    # 书架
│  │     │  └─ Reader.tsx   # 阅读器
│  │     ├─ settings.ts     # 阅读设置与主题
│  │     ├─ App.tsx
│  │     └─ styles.css
│  └─ shared/               # 主 / 渲染进程共享代码
│     ├─ types.ts           # 类型定义
│     └─ lib/
│        ├─ search.ts       # 文内搜索
│        └─ annotations.ts  # 高亮 / 批注切分
├─ electron.vite.config.ts
├─ vitest.config.mts
├─ package.json
├─ PRD.md                   # 产品需求文档
└─ TECH_DESIGN.md           # 技术设计文档
```

## 数据存储

所有数据均存放在 Electron 的 `userData` 目录（本地 JSON 文件），不依赖任何云服务：

- `books.json` — 书籍列表与阅读进度
- `annotations.json` — 高亮与批注
- `localStorage` — 阅读设置（主题 / 字号 / 行距 / 字体）

## License

[MIT](LICENSE)
