/** @odoo-module */

import { patch } from "@web/core/utils/patch";
import { PreparationDisplay } from "@pos_preparation_display/app/components/preparation_display/preparation_display";
import { onMounted, onWillUnmount, useState } from "@odoo/owl";

patch(PreparationDisplay.prototype, {
    setup() {
        super.setup();

        // Use keyboardState from the model (initialized in models/preparation_display.js)
        // This ensures it's accessible both here and in Order components via usePreparationDisplay()
        // No need to create a new useState here, just reference the model's property

        // Lock & cooldown to avoid repeated RPCs on key repeat
        this._actionInProgress = false;
        this._lastActionAt = 0;
        this._actionCooldownMs = 200; // debounce window

        this.handleKeyDown = this.handleKeyDown.bind(this);

        onMounted(() => {
            document.addEventListener('keydown', this.handleKeyDown);
        });

        onWillUnmount(() => {
            document.removeEventListener('keydown', this.handleKeyDown);
        });
    },

    handleKeyDown(event) {
        // Get keyboard configuration from the preparation display
        const displayConfig = (window.odoo && window.odoo.preparation_display) || {};
        const key = event.key;

        // Ignore auto-repeat to prevent multiple RPCs
        // Solo bloquear repetición para acciones con RPC; navegación puede repetir

        // Get configured keys or use defaults
        const keyUp = displayConfig.key_navigate_up || '8';
        const keyDown = displayConfig.key_navigate_down || '2';
        const keyLeft = displayConfig.key_navigate_left || '4';
        const keyRight = displayConfig.key_navigate_right || '6';
        const keyAdvance = displayConfig.key_advance_order || 'Enter';
        const keyChangeStagePrev = displayConfig.key_change_stage_prev || '7';
        const keyChangeStageNext = displayConfig.key_change_stage_next || '9';
        const keyFullscreen = displayConfig.key_fullscreen || '0';

        const isKey = (pressed, configured) => {
            if (pressed === configured) return true;
            // Numpad equivalentes
            if (configured === 'Enter' && pressed === 'NumpadEnter') return true;
            if (configured === '7' && pressed === 'Numpad7') return true;
            if (configured === '9' && pressed === 'Numpad9') return true;
            if (configured === '8' && pressed === 'Numpad8') return true;
            if (configured === '2' && pressed === 'Numpad2') return true;
            if (configured === '4' && pressed === 'Numpad4') return true;
            if (configured === '6' && pressed === 'Numpad6') return true;
            if (configured === '0' && pressed === 'Numpad0') return true;
            return false;
        };

        if (key === keyUp) {
            event.preventDefault();
            this.navigateToPreviousOrder();
        } else if (key === keyDown) {
            event.preventDefault();
            this.navigateToNextOrder();
        } else if (key === keyLeft) {
            event.preventDefault();
            this.navigateToPreviousColumn();
        } else if (key === keyRight) {
            event.preventDefault();
            this.navigateToNextColumn();
        } else if (isKey(key, keyAdvance)) {
            if (event.repeat) return; // antirrebote para RPC
            event.preventDefault();
            this.withActionLock(() => this.advanceSelectedOrder());
        } else if (isKey(key, keyFullscreen)) {
            event.preventDefault();
            this.toggleFullscreen();
        } else if (isKey(key, keyChangeStagePrev)) {
            if (event.repeat) return; // antirrebote para RPC
            event.preventDefault();
            this.withActionLock(() => this.changeToPreviousStage());
        } else if (isKey(key, keyChangeStageNext)) {
            if (event.repeat) return; // antirrebote para RPC
            event.preventDefault();
            this.withActionLock(() => this.changeToNextStage());
        } else if (key === 'Escape') {
            event.preventDefault();
            this.preparationDisplay.keyboardState.selectedOrderId = null;
        }
    },

    async withActionLock(fn) {
        const now = Date.now();
        if (this._actionInProgress) {
            return;
        }
        if (now - this._lastActionAt < this._actionCooldownMs) {
            return;
        }
        this._actionInProgress = true;
        try {
            await fn();
        } finally {
            this._lastActionAt = Date.now();
            this._actionInProgress = false;
        }
    },

    navigateToPreviousOrder() {
        const orders = this.getOrdersInCurrentColumn();
        const currentIndex = orders.findIndex(o => o.id === this.preparationDisplay.keyboardState.selectedOrderId);

        if (currentIndex > 0) {
            this.preparationDisplay.keyboardState.selectedOrderId = orders[currentIndex - 1].id;
            this.scrollToSelectedOrder();
        }
    },

    navigateToNextOrder() {
        const orders = this.getOrdersInCurrentColumn();
        const currentIndex = orders.findIndex(o => o.id === this.preparationDisplay.keyboardState.selectedOrderId);

        if (currentIndex < orders.length - 1) {
            this.preparationDisplay.keyboardState.selectedOrderId = orders[currentIndex + 1].id;
        } else if (currentIndex === -1 && orders.length > 0) {
            // If no order selected, select the first one
            this.preparationDisplay.keyboardState.selectedOrderId = orders[0].id;
        }
        this.scrollToSelectedOrder();
    },

    navigateToPreviousColumn() {
        if (this.preparationDisplay.keyboardState.selectedColumn > 0) {
            this.preparationDisplay.keyboardState.selectedColumn--;
            this.selectFirstOrderInColumn();
        }
    },

    navigateToNextColumn() {
        const columns = this.preparationDisplay.getOrdersByPosConfig();
        if (this.preparationDisplay.keyboardState.selectedColumn < columns.length - 1) {
            this.preparationDisplay.keyboardState.selectedColumn++;
            this.selectFirstOrderInColumn();
        }
    },

    async advanceSelectedOrder() {
        if (!this.preparationDisplay.keyboardState.selectedOrderId) return;

        const order = this.preparationDisplay.orders[this.preparationDisplay.keyboardState.selectedOrderId];
        if (!order) return;

        // Check if order is in the last stage
        const isLastStage = order.stageId === this.preparationDisplay.lastStage.id;

        if (isLastStage) {
            // BLOCKED: Orders in last stage (Entregado) cannot be advanced
            // They can only be viewed and navigated
            console.log('[KDS] Cannot advance order in last stage (Entregado)');
            return;
        }

        // Move to next stage
        await this.preparationDisplay.sendStrickedLineToNextStage(order);
        // After advancing, select next order in the same column
        this.navigateToNextOrder();
    },

    toggleFullscreen() {
        if (!document.fullscreenElement) {
            // Enter fullscreen
            document.documentElement.requestFullscreen().catch(err => {
                console.error(`Error attempting to enable fullscreen: ${err.message}`);
            });
        } else {
            // Exit fullscreen
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
    },

    changeToPreviousStage() {
        const stages = this.preparationDisplay.stages;
        // Add "All Stages" as index -1
        // Current selected stage is in this.preparationDisplay.selectedStageId
        // If 0 (All stages), previous is nothing (or loop to last?)
        // If > 0, previous is index - 1 or 0 (All stages)

        const currentStageId = this.preparationDisplay.selectedStageId;

        if (currentStageId === 0) {
            // Currently on "All", go to last stage? Or stay? Let's go to last stage for cycling
            // Convert Map values to array
            const stagesArray = Array.from(stages.values());
            if (stagesArray.length > 0) {
                const lastStage = stagesArray[stagesArray.length - 1];
                this.preparationDisplay.selectStage(lastStage.id);
            }
        } else {
            const stagesArray = Array.from(stages.values());
            const currentIndex = stagesArray.findIndex(s => s.id === currentStageId);
            if (currentIndex === 0) {
                // First stage, go to "All" (0)
                this.preparationDisplay.selectStage(0);
            } else if (currentIndex > 0) {
                // Go to previous stage
                this.preparationDisplay.selectStage(stagesArray[currentIndex - 1].id);
            }
        }
    },

    changeToNextStage() {
        const stages = this.preparationDisplay.stages;
        const currentStageId = this.preparationDisplay.selectedStageId;

        if (currentStageId === 0) {
            // Currently on "All", go to first stage
            const stagesArray = Array.from(stages.values());
            if (stagesArray.length > 0) {
                this.preparationDisplay.selectStage(stagesArray[0].id);
            }
        } else {
            const stagesArray = Array.from(stages.values());
            const currentIndex = stagesArray.findIndex(s => s.id === currentStageId);
            if (currentIndex === stagesArray.length - 1) {
                // Last stage, go to "All" (0)
                this.preparationDisplay.selectStage(0);
            } else if (currentIndex >= 0) {
                // Go to next stage
                this.preparationDisplay.selectStage(stagesArray[currentIndex + 1].id);
            }
        }
    },

    getOrdersInCurrentColumn() {
        const columns = this.preparationDisplay.getOrdersByPosConfig();
        if (columns[this.preparationDisplay.keyboardState.selectedColumn]) {
            return columns[this.preparationDisplay.keyboardState.selectedColumn][1];
        }
        return [];
    },

    selectFirstOrderInColumn() {
        const orders = this.getOrdersInCurrentColumn();
        if (orders.length > 0) {
            this.preparationDisplay.keyboardState.selectedOrderId = orders[0].id;
            this.scrollToSelectedOrder();
        } else {
            this.preparationDisplay.keyboardState.selectedOrderId = null;
        }
    },

    scrollToSelectedOrder() {
        setTimeout(() => {
            const element = document.querySelector(`[data-order-id="${this.preparationDisplay.keyboardState.selectedOrderId}"]`);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }, 50);
    },
});
