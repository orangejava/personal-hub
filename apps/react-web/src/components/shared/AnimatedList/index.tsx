import React from 'react';

interface AnimatedListProps<T> {
  items: T[];
  getKey: (item: T, index: number) => React.Key;
  renderItem: (item: T, index: number) => React.ReactNode;
  className?: string;
  /**
   * 是否为每个列表项额外包裹一层动画容器。
   *
   * Ant Design Row 要求直接子元素是 Col，所以栅格场景需要关闭包裹，
   * 将动画 class 注入到 renderItem 返回的 Col 上，避免破坏宽度计算。
   */
  wrapItem?: boolean;
}

/**
 * 列表项统一轻量进入动画。
 *
 * 只用于数量较少的卡片/列表首屏展示；大表格仍交给 ProTable，避免大量节点动画影响性能。
 */
function AnimatedList<T>({
  items,
  getKey,
  renderItem,
  className,
  wrapItem = true,
}: AnimatedListProps<T>) {
  const getDelayStyle = (index: number) => ({
    animationDelay: `calc(${index} * var(--ph-motion-stagger))`,
  });

  const children = items.map((item, index) => {
    const key = getKey(item, index);
    const child = renderItem(item, index);

    if (!wrapItem && React.isValidElement(child)) {
      const childProps = child.props as {
        className?: string;
        style?: React.CSSProperties;
      };

      return React.cloneElement(
        child as React.ReactElement<{
          className?: string;
          style?: React.CSSProperties;
        }>,
        {
          key,
          className: [childProps.className, 'ph-animated-list-item']
            .filter(Boolean)
            .join(' '),
          style: {
            ...childProps.style,
            ...getDelayStyle(index),
          },
        },
      );
    }

    return (
      <div
        key={key}
        className="ph-animated-list-item"
        style={getDelayStyle(index)}
      >
        {child}
      </div>
    );
  });

  if (!wrapItem && !className) {
    return <>{children}</>;
  }

  return (
    <div className={['ph-animated-list', className].filter(Boolean).join(' ')}>
      {children}
    </div>
  );
}

export default AnimatedList;
