# 优化 AI 需求文档/Prompt 的最佳实践 (针对 MindNote 项目)

作为逻辑专家、应用开发专家、Vue 开发专家和笔记开发专家，以下是针对 MindNote 项目，优化 AI 需求文档（Prompt）的五点通用建议及其专业解答和设置：

---

### 1. 定义 AI 的角色和具体任务 (Define AI's Role and Specific Task)

**专业解答/设置:**

这不仅仅是给 AI 一个头衔，更是设定其思考的“上下文”和“视角”。对于 MindNote 项目，你需要根据每次交互的具体目标，精细化 AI 的角色。

*   **角色 (Persona):**
    *   **通用开发任务:** `You are a senior full-stack developer (Vue 3, Electron, Node.js, TypeScript). Your code must be idiomatic, maintainable, follow best practices for each technology, and integrate seamlessly with the existing project structure.`
    *   **UI/UX 方面:** `You are a UI/UX designer and Vue.js front-end developer, deeply familiar with Material Design principles and Element Plus components. Focus on user-friendly interfaces, intuitive interactions, and consistency.`
    *   **数据结构/逻辑方面:** `You are a logic and data architecture expert for note-taking applications, focusing on robust, scalable, and efficient data models for mind maps. Ensure data integrity and clear boundaries between concerns.`
    *   **文件系统/IPC 方面:** `You are an Electron back-end developer and Node.js file system expert. Focus on secure, efficient, and robust file operations within the Electron main process, including ZIP handling and IPC communication.`

*   **具体任务 (Specific Task):**
    这必须是原子性的、可衡量的一个动作。避免模糊的指示如“改进 MindNote”。
    *   **Bad:** `请帮我设计 MindNote。` (Too broad)
    *   **Good:** `Task: Design and implement the TypeScript interfaces for the Mindmap node data structure, including all properties required by vue-flow for rendering and interaction, and ensuring compatibility with the .mn file format's map.json schema.`
    *   **Good:** `Task: Generate the Vue 3 component for the 'Header' section (Header.vue), including basic Element Plus menu structure and placeholder click handlers for 'File' -> 'New', 'Open', 'Save'.`
    *   **Good:** `Task: Outline the detailed plan for implementing the 'Tab' key interaction for creating child nodes in the Mindmap module, covering event handling, node creation, positioning logic, and state updates.`

**理由:**
清晰的角色能让 AI 采用正确的知识库和推理模式。精确的任务能让 AI 聚焦，并提供高度相关的输出，避免发散性或通用性回复。对于一个笔记软件，数据结构和用户交互是核心，AI 必须从这两个角度进行深入思考。

---

### 2. 优先级和任务分解 (Prioritize and Break Down Tasks)

**专业解答/设置:**

对于一个复杂的应用开发，任务分解是成功的关键。你需要引导 AI 像真实的项目经理一样，将大问题拆解成小块，并能识别其中的依赖关系。

*   **对 AI 的指令:**
    *   **分解大型需求:** `Given the 'Mindmap Module' requirements, break down its implementation into a series of smaller, sequential development tasks. For each task, identify its prerequisite knowledge or completed sub-tasks.`
    *   **优先级:** `Prioritize these tasks based on their criticality for core functionality and minimal viable product (MVP) delivery. Explain your reasoning.`

*   **实际操作:**
    假设你想开发 Mindmap 模块的“节点交互”部分：
    1.  **初始 prompt:** `You are a Vue.js developer... Task: Implement all mindmap node interactions (Tab, Enter, Drag, Double-click, Right-click context menu, Re-parenting) as described in work.md `
    2.  **AI 回复/你的细化:** AI 可能会提出一个大纲。你再逐个细化：
        *   `Now, focus on implementing the 'Tab' key interaction for creating new child nodes. Provide the Vue component code snippet for handling the keydown event and the Pinia store action for adding a new node.`
        *   `Next, implement the 'Enter' key interaction for creating sibling nodes. Consider its positioning relative to the current node.`

**理由:**
笔记软件的交互逻辑往往耦合度较高。如果一次性要求 AI 实现所有交互，很可能因为信息量过大或逻辑冲突导致结果不佳。通过任务分解，你可以逐步验证 AI 的输出，并在每个小阶段提供更精确的反馈。这符合敏捷开发中的“小步快跑，快速迭代”原则。

---

### 3. 明确说明假设 (Explicitly State Assumptions)

**专业解答/设置:**

AI 没有“常识性”的假设。它需要你明确告知当前环境和已完成的工作。这能避免 AI 重新发明轮子，或提供不适用于你当前项目状态的代码。

*   **对 AI 的指令:**
    *   `Assume the basic Vue 3 project structure with Vite, Pinia, and Element Plus is already set up.`
    *   `Assume the Electron main process for file I/O (fs module) and IPC communication (ipcMain, ipcRenderer) is already established and accessible via the preload script as described in ipcRenderer.ts. You only need to focus on the renderer process (Vue component) part.`
    *   `Assume map.json parsing and initial Mindmap data loading into the Pinia store is already handled.`
    *   `When designing image pasting, assume the Node.js layer has a utility function, 'saveImageToProject(base64Data, filenameHint)', that handles file system writes. Your task is to integrate with this existing API.`

**理由:**
笔记应用，尤其是涉及到文件系统操作和跨进程通信 (Electron)，有明显的层次划分。明确假设能让 AI 专注于它被要求解决的那一层问题，即它可以忽略 Main 进程代码，只关注 Renderer 进程的 Vue 组件逻辑，或反之。这大大减少了 AI 误解上下文的可能性。

---

### 4. 指定输出格式 (Specify Output Format)

**专业解答/设置:**

AI 的输出格式直接影响你使用其结果的效率。你需要精确规定你希望得到什么。

*   **对 AI 的指令:**
    *   **代码:** `Provide the complete TypeScript code for the Vue 3 component (using <script setup> syntax). Include necessary imports, reactive state, computed properties, methods, and a basic template structure with Element Plus components. Ensure all types are explicitly defined.`
    *   **接口设计:** `Define the TypeScript interfaces for the Mindmap node and map.json schema. Use JSDoc comments to describe each property.`
    *   **数据流图:** `Describe the data flow for 'saving a .mn file' using a numbered list, detailing the steps from user action in the renderer to file system operations in the main process and back to UI updates. Alternatively, use a Mermaid.js sequence diagram.`
    *   **功能计划:** `Provide a detailed implementation plan in Markdown format, using a hierarchical structure (## for module, ### for feature, **** for sub-task), outlining the necessary code changes, potential challenges, and integration points.`
    *   **UI 方案:** `Describe the UI/UX solution for the 'Pin' area in the Footer, detailing its appearance, interactive elements, and their behavior upon selection. Use a text-based wireframe if necessary.`
    *   **代码片段:** `Only provide the specific code snippet for the 'keydown' event handler within the MindmapCanvas.vue component, not the entire file.`

**理由:**
笔记软件需要严谨的类型定义和清晰的架构。通过指定输出格式，比如要求 TypeScript 接口或 Mermaid 图，你可以强制 AI 以结构化的方式思考和表达，这有助于你快速理解和集成其输出。这还能确保代码风格和项目规范的一致性。

---

### 5. 提供上下文代码/示例 (Provide Contextual Code/Examples)

**专业解答/设置:**

AI 学习能力很强，但它需要学习的“语料”是你项目本身的风格和模式。提供现有代码作为示例，能显著提高 AI 生成代码的质量和一致性。

*   **对 AI 的指令:**
    *   **结构演示:** `Here is an example of another Vue 3 component in our project (e.g., src/components/Footer.vue). Follow this structure, naming conventions, and <script setup> usage when generating new components:`
        ```vue
        <script setup lang="ts">
        import { ref } from 'vue';
        // ... existing imports
        </script>

        <template>
          <!-- ... existing template -->
        </template>

        <style scoped lang="scss">
        /* ... existing styles */
        </style>
        ```
    *   **Pinia Store 示例:** `Here's how we define actions and state in our Pinia stores (e.g., src/stores/mindmapStore.ts). Design the new store actions for node manipulation following this pattern:`
        ```typescript
        import { defineStore } from 'pinia';
        // ... existing types

        export const useMindmapStore = defineStore('mindmap', {
          state: () => ({
            nodes: [] as MindmapNode[],
            selectedNodeId: null as string | null,
          }),
          actions: {
            addNode(parentNodeId: string, newNode: MindmapNode) {
              // ...
            },
            // ... existing actions
          },
          // ... existing getters
        });
        ```
    *   **IPC 调用模式:** `Our Electron IPC calls follow this pattern (e.g., src/utils/ipcRenderer.ts). Ensure your new IPC calls adhere to this structure:`
        ```typescript
        import { ipcRenderer } from 'electron';
        import { IPC_EVENTS } from '../types/shared';

        export const someIpcCall = async (arg: string): Promise<SomeResultType> => {
          return ipcRenderer.invoke(IPC_EVENTS.SOME_EVENT, arg);
        };
        // ... existing IPC utilities
        ```

**理由:**
Vue 3 (`<script setup>`), Element Plus, Pinia,和 Electron IPC 都有其特定的开发模式和最佳实践。与其让 AI 猜测或使用通用的模式，不如直接提供你项目中正在使用的具体例子。这可以确保 AI 生成的代码在风格、结构和 API 调用方面与现有代码保持高度一致，减少重构的工作量。

---

通过以上细致的设置和指令，你将能够更有效地与 AI 协作，使其成为 MindNote 开发团队中一名高效且遵循规范的“成员”。请记住，每一次与 AI 的交互都是一次学习和迭代的过程，根据 AI 的输出不断优化你的 prompt 是关键。
