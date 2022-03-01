/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { FunctionComponent, h } from 'preact';
import { decimalFormat } from 'vscode-js-profile-core/out/esm/heap/display';
import { IHeapProfileNode, IProfileModel } from 'vscode-js-profile-core/out/esm/heap/model';
import { createTree } from 'vscode-js-profile-core/out/esm/heap/tree';
import makeBaseFlame from '../common/base-flame';
import { BaseTooltip } from '../common/base-flame-tooltip';
import styles from '../common/flame-graph.css';
import StackList from '../common/stack-list';
import { IBaseInfoBoxProp, IColumn } from '../common/types';

const InfoBox: FunctionComponent<IBaseInfoBoxProp> = ({ columns, boxes, box, setFocused }) => {
  const localLocation = box.loc;

  return (
    <div className={styles.info}>
      <dl>
        <dt>Self Size</dt>
        <dd>{decimalFormat.format((localLocation as IHeapProfileNode).selfSize / 1000)}kB</dd>
        <dt>Total Size</dt>
        <dd>{decimalFormat.format((localLocation as IHeapProfileNode).totalSize / 1000)}kB</dd>
      </dl>
      <StackList box={box} columns={columns} boxes={boxes} setFocused={setFocused}></StackList>
    </div>
  );
};

const BaseFlame = makeBaseFlame<IHeapProfileNode>();

export const FlameGraph: FunctionComponent<{
  columns: ReadonlyArray<IColumn>;
  filtered: ReadonlyArray<number>;
  model: IProfileModel;
}> = ({ columns, model, filtered }) => {
  const tree = createTree(model);

  return (
    <BaseFlame
      columns={columns}
      range={tree.totalSize}
      unit={'kB'}
      filtered={filtered}
      Tooltip={props => (
        <BaseTooltip {...props}>
          <dt className={styles.time}>Self Size</dt>
          <dd className={styles.time}>{decimalFormat.format(props.node.selfSize / 1000)}kB</dd>
          <dt className={styles.time}>Total Size</dt>
          <dd className={styles.time}>{decimalFormat.format(props.node.totalSize / 1000)}kB</dd>
        </BaseTooltip>
      )}
      InfoBox={InfoBox}
    />
  );
};
