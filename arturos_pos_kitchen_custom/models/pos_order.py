# -*- coding: utf-8 -*-

from odoo import models, api
import logging

_logger = logging.getLogger(__name__)

class PosOrder(models.Model):
    _inherit = 'pos.order'

    @api.model
    def _prepare_combo_line_uuids(self, order_vals):
        """
        Override to include combo links from combo_line_uuids (custom field).
        This ensures that items linked via UUIDs in the frontend are correctly linked in the backend,
        even if the standard ID-based linking fails (e.g. for custom items like 'COMER AQUI').
        """
        # Get standard links first
        acc = super()._prepare_combo_line_uuids(order_vals)
        
        try:
            if order_vals and 'lines' in order_vals:
                lines = [line[2] for line in order_vals['lines'] if len(line) == 3 and isinstance(line[2], dict)]
                
                for line in lines:
                    # product_name = self.env['product.product'].browse(line.get('product_id')).display_name if line.get('product_id') else 'Unknown'
                    
                    if custom_uuids := line.get('combo_line_uuids'):
                        parent_uuid = line.get('uuid')
                        
                        if parent_uuid:
                            existing_children = acc.get(parent_uuid, [])
                            # Merge and deduplicate
                            new_children = list(set(existing_children + custom_uuids))
                            acc[parent_uuid] = new_children

        except Exception as e:
            _logger.error("Error in _prepare_combo_line_uuids custom fix: %s", e, exc_info=True)
        
        return acc
