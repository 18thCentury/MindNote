export const isInputActive = (e: KeyboardEvent): boolean => {
    const target = e.target as HTMLElement;
    if (!target) return false;
    return (
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) ||
        target.isContentEditable
    );
};

export const isModalOpen = (): boolean => {
    // specific to Element Plus: it adds this class to body when a modal is active
    return document.body.classList.contains("el-popup-parent--hidden");
};

export const shouldIgnoreGlobalShortcut = (e: KeyboardEvent): boolean => {
    return isInputActive(e) || isModalOpen();
};
