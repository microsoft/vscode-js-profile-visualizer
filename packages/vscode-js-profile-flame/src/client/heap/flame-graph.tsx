/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { Fragment, FunctionComponent, h } from 'preact';
import { MiddleOut } from 'vscode-js-profile-core/out/esm/client/middleOutCompression';
import { classes } from 'vscode-js-profile-core/out/esm/client/util';
import { decimalFormat, getNodeText } from 'vscode-js-profile-core/out/esm/heap/display';
import { IProfileModel, ITreeNode } from 'vscode-js-profile-core/out/esm/heap/model';
import { createTree } from 'vscode-js-profile-core/out/esm/heap/tree';
import { Constants } from '../common/constants';
import DragHandle from '../common/drag-handle';
import styles from '../common/flame-graph.css';
import StackList from '../common/stack-list';
import { HighlightSource, IBox, IColumn } from '../common/types';
import useFlame from '../common/use-flame';

const clamp = (min: number, v: number, max: number) => Math.max(Math.min(v, max), min);

export const FlameGraph: FunctionComponent<{
  columns: ReadonlyArray<IColumn>;
  filtered: ReadonlyArray<number>;
  model: IProfileModel;
}> = ({ columns, model, filtered }) => {
  const tree = createTree(model);

  const {
    glCanvas,
    bounds,
    canvasSize,
    webCanvas,
    hovered,
    showInfo,
    rawBoxes,

    onMouseMove,
    onWheel,
    onMouseDown,
    onMouseUp,
    onMouseLeave,
    onFocus,

    focused,
    setFocused,
    drag,
    setDrag,
  } = useFlame({
    columns,
    range: tree.totalSize,
    unit: 'kb',
    filtered,
  });

  return (
    <Fragment>
      <DragHandle
        bounds={bounds}
        current={drag}
        canvasWidth={canvasSize.width}
        startDrag={setDrag}
      />
      <canvas
        ref={webCanvas}
        style={{ cursor: hovered ? 'pointer' : 'default' }}
        role="application"
        tabIndex={0}
        onFocus={onFocus}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
        onMouseMove={onMouseMove}
        onWheel={onWheel}
      />
      <canvas
        ref={glCanvas}
        style={{
          position: 'absolute',
          top: Constants.TimelineHeight,
          left: 0,
          right: 0,
          bottom: 0,
          pointerEvents: 'none',
          zIndex: -1,
        }}
      />
      {hovered && (
        <Tooltip
          canvasWidth={canvasSize.width}
          canvasHeight={canvasSize.height}
          left={(hovered.box.x1 - bounds.minX) / (bounds.maxX - bounds.minX)}
          upperY={canvasSize.height - hovered.box.y1 + bounds.y}
          lowerY={hovered.box.y2 - bounds.y}
          src={hovered.src}
          location={hovered.box.loc}
        />
      )}
      {focused && showInfo && (
        <InfoBox columns={columns} boxes={rawBoxes.boxById} box={focused} setFocused={setFocused} />
      )}
    </Fragment>
  );
};

const Tooltip: FunctionComponent<{
  canvasWidth: number;
  canvasHeight: number;
  left: number;
  upperY: number;
  lowerY: number;
  location: ITreeNode;
  src: HighlightSource;
}> = ({ left, lowerY, upperY, src, location, canvasWidth, canvasHeight }) => {
  const label = getNodeText(location);
  const above = lowerY + 300 > canvasHeight && lowerY > canvasHeight / 2;

  const file = label?.split(/\\|\//g).pop();
  return (
    <div
      className={styles.tooltip}
      aria-live="polite"
      aria-atomic={true}
      style={{
        left: clamp(0, canvasWidth * left + 10, canvasWidth - 400),
        top: above ? 'initial' : lowerY + 10,
        bottom: above ? upperY + 10 : 'initial',
      }}
    >
      <dl>
        <dt>Function</dt>
        <dd className={styles.function}>{location.callFrame.functionName}</dd>
        {label && (
          <Fragment>
            <dt>File</dt>
            <dd
              aria-label={file}
              className={classes(styles.label, location.callFrame && styles.clickable)}
            >
              <MiddleOut aria-hidden={true} endChars={file?.length} text={label} />
            </dd>
          </Fragment>
        )}
        <dt className={styles.time}>Self Size</dt>
        <dd className={styles.time}>{decimalFormat.format(location.selfSize / 1000)}ms</dd>
        <dt className={styles.time}>Total Size</dt>
        <dd className={styles.time}>{decimalFormat.format(location.totalSize / 1000)}ms</dd>
      </dl>
      <div className={styles.hint}>
        Ctrl+{src === HighlightSource.Keyboard ? 'Enter' : 'Click'} to jump to file
      </div>
    </div>
  );
};

const InfoBox: FunctionComponent<{
  box: IBox;
  columns: ReadonlyArray<IColumn>;
  boxes: ReadonlyMap<number, IBox>;
  setFocused(box: IBox): void;
}> = ({ columns, boxes, box, setFocused }) => {
  const localLocation = box.loc;

  return (
    <div className={styles.info}>
      <dl>
        <dt>Self Size</dt>
        <dd>{decimalFormat.format(localLocation.selfSize / 1000)}kb</dd>
        <dt>Total Size</dt>
        <dd>{decimalFormat.format(localLocation.totalSize / 1000)}kb</dd>
      </dl>
      <StackList box={box} columns={columns} boxes={boxes} setFocused={setFocused}></StackList>
    </div>
  );
};
