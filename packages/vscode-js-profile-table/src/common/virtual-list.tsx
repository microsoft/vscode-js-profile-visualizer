/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { ComponentChild, FunctionComponent, RefObject, h } from 'preact';
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { useResizeObserver } from 'vscode-js-profile-core/out/esm/client/useResizeObserver';

export interface IVirtualListProps<T> {
  containerRef?: RefObject<HTMLDivElement>;
  data: ReadonlyArray<T>;
  className?: string;
  renderRow: (row: T) => ComponentChild;
  rowHeight: number;
  overscanCount: number;
}

const Row: FunctionComponent<{
  style: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  row: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  renderRow: (row: any) => ComponentChild;
}> = ({ row, renderRow, style }) => <div style={style}>{useMemo(() => renderRow(row), [row])}</div>;

function makeRange(from: number, to: number): number[] {
  const o = [];
  for (let i = from; i < to; i++) {
    o.push(i);
  }
  return o;
}

const styleRow = (i: number, rowHeight: number) =>
  `position:absolute;left:0;right:0;height:${rowHeight}px;top:${i * rowHeight}px`;

export const makeVirtualList =
  <T,>(): FunctionComponent<IVirtualListProps<T>> =>
  ({ containerRef = useRef(null), data, className, renderRow, rowHeight, overscanCount }) => {
    const [range, setRange] = useState<number[]>([]);
    const totalHeight = data.length * rowHeight;

    const reconcile = useCallback(() => {
      const { current: container } = containerRef;
      if (!container) {
        return;
      }

      const scrollTop = container.scrollTop;
      const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - overscanCount);
      const endIndex = Math.min(
        data.length - 1,
        startIndex + Math.ceil(container.clientHeight / rowHeight) + 2 * overscanCount,
      );

      setRange(makeRange(startIndex, endIndex + 1));
    }, [data, rowHeight, overscanCount]);

    useResizeObserver(reconcile, containerRef.current);
    useLayoutEffect(() => reconcile(), [reconcile]);

    return (
      <div
        ref={containerRef}
        className={className}
        style={{ height: '100%', overflow: 'auto' }}
        onScroll={reconcile}
      >
        <div style={{ height: totalHeight, position: 'relative' }}>
          {range.map(i => (
            <Row renderRow={renderRow} row={data[i]} style={styleRow(i, rowHeight)} key={i} />
          ))}
        </div>
      </div>
    );
  };
