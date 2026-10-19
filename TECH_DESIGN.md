# 电子书阅读器 MVP 技术设计文档（TECH_DESIGN）

## 1. 技术选型

| 层 | 选择 | 说明 |
|----|------|------|
| 桌面框架 | **Electron** | 跨平台桌面应用 |
| 脚手架 | **electron-vite** | Vite 驱动，TS 支持好，主 / 渲染进程结构清晰 |
| UI 框架 | **React + TypeScript** | 生态最全，虚拟滚动方案成熟 |
| 样式 | 纯 CSS + CSS 变量 | 白色主题下够用；变量为后续深色留口子 |
| 编码检测 | `jschardet` | 识别 GBK / UTF-8 等 |
| 编码解码 | `iconv-lite` | 把检测出的编码解码成统一字符串 |
| 虚拟滚动 | `@tanstack/react-virtual`（或 `react-window`） | 大文件只渲染可见区域 |
| 本地存储 | `electron-store` | JSON 文件存书籍列表和进度，MVP 够用 |
| 状态管理 | `zustand`（或 React Context） | 书架 / 阅读状态 |

> 说明：进度和书籍列表用 `electron-store` 就够了，不必上 SQLite；需要全文搜索或大批量数据时再换 `better-sqlite3`。

## 2. 总体架构（进程模型）

Electron 分**主进程**和**渲染进程**：文件读写、对话框放主进程，UI 放渲染进程，中间通过 IPC 通信。

```
主进程 (main)：文件对话框、读文件、编码检测、持久化
   │  IPC（invoke/handle）
渲染进程 (renderer)：书架 UI、阅读器 UI、虚拟滚动
```

安全默认值（必须保持）：

- `contextIsolation: true`（渲染进程隔离）
- `nodeIntegration: false`（渲染进程不开 Node）
- 通过 `preload` 脚本用 `contextBridge` 暴露白名单 API

## 3. 目录结构

```
e-book-reader/
├─ src/
│  ├─ main/            # 主进程
│  │  ├─ index.ts      # 窗口创建、IPC 注册
│  │  ├─ ipc.ts        # 文件读写、对话框、存储处理器
│  │  └─ store.ts      # electron-store 封装
│  ├─ preload/
│  │  └─ index.ts      # contextBridge 暴露 API
│  └─ renderer/        # 渲染进程（React）
│     └─ src/
│        ├─ pages/
│        │  ├─ Shelf.tsx    # 书架
│        │  └─ Reader.tsx   # 阅读器
│        ├─ components/
│        └─ store/          # 状态管理
├─ electron.vite.config.ts
└─ package.json
```

## 4. 核心模块设计

### 4.1 文件导入与编码检测

1. 主进程 `dialog.showOpenDialog`（支持多选 + 过滤 `.txt`），返回文件路径。
2. 读文件为 `Buffer`。
3. 编码检测：`jschardet.detect(buffer)`。
4. 解码：`iconv-lite.decode(buffer, encoding)` 得到统一字符串。

**编码兜底顺序**：优先判断 UTF-8 BOM → 无 BOM 时判断 UTF-8 是否合法 → 否则按 `jschardet` 结果 → 最终兜底 GBK。

**换行符归一化**：TXT 中 `\r\n`、`\n`、`\r` 混用常见，解码后统一成 `\n`，否则按行切分虚拟滚动会出错。

### 4.2 阅读器渲染与虚拟滚动

- 全文按段落 / 行切分，用虚拟滚动只渲染可视区。
- **不要**一次性把几 MB 文本塞进 DOM，否则大文件会卡死渲染进程。

### 4.3 阅读进度

- 以**字符偏移量**记录（滚动时记录第一个可见字符的偏移）。
- 退出 / 翻页时写回 `electron-store`。
- 用字符偏移而非字节偏移：解码后字符串里的索引才是稳定位置，字节偏移在编码转换后会错位。

### 4.4 阅读设置

- 字号、行距用 CSS 变量控制。
- 主题色也走变量（目前只有白色一个值），为后续深色 / 米黄留口子。

## 5. 关键流程

```
导入：renderer 调用 API → main 打开对话框 → 读文件 → 检测编码 → 解码 → 存入 store → 返回书籍列表
打开阅读：renderer 请求书籍内容 + 进度 → 切分渲染 → 滚动时更新偏移
退出：renderer 上报当前偏移 → main 写回 store
```

## 6. 关键坑点与对策

- **大文件别整段进 DOM**：全文切块后虚拟化。
- **IPC 传大文本**：几 MB 以内 `ipcRenderer.invoke` 直接传字符串没问题；超大文件后续改流式 / 分块读取。
- **进度用字符偏移而非字节**：避免编码转换后错位。
- **electron-store 在渲染进程访问**：通过 IPC 由主进程读写，渲染进程不直接碰文件系统。

## 7. 后续演进

- 全文搜索时引入 `better-sqlite3`。
- 超大文件改为分块 / 流式读取。
- 目录功能：正则识别"第 X 章"做轻量章节跳转。
