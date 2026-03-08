/** @odoo-module */

import { patch } from "@web/core/utils/patch";
import { PaymentScreen } from "@point_of_sale/app/screens/payment_screen/payment_screen";

patch(PaymentScreen.prototype, {
    /**
     * Override to auto-send orders to KDS when payment is validated
     * if enable_auto_send_on_payment is enabled.
     */
    async validateOrder(isForceValidate) {
        // Check if we should auto-send to KDS before validating
        const shouldAutoSend =
            this.pos.config.enable_kds_only &&
            this.pos.config.enable_auto_send_on_payment;

        if (shouldAutoSend) {
            // Check if there are changes to send to KDS
            const hasChanges = this.pos.getOrderChanges && this.pos.getOrderChanges();
            const hasChangesToPrint = hasChanges && (
                hasChanges.generalNote === ""
                    ? true // for the case when removed all general note
                    : hasChanges.count || hasChanges.generalNote || hasChanges.modeUpdate
            );

            // Send to KDS if there are changes
            if (hasChangesToPrint) {
                try {
                    await this.pos.sendOrderInPreparationUpdateLastChange(this.currentOrder);
                } catch (error) {
                    console.error("[KDS Auto-Send] Error sending order to KDS:", error);
                    // Continue with payment validation even if KDS send fails
                }
            }
        }

        // Call parent method to continue with normal payment validation
        return await super.validateOrder(isForceValidate);
    },
});
