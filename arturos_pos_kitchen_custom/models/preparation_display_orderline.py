# -*- coding: utf-8 -*-

from odoo import models, api
from psycopg2 import OperationalError, errorcodes
import time
import logging

_logger = logging.getLogger(__name__)

class PosPreparationDisplayOrderline(models.Model):
    _inherit = 'pos_preparation_display.orderline'

    def _retry_on_serialization_failure(self, func, *args, **kwargs):
        """
        Retry a function if it fails due to serialization error or lock unavailability.
        This handles concurrent update errors when using mouse/touch.
        """
        max_retries = 3
        retry_delay = 0.05  # 50ms initial delay
        
        for attempt in range(max_retries):
            try:
                return func(*args, **kwargs)
            except OperationalError as e:
                # Check if it's a serialization failure or lock not available
                should_retry = (
                    e.pgcode == errorcodes.SERIALIZATION_FAILURE or
                    e.pgcode == errorcodes.LOCK_NOT_AVAILABLE
                )
                
                if should_retry:
                    if attempt < max_retries - 1:
                        # Wait with exponential backoff
                        wait_time = retry_delay * (2 ** attempt)
                        error_type = "Serialization" if e.pgcode == errorcodes.SERIALIZATION_FAILURE else "Lock"
                        _logger.info(f"[KDS] {error_type} error, retrying in {wait_time}s (attempt {attempt + 1}/{max_retries})")
                        time.sleep(wait_time)
                        # Rollback the failed transaction
                        self.env.cr.rollback()
                        # Invalidate cache to get fresh data
                        self.env.invalidate_all()
                        continue
                    else:
                        _logger.error(f"[KDS] Error after {max_retries} retries: {e}")
                        raise
                else:
                    # Not a retryable error, re-raise immediately
                    raise

    def change_line_status(self, status, *args, **kwargs):
        """
        [OPTIMIZED] 
        1. Batch updates to avoid N+1 queries on 30M record table.
        2. Uses sudo() to bypass simplify_access_management overhead.
        3. Row-level locking to prevent concurrency errors.
        """
        if not self:
            return True

        def _do_change_status():
            this_sudo = self.sudo()
            # Row-level lock
            query = "SELECT id FROM pos_preparation_display_orderline WHERE id = ANY(%s) FOR UPDATE NOWAIT"
            self.env.cr.execute(query, (list(this_sudo.ids),))

            # Batch update (handling different status per line if possible, or common status)
            # Find lines that need to be True and those that need to be False
            true_ids = [int(line_id) for line_id, val in status.items() if val and int(line_id) in this_sudo.ids]
            false_ids = [int(line_id) for line_id, val in status.items() if not val and int(line_id) in this_sudo.ids]

            if true_ids:
                this_sudo.browse(true_ids).write({'todo': True})
            if false_ids:
                this_sudo.browse(false_ids).write({'todo': False})

            # Notify displays
            categories = this_sudo.mapped('product_id.pos_categ_ids')
            preparation_displays = self.env['pos_preparation_display.display'].sudo().search([
                '|', ('category_ids', 'in', categories.ids), ('category_ids', '=', False)
            ])

            orderlines_status = []
            for line in this_sudo:
                orderlines_status.append({
                    'id': line.id,
                    'todo': line.todo
                })

            for preparation_display in preparation_displays:
                preparation_display._notify('CHANGE_ORDERLINE_STATUS', orderlines_status)

            return True

        return self._retry_on_serialization_failure(_do_change_status)

    def send_stricked_line_to_next_stage(self, preparation_display_id, *args, **kwargs):
        """
        [OPTIMIZED] Full override to fix latency and concurrency issues.
        1. Uses write() instead of loops for 30M record table.
        2. Uses sudo() to bypass simplify_access_management overhead.
        3. Maintains FOR UPDATE locking for data integrity.
        """
        def _do_send_to_next_stage():
            # Use sudo() for KDS backend operations to bypass heavy rule checks
            self_sudo = self.sudo()
            order = self_sudo.preparation_display_order_id
            preparation_display = self.env['pos_preparation_display.display'].sudo().browse(preparation_display_id)

            # Row-level lock on lines to prevent concurrent modification
            line_ids = self.ids
            if line_ids:
                query = "SELECT id FROM pos_preparation_display_orderline WHERE id = ANY(%s) FOR UPDATE NOWAIT"
                self.env.cr.execute(query, (list(line_ids),))

            stage_ids = preparation_display.stage_ids
            order_stages = order.order_stage_ids.filtered(lambda x: x.stage_id in stage_ids)
            
            if not order_stages:
                return order.id

            current_stage_record = order_stages[-1]
            try:
                current_stage_index = stage_ids.ids.index(current_stage_record.stage_id.id)
                if current_stage_index >= len(stage_ids.ids) - 1:
                    return order.id
                next_stage_id = stage_ids.ids[current_stage_index + 1]
            except (ValueError, IndexError):
                return order.id

            # Create new KDS order
            new_order = self.env['pos_preparation_display.order'].sudo().create({
                'displayed': True,
                'pos_order_id': order.pos_order_id.id,
                'pos_config_id': order.pos_config_id.id,
            })

            # Create new stage record
            new_order.order_stage_ids.create({
                'preparation_display_id': preparation_display_id,
                'stage_id': next_stage_id,
                'order_id': new_order.id,
                'done': False
            })

            # BATCH UPDATE: Most critical speed improvement
            self_sudo.write({
                'todo': True,
                'preparation_display_order_id': new_order.id
            })

            # Fetch categories in one go
            category_ids = set(self_sudo.mapped('product_id.pos_categ_ids.id'))

            # Notify displays
            preparation_displays = self.env['pos_preparation_display.display'].sudo().search([
                '&',
                '|', ('pos_config_ids', '=', False),
                ('pos_config_ids', 'in', [order.pos_config_id.id]),
                '|', ('category_ids', 'in', list(category_ids)),
                ('category_ids', '=', False)])

            for p_dis in preparation_displays:
                p_dis._send_load_orders_message()
            
            return new_order.id
        
        return self._retry_on_serialization_failure(_do_send_to_next_stage)
