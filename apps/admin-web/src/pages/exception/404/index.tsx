import { Button, Card, Result } from 'antd';
import { useIntl } from '@umijs/max';
import React from 'react';
import { getUserWebOrigin } from '@personal-hub/app-origins';

const Exception404: React.FC = () => {
  const intl = useIntl();
  return (
    <Card variant="borderless">
      <Result
        status="404"
        title="404"
        subTitle={intl.formatMessage({ id: 'pages.404.subTitle' })}
        extra={
          <Button type="primary" href={`${getUserWebOrigin()}`}>
            {intl.formatMessage({ id: 'pages.404.buttonText' })}
          </Button>
        }
      />
    </Card>
  );
};

export default Exception404;
