# MindNote

MindNote is a modern desktop application that seamlessly combines mind mapping with Markdown note-taking. It allows you to organize your thoughts visually and elaborate on them with rich text content, all in one integrated environment.

## Features

-   **Visual Mind Mapping**: Create and organize nodes in an infinite canvas using [Vue Flow](https://vueflow.dev/).
-   **Integrated Markdown Editor**: Edit node content with a powerful Markdown editor powered by [Toast UI Editor](https://ui.toast.com/tui-editor).
-   **File Management**: Save your work as `.mn` files (custom archive format) containing your mindmap structure, markdown content, and images.
-   **Rich Media Support**: Drag and drop images directly onto nodes or into the editor.
-   **Customizable Themes**:
    -   Built-in Light and Dark modes (syncs with system settings).
    -   Customizable node styles (colors, borders, shapes).
    -   Customizable connection lines and background patterns.
-   **Keyboard Shortcuts**:
    -   `Tab`: Add child node.
    -   `Enter`: Add sibling node.
    -   `Delete` / `Backspace`: Delete selected node(s).
    -   `Ctrl+N`: New file.
    -   `Ctrl+O`: Open file.
    -   `Ctrl+S`: Save file.
    -   `Ctrl+Shift+S`: Save As.
    -   `Ctrl+Z` / `Ctrl+Y`: Undo / Redo.

## Tech Stack

-   **Core**: [Electron](https://www.electronjs.org/), [Vue 3](https://vuejs.org/), [TypeScript](https://www.typescriptlang.org/)
-   **Build Tool**: [Vite](https://vitejs.dev/)
-   **State Management**: [Pinia](https://pinia.vuejs.org/)
-   **UI Framework**: [Element Plus](https://element-plus.org/)
-   **Mindmap Library**: [Vue Flow](https://vueflow.dev/)
-   **Editor**: [Toast UI Editor](https://ui.toast.com/tui-editor)
-   **Styling**: SCSS

## Getting Started

### Prerequisites

-   Node.js (v16 or higher recommended)
-   npm

### Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/18thCentury/MindNote.git
    cd MindNote
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

## Development

To start the development server with hot reload:

```bash
# Terminal 1: Build Vue renderer (watch mode not enabled by default in this script, run manually if needed)
npm run vue

# Terminal 2: Start Electron
npm run dev
```

*Note: The current `npm run dev` script compiles the main process and starts Electron. You may need to rebuild the renderer (`npm run vue`) if you make changes to Vue files.*

## Build

To build the application for production (Windows):

```bash
npm run build
```

This command will:
1.  Build the Vue renderer (`npm run build:renderer`).
2.  Compile the Electron main process and package the application (`npm run build:electron`).

The output installer/executable will be in the `release` directory.

## License

[ISC](LICENSE)
