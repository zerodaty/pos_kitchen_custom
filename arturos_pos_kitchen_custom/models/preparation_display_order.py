# -*- coding: utf-8 -*-

from odoo import models, api
import logging

_logger = logging.getLogger(__name__)

class PosPreparationDisplayOrder(models.Model):
    _inherit = 'pos_preparation_display.order'

    def _is_service_type(self, product):
        """Check if a product is a delivery type based on special_product_type field"""
        if not product:
            return False
        return product.special_product_type == 'delivery_type'

    def get_preparation_display_order(self, preparation_display_id, *args, **kwargs):
        """
        [OPTIMIZED] High performance version of get_preparation_display_order.
        Signature: handles both direct Python calls and RPC calls (which may pass ids in args).
        """
        # Odoo RPC from JS orm.call often passes [[ids], preparation_display_id]
        # In instance methods, recs is model.browse(ids).
        # We handle case where preparation_display_id might be the IDs list if signature is misaligned.
        if isinstance(preparation_display_id, (list, models.BaseModel)) and args:
            preparation_display_id = args[0]
            
        # Fast browse and search via sudo
        preparation_display = self.env['pos_preparation_display.display'].sudo().browse(preparation_display_id)
        
        if not preparation_display.exists():
            return []

        open_orders = preparation_display._get_open_orders_in_display()
        new_orders = preparation_display._get_stageless_orders_in_display()
        
        if not preparation_display.stage_ids:
            return []
            
        first_stage = preparation_display.stage_ids[0]

        preparation_display_orders_ui = []
        order_stages_values = []
        
        # Combine orders
        all_candidate_orders = open_orders
        for order in new_orders:
            order_stages_values.append({
                'preparation_display_id': preparation_display_id,
                'stage_id': first_stage.id,
                'order_id': order.id,
                'done': False
            })
            all_candidate_orders |= order
            
        if order_stages_values:
            self.env['pos_preparation_display.order.stage'].sudo().create(order_stages_values)

        for order in all_candidate_orders:
            order_ui = order._export_for_ui(preparation_display)
            if order_ui:
                preparation_display_orders_ui.append(order_ui)

        return preparation_display_orders_ui

    def change_order_stage(self, stage_id, preparation_display_id, *args, **kwargs):
        """
        [OPTIMIZED] 
        1. Flexible signature to avoid TypeError.
        2. Batch updates to avoid N+1 queries.
        3. Row-level locking (FOR UPDATE) to prevent concurrency errors.
        """
        self.ensure_one()
        
        # Acquisition of lock to prevent PostgreSQL serialization failure
        query = "SELECT id FROM pos_preparation_display_order WHERE id = %s FOR UPDATE NOWAIT"
        self.env.cr.execute(query, (self.id,))
        
        this_sudo = self.sudo()
        categories = this_sudo.preparation_display_order_line_ids.mapped('product_id.pos_categ_ids.id')
        p_dis = self.env['pos_preparation_display.display'].sudo().browse(preparation_display_id)

        # Batch update lines
        this_sudo.preparation_display_order_line_ids.write({'todo': True})

        p_dis_categories = p_dis._get_pos_category_ids()

        if set(p_dis_categories.ids).intersection(categories):
            if stage_id in p_dis.stage_ids.ids:
                current_stage = this_sudo.order_stage_ids.create({
                    'preparation_display_id': p_dis.id,
                    'stage_id': stage_id,
                    'order_id': self.id,
                    'done': False
                })

                p_dis._notify('CHANGE_ORDER_STAGE', {
                    'order_id': self.id,
                    'last_stage_change': current_stage.write_date,
                    'stage_id': stage_id
                })

                return current_stage.write_date
        return False

    def _export_for_ui(self, preparation_display):
        """
        [OPTIMIZED]
        1. Batch fetch all pos.order.lines for this order to avoid N+1 queries.
        2. Group identical orderlines (same product, attributes, notes) and sum quantities.
        3. Include combo parent information and service type labels.
        """
        # Batch fetch all related POS order lines for this order
        # This is critical to avoid N+1 searches on the 30M+ pos_order_line table
        pos_lines = self.env['pos.order.line'].search([('order_id', '=', self.pos_order_id.id)])
        pos_line_by_uuid = {line.uuid: line for line in pos_lines if line.uuid}

        preparation_display_orderlines = []
        
        # Build child to parent map for combos in one pass
        child_to_parent_uuid = {}
        for line in pos_lines:
            if line.combo_line_ids:
                for child in line.combo_line_ids:
                    if child.uuid:
                        child_to_parent_uuid[child.uuid] = line.uuid

        # Map to store service type labels (parent_uuid -> service_name)
        service_type_by_parent = {}

        temp_orderlines = []
        for orderline in self.preparation_display_order_line_ids:
            if preparation_display._should_include(orderline, pos_line_map=pos_line_by_uuid):
                pos_orderline = pos_line_by_uuid.get(orderline.pos_order_line_uuid)
                
                is_service = self._is_service_type(orderline.product_id)
                combo_parent_uuid = False
                is_combo_parent = False
                
                if pos_orderline:
                    is_combo_parent = bool(pos_orderline.combo_line_ids)
                    if pos_orderline.combo_parent_id:
                        combo_parent_uuid = pos_orderline.combo_parent_id.uuid
                    
                    # Store service type label for the parent if applicable
                    if is_service and combo_parent_uuid:
                        service_type_by_parent[combo_parent_uuid] = orderline.product_id.name

                temp_orderlines.append({
                    'id': orderline.id,
                    'todo': orderline.todo,
                    'internal_note': orderline.internal_note,
                    'attribute_ids': orderline.attribute_value_ids.ids,
                    'product_id': orderline.product_id.id,
                    'product_name': orderline.product_id.name,
                    'product_quantity': orderline.product_quantity,
                    'product_cancelled': orderline.product_cancelled,
                    'product_category_ids': orderline.product_id.pos_categ_ids.ids,
                    'pos_order_line_uuid': orderline.pos_order_line_uuid,
                    'is_service_type': is_service,
                    'is_combo_parent': is_combo_parent,
                })

        if not temp_orderlines:
            return None

        # Second pass: Enrich with parent UUIDs and service labels
        for line_data in temp_orderlines:
            uuid = line_data['pos_order_line_uuid']
            
            # Logic for parent UUID (from pos_orderline or from global map)
            pos_orderline = pos_line_by_uuid.get(uuid)
            parent_uuid = False
            if pos_orderline and pos_orderline.combo_parent_id:
                parent_uuid = pos_orderline.combo_parent_id.uuid
            elif uuid in child_to_parent_uuid:
                parent_uuid = child_to_parent_uuid[uuid]
            
            line_data['combo_parent_uuid'] = parent_uuid
            
            # Add service label if this is a combo parent that has a service child
            if line_data['is_combo_parent'] and uuid in service_type_by_parent:
                line_data['service_type_label'] = service_type_by_parent[uuid]
            else:
                line_data['service_type_label'] = False

        # Get current order stage
        current_order_stage = None
        for stage in self.order_stage_ids[::-1]:
            if stage.preparation_display_id.id == preparation_display.id:
                current_order_stage = stage
                break

        # Meta data for the order
        pos_config_name = self.pos_order_id.session_id.config_id.name if self.pos_order_id.session_id else ''
        customer_name = self.pos_order_id.partner_id.name if self.pos_order_id.partner_id else ''

        return {
            'id': self.id,
            'pos_order_id': self.pos_order_id.id,
            'create_date': self.create_date,
            'responsible': self.create_uid.display_name,
            'pos_config_name': pos_config_name,
            'customer_name': customer_name,
            'stage_id': current_order_stage.stage_id.id if current_order_stage else None,
            'last_stage_change': current_order_stage.write_date if current_order_stage else self.create_date,
            'displayed': self.displayed,
            'orderlines': temp_orderlines,
            'tracking_number': self.pos_order_id.tracking_number,
            'generalNote': self.pdis_general_note or '',
        }
