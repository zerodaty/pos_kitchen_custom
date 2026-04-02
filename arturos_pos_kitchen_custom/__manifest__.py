# -*- coding: utf-8 -*-
{
  # Theme information
  'name': 'POS Kitchen Custom',
  'version': '18.0.1.0.0',
  'category': 'Point of Sale',
  'countries': ['ve'],
  'summary': 'POS Kitchen Customizations',
  'description': """ POS Kitchen Customizations """,

  # Author
  'author': 'Frany Velasquez,
  'maintainer': 'Frany Velasquez',
  'license': 'LGPL-3',
  'contributors': [
    
    'Frany Velasquez <zerodaty@gmail.com>',
    
  ],
  
  # Dependencies
  'depends': [
    'base',
    'product',
    'point_of_sale',
    'pos_restaurant'
  ],

  # Data
  'data': [
    # 'security/ir.model.access.csv',
    'security/ir_rule.xml',
    'views/res_config_settings_views.xml',
    'views/preparation_display_views.xml',
    'views/preparation_display_assets_index.xml',
    'views/product_template_views.xml',
  ],

  'assets': {
      # Backend assets (for configuration forms)
      'web.assets_backend': [
          'arturos_pos_kitchen_custom/static/src/widgets/key_capture_widget.js',
          'arturos_pos_kitchen_custom/static/src/widgets/key_capture_widget.xml',
          'arturos_pos_kitchen_custom/static/src/widgets/key_capture_widget.scss',
      ],
      # POS assets (for the Point of Sale interface)
      'point_of_sale._assets_pos': [
          'arturos_pos_kitchen_custom/static/src/overrides/components/actionpad_widget/actionpad_widget.js',
          'arturos_pos_kitchen_custom/static/src/overrides/components/actionpad_widget/actionpad_widget.xml',
          'arturos_pos_kitchen_custom/static/src/overrides/components/payment_screen/payment_screen.js',
          'arturos_pos_kitchen_custom/static/src/overrides/models/pos_orderline.js',
      ],
      # KDS assets (for the Kitchen Display System)
      'pos_preparation_display.assets': [
          'arturos_pos_kitchen_custom/static/src/overrides/models/preparation_display.js',
          'arturos_pos_kitchen_custom/static/src/overrides/components/preparation_display/keyboard_navigation.js',
          'arturos_pos_kitchen_custom/static/src/overrides/components/preparation_display/preparation_display.xml',
          'arturos_pos_kitchen_custom/static/src/overrides/components/preparation_display/preparation_display.css',
          'arturos_pos_kitchen_custom/static/src/overrides/components/order/order.js',
          'arturos_pos_kitchen_custom/static/src/overrides/components/order/order.xml',
          'arturos_pos_kitchen_custom/static/src/overrides/components/order/order.css',
          'arturos_pos_kitchen_custom/static/src/overrides/components/orderline/orderline.xml',
          'arturos_pos_kitchen_custom/static/src/overrides/components/orderline/orderline.css',
          'arturos_pos_kitchen_custom/static/src/overrides/components/about_dialog/about_dialog.js',
          'arturos_pos_kitchen_custom/static/src/overrides/components/about_dialog/about_dialog.xml',
          'arturos_pos_kitchen_custom/static/src/overrides/components/about_dialog/about_dialog.css',
          'arturos_pos_kitchen_custom/static/src/overrides/components/about_dialog/about_dialog_patch.js',
      ],
  },

  # Technical
  'installable': True,
  'application': False,
  'auto_install': False,
}
