import { Folder, type FolderProps } from '@ant-design/x';
import React from 'react';

/**
 * AI 文件夹封装。
 *
 * 阶段 5 后续资产分类、项目文件夹、知识引用树都从这里接入，
 * 当前只做透传，避免业务页面直接绑定 Ant Design X 的 Folder API。
 */
const AiXFolder: React.FC<FolderProps> = (props) => <Folder {...props} />;

export default AiXFolder;

