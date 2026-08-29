import type { ProLayoutProps } from '@ant-design/pro-components';

const Settings: ProLayoutProps & {
  logo?: string;
} = {
  navTheme: 'light',
  colorPrimary: '#1677ff',
  layout: 'mix',
  contentWidth: 'Fluid',
  fixedHeader: false,
  fixSiderbar: true,
  colorWeak: false,
  title: 'Personal Hub',
  iconfontUrl: '',
  token: {},
};

export default Settings;
