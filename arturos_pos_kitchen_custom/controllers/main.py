# -*- coding: utf-8 -*-

from odoo import http
from odoo.http import request
from odoo.addons.pos_preparation_display.controllers.main import PosPreparationDisplayController


class PosPreparationDisplayControllerCustom(PosPreparationDisplayController):
    
    @http.route(['/pos_preparation_display/web/'], type='http', auth='user', methods=['GET'])
    def display_preparation_web(self, display_id=False, debug=False, **kwargs):
        """
        Override to include keyboard configuration in session_info.
        This allows the frontend to access keyboard settings via window.odoo.preparation_display
        """
        preparation_display = request.env['pos_preparation_display.display'].search(
            [('id', '=', int(display_id))]
        )

        if not preparation_display:
            return request.redirect('/odoo/action-pos_preparation_display.action_preparation_display')

        session_info = request.env['ir.http'].session_info()
        
        # Include keyboard configuration fields in addition to standard fields
        session_info['preparation_display'] = preparation_display.read([
            "id",
            "name",
            "access_token",
            # Keyboard navigation fields
            "key_navigate_up",
            "key_navigate_down",
            "key_navigate_left",
            "key_navigate_right",
            "key_advance_order",
            "key_change_stage_prev",
            "key_change_stage_next",
            "key_fullscreen",
        ])[0]

        context = {
            'session_info': session_info,
        }

        response = request.render('pos_preparation_display.index', context)
        return response
