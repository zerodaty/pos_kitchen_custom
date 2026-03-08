/** @odoo-module */

import { patch } from "@web/core/utils/patch";
import { Order } from "@pos_preparation_display/app/components/order/order";

patch(Order.prototype, {
    setup() {
        super.setup();
        // Now this.preparationDisplay is available from the base class
    },

    get posHeaderColor() {
        const config = (window.odoo && window.odoo.preparation_display) || {};
        return config.kds_header_color || '#212529';
    },

    /**
     * Override to ensure combo children appear immediately after their parents.
     * The default implementation sorts by category sequence, which breaks combo structure.
     */
    getSortedOrderlines() {
        // First, get the lines sorted by category (default behavior)
        // But we only want to sort the "top level" items (non-combo lines and combo parents)
        const allLines = this.props.order.orderlines;

        // Separate parents/independent lines from children
        const topLevelLines = [];
        const childrenByParent = {};

        for (const line of allLines) {
            if (line.comboParentUuid) {
                // It's a child
                if (!childrenByParent[line.comboParentUuid]) {
                    childrenByParent[line.comboParentUuid] = [];
                }
                childrenByParent[line.comboParentUuid].push(line);
            } else {
                // It's a top level line (regular or combo parent)
                topLevelLines.push(line);
            }
        }

        // Sort top level lines by category sequence (mimicking original behavior)
        topLevelLines.sort((a, b) => {
            const categoryA = this.preparationDisplay.getProductCategories(a.productCategoryIds)[0];
            const categoryB = this.preparationDisplay.getProductCategories(b.productCategoryIds)[0];

            // Safety check for categories
            if (!categoryA || !categoryB) return 0;

            if (categoryA.sequence === 0 && categoryB.sequence === 0) {
                return categoryA.id - categoryB.id;
            }
            return categoryA.sequence - categoryB.sequence;
        });

        // Reconstruct the list: Parent -> Children -> Next Parent...
        const sortedResult = [];

        for (const parent of topLevelLines) {
            sortedResult.push(parent);

            // If this parent has children, append them immediately after
            // We use posOrderLineUuid to match, as that's what we stored in the backend
            if (parent.posOrderLineUuid && childrenByParent[parent.posOrderLineUuid]) {
                const children = childrenByParent[parent.posOrderLineUuid];

                // Aggregate identical children
                const aggregatedChildren = [];
                const childrenMap = new Map(); // Key -> AggregatedLine

                for (const child of children) {
                    // Create a unique key for grouping: product_id + sorted attribute_ids + internal_note
                    // We can use JSON.stringify for simplicity since attributes are IDs
                    const key = JSON.stringify({
                        p: child.productId,
                        a: child.attribute_ids ? [...child.attribute_ids].sort() : [],
                        n: child.internalNote || '',
                    });

                    if (childrenMap.has(key)) {
                        const existing = childrenMap.get(key);
                        // Update quantity
                        existing.productQuantity += child.productQuantity;
                        existing.productCancelled += child.productCancelled;
                        // Add ID to aggregated list
                        if (!existing.aggregatedIds) existing.aggregatedIds = [existing.id];
                        existing.aggregatedIds.push(child.id);

                        // If any child is todo, the group is todo? Or if all?
                        // Usually if one is todo, the group is todo.
                        // But wait, child.todo is boolean.
                        // If I have 2 chocolates, one done, one todo.
                        // Display: 2x Chocolate.
                        // Status: Todo (because 1 is todo).
                        if (child.todo) existing.todo = true;
                    } else {
                        // Clone the child to avoid mutating the original model
                        // We use Object.create to keep prototype methods if any (Orderline is a class)
                        // But we need to be careful about reactivity.
                        // Since we are in a render helper, we should probably return a new object that looks like Orderline
                        // or just modify a shallow copy.

                        // Let's try creating a shallow copy with prototype
                        const clone = Object.assign(Object.create(Object.getPrototypeOf(child)), child);
                        // Ensure aggregatedIds is initialized
                        clone.aggregatedIds = [child.id];
                        childrenMap.set(key, clone);
                        aggregatedChildren.push(clone);
                    }
                }

                // Optional: Sort children by name
                aggregatedChildren.sort((a, b) => a.productName.localeCompare(b.productName));

                sortedResult.push(...aggregatedChildren);
            }
        }

        // Check for orphaned children (shouldn't happen, but good for safety)
        // If we have children whose parents weren't in topLevelLines
        for (const [parentUuid, children] of Object.entries(childrenByParent)) {
            const parentExists = topLevelLines.some(l => l.posOrderLineUuid === parentUuid);
            if (!parentExists) {
                console.warn(`[KDS] Found orphaned combo children for parent UUID ${parentUuid}`, children);
                sortedResult.push(...children);
            }
        }

        return sortedResult;
    },

    /**
     * Check if this order is currently selected by keyboard navigation.
     * Used in the template to apply the selection class.
     */
    isKeyboardSelected() {
        const keyboardState = this.preparationDisplay.keyboardState;
        if (!keyboardState) return false;
        return keyboardState.selectedOrderId === this.props.order.id;
    }
});
