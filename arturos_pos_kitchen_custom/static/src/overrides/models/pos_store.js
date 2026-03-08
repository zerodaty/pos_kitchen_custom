/** @odoo-module */

import { patch } from "@web/core/utils/patch";
import { PosStore } from "@point_of_sale/app/store/pos_store";

patch(PosStore.prototype, {
    /**
     * Override printChanges to organize order lines by combos and mark combo children
     * This ensures proper display in both printer receipts and KDS
     */
    async printChanges(order, orderChange) {
        // Mark combo child items for indentation in KDS before printing
        if (orderChange.new && orderChange.new.length > 0) {
            for (const line of orderChange.new) {
                // A line is a combo child if it has combo_parent_id
                if (line.combo_parent_id) {
                    line.isComboChild = true;
                }
            }
        }

        // Call parent method to handle the actual printing and KDS sending
        return await super.printChanges(order, orderChange);
    },
});
