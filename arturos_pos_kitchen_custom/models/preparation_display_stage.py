# -*- coding: utf-8 -*-

from odoo import models, fields, api
from datetime import datetime, timedelta
import logging

_logger = logging.getLogger(__name__)


class PosPreparationStage(models.Model):
    _inherit = 'pos_preparation_display.stage'

    auto_advance_minutes = fields.Integer(
        string='Auto-avance (min)',
        help='Minutos antes de avanzar automáticamente al siguiente stage. '
             'Dejar vacío para avance manual.'
    )

    auto_advance_display = fields.Char(
        string='Configurado',
        compute='_compute_auto_advance_display',
        store=False
    )

    @api.depends('auto_advance_minutes')
    def _compute_auto_advance_display(self):
        """Muestra 'N/A' si no configurado, o '{X} min' si configurado"""
        for stage in self:
            if stage.auto_advance_minutes and stage.auto_advance_minutes > 0:
                stage.auto_advance_display = f'{stage.auto_advance_minutes} min'
            else:
                stage.auto_advance_display = 'N/A'
