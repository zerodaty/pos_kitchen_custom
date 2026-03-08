/** @odoo-module */

import { Component, useState } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { standardFieldProps } from "@web/views/fields/standard_field_props";

export class KeyCaptureWidget extends Component {
    static template = "arturos_pos_kitchen_custom.KeyCaptureWidget";
    static props = {
        ...standardFieldProps,
    };

    static supportedTypes = ["char"];

    setup() {
        this.state = useState({
            isCapturing: false,
        });
    }

    get displayValue() {
        if (!this.props.record || !this.props.name) {
            return "Click to set key";
        }

        const value = this.props.record.data[this.props.name];
        if (!value) return "Click to set key";

        // Format key names nicely
        const keyMap = {
            'ArrowUp': '↑ Arrow Up',
            'ArrowDown': '↓ Arrow Down',
            'ArrowLeft': '← Arrow Left',
            'ArrowRight': '→ Arrow Right',
            'Enter': '⏎ Enter',
            'Escape': 'Esc',
            ' ': 'Space',
            // Numpad keys
            '0': '0️⃣ Pantalla completa',
            '1': '1 (Numpad)',
            '2': '2️⃣ Orden ↓',
            '3': '3 (Numpad)',
            '4': '4️⃣ Columna ←',
            '5': '5 (Numpad)',
            '6': '6️⃣ Columna →',
            '7': '7️⃣ Stage ←',
            '8': '8️⃣ Orden ↑',
            '9': '9️⃣ Stage →',
        };

        return keyMap[value] || value;
    }

    get isReadonly() {
        return this.props.readonly || false;
    }

    get currentValue() {
        if (!this.props.record || !this.props.name) {
            return false;
        }
        return this.props.record.data[this.props.name];
    }

    startCapture() {
        if (this.isReadonly) return;

        this.state.isCapturing = true;
        document.addEventListener('keydown', this.onKeyDown.bind(this), { once: true });

        // Auto-cancel after 5 seconds if no key pressed
        setTimeout(() => {
            if (this.state.isCapturing) {
                this.state.isCapturing = false;
            }
        }, 5000);
    }

    onKeyDown(event) {
        event.preventDefault();
        event.stopPropagation();

        this.state.isCapturing = false;

        // Capture the key
        let key = event.key;

        // Update the field value
        if (this.props.record && this.props.name) {
            this.props.record.update({ [this.props.name]: key });
        }
    }

    clearKey() {
        if (this.isReadonly) return;

        if (this.props.record && this.props.name) {
            this.props.record.update({ [this.props.name]: false });
        }
    }
}

export const keyCaptureWidget = {
    component: KeyCaptureWidget,
    supportedTypes: ["char"],
};

registry.category("fields").add("key_capture", keyCaptureWidget);
