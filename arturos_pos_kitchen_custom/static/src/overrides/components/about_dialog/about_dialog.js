/** @odoo-module */

import { Component } from "@odoo/owl";

/**
 * AboutDialog — KDS Author Card
 * Shows module author info when clicking the sidebar logo.
 * Standalone component: no Odoo Dialog dependency, pure OWL + CSS.
 */
export class AboutDialog extends Component {
    static template = "arturos_pos_kitchen_custom.AboutDialog";
    static props = {
        onClose: { type: Function },
    };

    /**
     * Close when clicking the backdrop (outside the card).
     */
    onBackdropClick(event) {
        if (event.target === event.currentTarget) {
            this.props.onClose();
        }
    }

    openGitHub() {
        window.open("https://github.com/zerodaty", "_blank", "noopener noreferrer");
    }
}
