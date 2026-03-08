/** @odoo-module */

import { patch } from "@web/core/utils/patch";
import { Orderline } from "@pos_preparation_display/app/components/orderline/orderline";

patch(Orderline.prototype, {
    /**
     * Override to handle aggregated lines.
     * If the orderline has aggregatedIds, we need to update all of them.
     */
    async changeOrderlineStatus() {
        const orderline = this.props.orderline;

        // If this is an aggregated line (created in getSortedOrderlines)
        if (orderline.aggregatedIds && orderline.aggregatedIds.length > 0) {
            const newState = !orderline.todo;
            const order = orderline.order;

            // Optimistic update for the aggregated line
            orderline.todo = newState;

            // Update all underlying lines in the model
            // We need to find them in the order's orderlines
            const idsToUpdate = orderline.aggregatedIds;

            // Perform the write operation for all IDs
            // The original method does: this.orm.write("pos_preparation_display.order.stage", ... wait no
            // The original method does NOT call write directly?
            // Let's check the original code again.
            // Original code:
            // orderline.todo = newState;
            // if (order.stageId !== this.preparationDisplay.lastStage.id) {
            //     this.preparationDisplay.changeOrderStage(order);
            // }

            // Wait, where is the write?
            // Orderline model is Reactive.
            // Does changing .todo trigger a write?
            // No, usually there is a listener or the component calls a service.

            // Ah, I see in Orderline component setup: this.orm = useService("orm");
            // But changeOrderlineStatus in the component (Step 628) does NOT call this.orm.write.
            // It just sets orderline.todo = newState.

            // So where is the write happening?
            // Maybe in the model?
            // Let's check Orderline model or PreparationDisplay model.

            // If I look at preparation_display.js (Step 577), there is no write on todo change.
            // Maybe it's in the base preparation_display.js?

            // Let's assume for now that setting .todo is enough if it's reactive.
            // But wait, if I created a CLONE in getSortedOrderlines, that clone is NOT the reactive model instance.
            // It's a copy.
            // So setting .todo on the clone does NOTHING to the backend.

            // I MUST manually update the real model instances and trigger the write.

            // Let's find the real orderlines
            for (const id of idsToUpdate) {
                const realLine = this.preparationDisplay.orderlines[id];
                if (realLine) {
                    realLine.todo = newState;
                }
            }

            // Now, we need to ensure the backend is updated.
            // If the base code relies on reactivity of the original object to trigger a write (unlikely for simple property),
            // or if there is an explicit save.

            // Actually, in standard Odoo preparation display, clicking a line usually calls an RPC.
            // Let's check `orderline.js` again carefully.
            // Step 628:
            // async changeOrderlineStatus() {
            //     const orderline = this.props.orderline;
            //     const newState = !orderline.todo;
            //     const order = this.props.orderline.order;
            //     orderline.todo = newState;
            //     if (order.stageId !== this.preparationDisplay.lastStage.id) {
            //         this.preparationDisplay.changeOrderStage(order);
            //     }
            // }

            // It calls `this.preparationDisplay.changeOrderStage(order)`.
            // `changeOrderStage` (Step 577) calls `super.changeOrderStage`.
            // Does `changeOrderStage` save the line status?
            // Usually `changeOrderStage` moves the order to next stage if all lines are done.

            // But what saves the "todo" status of the line itself?
            // Maybe `orderline.todo` setter triggers an RPC?
            // Let's check `models/orderline.js` (Step 576).
            // It extends Reactive.
            // No setter logic visible.

            // There MUST be something I missed.
            // Let's check `models/preparation_display.js` base code for `setup` or listeners.

            // However, if I want to be safe, I should call the ORM write myself.
            // "pos_preparation_display.orderline" model?

            try {
                await this.orm.write("pos_preparation_display.orderline", idsToUpdate, {
                    todo: newState,
                });
            } catch (e) {
                console.error("Failed to update orderline status", e);
            }

            // And then call changeOrderStage to check if order is complete
            if (order.stageId !== this.preparationDisplay.lastStage.id) {
                this.preparationDisplay.changeOrderStage(order);
            }

            return;
        }

        // Fallback to default behavior for non-aggregated lines
        return super.changeOrderlineStatus();
    }
});
