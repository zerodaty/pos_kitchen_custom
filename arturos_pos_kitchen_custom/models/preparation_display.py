# -*- coding: utf-8 -*-

from odoo import models, fields, api, _
from odoo.exceptions import ValidationError

class PosPreparationDisplay(models.Model):
    _inherit = 'pos_preparation_display.display'

    # Conditional KDS features
    enable_auto_send_on_payment = fields.Boolean(
        string='Auto-send to KDS on Payment',
        default=False,
        help='When enabled, orders are automatically sent to KDS upon payment completion instead of requiring the Order button.'
    )
    
    has_kds_only_pos = fields.Boolean(
        string='Has KDS-Only POS',
        compute='_compute_has_kds_only_pos',
        store=True,
        help='Technical field: True if at least one POS config has enable_kds_only enabled.'
    )
    
    show_empty_columns = fields.Boolean(
        string='Show Empty Columns',
        default=False,
        help='When enabled, columns for all configured POS configs are always visible, even if they have no orders. '
             'When disabled, only columns with a<ctive orders are shown.'
    )

    kds_header_color = fields.Char(
        string='Color de la barra de columna del KDS',
        default='#f7931e',
        help='Elige el color para la barra de título de cada caja POS en la pantalla.'
    )

    # Dynamic branding images
    kds_background_image = fields.Binary(
        string='Imagen de Fondo del KDS',
        attachment=True,
        help='Sube una imagen personalizada de fondo para esta pantalla KDS. '
             'Si no hay imagen, se usa la imagen de fondo por defecto.'
    )
    kds_favicon_image = fields.Binary(
        string='Favicon / Logo KDS',
        attachment=True,
        help='Sube un favicon o logo personalizado para esta pantalla KDS. '
             'Si no hay imagen, se usa el favicon por defecto.'
    )
    # Keyboard navigation settings
    key_navigate_up = fields.Char(
        string='Tecla: Orden Anterior',
        default='ArrowUp',
        help='Tecla para navegar a la orden anterior (ej: ArrowUp, w, 8)'
    )
    key_navigate_down = fields.Char(
        string='Tecla: Orden Siguiente',
        default='ArrowDown',
        help='Tecla para navegar a la orden siguiente (ej: ArrowDown, s, 2)'
    )
    key_navigate_left = fields.Char(
        string='Tecla: Columna Izquierda',
        default='4',
        help='Tecla para cambiar a la columna izquierda (ej: ArrowLeft, a, 4)'
    )
    key_navigate_right = fields.Char(
        string='Tecla: Columna Derecha',
        default='6',
        help='Tecla para cambiar a la columna derecha (ej: ArrowRight, d, 6)'
    )
    key_advance_order = fields.Char(
        string='Tecla: Avanzar Orden',
        default='Enter',
        help='Tecla para avanzar la orden al siguiente stage o marcar como hecha (ej: Enter)'
    )
    
    # Stage navigation settings
    key_change_stage_prev = fields.Char(
        string='Tecla: Stage Anterior',
        default='7',
        help='Tecla para cambiar a la vista del stage anterior (ej: 7, PageUp)'
    )
    key_change_stage_next = fields.Char(
        string='Tecla: Stage Siguiente',
        default='9',
        help='Tecla para cambiar a la vista del stage siguiente (ej: 9, PageDown)'
    )
    key_fullscreen = fields.Char(
        string='Tecla: Pantalla Completa',
        default='0',
        help='Tecla para activar/desactivar pantalla completa (ej: 0, F11, f)'
    )

    # Override stage_ids to set custom default stages
    stage_ids = fields.One2many(
        'pos_preparation_display.stage', 
        'preparation_display_id', 
        string="Stages", 
        default=[
            {'name': 'En preparación', 'color': '#3498db', 'alert_timer': 10, 'auto_advance_minutes': 0},
            {'name': 'Entregado', 'color': '#27ae60', 'alert_timer': 0, 'auto_advance_minutes': 15}
        ]
    )

    @api.depends('pos_config_ids', 'pos_config_ids.enable_kds_only')
    def _compute_has_kds_only_pos(self):
        """Check if any linked POS config has KDS-only mode enabled"""
        for display in self:
            display.has_kds_only_pos = any(
                config.enable_kds_only for config in display.pos_config_ids
            )


    @api.constrains('pos_config_ids')
    def _check_max_pos_configs(self):
        """Limit to maximum 2 POS configs per preparation display"""
        for display in self:
            if len(display.pos_config_ids) > 2:
                raise ValidationError(_(
                    'A preparation display can have a maximum of 2 POS configurations. '
                    'Please remove some POS configs before adding new ones.'
                ))

    def read(self, fields=None, load='_classic_read'):
        """Override read to include keyboard config, KDS features, and stage configs in the data sent to frontend"""
        result = super().read(fields, load)
        
        # If reading for the preparation display, include keyboard config, KDS features, and stage configs
        if isinstance(result, list) and result:
            for record in result:
                if 'id' in record:
                    display = self.browse(record['id'])
                    # Add KDS features (with safe attribute access)
                    if hasattr(display, 'enable_auto_send_on_payment'):
                        record['enable_auto_send_on_payment'] = display.enable_auto_send_on_payment
                    if hasattr(display, 'has_kds_only_pos'):
                        record['has_kds_only_pos'] = display.has_kds_only_pos
                    if hasattr(display, 'show_empty_columns'):
                        record['show_empty_columns'] = display.show_empty_columns
                    # Export POS config names for static columns
                    record['pos_config_names'] = [config.name for config in display.pos_config_ids]
                    
                    # Custom colors
                    record['kds_header_color'] = display.kds_header_color or '#f7931e'
                 
                    # Dynamic image URLs - served by Odoo as /web/image/model/id/field
                    if display.kds_background_image:
                        record['kds_background_url'] = f'/web/image/pos_preparation_display.display/{display.id}/kds_background_image'
                    else:
                        record['kds_background_url'] = False
                    if display.kds_favicon_image:
                        record['kds_favicon_url'] = f'/web/image/pos_preparation_display.display/{display.id}/kds_favicon_image'
                    else:
                        record['kds_favicon_url'] = False
                    # Add keyboard configuration (with safe attribute access)
                    record['key_navigate_up'] = getattr(display, 'key_navigate_up', None) or '8'
                    record['key_navigate_down'] = getattr(display, 'key_navigate_down', None) or '2'
                    record['key_navigate_left'] = getattr(display, 'key_navigate_left', None) or '4'
                    record['key_navigate_right'] = getattr(display, 'key_navigate_right', None) or '6'
                    record['key_advance_order'] = getattr(display, 'key_advance_order', None) or 'Enter'
                    record['key_change_stage_prev'] = getattr(display, 'key_change_stage_prev', None) or '7'
                    record['key_change_stage_next'] = getattr(display, 'key_change_stage_next', None) or '9'
                    record['key_fullscreen'] = getattr(display, 'key_fullscreen', None) or '0'
                    
                    # Add stage configurations for frontend auto-cleanup
                    stage_configs = {}
                    all_stages = display.stage_ids.sorted('sequence')
                    for i, stage in enumerate(all_stages):
                        # Safe access to auto_advance_minutes
                        auto_advance = getattr(stage, 'auto_advance_minutes', None) or 0
                        stage_configs[stage.id] = {
                            'auto_advance_minutes': auto_advance,
                            'has_next_stage': i < len(all_stages) - 1,
                            'sequence': stage.sequence,
                        }
                    record['stage_configs'] = stage_configs
        
        return result



    def _should_include(self, orderline, pos_line_map=None):
        """
        Override to:
        1. Exclude products from 'RECETAS' category (internal recipe components)
        2. Include combo children even without categories if their parent has one
        """
        # FIRST: Check if product is from RECETAS category - always exclude these
        # RECETAS is a product.category, not a pos.category
        product = orderline.product_id
        
        # Check if the product's category or any parent category is RECETAS
        if product.categ_id:
            is_recipe = self.env['product.category'].search_count([
                ('id', 'parent_of', product.categ_id.id),
                ('name', '=ilike', 'RECETAS')
            ])
            if is_recipe:
                return False
        
        # Check if the line itself has a valid category (standard behavior)
        if product.pos_categ_ids & self._get_pos_category_ids():
            return True
        
        # [OPTIMIZED] THIRD: If the line doesn't have a valid category, check if it's a combo child
        # Use the pre-loaded map if available to avoid a 30M record search
        pos_orderline = False
        if pos_line_map:
            pos_orderline = pos_line_map.get(orderline.pos_order_line_uuid)
        else:
            # Fallback for other callers
            pos_orderline = self.env['pos.order.line'].search([
                ('uuid', '=', orderline.pos_order_line_uuid),
                ('order_id.id', '=', orderline.preparation_display_order_id.pos_order_id.id)
            ], limit=1)
        
        if pos_orderline and pos_orderline.combo_parent_id:
            # This is a combo child, check if the parent has a valid category
            parent_prep_line = self.env['pos_preparation_display.orderline'].search([
                ('pos_order_line_uuid', '=', pos_orderline.combo_parent_id.uuid),
                ('preparation_display_order_id', '=', orderline.preparation_display_order_id.id)
            ], limit=1)
            
            if parent_prep_line:
                # Recursively check if the parent should be included, passing the map
                return self._should_include(parent_prep_line, pos_line_map=pos_line_map)
        
        # Default: not included
        return False
