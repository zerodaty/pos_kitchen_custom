import { patch } from "@web/core/utils/patch";
import { ActionpadWidget } from "@point_of_sale/app/screens/product_screen/action_pad/action_pad";
import { useState } from "@odoo/owl";
import { TicketScreen } from "@point_of_sale/app/screens/ticket_screen/ticket_screen";

patch(ActionpadWidget.prototype, {
    setup() {
        super.setup();
        this.uiState = useState({
            clicked: false,
        });
    },
    get currentOrder() {
        return this.pos.get_order();
    },
    get isKdsOnly() {
        const value = this.pos.config.enable_kds_only;
        return value;
    },
    get isKdsContext() {
        // Following Odoo's pattern from pos_restaurant
        // Show KDS buttons only when NOT in TicketScreen (refund screen)
        return this.pos.config.enable_kds_only && this.pos.mainScreen.component !== TicketScreen;
    },
    get enableAutoSendOnPayment() {
        const value = this.pos.config.enable_auto_send_on_payment || false;
        return value;
    },
    get hasChangesToPrint() {
        let hasChange = this.pos.getOrderChanges();
        hasChange =
            hasChange.generalNote == ""
                ? true // for the case when removed all general note
                : hasChange.count || hasChange.generalNote || hasChange.modeUpdate;
        return hasChange;
    },
    get swapButtonClasses() {
        // Logic copied/adapted from pos_restaurant to support our custom button
        const classes = {
            "highlight btn-primary justify-content-between": this.displayCategoryCount.length,
            "btn-light pe-none disabled justify-content-center": !this.displayCategoryCount.length,
            altlight: !this.hasChangesToPrint && this.currentOrder?.hasSkippedChanges(),
        };
        return classes;
    },
    async submitOrder() {
        if (!this.uiState.clicked) {
            this.uiState.clicked = true;
            try {
                // Ensure we call the method that sends to kitchen
                // This method exists in PosStore because pos_restaurant is installed
                await this.pos.sendOrderInPreparationUpdateLastChange(this.currentOrder);
            } finally {
                this.uiState.clicked = false;
            }
        }
    },
    hasQuantity(order) {
        if (!order) {
            return false;
        } else {
            return order.lines.reduce((totalQty, line) => totalQty + line.get_quantity(), 0) > 0;
        }
    },
    get highlightPay() {
        // When auto-send is enabled, highlight if there are products
        // When auto-send is disabled, highlight only if there are products AND no pending changes
        if (this.enableAutoSendOnPayment) {
            return this.currentOrder?.lines?.length && this.hasQuantity(this.currentOrder);
        }
        return (
            this.currentOrder?.lines?.length &&
            !this.hasChangesToPrint &&
            this.hasQuantity(this.currentOrder)
        );
    },
    get displayCategoryCount() {
        // Ensure categoryCount exists (it's added by pos_restaurant)
        return this.pos.categoryCount ? this.pos.categoryCount.slice(0, 4) : [];
    },
    get isCategoryCountOverflow() {
        if (this.pos.categoryCount && this.pos.categoryCount.length > 4) {
            return true;
        }
        return false;
    },
});
