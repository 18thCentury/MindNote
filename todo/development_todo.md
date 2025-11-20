# MindNote Development To-Do List

This document outlines the development tasks for the MindNote application, broken down into categories and individual, AI-executable to-do items. Each to-do item is designed to be a self-contained instruction for an AI to generate code or a plan, leveraging the shared data structures defined in `todo/shared_types.ts`.

---

## 1. Mindmap Module Development

### 1.1. Canvas Setup and Basic Rendering

#### To-Do: Initialize Vue-Flow Canvas
**AI Role:** Vue.js front-end developer, deeply familiar with `vue-flow` and its integration.
**Task:** Create the basic `MindmapCanvas.vue` component. Initialize a `vue-flow` instance with a minimal setup, including a placeholder root node. Ensure the canvas is responsive and fills its container.
**Assumptions:**
*   Vue 3 project structure with `<script setup>` is set up.
*   `vue-flow` library is installed and available.
*   Shared types from `todo/shared_types.ts` are available.
**Output Format:** Complete Vue 3 component code for `MindmapCanvas.vue`.

#### To-Do: Implement Root Node Styling
**AI Role:** UI/UX designer and Vue.js front-end developer, familiar with Material Design principles and `vue-flow` custom nodes.
**Task:** Design and implement the custom Vue 3 component for the root node (`MindmapCustomNode.vue`). Apply distinct styling (e.g., larger size, different background color, bold text) to visually differentiate it from child nodes. Ensure it uses the `MindmapNode` interface for its props.
**Assumptions:**
*   `MindmapCanvas.vue` is set up.
*   Shared types from `todo/shared_types.ts` are available.
**Output Format:** Complete Vue 3 component code for `MindmapCustomNode.vue` (specifically for the root node variant).

#### To-Do: Implement Child Node Styling
**AI Role:** UI/UX designer and Vue.js front-end developer, familiar with Material Design principles and `vue-flow` custom nodes.
**Task:** Design and implement the custom Vue 3 component for child nodes (`MindmapCustomNode.vue`). Apply appropriate styling (e.g., standard size, subtle background) that is consistent with Material Design and visually distinct from the root node. Ensure it uses the `MindmapNode` interface for its props.
**Assumptions:**
*   `MindmapCanvas.vue` is set up.
*   Shared types from `todo/shared_types.ts` are available.
**Output Format:** Complete Vue 3 component code for `MindmapCustomNode.vue` (specifically for the child node variant).

#### To-Do: Configure Node Connection Points
**AI Role:** Vue.js front-end developer, `vue-flow` expert.
**Task:** Configure `vue-flow` to ensure all nodes (root and child) have connection points only on their left and right sides.
**Assumptions:**
*   `MindmapCanvas.vue` and `MindmapCustomNode.vue` are implemented.
**Output Format:** Code snippet for `MindmapCanvas.vue` or `MindmapCustomNode.vue` demonstrating the connection point configuration.

#### To-Do: Implement Horizontal Mindmap Layout
**AI Role:** Vue.js front-end developer, `vue-flow` layout expert.
**Task:** Configure `vue-flow` to enforce a horizontal layout for the mindmap, where child nodes are consistently placed to the right of their parent nodes.
**Assumptions:**
*   `MindmapCanvas.vue` is implemented.
**Output Format:** Code snippet for `MindmapCanvas.vue` demonstrating the layout configuration.

### 1.2. Mindmap Interaction Logic

#### To-Do: Implement 'Tab' Key for New Child Node
**AI Role:** Vue.js front-end developer, Pinia store expert, interaction expert.
**Task:** Implement the 'Tab' key interaction in `MindmapCanvas.vue`. When a node is selected and 'Tab' is pressed, a new child node should be created, positioned to the right of the parent, and automatically focused for text editing. Update the Pinia `mindmapStore` accordingly.
**Assumptions:**
*   `MindmapCanvas.vue` is implemented.
*   `mindmapStore.ts` exists with `addNode` action.
*   Shared types from `todo/shared_types.ts` are available.
**Output Format:** Vue component code snippet for `MindmapCanvas.vue` event handler and Pinia store action.

#### To-Do: Implement 'Enter' Key for New Sibling Node
**AI Role:** Vue.js front-end developer, Pinia store expert, interaction expert.
**Task:** Implement the 'Enter' key interaction in `MindmapCanvas.vue`. When a node is selected and 'Enter' is pressed, a new sibling node should be created, positioned below the current node, and automatically focused for text editing. Ensure the new node is visible within the canvas. Update the Pinia `mindmapStore` accordingly.
**Assumptions:**
*   `MindmapCanvas.vue` is implemented.
*   `mindmapStore.ts` exists with `addNode` action.
*   Shared types from `todo/shared_types.ts` are available.
**Output Format:** Vue component code snippet for `MindmapCanvas.vue` event handler and Pinia store action.

#### To-Do: Implement 'Del' Key for Delete Node
**AI Role:** Vue.js front-end developer, Pinia store expert, interaction expert.
**Task:** Implement the 'Del' key interaction in `MindmapCanvas.vue`. When a node is selected and 'Del' is pressed, this node should be deleted. Update the Pinia `mindmapStore` accordingly.
**Assumptions:**
*   `MindmapCanvas.vue` is implemented.
*   `mindmapStore.ts` exists with `delNode` action.
*   Shared types from `todo/shared_types.ts` are available.
**Output Format:** Vue component code snippet for `MindmapCanvas.vue` event handler and Pinia store action.

#### To-Do: Implement Node Text Editing on Double-Click
**AI Role:** Vue.js front-end developer, interaction expert.
**Task:** Implement double-click functionality on `MindmapCustomNode.vue` to enable in-place editing of the node's text content.node's width should dynamically adjust to fit the text content during editing.
**Assumptions:**
*   `MindmapCustomNode.vue` is implemented.
*   Pinia `mindmapStore` has an action to update node text.
**Output Format:** Vue component code snippet for `MindmapCustomNode.vue` event handler and text input.

#### To-Do: Implement Expand/Collapse Child Nodes
**AI Role:** Vue.js front-end developer, `vue-flow` expert, interaction expert.
**Task:** Implement functionality to expand and collapse child nodes of a selected node. This should visually hide/show the child nodes and their connections.
**Assumptions:**
*   `MindmapCanvas.vue` and `MindmapCustomNode.vue` are implemented.
*   Pinia `mindmapStore` can manage node visibility/collapsed state.
**Output Format:** Vue component code snippets for `MindmapCustomNode.vue` (toggle button) and `MindmapCanvas.vue` (logic for hiding/showing children).

#### To-Do: Implement Right-Click Context Menu for Nodes
**AI Role:** Vue.js front-end developer, UI/UX designer, Element Plus expert.
**Task:** Implement a right-click context menu for nodes in `MindmapCanvas.vue`. The menu should include options : "Delete Node","Node Style","Pin Node","Add Image".
**Assumptions:**
*   `MindmapCanvas.vue` and `MindmapCustomNode.vue` are implemented.
*   Element Plus components are available.
*   Pinia `mindmapStore` has actions for deleting and updating node styles.
**Output Format:** Vue component code snippet for `MindmapCanvas.vue` or `MindmapCustomNode.vue` demonstrating the context menu.

#### To-Do: Implement Node Re-parenting & Sorting (Drag and Drop)
**AI Role:** Vue.js front-end developer, `vue-flow` expert, interaction expert.
**Task:** Implement the complex drag-and-drop logic in `MindmapCanvas.vue` to support two distinct operations upon drop:
1. **Sorting Insertion:** Placing the dragged node (`X`) as a sibling *before* or *after* a target node (`M`).
2. Parenting/Childing: Making the dragged node (X) a child of the target node (M) by dropping onto its center.
    This implementation must include real-time visual previews and call the appropriate Pinia actions based on the drop zone.
**Detailed Steps & Logic:**
* **Drag & Hot Zone Detection:** On `onNodeDrag`, continuously determine if `X` is hovering over the target node `M`'s:
    * **Upper Zone (Sorting):** Triggers `reorderNode` to insert `X` before `M`.
    * **right Zone (Parenting):** Triggers `reparentNode` without children to make `M` the new parent of `X`.
    * **Lower Zone (Sorting):** Triggers `reorderNode` to insert `X` after `M`.
* **Visual Preview:**
    * Show a **dashed line indicator** for Sorting zones.
    * Show target node **highlight/high-contrast border** for Parenting zones.
* **Root Elevation:** Drop on canvas background triggers `reparentNode` with `newParentId: null`.
**Assumptions & Requirements:**
* `MindmapCanvas.vue` is implemented and handles base drag events.
* **Pinia Actions (Required):**
    * `reparentNode({ draggedNodeId, newParentId })`
    * `reorderNode({ draggedNodeId, newParentId, targetNodeId, position: 'before'|'after' })`
* **Guardrail:** Must prevent **circular dependencies** (A cannot be dropped onto any of its descendants). Drop must be invalid in this case.
**Output Format:** Code snippet for `MindmapCanvas.vue` demonstrating the drag event handlers (`onNodeDrag`, `onNodeDragStop`) including the hot zone calculation logic and Pinia Action calls.

#### To-Do: Implement Image Insertion and Display (Drag and Drop)
**AI Role:** Vue.js front-end developer, UI/UX designer, `vue-flow` expert.
**Task:** Implement the ability to drag image into the mindmap. These nodes should display a thumbnail of the image.Drag and Drop logic is like the todo:"Implement Node Re-parenting & Sorting (Drag and Drop)". Upon dropping an image onto the sibling or a node, create a new image node at that position. Update the Pinia `mindmapStore` accordingly.
**Assumptions:**
*   `MindmapCanvas.vue` is implemented.
*   `MindmapCustomNode.vue` can render images.
*   Pinia `mindmapStore` can manage image node data.
**Output Format:** Vue component code snippets for `MindmapCanvas.vue` (insertion logic) and `MindmapCustomNode.vue` (image rendering).



## 2. Markdown Editor Module Development

#### To-Do: Integrate Toast UI Editor
**AI Role:** Vue.js front-end developer, Markdown expert.
**Task:** Integrate `@toast-ui/editor` into `MarkdownEditor.vue`. Set up a basic editor instance with real-time preview.
**Assumptions:**
*   Vue 3 project structure is set up.
*   `@toast-ui/editor` is installed.
**Output Format:** Complete Vue 3 component code for `MarkdownEditor.vue`.

#### To-Do: Implement Markdown Editor Table Editing
**AI Role:** Markdown expert, Vue.js front-end developer.
**Task:** Configure `@toast-ui/editor` in `MarkdownEditor.vue` to enable robust table editing functionality.
**Assumptions:**
*   `MarkdownEditor.vue` is implemented with `@toast-ui/editor`.
**Output Format:** Code snippet for `MarkdownEditor.vue` demonstrating table editing configuration.

#### To-Do: Implement Markdown Editor Image Pasting
**AI Role:** Vue.js front-end developer, Electron IPC expert, Markdown expert.
**Task:** Implement the image pasting functionality in `MarkdownEditor.vue`. When an image is pasted, it should be sent via IPC to the Electron main process for saving, and the editor should insert the returned image URL into the Markdown content.Implement an IPC call to `IPC_EVENTS.IMAGE_SAVE` to handle the image saving process.The image link new protocol is `mn://images/<filename>`.
**Assumptions:**
*   `MarkdownEditor.vue` is implemented with `@toast-ui/editor`.
*   `ipcRenderer.ts` utility is available.
*   `IPC_EVENTS.IMAGE_SAVE` is defined in `todo/shared_types.ts`.
**Output Format:** Vue component code snippet for `MarkdownEditor.vue` handling paste event and IPC call.

#### To-Do: Implement Markdown Editor - Mindmap Node Linkage
**AI Role:** Vue.js front-end developer, Pinia store expert.
**Task:** Implement the linkage between the Markdown editor and the Mindmap. When a node is selected in the Mindmap, `MarkdownEditor.vue` should automatically load and display the content of the associated Markdown file (`uuid.md`).
**Assumptions:**
*   `MarkdownEditor.vue` is implemented.
*   Pinia `mindmapStore` manages the currently selected node.
*   IPC call to Electron main process to read Markdown file content is available.
**Output Format:** Vue component code snippet for `MarkdownEditor.vue` watching selected node and loading content.

## 3. Footer Module Development

#### To-Do: Create Footer Component Structure
**AI Role:** Vue.js front-end developer, UI/UX designer, Element Plus expert.
**Task:** Create the `Footer.vue` component. Implement its basic structure to include a "Pin Area", ""Path display", and "Save Status" indicator. Use Element Plus components for a consistent UI.
**Assumptions:**
*   Vue 3 project structure is set up.
*   Element Plus components are available.
*   Shared types from `todo/shared_types.ts` are available.
**Output Format:** Complete Vue 3 component code for `Footer.vue`.

#### To-Do: Implement Pin Area Functionality
**AI Role:** Vue.js front-end developer, Pinia store expert, interaction expert.
**Task:** Implement the "Pin 区" in `Footer.vue`. It should display pinned nodes (using their `id` and `text`). Clicking a pinned node should trigger the Mindmap to display that node as the temporary root and update the Markdown editor. The actual Mindmap root node should always be pinned on the far left.
**Assumptions:**
*   `Footer.vue` structure is implemented.
*   Pinia `mindmapStore` manages pinned nodes and selected node.
*   Shared types from `todo/shared_types.ts` are available.
**Output Format:** Vue component code snippet for `Footer.vue`'s Pin Area logic.

#### To-Do: Implement Current Node Path Display
**AI Role:** Vue.js front-end developer, Pinia store expert.
**Task:** Implement the "Path" display in `Footer.vue`. It should show the path from the root node to the currently selected node in the Mindmap. The path segments should be clickable to navigate to that node.
**Assumptions:**
*   `Footer.vue` structure is implemented.
*   Pinia `mindmapStore` manages the currently selected node and provides a way to get its path.
*   Shared types from `todo/shared_types.ts` are available.
**Output Format:** Vue component code snippet for `Footer.vue`'s Path display logic.

#### To-Do: Implement File Save Status Display
**AI Role:** Vue.js front-end developer, Pinia store expert.
**Task:** Implement the "Save Status" indicator in `Footer.vue`. It should display the current file's save status (e.g., "Saved", "Unsaved", "Saving") based on the `FileStatus` enum.
**Assumptions:**
*   `Footer.vue` structure is implemented.
*   Pinia `fileStore` manages the `FileState` (including `fileStatus`).
*   Shared types from `todo/shared_types.ts` are available.
**Output Format:** Vue component code snippet for `Footer.vue`'s Save Status display logic.

## 4. Electron Module Development (IPC and File Operations)

#### To-Do: Implement IPC Event Handling in Main Process
**AI Role:** Electron back-end developer, Node.js file system expert.
**Task:** In `electron/main.ts`, set up IPC event listeners for all `IPC_EVENTS` defined in `todo/shared_types.ts`. These listeners will coordinate file operations and other main-process tasks.
**Assumptions:**
*   `electron/main.ts` is the main process entry point.
*   `todo/shared_types.ts` is available.
**Output Format:** Code snippet for `electron/main.ts` demonstrating IPC event listener setup.

#### To-Do: Implement New File Logic in Main Process
**AI Role:** Electron back-end developer, Node.js file system expert, ZIP handling expert.
**Task:** Implement the `IPC_EVENTS.FILE_NEW` handler in `electron/main.ts`. This handler should:
1.  Select a directory for the new mindmap project.
2.  Create a new temporary directory structure for the mindmap.
3.  Initialize a default `map.json` and an empty root node.
4.  Send the initial `MindmapData` and empty Markdown content back to the renderer.
5.  Update the `FileState` in the main process and notify the renderer.
**Assumptions:**
*   `electron/main.ts` is the main process entry point.
*   `todo/shared_types.ts` is available.
*   Node.js `fs` and `zlib` (or similar for ZIP) modules are available.
**Output Format:** Code snippet for `electron/main.ts` implementing the `FILE_NEW` IPC handler.

#### To-Do: Implement File Open Logic in Main Process
**AI Role:** Electron back-end developer, Node.js file system expert, ZIP handling expert.
**Task:** Implement the `IPC_EVENTS.FILE_OPEN` handler in `electron/main.ts`. This handler should:
1.  Receive the `.mn` file path from the renderer.
2.  Unzip the `.mn` file to a temporary directory.
3.  Read `map.json` and all `uuid.md` files from the temporary directory.
4.  Send the parsed `MindmapData` and Markdown contents back to the renderer.
5.  Update the `FileState` in the main process and notify the renderer.
**Assumptions:**
*   `electron/main.ts` is the main process entry point.
*   `todo/shared_types.ts` is available.
*   Node.js `fs` and `zlib` (or similar for ZIP) modules are available.
**Output Format:** Code snippet for `electron/main.ts` implementing the `FILE_OPEN` IPC handler.

#### To-Do: Implement File Save Logic in Main Process
**AI Role:** Electron back-end developer, Node.js file system expert, ZIP handling expert.
**Task:** Implement the `IPC_EVENTS.FILE_SAVE` handler in `electron/main.ts`. This handler should:
1.  Receive a `FileSavePayload` object from the renderer. This payload contains `mindmapData` and `markdownContents`.
2.  Write the `mindmapData` to `map.json` in the temporary directory.
3.  Iterate through the `markdownContents` record, writing each Markdown string to its corresponding `<uuid>.md` file in the `text/` subdirectory of the temporary directory.
4.  Zip the entire contents of the temporary directory into a `.mn` file.
5.  Overwrite the original `.mn` file.
6.  Update the `FileState` in the main process to `SAVED` and notify the renderer.
**Assumptions:**
*   `electron/main.ts` is the main process entry point.
*   `todo/shared_types.ts` (including `FileSavePayload`) is available.
*   Node.js `fs` and `zlib` (or similar for ZIP) modules are available.
**Output Format:** Code snippet for `electron/main.ts` implementing the `FILE_SAVE` IPC handler.

#### To-Do: Implement Image Save Logic in Main Process
**AI Role:** Electron back-end developer, Node.js file system expert.
**Task:** Implement the `IPC_EVENTS.IMAGE_SAVE` handler in `electron/main.ts`. This handler should:
1.  Receive base64 image data and a filename hint from the renderer.
2.  Save the image to the project's `images` directory within the temporary unzipped structure.
3.  Return the relative path to the saved image.
**Assumptions:**
*   `electron/main.ts` is the main process entry point.
*   `todo/shared_types.ts` is available.
*   Node.js `fs` module is available.
**Output Format:** Code snippet for `electron/main.ts` implementing the `IMAGE_SAVE` IPC handler.

#### To-Do: Implement IPC Renderer Utilities
**AI Role:** Electron front-end developer, TypeScript expert.
**Task:** Create/update `src/utils/ipcRenderer.ts` to provide type-safe utility functions for invoking IPC events from the renderer process to the main process (e.g., `ipcRenderer.invoke(IPC_EVENTS.FILE_OPEN, filePath)`).
**Assumptions:**
*   `electron` module is available in the preload script.
*   `IPC_EVENTS` from `todo/shared_types.ts` is available.
**Output Format:** Complete TypeScript code for `src/utils/ipcRenderer.ts`.

#### To-Do: Implement Graceful Application Shutdown
**AI Role:** Electron back-end developer, Node.js expert.
**Task:** Implement logic in `electron/main.ts` to handle application shutdown gracefully.
1.  Listen for the `close` event on the main `BrowserWindow`.
2.  In the handler, prevent the default close action immediately.
3.  Send an IPC message to the renderer process to ask if there are unsaved changes (i.e., if `fileStore.isDirty` is true).
4.  **If there are unsaved changes:**
    *   Display a `dialog.showMessageBox` with "Save", "Don't Save", and "Cancel" options.
    *   **Handle response:**
        *   **"Save":** Instruct the renderer to trigger the save flow. After the save is confirmed, quit the application.
        *   **"Don't Save":** Proceed to quit the application.
        *   **"Cancel":** Do nothing, the application remains open.
5.  **If there are no unsaved changes:**
    *   Proceed to quit the application.
6.  **Temporary File Cleanup:**
    *   Ensure that before the application fully quits (e.g., in the `will-quit` event), any temporary directory created for the session is recursively deleted. This cleanup must occur unless the user cancels the shutdown.
**Assumptions:**
*   `electron/main.ts` is the main process entry point.
*   An IPC channel is set up for the main process to query the renderer's `isDirty` state.
*   The path to the temporary directory is managed within the main process.
**Output Format:** Code snippets for `electron/main.ts` demonstrating the `close` event handler, IPC for checking dirty state, and cleanup logic.

## 5. Global State Management (Pinia Stores)

#### To-Do: Create Mindmap Pinia Store
**AI Role:** Vue.js front-end developer, Pinia store expert.
**Task:** Create `src/stores/mindmapStore.ts`. Define the state to hold `MindmapData` (nodes, selected node, etc.) and actions for adding, deleting, updating, and re-parenting nodes, as well as managing node selection and expansion/collapse.
**Assumptions:**
*   Pinia is set up.
*   Shared types from `todo/shared_types.ts` are available.
**Output Format:** Complete TypeScript code for `src/stores/mindmapStore.ts`.

#### To-Do: Create File Pinia Store
**AI Role:** Vue.js front-end developer, Pinia store expert.
**Task:** Create `src/stores/fileStore.ts`. Define the state to hold `FileState` (current file path, status, dirty flag) and actions for updating these properties.
**Assumptions:**
*   Pinia is set up.
*   Shared types from `todo/shared_types.ts` are available.
**Output Format:** Complete TypeScript code for `src/stores/fileStore.ts`.

#### To-Do: Create UI Pinia Store
**AI Role:** Vue.js front-end developer, Pinia store expert.
**Task:** Create `src/stores/uiStore.ts`. Define the state to hold `UIState` (pinned nodes, etc.) and actions for managing UI-specific states.
**Assumptions:**
*   Pinia is set up.
*   Shared types from `todo/shared_types.ts` are available.
**Output Format:** Complete TypeScript code for `src/stores/uiStore.ts`.

## 6. Main Application Integration

#### To-Do: Integrate Header Component
**AI Role:** Vue.js front-end developer, Element Plus expert.
**Task:** Integrate the `Header.vue` component into `App.vue`. Implement basic menu structure with placeholder click handlers for "File" -> "New", "Open", "Save", "Save As", "Close".
**Assumptions:**
*   `Header.vue` is implemented.
*   Element Plus components are available.
*   IPC utilities are available.
**Output Format:** Code snippet for `App.vue` integrating `Header.vue` and its menu actions.

#### To-Do: Implement 'File -> Save' Action
**AI Role:** Vue.js front-end developer, Pinia store expert, Electron IPC expert.
**Task:** Implement the click handler for the "File" -> "Save" menu item. This handler should:
1.  Check if a file is currently open (`currentFilePath` in `fileStore`). If not, trigger the 'Save As' logic instead.
2.  Gather the current `MindmapData` from the `mindmapStore`.
3.  Gather all loaded/modified Markdown contents from the relevant store(s).
4.  Construct the `FileSavePayload` object, including `mindmapData` and `markdownContents`.
5.  Set the file status to `SAVING` in the `fileStore`.
6.  Invoke the `IPC_EVENTS.FILE_SAVE` event, passing the `FileSavePayload` object to the main process.
7.  Upon successful completion, the main process will notify the renderer to update the file status to `SAVED`.
**Assumptions:**
*   `Header.vue` is integrated with menu items.
*   `mindmapStore`, `fileStore`, and a store holding Markdown content are available.
*   `FileSavePayload` interface is defined in `shared_types.ts`.
*   `ipcRenderer` utilities are available.
**Output Format:** Code snippet for the 'Save' action handler.

#### To-Do: Integrate Main View Components
**AI Role:** Vue.js front-end developer, layout expert.
**Task:** Integrate `MindmapCanvas.vue`, a splitter, and `MarkdownEditor.vue` into `MainView.vue`. Ensure the splitter allows resizing of the Mindmap and Markdown editor areas.
**Assumptions:**
*   `MindmapCanvas.vue` and `MarkdownEditor.vue` are implemented.
**Output Format:** Complete Vue 3 component code for `MainView.vue`.

#### To-Do: Integrate Footer Component
**AI Role:** Vue.js front-end developer.
**Task:** Integrate the `Footer.vue` component into `App.vue`.
**Assumptions:**
*   `Footer.vue` is implemented.
**Output Format:** Code snippet for `App.vue` integrating `Footer.vue`.

---

This structured to-do list, along with the shared types, should provide a clear roadmap for developing the MindNote application incrementally, with each step being an actionable instruction for an AI.

---

## 7. Custom Window Controls and Title Bar

#### To-Do: Create Frameless Window in Electron
**AI Role:** Electron back-end developer.
**Task:** Modify the `BrowserWindow` creation options in `electron/main.ts`. Set `frame` to `false` and `titleBarStyle` to `hidden` to create a frameless window without the default title bar and menu.
**Assumptions:**
*   `electron/main.ts` is the main process entry point.
**Output Format:** Code snippet for `electron/main.ts` showing the modified `BrowserWindow` options.

#### To-Do: Implement Draggable Header Region
**AI Role:** Vue.js front-end developer, UI/UX designer.
**Task:** In `Header.vue`, apply the CSS property `-webkit-app-region: drag` to the main header area that should function as the draggable title bar. Ensure that interactive elements like menus and buttons within this area have `-webkit-app-region: no-drag` applied so they remain clickable.
**Assumptions:**
*   `Header.vue` is implemented.
*   The application is running in a frameless Electron window.
**Output Format:** CSS code snippet for `Header.vue`.

#### To-Do: Add Custom Window Control Buttons
**AI Role:** Vue.js front-end developer, Electron IPC expert.
**Task:** Add minimize, maximize/unmaximize, and close buttons to the right side of `Header.vue`. These buttons should call corresponding methods that invoke IPC events to the main process (e.g., `WINDOW_MINIMIZE`, `WINDOW_MAXIMIZE`, `WINDOW_CLOSE`).
**Assumptions:**
*   `Header.vue` is implemented.
*   `ipcRenderer.ts` utility is available.
*   New IPC events for window control are defined in `shared_types.ts`.
**Output Format:** Vue component code snippet for `Header.vue` showing the buttons and their click handlers.

#### To-Do: Implement Window Control IPC Handlers
**AI Role:** Electron back-end developer.
**Task:** In `electron/main.ts`, implement the IPC handlers for `WINDOW_MINIMIZE`, `WINDOW_MAXIMIZE`, and `WINDOW_CLOSE`. These handlers will call the corresponding `BrowserWindow` methods (`win.minimize()`, `win.isMaximized() ? win.unmaximize() : win.maximize()`, `win.close()`). Also, add these new event names to the `IPC_EVENTS` enum in `shared_types.ts`.
**Assumptions:**
*   `electron/main.ts` is the main process entry point.
*   The `BrowserWindow` instance is accessible.
**Output Format:** Code snippets for `electron/main.ts` (IPC handlers) and `shared_types.ts` (updated enum).

---

## 8. Advanced Layout Engine

#### To-Do: Implement Dynamic, Content-Aware Node Layout
**AI Role:** Vue.js front-end developer, Pinia store expert, UI/UX expert.
**Task:** Refactor the `applyAutoLayout` function in `mindmapStore.ts` to create a dynamic layout that adapts to the rendered size of each node. This will replace the current static `xGap` and `yGap` logic. The implementation involves several steps:
1.  **Store Node Dimensions:** In `mindmapStore.ts`, add state to store the rendered dimensions of each node (e.g., `nodeDimensions: Map<string, { width: number, height: number }>`) and an action `setNodeDimensions(nodeId, dimensions)` to update it.
2.  **Measure and Report Node Size:** In `MindmapCustomNode.vue`, use a `ResizeObserver` to monitor the node's size. On mount and on size change, call the `setNodeDimensions` action to report its dimensions to the store.
3.  **Refactor `applyAutoLayout`:** Modify the layout algorithm to use the stored dimensions instead of fixed gaps. The node's `x` position should be based on its parent's position and width, and the `y` position should be centered relative to the total height of its children subtree.
4.  **Ensure New Node Visibility:** In `addChildNode` and `addSiblingNode` actions, after applying the layout, call `selectAndPanToNode(newNode.id)` to ensure the new node is visible.
5.  **Optimize with Debounce:** Wrap the `applyAutoLayout` call within `setNodeDimensions` with a `debounce` function to improve performance during rapid text editing.
**Assumptions:**
*   `mindmapStore.ts` exists with a basic `applyAutoLayout` function.
*   `MindmapCustomNode.vue` is the component responsible for rendering a single node.
*   The application uses Pinia for state management.
**Output Format:** A clear plan and subsequent code modifications for the store and components.


## 9. IsDirty State Management and History based Undo/Redo

#### To-Do: Implement isDirty State Management
**AI Role:** Vue.js front-end developer, Pinia store expert.
**Task:** Enhance the `fileStore` Pinia store to manage an `isDirty` state. This state should be set to `true` whenever changes are made to the mindmap or markdown content, and set to `false` after a successful save operation. Ensure that all relevant actions in the `mindmapStore` and markdown content store update the `isDirty` state appropriately.
**Assumptions:**
*   `fileStore.ts` exists with basic file state management.
*   `mindmapStore.ts` and markdown content store exist and have actions that modify content.
**Output Format:** Code modifications for `fileStore.ts`, `mindmapStore.ts`, and markdown content store to implement `isDirty` state management.

#### To-Do: Implement History-based Undo/Redo Functionality
**AI Role:** Vue.js front-end developer, Pinia store expert.
**Task:** Implement a history-based undo/redo functionality in the `mindmapStore` Pinia store. This should involve maintaining a history stack of mindmap states, allowing users to revert to previous states or redo changes. Implement actions `undo` and `redo` that modify the current mindmap state based on the history stack. Ensure that the `isDirty` state is updated accordingly during undo/redo operations.
**Assumptions:**
*   `mindmapStore.ts` exists with basic mindmap state management.
*   Pinia is set up for state management.
**Output Format:** Code modifications for `mindmapStore.ts` to implement history-based undo/redo functionality.
