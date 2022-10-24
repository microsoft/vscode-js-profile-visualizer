/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as GoToFileIcon from '@vscode/codicons/src/icons/go-to-file.svg';
import { Fragment, FunctionComponent, h } from 'preact';
import { useCallback, useContext, useEffect, useMemo, useState } from 'preact/hooks';
import { Icon } from 'vscode-js-profile-core/out/esm/client/icons';
import { IVscodeApi, VsCodeApi } from 'vscode-js-profile-core/out/esm/client/vscodeApi';
import { getNodeText } from 'vscode-js-profile-core/out/esm/common/display';
import { IOpenDocumentMessage } from 'vscode-js-profile-core/out/esm/common/types';
import { Constants } from '../common/constants';
import getBoxInRowColumn from '../common/get-boxIn-row-column';
import styles from './common.css';
import { IBox, IColumn } from './types';

const StackList: FunctionComponent<{
  box: IBox;
  columns: ReadonlyArray<IColumn>;
  boxes: ReadonlyMap<number, IBox>;
  setFocused(box: IBox): void;
}> = ({ columns, boxes, box, setFocused }) => {
  const [limitedStack, setLimitedStack] = useState(true);

  useEffect(() => setLimitedStack(true), [box]);

  const stack = useMemo(() => {
    const stack: IBox[] = [box];
    for (let row = box.row - 1; row >= 0 && stack.length; row--) {
      const b = getBoxInRowColumn(columns, boxes, box.column, row);
      if (b) {
        stack.push(b);
      }
    }

    return stack;
  }, [box, columns, boxes]);

  const shouldTruncateStack = stack.length >= Constants.DefaultStackLimit + 3 && limitedStack;

  return (
    <ol start={0}>
      {stack.map(
        (b, i) =>
          (!shouldTruncateStack || i < Constants.DefaultStackLimit) && (
            <li key={i}>
              <BoxLink box={b} onClick={setFocused} link={i > 0} />
            </li>
          ),
      )}
      {shouldTruncateStack && (
        <li>
          <a onClick={() => setLimitedStack(false)}>
            <em>{stack.length - Constants.DefaultStackLimit} more...</em>
          </a>
        </li>
      )}
    </ol>
  );
};

const BoxLink: FunctionComponent<{ box: IBox; onClick(box: IBox): void; link?: boolean }> = ({
  box,
  onClick,
  link,
}) => {
  const vscode = useContext(VsCodeApi) as IVscodeApi;
  const open = useCallback(
    (evt: { altKey: boolean }) => {
      const src = box.loc.src;
      if (!src?.source.path) {
        return;
      }

      vscode.postMessage<IOpenDocumentMessage>({
        type: 'openDocument',
        location: src,
        callFrame: box.loc.callFrame,
        toSide: evt.altKey,
      });
    },
    [vscode, box],
  );

  const click = useCallback(() => onClick(box), [box, onClick]);
  const locText = getNodeText(box.loc);
  const lineCol = locText?.match(/:(\d+(:\d+)?)$/)?.[1];
  const locFile = locText?.substring(0, locText.length - (lineCol ? lineCol.length + 1 : 0));
  const linkContent = (
    <Fragment>
      <span className={styles.function}>{box.loc.callFrame.functionName}</span> <em title={locFile}>{locFile} <span className={styles.lineNumber}>{lineCol}</span></em>
    </Fragment>
  );

  return (
    <Fragment>
      {link ? <a onClick={click}>{linkContent}</a> : linkContent}
      {box.loc.src?.source.path && (
        <Icon
          i={GoToFileIcon}
          className={styles.goToFile}
          onClick={open}
          role="button"
          title="Go to File"
        />
      )}
    </Fragment>
  );
};

export default StackList;
