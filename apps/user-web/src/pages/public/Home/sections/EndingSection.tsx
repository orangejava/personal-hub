import { history } from '@umijs/max';
import { Button } from 'antd';
import React from 'react';

/** 结尾不进后台模块配置，固定跟在最后一个可见区块后面。 */
const EndingSection: React.FC = () => {
  return (
    <div className="ph-home-section ph-home-ending">
      <p>知识、工具和这个平台，放在同一处。</p>
      <div className="ph-home-hero-actions">
        <Button
          type="primary"
          size="large"
          onClick={() => history.push('/content')}
        >
          浏览内容
        </Button>
        <Button size="large" onClick={() => history.push('/projects')}>
          查看作品
        </Button>
      </div>
    </div>
  );
};

export default EndingSection;
