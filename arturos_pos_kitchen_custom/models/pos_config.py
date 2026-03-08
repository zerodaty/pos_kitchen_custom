# -*- coding: utf-8 -*-

from odoo import fields, models, api

class PosConfig(models.Model):
    _inherit = 'pos.config'

    #Este boton tiene que traerse un pos config personalizado que permita usar la funcionalidad de SDK de odoo sin todo lo demas que trae el modo restarante de base 
    enable_kds_only = fields.Boolean(string="Enable KDS Only Mode", help="If checked, this enables a KDS-only mode: hides Table Management UI (Floor Screen, Table Button) and unblocks the Order button.")
    
    enable_auto_send_on_payment = fields.Boolean(
        string="Auto-send to KDS on Payment",
        compute='_compute_enable_auto_send_on_payment',
        help="When enabled, orders are automatically sent to KDS upon payment completion."
    )
    
    def _compute_enable_auto_send_on_payment(self):
        """Get enable_auto_send_on_payment from the preparation display linked to this POS config"""
        for config in self:
            preparation_display = self.env['pos_preparation_display.display'].search([
                ('pos_config_ids', 'in', config.id)
            ], limit=1)
            config.enable_auto_send_on_payment = (
                preparation_display.enable_auto_send_on_payment if preparation_display else False
            )


class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    pos_enable_kds_only = fields.Boolean(related='pos_config_id.enable_kds_only', readonly=False)
