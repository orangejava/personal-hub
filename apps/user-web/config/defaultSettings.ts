import type { ProLayoutProps } from '@ant-design/pro-components';

const Settings: ProLayoutProps & {
  logo?: string;
} = {
  navTheme: 'realDark',
  colorPrimary: '#722ed1',
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
