/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { FunctionComponent, h } from 'preact';
import { decimalFormat } from 'vscode-js-profile-core/out/esm/cpu/display';
import { ILocation, IProfileModel } from 'vscode-js-profile-core/out/esm/cpu/model';
import makeBaseFlame from '../common/base-flame';
import { BaseTooltip } from '../common/base-flame-tooltip';
import styles from '../common/flame-graph.css';
import StackList from '../common/stack-list';
import { IBaseInfoBoxProp, IColumn } from '../common/types';

const InfoBox: FunctionComponent<
  IBaseInfoBoxProp & {
    model: IProfileModel;
  }
> = ({ columns, boxes, box, model, setFocused }) => {
  const originalLocation = model.locations[box.loc.id];
  const localLocation = box.loc;

  return (
    <div className={styles.info}>
      <dl className={styles.times}>
        <dt>Self Time</dt>
        <dd>{decimalFormat.format((localLocation as ILocation).selfTime / 1000)}ms</dd>
        <dt>Total Time</dt>
        <dd>{decimalFormat.format((localLocation as ILocation).aggregateTime / 1000)}ms</dd>
        <dt>
          Self Time<small>Entire Profile</small>
        </dt>
        <dd>{decimalFormat.format(originalLocation.selfTime / 1000)}ms</dd>
        <dt>
          Total Time<small>Entire Profile</small>
        </dt>
        <dd>{decimalFormat.format(originalLocation.aggregateTime / 1000)}ms</dd>
      </dl>
      <StackList box={box} columns={columns} boxes={boxes} setFocused={setFocused}></StackList>
    </div>
  );
};

const BaseFlame = makeBaseFlame<ILocation>();

export const FlameGraph: FunctionComponent<{
  columns: ReadonlyArray<IColumn>;
  filtered: ReadonlyArray<number>;
  model: IProfileModel;
}> = ({ columns, model, filtered }) => (
  <BaseFlame
    columns={columns}
    range={model.duration}
    unit={'ms'}
    filtered={filtered}
    Tooltip={props => (
      <BaseTooltip {...props}>
        <dt className={styles.time}>Self Time</dt>
        <dd className={styles.time}>{decimalFormat.format(props.node.selfTime / 1000)}ms</dd>
        <dt className={styles.time}>Aggregate Time</dt>
        <dd className={styles.time}>{decimalFormat.format(props.node.aggregateTime / 1000)}ms</dd>
      </BaseTooltip>
    )}
    InfoBox={(props: IBaseInfoBoxProp) => <InfoBox {...props} model={model}></InfoBox>}
  ></BaseFlame>
);
