# MindNote 开发文档

## 1. 项目简介

MindNote 是一款桌面端笔记软件，核心特点是使用思维导图（Mindmap）来组织笔记节点，每个节点关联一个 Markdown 文件。旨在提供一个直观、高效的笔记管理体验。

## 2. 技术栈与约束

*   **前端框架**: Vue 3 (`<script setup lang="ts">` 语法)
*   **组件库**: Element Plus
*   **状态管理**: Pinia
*   **构建工具**: Vite
*   **桌面运行**: Electron
*   **文件操作**: Node.js `fs` 模块 (用于读写 zip / 图片 / markdown 文件)
*   **压缩/解压**: Node.js 层实现，不使用前端 JSZip 库
*   **Markdown 编辑器**: `@toast-ui/editor`
*   **思维导图**: `vue-flow`
*   **语言**: 所有代码使用 TypeScript，遵循命名规范，结构清晰，可维护。

## 3. 界面结构 (App.vue)

```
App.vue
 ├── Header        // 顶部菜单栏：文件:新建,打开,保存,另存为,关闭 / 配置:节点样式,排版样式,连线样式,首选项 / 帮助:关于/--/关闭按钮
 ├── Main
 │    ├── Mindmap  // 左侧思维导图区域（vue-flow）
 │    ├── splitter  // 可拖动分割线
 │    └── MarkdownEditor // 右侧 markdown 编辑器
 └── Footer        // 底部状态栏：Pin 区 + 路径(可以点击跳转) + 保存状态
```

## 4. 核心模块功能

### 4.1. 思维导图 (Mindmap) 模块

*   **数据结构**: 每个节点包含以下核心属性 (TypeScript 接口表示):
    ```typescript
    interface MindmapNode {
      id: string; // Unique identifier for the node (UUID)
      text: string; // Display text of the node
      children: MindmapNode[]; // Array of child nodes
      markdown: string; // File name of the associated Markdown content (e.g., "uuid.md")
      image: string; // image file name associated with the node (e.g., "img1.png")
    }
    ```
*   **交互功能**:
    *   `Tab` 键: 新建子节点，并自动聚焦到新节点进行编辑。
    *   `Enter` 键: 新建兄弟节点，并自动聚焦到新节点进行编辑,移动该节点保持画布内可见。
    *   拖拽节点: 通过鼠标左键拖动节点，改变其在画布上的位置。靠近某个节点时,被拖拽节点将成为目标节点的子节点（实现节点重新父化）。拖动时，目标节点将高亮显示以提示用户。预先显示父化位置(虚线+虚线node), 当释放鼠标时，完成节点的重新父化操作。
    *   双击节点: 可编辑节点的文本内容。编辑节点时,按 `Enter` 键保存修改，按 `Esc` 键取消编辑。编辑节点时,不触发新建节点操作,不可拖拽节点。
    *   展开/收起子节点。
    *   插入图片节点 (支持缩略图显示)。点击图片节点可在 Markdown 编辑器中查看和编辑其关联的内容。双击图片节点显示大图预览。
    *   节点连接点: 节点的连接点统一改为左右两侧。
    *   Mindmap 方向: 思维导图的布局方向统一为水平方向，子节点放置在父节点的右侧。
    *   右键点击节点: 弹出上下文菜单，包含“删除节点/修改节点样式”选项。

### 4.2. Markdown 编辑器模块

*   基于 `@toast-ui/editor` 实现。
*   支持实时预览功能。
*   支持表格编辑。
*   图片粘贴功能: 粘贴的图片将通过 IPC 调用，由 Electron 主进程的 Node.js 层处理并保存到项目 `images` 目录下，并在 Markdown 中自动生成引用链接。
*   与 Mindmap 联动: 选择 Mindmap 节点后，自动加载并显示对应关联的 Markdown 文件 (`uuid.md`)。


### 4.3. Pin 与状态栏逻辑

*   **Pin 功能**: 用户可以固定 (Pin) 多个思维导图节点。
*   点击 Pin 节点: 在状态栏点击已固定的节点后，Mindmap 视图将以该节点为临时根节点显示，同时 Markdown 编辑器自动切换并加载该节点关联的文档。
*   **默认 Pin**: 状态栏的 Pin 区域最左侧默认固定实际 Mindmap 的根节点。
*   **状态栏显示**: 底部状态栏实时显示当前选中节点的路径和文件的保存状态 (已保存/未保存/保存中)。


### 4.4. 文件系统 (.mn 文件格式)

*   **文件结构**: MindNote 的文件 (`.mn`) 实际上是一个 ZIP 压缩包，内部结构如下：
    ```
    note.mn (zip)
     ├── map.json       // 存储思维导图的结构数据
     ├── text/
     │   ├── <uuid>.md  // 存储各个节点的 Markdown 内容
     └── images/
         ├── img1.png // 存储节点关联的图片文件
    ```
*   **打开文件**:
    1.  Electron 主进程接收打开 `.mn` 文件的请求。
    2.  Node.js 层负责将 `.mn` 文件（ZIP 压缩包）解压到临时目录。
    3.  读取临时目录中的 `map.json` 文件，并将其内容加载到 Pinia store 以构建思维导图数据。
    4.  根据 `map.json` 中节点关联的 `uuid.md` 信息，加载对应的 Markdown 文档内容到 Pinia store。
*   **保存文件**:
    1.  当用户触发保存操作时，前端将当前思维导图数据 (`map.json` 内容)、所有关联的 Markdown 内容和图片信息发送到 Electron 主进程。
    2.  Electron 主进程的 Node.js 层将这些数据写入到临时目录中对应的文件。
    3.  将临时目录中的所有内容（包括更新后的 `map.json`、Markdown 文件和 `images` 目录）重新压缩为 `.mn` 文件。
    4.  覆盖原有的 `.mn` 文件，完成保存。
*   **版本控制**: 不需要内置版本控制功能。


## 5. 架构扩展(本次不实现，未来可考虑)

*   **标签系统**: 如何添加标签系统以更好地组织和搜索节点。
*   **节点搜索**: 实现全局节点搜索功能。
*   **多窗口支持**: 考虑如何支持多个 MindNote 窗口同时打开。
*   **插件系统**: 抽象插件系统或 Markdown 同步机制，以增强可扩展性。
