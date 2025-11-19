<script setup lang="ts">
import { ref, onMounted, watch, onBeforeUnmount } from "vue";
import Editor from "@toast-ui/editor";
import "@toast-ui/editor/dist/toastui-editor.css";
import tableExtension from "@toast-ui/editor-plugin-table-merged-cell";
import "@toast-ui/editor-plugin-table-merged-cell/dist/toastui-editor-plugin-table-merged-cell.css";
import { useFileStore } from "../stores/fileStore";
import { useEditorStore } from "../stores/editorStore";
import { ElMessage } from "element-plus";

interface Props {
    initialContent: string;
    currentNodeId: string | null;
}

const props = defineProps<Props>();
const emit = defineEmits(["content-changed"]);

const editorRef = ref<HTMLElement | null>(null);
let editorInstance: Editor | null = null;
const fileStore = useFileStore();
const editorStore = useEditorStore();

onMounted(() => {
    if (editorRef.value) {
        editorInstance = new Editor({
            el: editorRef.value,
            height: "100%",
            initialEditType: "wysiwyg",
            previewStyle: "vertical",
            initialValue: props.initialContent,
            plugins: [tableExtension],
            hooks: {
                addImageBlobHook: async (blob, callback) => {
                    if (!fileStore.tempDir || !props.currentNodeId) {
                        ElMessage.error(
                            "Cannot save image: no file open or node selected.",
                        );
                        return;
                    }

                    const reader = new FileReader();
                    reader.onload = async (e) => {
                        const base64Data = e.target?.result as string;
                        try {
                            const imageName = await fileStore.handleImagePaste(
                                base64Data,
                                props.currentNodeId!,
                            );
                            // The path in markdown should be relative to the .md file
                            callback(`mn-asset://images/${imageName}`, "image");
                            ElMessage.success("Image pasted and saved!");
                        } catch (error) {
                            ElMessage.error("Failed to save pasted image.");
                            console.error("Image paste error:", error);
                        }
                    };
                    reader.readAsDataURL(blob);
                },
            },
        });

        editorInstance.on("change", () => {
            emit("content-changed", editorInstance?.getMarkdown() || "");
        });

        editorInstance.on("focus", () => {
            editorStore.setTextInputActive(true);
        });

        editorInstance.on("blur", () => {
            editorStore.setTextInputActive(false);
        });
    }
});

watch(
    () => props.initialContent,
    (newContent) => {
        if (editorInstance && editorInstance.getMarkdown() !== newContent) {
            editorInstance.setMarkdown(newContent, false);
        }
    },
);

onBeforeUnmount(() => {
    if (editorInstance) {
        editorInstance.destroy();
        editorInstance = null;
    }
});
</script>

<template>
    <div class="markdown-editor-wrapper">
        <div ref="editorRef" class="toast-ui-editor"></div>
    </div>
</template>

<style lang="scss" scoped>
.markdown-editor-wrapper {
    height: 100%;
    width: 100%;
}

.toast-ui-editor {
    background-color: #fff;
}

.markdown-editor-wrapper :deep(.toastui-editor-defaultUI-toolbar) {
    // 示例：将工具栏高度设置为 40px
    height: 26px !important;
    align-items: center;
    min-height: 26px !important; /* 确保最小高度也被设置 */
    line-height: 26px !important; /* 如果需要，调整行高以垂直居中内容 */
    padding: 0; /* 示例：调整内边距 */
}

.markdown-editor-wrapper :deep(.toastui-editor-defaultUI button) {
    color: #333;
    height: 24px;
    padding-top: 2px;
    padding-bottom: 0px;
    font-size: 6px;

    cursor: pointer;
    border: none;
    border-radius: 2px;
}

/* 🚀 关键修复：同步修改主编辑区域的 top 值 */
.markdown-editor-wrapper :deep(.toastui-editor-defaultUI .toastui-editor-main) {
    top: -20px !important; /* 必须与新的工具栏高度保持一致 */
}

/* 使用深度选择器和更完整的路径 */
.markdown-editor-wrapper :deep(.toastui-editor-defaultUI .tui-editor-contents) {
    padding-top: 5px !important;
    padding-left: 5px !important;
    /* ... 其他 padding ... */
}

.markdown-editor-wrapper :deep(.toastui-editor-defaultUI .tui-editor-preview) {
    padding-left: 5px !important;
    padding-top: 5px !important;
}

.markdown-editor-wrapper :deep(.toastui-editor-defaultUI .ProseMirror) {
    padding-left: 5px !important;
    padding-top: 5px !important;
}
</style>
