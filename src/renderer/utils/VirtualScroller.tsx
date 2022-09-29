import {
  ComponentType,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import {
  FixedSizeList,
  ListChildComponentProps,
  ListItemKeySelector,
} from 'react-window';
import styles from './VirtualScroller.module.css';
import { Notifier } from './utils';

const INITIAL_HEIGHT = 500;

export interface VirtualScrollerContext<TItemData, TSharedData> {
  itemDataList: TItemData[];
  sharedData: TSharedData;
}

export const VirtualScroller = <TItemData, TSharedData>({
  initialHeight = INITIAL_HEIGHT,
  itemHeight,
  itemDataList,
  sharedData,
  itemKeyFn,
  children,
  focusIndex,
  updateHeightNotifier,
}: {
  initialHeight?: number;
  itemHeight: number;
  itemDataList: TItemData[];
  sharedData: TSharedData;
  itemKeyFn?: ListItemKeySelector<
    VirtualScrollerContext<TItemData, TSharedData>
  >;
  children: ComponentType<
    ListChildComponentProps<VirtualScrollerContext<TItemData, TSharedData>>
  >;
  focusIndex?: number;
  updateHeightNotifier?: Notifier;
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [height, setHeight] = useState(initialHeight);

  const updateHeight = useCallback(() => {
    if (containerRef.current) {
      setHeight(containerRef.current.clientHeight);
    }
  }, []);

  useLayoutEffect(updateHeight, [updateHeightNotifier, updateHeight]);

  useEffect(() => {
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, [updateHeight]);

  const scrollerRef = useRef<FixedSizeList | null>(null);

  useEffect(() => {
    if (focusIndex !== undefined) {
      scrollerRef.current?.scrollToItem(focusIndex);
    }
  }, [focusIndex]);

  return (
    <div className={styles.container} ref={containerRef}>
      <FixedSizeList
        ref={scrollerRef}
        height={height}
        itemCount={itemDataList.length}
        itemSize={itemHeight}
        width="100%"
        itemData={{ itemDataList, sharedData }}
        itemKey={itemKeyFn}
      >
        {children}
      </FixedSizeList>
    </div>
  );
};
