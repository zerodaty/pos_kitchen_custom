/** @odoo-module */

import { PosOrderline } from "@point_of_sale/app/models/pos_order_line";
import { patch } from "@web/core/utils/patch";

patch(PosOrderline.prototype, {
    export_as_JSON() {
        const json = super.export_as_JSON(...arguments);

        // Export combo line UUIDs for backend processing
        if (this.combo_line_ids?.length) {
            json.combo_line_uuids = this.combo_line_ids.map(line => line.uuid);
        }

        return json;
    },
});
