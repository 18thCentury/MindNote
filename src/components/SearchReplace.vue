<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { Search, ArrowUp, ArrowDown, Close, Check } from '@element-plus/icons-vue';

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['close', 'search-next', 'search-prev', 'replace', 'replace-all']);

const searchText = ref('');
const replaceText = ref('');
const showReplace = ref(false); // Toggle replace row

const inputRef = ref<HTMLInputElement | null>(null);

// Focus input when becoming visible
// We'll watch specifically in parent or use a simple timeout/nextTick here if needed, 
// but usually parent handles focus or we use v-if/v-show logic.

const onSearchNext = () => {
    emit('search-next', searchText.value);
};

const onSearchPrev = () => {
    emit('search-prev', searchText.value);
};

const onReplace = () => {
    emit('replace', searchText.value, replaceText.value);
};

const onReplaceAll = () => {
    emit('replace-all', searchText.value, replaceText.value);
};

const onClose = () => {
    emit('close');
};

const toggleReplace = () => {
    showReplace.value = !showReplace.value;
};

</script>

<template>
  <div v-if="visible" class="search-replace-container">
    <div class="sr-row">
        <div class="sr-input-wrapper">
             <el-icon class="sr-icon"><Search /></el-icon>
             <input 
                ref="inputRef"
                v-model="searchText" 
                class="sr-input" 
                placeholder="Find"
                @keyup.enter="onSearchNext"
                @keydown.esc="onClose"
             />
        </div>
        <div class="sr-actions">
            <button class="icon-btn" @click="onSearchPrev" title="Previous Match">
                <el-icon><ArrowUp /></el-icon>
            </button>
            <button class="icon-btn" @click="onSearchNext" title="Next Match">
                <el-icon><ArrowDown /></el-icon>
            </button>
            <button class="icon-btn" @click="toggleReplace" :class="{ active: showReplace }" title="Toggle Replace">
                <span style="font-size: 10px; font-weight: bold;">R</span>
            </button>
             <button class="icon-btn close-btn" @click="onClose">
                <el-icon><Close /></el-icon>
            </button>
        </div>
    </div>
    
    <div v-if="showReplace" class="sr-row replace-row">
         <div class="sr-input-wrapper">
             <el-icon class="sr-icon"><Check /></el-icon>
             <input 
                v-model="replaceText" 
                class="sr-input" 
                placeholder="Replace"
                @keyup.enter="onReplace"
             />
        </div>
         <div class="sr-actions">
            <button class="text-btn" @click="onReplace">Replace</button>
            <button class="text-btn" @click="onReplaceAll">All</button>
        </div>
    </div>
  </div>
</template>

<style scoped>
.search-replace-container {
    position: absolute;
    top: 50px; /* Adjust based on toolbar height */
    right: 20px;
    width: 300px;
    background-color: var(--panel-bg-color, #fff);
    border: 1px solid var(--border-color, #ddd);
    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    border-radius: 4px;
    z-index: 20; /* Above editor content */
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    color: var(--text-color, #333);
}

.sr-row {
    display: flex;
    align-items: center;
    gap: 8px;
}

.sr-input-wrapper {
    display: flex;
    align-items: center;
    flex: 1;
    background: var(--input-bg-color, #f5f5f5);
    border: 1px solid transparent;
    border-radius: 3px;
    padding: 0 6px;
}

.sr-input-wrapper:focus-within {
    border-color: var(--primary-color, #409eff);
}

.sr-input {
    border: none;
    background: transparent;
    outline: none;
    flex: 1;
    padding: 4px;
    font-size: 13px;
    color: inherit;
    min-width: 0;
}

.sr-icon {
    font-size: 14px;
    color: #999;
}

.sr-actions {
    display: flex;
    align-items: center;
    gap: 2px;
}

.icon-btn {
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 4px;
    border-radius: 3px;
    color: inherit;
    display: flex;
    align-items: center;
    justify-content: center;
}

.icon-btn:hover {
    background-color: rgba(0,0,0,0.05);
}

.icon-btn.active {
    background-color: rgba(64, 158, 255, 0.2);
    color: #409eff;
}

.text-btn {
    background: transparent;
    border: 1px solid var(--border-color, #ccc);
    border-radius: 3px;
    padding: 2px 8px;
    font-size: 12px;
    cursor: pointer;
    color: inherit;
}

.text-btn:hover {
    background-color: rgba(0,0,0,0.05);
}
</style>
