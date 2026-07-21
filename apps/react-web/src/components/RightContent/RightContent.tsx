import React from 'react';
import { AvatarDropdown } from './AvatarDropdown';
import { LangDropdown } from './LangDropdown';
import { ThemeSettingButton } from './ThemeSettingButton';

/** ProLayout 右侧操作区（公开页 PublicLayout 仍可直接引用子组件） */
const RightContent: React.FC = () => (
  <>
    <LangDropdown />
    <ThemeSettingButton />
    <AvatarDropdown />
  </>
);

export default RightContent;
