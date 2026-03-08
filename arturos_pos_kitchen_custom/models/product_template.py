# -*- coding: utf-8 -*-

from odoo import models, fields


class ProductTemplate(models.Model):
    _inherit = 'product.template'

    special_product_type = fields.Selection(
        selection=[
            ('delivery_type', 'Delivery Type'),
        ],
        string='Special Product Type',
        help='Classify this product as a special type for KDS display purposes'
    )
