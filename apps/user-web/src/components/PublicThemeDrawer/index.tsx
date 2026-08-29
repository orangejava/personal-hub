import { CheckOutlined } from '@ant-design/icons';
import { ColorPicker, Drawer, Space, Tooltip, Typography } from 'antd';
import React from 'react';
import {
  NAV_THEME_PRESETS,
  THEME_COLOR_PRESETS,
  type NavThemePreset,
} from '@/config/themePresets';
import type { PublicThemeSettings } from '@/types/app';

interface PublicThemeDrawerProps {
  open: boolean;
  settings: PublicThemeSettings;
  onClose: () => void;
  onChange: (settings: PublicThemeSettings) => void;
}

/** 公开前台主题抽屉：风格块 + 预设色 + 自定义色盘（与工作区 SettingDrawer 对齐） */
const PublicThemeDrawer: React.FC<PublicThemeDrawerProps> = ({
  open,
  settings,
  onClose,
  onChange,
}) => (
  <Drawer
    title="主题设置"
    open={open}
    onClose={onClose}
    size={320}
    destroyOnHidden={false}
    className="ph-public-theme-drawer"
  >
    <Space orientation="vertical" size="large" style={{ width: '100%' }}>
      <div>
        <Typography.Text strong>整体风格</Typography.Text>
        <div className="ph-theme-style-list" style={{ marginTop: 12 }}>
          {NAV_THEME_PRESETS.map((item) => (
            <Tooltip key={item.key} title={item.title}>
              <button
                type="button"
                aria-label={item.title}
                className={`ph-theme-style-item ph-theme-style-${item.key === 'realDark' ? 'dark' : 'light'}${settings.navTheme === item.key ? ' active' : ''}`}
                onClick={() =>
                  onChange({ ...settings, navTheme: item.key as NavThemePreset })
                }
              />
            </Tooltip>
          ))}
        </div>
      </div>

      <div>
        <Typography.Text strong>主题色</Typography.Text>
        <div className="ph-theme-color-list">
          {THEME_COLOR_PRESETS.map((item) => (
            <Tooltip key={item.key} title={item.title}>
              <button
                type="button"
                aria-label={item.title}
                className={`ph-theme-color-block${settings.colorPrimary.toLowerCase() === item.color.toLowerCase() ? ' active' : ''}`}
                style={{ backgroundColor: item.color, color: '#fff' }}
                onClick={() => onChange({ ...settings, colorPrimary: item.color })}
              >
                {settings.colorPrimary.toLowerCase() === item.color.toLowerCase() ? (
                  <CheckOutlined />
                ) : null}
              </button>
            </Tooltip>
          ))}
        </div>
        <div style={{ marginTop: 16 }}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            自定义颜色
          </Typography.Text>
          <div style={{ marginTop: 8 }}>
            <ColorPicker
              value={settings.colorPrimary}
              showText
              onChange={(color) =>
                onChange({ ...settings, colorPrimary: color.toHexString() })
              }
            />
          </div>
        </div>
      </div>
    </Space>
  </Drawer>
);

export default PublicThemeDrawer;
