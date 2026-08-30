import { CheckOutlined, GlobalOutlined } from '@ant-design/icons';
import { getLocale, setLocale } from '@umijs/max';
import type { MenuProps } from 'antd';
import { Button } from 'antd';
import { useLayoutEffect } from 'react';
import { ACTIVE_LOCALES, ensureActiveLocale } from '@/utils/locale';
import HeaderDropdown from '../HeaderDropdown';
import useHeaderActionStyles from './style';

const localeLabelMap: Record<(typeof ACTIVE_LOCALES)[number], { emoji: string; label: string }> = {
  'zh-CN': { emoji: '🇨🇳', label: '简体中文' },
  'en-US': { emoji: '🇺🇸', label: 'English' },
};

const onLangClick: MenuProps['onClick'] = ({ key }) => {
  if (key.startsWith('lang-')) {
    setLocale(key.replace('lang-', ''), false);
  }
};

export const LangDropdown: React.FC = () => {
  const { styles } = useHeaderActionStyles();
  useLayoutEffect(() => {
    ensureActiveLocale();
  }, []);
  const currentLocale = getLocale();

  const langItems: MenuProps['items'] = ACTIVE_LOCALES.map((locale) => ({
    key: `lang-${locale}`,
    icon:
      locale === currentLocale ? (
        <CheckOutlined style={{ color: '#52c41a' }} />
      ) : (
        <span style={{ display: 'inline-block', width: 14 }} />
      ),
    label: `${localeLabelMap[locale].emoji} ${localeLabelMap[locale].label}`,
  }));

  return (
    <HeaderDropdown
      placement="bottomRight"
      arrow
      menu={{
        selectedKeys: [`lang-${currentLocale}`],
        onClick: onLangClick,
        items: langItems,
        style: { minWidth: 180 },
      }}
    >
      <Button type="text" className={styles.action} aria-label="语言切换">
        <GlobalOutlined />
      </Button>
    </HeaderDropdown>
  );
};
