# -*- coding: utf-8 -*-

from odoo import models, fields

class PosOrderLine(models.Model):
    _inherit = 'pos.order.line'

    # Add index=True to uuid field to prevent Full Table Scans
    # This is critical for performance in databases with millions of records
    uuid = fields.Char(index=True)
