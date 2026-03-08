/** @odoo-module */

import { patch } from "@web/core/utils/patch";
import { PreparationDisplay } from "@pos_preparation_display/app/models/preparation_display";

patch(PreparationDisplay.prototype, {
    async setup(...args) {
        await super.setup(...args);

        // Initialize keyboard state in the model so it's accessible via usePreparationDisplay()
        // This ensures it's accessible both here and in Order components via usePreparationDisplay()
        this.keyboardState = {
            selectedOrderId: null,
            selectedColumn: 0,
        };

        // Apply dynamic background and favicon from Odoo configuration
        this._applyDynamicBranding();

        // Initialize and start cleanup interval
        // PreparationDisplay is a service, not a component, so we can't use onMounted/onWillUnmount
        this.cleanupInterval = null;
        this.startCleanupInterval();
    },

    /**
     * Apply dynamic background image and favicon from Odoo KDS configuration.
     * Falls back to static files if no dynamic images are configured.
     */
    _applyDynamicBranding() {
        const config = (window.odoo && window.odoo.preparation_display) || {};

        // --- BACKGROUND ---
        const backgroundUrl = config.kds_background_url;
        const mainScreen = document.querySelector('.o_pdis_main_screen');
        if (mainScreen) {
            if (backgroundUrl) {
                // Apply dynamic image from Odoo database (overrides CSS static rule)
                mainScreen.style.backgroundImage = `url('${backgroundUrl}')`;
                mainScreen.style.backgroundSize = 'cover';
                mainScreen.style.backgroundPosition = 'center';
                mainScreen.style.backgroundRepeat = 'no-repeat';
            }
            // If no dynamic URL, the CSS static fallback still applies
        } else {
            // DOM not ready yet: retry after a short delay (first render may not be complete)
            setTimeout(() => this._applyDynamicBranding(), 300);
            return;
        }

        // --- FAVICON ---
        const faviconUrl = config.kds_favicon_url;
        if (faviconUrl) {
            // Remove existing favicons
            const existingLinks = document.querySelectorAll('link[rel~="icon"], link[rel~="shortcut"]');
            existingLinks.forEach(el => el.remove());

            // Inject new favicon
            const link = document.createElement('link');
            link.rel = 'icon';
            link.type = 'image/png';
            link.href = faviconUrl;
            document.head.appendChild(link);
        }
    },

    /**
     * Start the cleanup interval
     */
    startCleanupInterval() {
        if (this.cleanupInterval) {
            return; // Already running
        }

        // Run cleanup every 60 seconds (60000 ms)
        this.cleanupInterval = setInterval(() => {
            this.cleanOldOrders();
        }, 60000);
    },

    /**
     * Stop the cleanup interval
     */
    stopCleanupInterval() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
    },

    /**
     * Getter to check if we are in KDS-only mode.
     * Reads from the global session configuration.
     */
    get hasKdsOnlyPos() {
        const config = (window.odoo && window.odoo.preparation_display) || {};
        return config.has_kds_only_pos || false;
    },

    /**
     * Getter for the KDS sidebar logo URL.
     * Returns the dynamic URL from Odoo config if set, otherwise falls back to the static file.
     * Used in the QWeb template to replace the hardcoded img src.
     */
    get kdsLogoUrl() {
        const config = (window.odoo && window.odoo.preparation_display) || {};
        return config.kds_favicon_url || '/arturos_pos_kitchen_custom/static/src/img/favicon.png';
    },

    /**
     * Getter for the KDS POS column header background color.
     * Defined in the Odoo config, defaults to #212529 (Dark gray).
     */
    get posHeaderColor() {
        const config = (window.odoo && window.odoo.preparation_display) || {};
        return config.kds_header_color || '#212529';
    },

    /**
     * Override to ensure combo child lines are visible even if they don't have categories.
     * If a line has a combo parent, it inherits the visibility of its parent.
     */
    checkOrderlineVisibility(orderline) {
        // Safety check: ensure orderline exists
        if (!orderline) {
            return false;
        }

        // If this line has a combo parent, it should be visible if the parent is visible
        if (orderline.comboParentUuid) {
            // Find the parent orderline using UUID
            const parentLine = Object.values(this.orderlines).find(
                line => line.posOrderLineUuid === orderline.comboParentUuid
            );

            // If parent exists and is visible, child should be visible too
            if (parentLine) {
                // Recursively check parent visibility
                const parentVisible = this.checkOrderlineVisibility(parentLine);
                return parentVisible;
            }
            // If no parent found, fall through to default logic
        }

        // For non-combo lines or combo parents, use default visibility logic
        // Only call super if orderline has the required properties
        if (orderline.productCategoryIds) {
            const result = super.checkOrderlineVisibility(orderline);
            return result;
        }

        // If no productCategoryIds, assume not visible (unless it's a combo child, handled above)
        return false;
    },

    /**
     * Group filtered orders by POS config name for column-based display.
     * Returns an array of [posConfigName, orders[]] tuples.
     * If has_kds_only_pos is false, returns a single group to mimic standard behavior.
     * If show_empty_columns is true, all configured POS configs are shown even without orders.
     */
    getOrdersByPosConfig() {
        // If NOT in KDS-only mode (no special POS configs), return standard flat list
        // We wrap it in a single tuple so the template loop still works but renders one big column
        if (!this.hasKdsOnlyPos) {
            return [['All Orders', this.filteredOrders]];
        }

        const config = (window.odoo && window.odoo.preparation_display) || {};
        const showEmptyColumns = config.show_empty_columns || false;
        const configuredPosNames = config.pos_config_names || [];

        const grouped = {};

        // If show_empty_columns is true, initialize all configured POS configs with empty arrays
        if (showEmptyColumns && configuredPosNames.length > 0) {
            // Initialize all configured POS configs
            for (const posName of configuredPosNames) {
                grouped[posName] = [];
            }

            // Then populate with actual orders
            for (const order of this.filteredOrders) {
                const posConfigName = order.pos_config_name || 'Sin Caja';
                if (grouped[posConfigName]) {
                    grouped[posConfigName].push(order);
                } else {
                    // If order is from a config not in our list, still show it
                    grouped[posConfigName] = [order];
                }
            }
        } else {
            // Dynamic mode: only show columns with orders
            for (const order of this.filteredOrders) {
                const posConfigName = order.pos_config_name || 'Sin Caja';

                if (!grouped[posConfigName]) {
                    grouped[posConfigName] = [];
                }

                grouped[posConfigName].push(order);
            }
        }

        // Convert to array of [name, orders] for template iteration
        const result = Object.entries(grouped).sort((a, b) => a[0].localeCompare(b[0]));
        return result;
    },



    /**
     * Override to add per-order blocking and faster animation.
     * Prevents multiple concurrent stage changes for the same order (from clicks, keyboard, or touch).
     * Default animation is 250ms, we use 100ms for faster transitions.
     */
    async changeOrderStage(order, force = false, direction = 1, animationTime = 100) {
        // Initialize processing orders Set if it doesn't exist
        if (!this.processingOrders) {
            this.processingOrders = new Set();
        }

        // Check if this order is already being processed
        if (this.processingOrders.has(order.id)) {
            console.log(`[KDS] Order ${order.id} is already being processed, ignoring...`);
            return;
        }

        // Mark order as processing
        this.processingOrders.add(order.id);

        // Add visual feedback class for animation
        // Find the order card by tracking number since there's no data-order-id
        const orderElements = document.querySelectorAll('.o_pdis_order_card');
        let orderElement = null;

        for (const el of orderElements) {
            const trackerEl = el.querySelector('.o_pdis_tracker');
            if (trackerEl && trackerEl.textContent.trim() === `#${order.tracking_number} `) {
                orderElement = el;
                break;
            }
        }

        if (orderElement) {
            orderElement.classList.add('o_pdis_order_processing');
        }

        try {
            // Call parent method with faster animation
            await super.changeOrderStage(order, force, direction, animationTime);
        } finally {
            // Always unblock the order, even if there was an error
            this.processingOrders.delete(order.id);

            // Remove visual feedback class
            if (orderElement) {
                orderElement.classList.remove('o_pdis_order_processing');
            }
        }
    },

    /**
     * Override to enrich orderlines with combo data after creation.
     * This assigns combo_parent_uuid, is_combo_parent, pos_order_line_uuid,
     * is_service_type, and service_type_label to each orderline from the backend data.
     */
    processOrders() {
        const result = super.processOrders();

        // Enrich orderlines with combo data from raw data
        if (this.rawData && this.rawData.orders) {
            for (const order of this.rawData.orders) {
                // Enrich order with POS config name and customer name
                const orderObj = this.orders[order.id];
                if (orderObj) {
                    orderObj.pos_config_name = order.pos_config_name || '';
                    orderObj.customer_name = order.customer_name || '';

                    // Enrich orderlines with combo and service type data
                    if (order.orderlines) {
                        for (const line of order.orderlines) {
                            const orderline = this.orderlines[line.id];
                            if (orderline) {
                                // Assign combo fields
                                orderline.posOrderLineUuid = line.pos_order_line_uuid || false;
                                orderline.comboParentUuid = line.combo_parent_uuid || false;
                                orderline.isComboParent = line.is_combo_parent || false;

                                // Assign service type fields
                                orderline.isServiceType = line.is_service_type || false;
                                orderline.serviceTypeLabel = line.service_type_label || false;
                            }
                        }
                    }
                }
            }
        }

        return result;
    },

    /**
     * Clean old orders from memory based on stage configuration.
     * Only removes orders from stages that have auto_advance_minutes configured.
     * This runs every 60 seconds via setInterval.
     */
    async cleanOldOrders() {
        if (!this.hasKdsOnlyPos) {
            return;
        }

        const ordersToRemove = [];
        const config = (window.odoo && window.odoo.preparation_display) || {};
        const stageConfigs = config.stage_configs || {};

        // Iterate over all orders in memory
        for (const orderId in this.orders) {
            const order = this.orders[orderId];
            const currentStageId = order.stageId;
            const stageConfig = stageConfigs[currentStageId];

            // Skip if stage doesn't have auto_advance_minutes configured
            if (!stageConfig || !stageConfig.auto_advance_minutes || stageConfig.auto_advance_minutes <= 0) {
                continue;
            }

            // Calculate time difference in minutes
            const lastChange = order.lastStageChange || order.createDate;
            if (!lastChange) {
                continue;
            }

            // Odoo sends dates as "YYYY-MM-DD HH:MM:SS" in UTC timezone
            const isoDate = lastChange.replace(' ', 'T');
            const orderDateTime = luxon.DateTime.fromISO(isoDate, { zone: 'utc' });
            const nowDateTime = luxon.DateTime.utc();
            const diffMins = Math.floor(nowDateTime.diff(orderDateTime, 'minutes').minutes);

            // Check if order has exceeded the timeout for its current stage
            if (diffMins > stageConfig.auto_advance_minutes) {
                const hasNextStage = stageConfig.has_next_stage;

                if (!hasNextStage) {
                    // If it's the last stage, mark for removal
                    ordersToRemove.push(order);
                }
            }
        }

        // Use the official Odoo method to archive orders
        if (ordersToRemove.length > 0) {
            // Mark orders as not displayed (same as archiveAllVisibleOrders does)
            for (const order of ordersToRemove) {
                order.displayed = false;
            }

            // Call the official doneOrders method which makes the RPC call to backend
            await this.doneOrders(ordersToRemove);
        }
    }
});
