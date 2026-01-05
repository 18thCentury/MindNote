<template>
  <el-dialog
    v-model="visible"
    :title="dialogTitle"
    width="900px"
    @close="handleClose"
    class="webdav-dialog"
    destroy-on-close
  >
    <div class="webdav-container" v-loading="loading">
      
      <!-- VIEW 1: LOGIN -->
      <div v-if="!isConnected" class="login-view">
        <div class="login-doodle">
           <el-icon :size="64" color="#409eff"><Cloudy /></el-icon>
           <h3>Connect to WebDAV</h3>
        </div>
        <el-form label-position="top" size="large" class="login-form">
            <el-form-item label="Server URL">
                <el-input v-model="config.url" placeholder="https://cloud.example.com/remote.php/webdav/">
                    <template #prefix><el-icon><Link /></el-icon></template>
                </el-input>
            </el-form-item>
            <div class="form-row">
                <el-form-item label="Username" style="flex: 1">
                    <el-input v-model="config.username" placeholder="Username">
                        <template #prefix><el-icon><User /></el-icon></template>
                    </el-input>
                </el-form-item>
                <el-form-item label="Password" style="flex: 1">
                    <el-input v-model="config.password" type="password" placeholder="Password" show-password>
                        <template #prefix><el-icon><Lock /></el-icon></template>
                    </el-input>
                </el-form-item>
            </div>
            <el-form-item>
                <el-button type="primary" class="connect-btn" @click="handleConnect" :loading="connecting">
                    Connect
                </el-button>
            </el-form-item>
             <div class="login-actions">
                 <el-checkbox v-model="saveCreds">Save Credentials</el-checkbox>
             </div>
        </el-form>
      </div>

      <!-- VIEW 2: BROWSER -->
      <div v-else class="browser-view">
        <!-- Toolbar -->
        <div class="browser-toolbar">
            <div class="breadcrumbs">
                <el-breadcrumb separator="/">
                    <el-breadcrumb-item><a @click="navigateTo('/')"><el-icon><HomeFilled /></el-icon></a></el-breadcrumb-item>
                    <el-breadcrumb-item v-for="(part, index) in pathParts" :key="index">
                         <a @click="navigateToPart(index)">{{ part }}</a>
                    </el-breadcrumb-item>
                </el-breadcrumb>
            </div>
            <div class="toolbar-actions">
                <el-button-group>
                    <el-button size="small" :icon="FolderAdd" @click="handleNewFolder" title="New Folder" />
                    <el-button size="small" :icon="Refresh" @click="refresh" title="Refresh" />
                     <el-button size="small" :icon="SwitchButton" @click="handleDisconnect" title="Disconnect" />
                </el-button-group>
            </div>
        </div>

        <!-- File List -->
        <div class="file-list-container">
            <el-table
                :data="files"
                style="width: 100%;"
                height="100%"
                highlight-current-row
                @row-click="handleRowClick"
                @row-dblclick="handleRowDblClick"
                @row-contextmenu="handleContextMenu"
                class="file-table"
            >
                <el-table-column width="40">
                    <template #default="scope">
                        <el-icon v-if="scope.row.type === 'directory'" class="icon-folder"><Folder /></el-icon>
                        <el-icon v-else class="icon-file"><Document /></el-icon>
                    </template>
                </el-table-column>
                <el-table-column prop="basename" label="Name" show-overflow-tooltip sortable />
                <el-table-column prop="lastmod" label="Date" width="160" sortable />
                <el-table-column prop="size" label="Size" width="90">
                    <template #default="scope">
                        {{ formatSize(scope.row.size) }}
                    </template>
                </el-table-column>
            </el-table>
        </div>

        <!-- Footer / Save Bar -->
        <div class="browser-footer" v-if="mode === 'save'">
             <div class="filename-input">
                <span class="label">File name:</span>
                <el-input v-model="saveFilename" placeholder="MyMindmap.mn" @keyup.enter="handleSave">
                     <template #append>.mn</template>
                </el-input>
             </div>
        </div>
      </div>

    </div>

    <!-- Context Menu -->
    <ul v-show="contextMenuVisible" :style="{left: contextMenuX + 'px', top: contextMenuY + 'px'}" class="context-menu">
        <li @click="contextAction('rename')"><el-icon><Edit /></el-icon> Rename</li>
        <li @click="contextAction('delete')" class="delete"><el-icon><Delete /></el-icon> Delete</li>
    </ul>

    <!-- Dialog Footer (Global) -->
    <template #footer>
      <span class="dialog-footer">
        <el-button @click="visible = false">Cancel</el-button>
        <el-button type="primary" @click="handleAction" :disabled="!isActionEnabled">
          {{ actionButtonText }}
        </el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, reactive, watch, nextTick, onBeforeUnmount } from "vue";
import { useSettingsStore } from "@/stores/settingsStore";
import { useFileStore } from "@/stores/fileStore";
import { ipcRenderer } from "@/utils/ipcRenderer";
import { IPC_EVENTS, WebDavFileItem } from "@/types/shared_types";
import { ElMessage, ElMessageBox } from "element-plus";
import { 
    Folder, Document, Cloudy, Link, User, Lock, 
    HomeFilled, Refresh, FolderAdd, SwitchButton,
    Edit, Delete
} from "@element-plus/icons-vue";

const props = defineProps({
  modelValue: Boolean,
  mode: {
    type: String as () => "open" | "save",
    default: "open",
  },
});
const emit = defineEmits(["update:modelValue", "file-opened", "file-saved"]);

const settingsStore = useSettingsStore();
const fileStore = useFileStore();

// UI State
const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit("update:modelValue", val),
});

const config = reactive({
    url: "",
    username: "",
    password: "",
});
const saveCreds = ref(true);

const connecting = ref(false);
const isConnected = ref(false);
const loading = ref(false);
const currentPath = ref("/");
const files = ref<WebDavFileItem[]>([]);
const selectedFile = ref<WebDavFileItem | null>(null);
const saveFilename = ref("Untitled");

// Context Menu
const contextMenuVisible = ref(false);
const contextMenuX = ref(0);
const contextMenuY = ref(0);
const contextTarget = ref<WebDavFileItem | null>(null);

// Computed
const pathParts = computed(() => currentPath.value.split('/').filter(p => p));
const dialogTitle = computed(() => isConnected.value 
    ? (props.mode === 'save' ? `Save to WebDAV: ${currentPath.value}` : 'Open from WebDAV')
    : 'WebDAV Connection'
);
const actionButtonText = computed(() => {
    if (!isConnected.value) return 'Connect'; // Hidden in login view technically
    return props.mode === 'save' ? 'Save' : 'Open';
});

const isActionEnabled = computed(() => {
    if (!isConnected.value) return true; // Login view handles its own button
    if (props.mode === 'open') return !!selectedFile.value;
    if (props.mode === 'save') return !!saveFilename.value;
    return false;
});

// Init
onMounted(async () => {
    await settingsStore.loadSettings();
    const headers = settingsStore.settings.webdav;
    if (headers) {
        config.url = headers.url;
        config.username = headers.username;
        // Password is not populated for security, but backend might have it.
        // If we want auto-connect logic:
        // if (headers.encryptedPassword) handleConnect(); 
    }
});

// Watch visibility
watch(() => props.modelValue, (val) => {
    if (val) {
        if (props.mode === 'save') {
             if (fileStore.currentFilePath) {
                 const basename = fileStore.currentFilePath.split(/[\\/]/).pop() || '';
                 saveFilename.value = basename.replace('.mn', '');
             } else {
                 saveFilename.value = "Untitled";
             }
        }
        // If we have creds, maybe try auto-connect or just show login
        // Let's stick to explicit connect for now unless already connected in session?
        // If isConnected is true, we keep state.
    } else {
        contextMenuVisible.value = false;
    }
});

// --- Actions ---

const handleConnect = async () => {
    connecting.value = true;
    try {
        const success = await ipcRenderer.invoke(IPC_EVENTS.WEBDAV_CHECK_CONNECTION, { ...config });
        if (success) {
            isConnected.value = true;
            ElMessage.success("Connected");
            if (saveCreds.value) {
                ipcRenderer.invoke(IPC_EVENTS.WEBDAV_SAVE_SETTINGS, { ...config });
            }
            await loadDirectory("/");
        } else {
            ElMessage.error("Connection failed.");
        }
    } catch (e) {
         ElMessage.error("Connection error.");
    } finally {
        connecting.value = false;
    }
};

const handleDisconnect = () => {
    isConnected.value = false;
    files.value = [];
    currentPath.value = "/";
};

const loadDirectory = async (path: string) => {
    loading.value = true;
    try {
        const items = await ipcRenderer.invoke(IPC_EVENTS.WEBDAV_READ_DIR, path);
        // Sort: Folders first, then files
        files.value = items.sort((a: any, b: any) => {
            if (a.type === b.type) return a.basename.localeCompare(b.basename);
            return a.type === 'directory' ? -1 : 1;
        });
        currentPath.value = path;
        selectedFile.value = null; // Clear selection
    } catch (e) {
        ElMessage.error("Failed to load directory");
    } finally {
        loading.value = false;
    }
};

const navigateTo = (path: string) => loadDirectory(path);
const navigateToPart = (index: number) => {
    const targetPath = '/' + pathParts.value.slice(0, index + 1).join('/');
    loadDirectory(targetPath);
};

const refresh = () => loadDirectory(currentPath.value);

// --- File Operations ---

const handleRowClick = (row: WebDavFileItem) => {
    selectedFile.value = row;
    contextMenuVisible.value = false;
    if (props.mode === 'save' && row.type !== 'directory') {
        saveFilename.value = row.basename.replace('.mn', '');
    }
};

const handleRowDblClick = (row: WebDavFileItem) => {
    if (row.type === 'directory') {
        const newPath = currentPath.value === '/' ? '/' + row.basename : currentPath.value + '/' + row.basename;
        loadDirectory(newPath);
    } else if (row.basename.endsWith('.mn')) {
        if (props.mode === 'open') {
             openFile(row.filename);
        } else {
            saveFilename.value = row.basename.replace('.mn', '');
            selectedFile.value = row;
        }
    }
};

const handleAction = () => {
    if (props.mode === 'open') {
        if (selectedFile.value) openFile(selectedFile.value.filename);
    } else {
        handleSave();
    }
};

const handleNewFolder = async () => {
    try {
        const { value: folderName } = await ElMessageBox.prompt('Please input folder name', 'New Folder', {
            confirmButtonText: 'Create',
            cancelButtonText: 'Cancel',
        });
        if (folderName) {
            const newPath = currentPath.value === '/' ? '/' + folderName : currentPath.value + '/' + folderName;
            await ipcRenderer.invoke(IPC_EVENTS.WEBDAV_CREATE_DIR, newPath);
            ElMessage.success("Folder created");
            refresh();
        }
    } catch (e) {
        // Cancelled or error
    }
};

// --- Save / Open Logic ---

const handleSave = async () => {
    if (!saveFilename.value) return;
    let filename = saveFilename.value;
    if (!filename.endsWith('.mn')) filename += '.mn';
    
    const remotePath = currentPath.value === '/' ? '/' + filename : currentPath.value + '/' + filename;

    // Check overwrite
    const exists = files.value.find(f => f.basename === filename);
    if (exists) {
         try {
            await ElMessageBox.confirm(`File "${filename}" already exists. Overwrite?`, 'Warning', {
                confirmButtonText: 'Overwrite',
                cancelButtonText: 'Cancel',
                type: 'warning',
            });
         } catch {
             return;
         }
    }

    try {
        await fileStore.saveAsToWebDav(remotePath);
        visible.value = false;
        ElMessage.success("Saved to WebDAV");
        emit("file-saved");
    } catch (e) {
        ElMessage.error("Failed to save");
    }
};

const openFile = async (path: string) => {
    try {
        await fileStore.openWebDavFile(path);
        visible.value = false;
        ElMessage.success("Opened file");
        emit("file-opened");
    } catch (e) {
        ElMessage.error("Failed to open");
    }
};

// --- Context Menu ---

const handleContextMenu = (row: WebDavFileItem, column: any, event: MouseEvent) => {
    event.preventDefault();
    selectedFile.value = row; // Select it
    contextTarget.value = row;
    contextMenuX.value = event.clientX;
    contextMenuY.value = event.clientY;
    contextMenuVisible.value = true;
};

const contextAction = async (action: 'rename' | 'delete') => {
    contextMenuVisible.value = false;
    const target = contextTarget.value;
    if (!target) return;

    if (action === 'delete') {
        try {
            await ElMessageBox.confirm(`Are you sure you want to delete "${target.basename}"?`, 'Delete', {
                type: 'warning',
                confirmButtonText: 'Delete',
                confirmButtonClass: 'el-button--danger'
            });
            await ipcRenderer.invoke(IPC_EVENTS.WEBDAV_DELETE_FILE, target.filename);
            ElMessage.success("Deleted");
            refresh();
        } catch {}
    } 
    else if (action === 'rename') {
        try {
            const { value: newName } = await ElMessageBox.prompt('Enter new name', 'Rename', {
                inputValue: target.basename,
                confirmButtonText: 'Rename'
            });
            if (newName && newName !== target.basename) {
                // Determine source and target paths
                const source = target.filename;
                // Construct target path (careful with parents)
                // usually filename is full path.
                // We need to switch the last part.
                // Or simply: currentPath + / + newName
                const targetPath = currentPath.value === '/' ? '/' + newName : currentPath.value + '/' + newName;
                
                await ipcRenderer.invoke(IPC_EVENTS.WEBDAV_RENAME_FILE, source, targetPath);
                ElMessage.success("Renamed");
                refresh();
            }
        } catch {}
    }
};

// Global click to close context menu
const closeContextMenu = () => { contextMenuVisible.value = false; };
onMounted(() => window.addEventListener('click', closeContextMenu));
onBeforeUnmount(() => window.removeEventListener('click', closeContextMenu));

// Helper
const formatSize = (size: number) => {
    if (size === 0) return '-'; // Folders often 0
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(size) / Math.log(k));
    return parseFloat((size / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const handleClose = () => {
    //
};
</script>

<style scoped>
.webdav-container {
    height: 500px;
    display: flex;
    flex-direction: column;
    position: relative;
}

/* LOGIN VIEW */
.login-view {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    padding: 20px;
}
.login-doodle {
    text-align: center;
    margin-bottom: 30px;
    color: var(--el-text-color-primary);
}
.login-doodle h3 { margin-top: 10px; font-weight: 500; }
.login-form {
    width: 320px;
}
.form-row {
    display: flex;
    gap: 15px;
}
.connect-btn {
    width: 100%;
    margin-top: 10px;
}
.login-actions {
    text-align: center;
    margin-top: 10px;
}

/* BROWSER VIEW */
.browser-view {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.browser-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 0;
    border-bottom: 1px solid var(--el-border-color-lighter);
    margin-bottom: 5px;
}

.breadcrumbs {
   font-size: 14px;
}
.breadcrumbs a {
    cursor: pointer;
    transition: color 0.2s;
}
.breadcrumbs a:hover {
    color: var(--el-color-primary);
}

.file-list-container {
    flex: 1;
    overflow: hidden; /* Table handles scroll */
}

.icon-folder { color: #E6A23C; font-size: 18px; vertical-align: middle; }
.icon-file { color: #909399; font-size: 18px; vertical-align: middle; }

.browser-footer {
    padding-top: 15px;
    border-top: 1px solid var(--el-border-color-lighter);
}
.filename-input {
    display: flex;
    align-items: center;
    gap: 10px;
}
.filename-input .label {
    white-space: nowrap;
    font-size: 14px;
    color: var(--el-text-color-regular);
}

/* CONTEXT MENU */
.context-menu {
    position: fixed;
    background: white;
    border: 1px solid #dcdfe6;
    box-shadow: 0 2px 12px 0 rgba(0,0,0,0.1);
    border-radius: 4px;
    padding: 5px 0;
    margin: 0;
    list-style: none;
    z-index: 3000;
    min-width: 120px;
}
.context-menu li {
    padding: 8px 15px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: #606266;
}
.context-menu li:hover {
    background-color: #f5f7fa;
    color: var(--el-color-primary);
}
.context-menu li.delete:hover {
    color: #F56C6C;
    background-color: #fef0f0;
}
</style>
