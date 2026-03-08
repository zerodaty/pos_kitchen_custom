import { patch } from "@web/core/utils/patch";
import { PreparationDisplay } from "@pos_preparation_display/app/components/preparation_display/preparation_display";
import { AboutDialog } from "@arturos_pos_kitchen_custom/overrides/components/about_dialog/about_dialog";
import { useState } from "@odoo/owl";

// Register AboutDialog as a known child component of PreparationDisplay
PreparationDisplay.components = {
    ...PreparationDisplay.components,
    AboutDialog,
};

patch(PreparationDisplay.prototype, {
    setup() {
        super.setup(...arguments);
        // Local reactive state to control the visibility of the About dialog
        this.aboutDialogState = useState({ isVisible: false });
    },

    openAboutDialog() {
        this.aboutDialogState.isVisible = true;
    },

    closeAboutDialog() {
        this.aboutDialogState.isVisible = false;
    }
});
