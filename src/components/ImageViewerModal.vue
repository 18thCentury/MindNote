<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from "vue";

const props = defineProps<{
  visible: boolean;
  imageUrl: string | null;
}>();

const emit = defineEmits(["close"]);

const scale = ref(1);
const translateX = ref(0);
const translateY = ref(0);
const isDragging = ref(false);
const startDragX = ref(0);
const startDragY = ref(0);
const imageNaturalWidth = ref(0);
const imageNaturalHeight = ref(0);
const containerRef = ref<HTMLElement | null>(null);

// Constants
const MAX_ZOOM = 4;
const MIN_ZOOM = 0.1; // Will be dynamically adjusted to fit container

const imageStyle = computed(() => ({
  transform: `translate(${translateX.value}px, ${translateY.value}px) scale(${scale.value})`,
  cursor: isDragging.value ? "grab" : scale.value > 1 ? "grab" : "default",
}));

const zoomPercentage = computed(() => Math.round(scale.value * 100));

const resetZoom = () => {
  if (!containerRef.value || imageNaturalWidth.value === 0) return;
  
  const containerWidth = containerRef.value.clientWidth;
  const containerHeight = containerRef.value.clientHeight;
  
  const scaleX = containerWidth / imageNaturalWidth.value;
  const scaleY = containerHeight / imageNaturalHeight.value;
  
  // Fit to container
  scale.value = Math.min(scaleX, scaleY, 1); 
  translateX.value = 0;
  translateY.value = 0;
};

const onImageLoad = (event: Event) => {
  const img = event.target as HTMLImageElement;
  imageNaturalWidth.value = img.naturalWidth;
  imageNaturalHeight.value = img.naturalHeight;
  resetZoom();
};

const onWheel = (event: WheelEvent) => {
  event.preventDefault();
  
  const zoomFactor = 0.1;
  const delta = event.deltaY > 0 ? -zoomFactor : zoomFactor;
  const newScale = Math.min(Math.max(scale.value + delta, MIN_ZOOM), MAX_ZOOM);
  
  // Zoom towards cursor logic could be added here, but center zoom is simpler for now and often sufficient
  scale.value = newScale;
};

const onMouseDown = (event: MouseEvent) => {
  if (scale.value <= 1 && translateX.value === 0 && translateY.value === 0) return; // Don't drag if fitted
  
  isDragging.value = true;
  startDragX.value = event.clientX - translateX.value;
  startDragY.value = event.clientY - translateY.value;
};

const onMouseMove = (event: MouseEvent) => {
  if (!isDragging.value) return;
  
  translateX.value = event.clientX - startDragX.value;
  translateY.value = event.clientY - startDragY.value;
};

const onMouseUp = () => {
  isDragging.value = false;
};

const setActualSize = () => {
  scale.value = 1;
  translateX.value = 0;
  translateY.value = 0;
};

const close = () => {
  emit("close");
};

const handleKeydown = (e: KeyboardEvent) => {
  if (props.visible && e.key === "Escape") {
    close();
  }
};

watch(() => props.visible, (newVal) => {
  if (newVal) {
    // Reset state when opening
    scale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
    window.addEventListener("keydown", handleKeydown);
  } else {
    window.removeEventListener("keydown", handleKeydown);
  }
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", handleKeydown);
});
</script>

<template>
  <div v-if="visible" class="image-viewer-overlay" @click.self="close">
    <button class="close-button" @click="close">×</button>
    <div class="image-viewer-container" ref="containerRef">
      <div class="image-wrapper" 
           @wheel="onWheel"
           @mousedown="onMouseDown"
           @mousemove="onMouseMove"
           @mouseup="onMouseUp"
           @mouseleave="onMouseUp"
           @dblclick="resetZoom">
        <img 
          v-if="imageUrl" 
          :src="imageUrl" 
          class="viewer-image" 
          :style="imageStyle"
          @load="onImageLoad"
          draggable="false"
        />
      </div>
      
      <div class="info-panel">
        <div class="dimensions" v-if="imageNaturalWidth">
          {{ imageNaturalWidth }} × {{ imageNaturalHeight }} px
        </div>
        <div class="zoom-level">
          {{ zoomPercentage }}%
        </div>
        <button class="actual-size-btn" @click="setActualSize">1:1</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.image-viewer-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background-color: rgba(0, 0, 0, 0.8);
  z-index: 2000; /* High z-index to cover everything */
  display: flex;
  justify-content: center;
  align-items: center;
}

.image-viewer-container {
  position: relative;
  width: 80%;
  height: 80%;
  background-color: transparent;
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: hidden; /* Clip image when zoomed */
}

.image-wrapper {
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
}

.viewer-image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  transition: transform 0.1s ease-out; /* Smooth zoom/pan */
  user-select: none;
}

.close-button {
  position: absolute;
  top: 20px;
  right: 20px;
  background: none;
  border: none;
  color: white;
  font-size: 40px;
  cursor: pointer;
  opacity: 0.8;
  z-index: 2001;
}

.close-button:hover {
  opacity: 1;
}

.info-panel {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  background-color: rgba(0, 0, 0, 0.6);
  padding: 8px 16px;
  border-radius: 20px;
  color: white;
  display: flex;
  gap: 16px;
  align-items: center;
  font-size: 14px;
}

.actual-size-btn {
  background-color: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.4);
  color: white;
  padding: 2px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.actual-size-btn:hover {
  background-color: rgba(255, 255, 255, 0.3);
}
</style>
