/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import cytoscape from 'cytoscape';
import { Fragment, FunctionComponent, h, render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { Filter } from 'vscode-js-profile-core/out/esm/client/filter';
import { FilterBar } from 'vscode-js-profile-core/out/esm/client/filterBar';
import { PageLoader } from 'vscode-js-profile-core/out/esm/client/pageLoader';
import { vscodeApi } from 'vscode-js-profile-core/out/esm/client/vscodeApi';
import { EdgeType, IRetainingNode } from 'vscode-js-profile-core/out/esm/heapsnapshot/rpc';
import { doGraphRpc } from 'vscode-js-profile-core/out/esm/heapsnapshot/useGraph';
import { parseColors } from 'vscode-webview-tools';
import styles from './client.css';

/* eslint-disable @typescript-eslint/no-explicit-any */

// eslint-disable-next-line @typescript-eslint/no-var-requires
cytoscape.use(require('cytoscape-klay'));

declare const DOCUMENT_URI: string;
const snapshotUri = new URL(DOCUMENT_URI.replace(/\%3D/g, '='));
const index = snapshotUri.searchParams.get('index');

const DEFAULT_RETAINER_DISTANCE = 4;

const Root: FunctionComponent = () => {
  const [maxDistance, setMaxDistance] = useState<number>();

  return (
    <Fragment>
      <div className={styles.toolbar}>
        <FilterBar>
          <Filter
            onChange={v => setMaxDistance(Number(v))}
            type="number"
            min={1}
            value={maxDistance ? String(maxDistance) : ''}
            placeholder={`Maximum retainer distance (default: ${DEFAULT_RETAINER_DISTANCE})`}
          ></Filter>
        </FilterBar>
      </div>
      <Graph maxDistance={maxDistance || DEFAULT_RETAINER_DISTANCE} />
    </Fragment>
  );
};

const Graph: FunctionComponent<{ maxDistance: number }> = ({ maxDistance }) => {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [nodes, setNodes] = useState<IRetainingNode[]>();

  useEffect(() => {
    doGraphRpc(vscodeApi, 'getRetainers', [Number(index), maxDistance]).then(r =>
      setNodes(r as IRetainingNode[]),
    );
  }, [maxDistance]);

  useEffect(() => {
    if (!container || !nodes) {
      setLoading(true);
      return;
    }

    const colors = parseColors();
    const cy = cytoscape({
      container,
      autounselectify: true,
      elements: nodes.flatMap(node => {
        const r: cytoscape.ElementDefinition[] = [
          {
            data: { id: String(node.index), name: node.name || '<unknown>' },
          },
        ];
        if (node.index !== node.retainsIndex) {
          r.push({
            data: {
              id: `${node.index}-${node.retainsIndex}`,
              type: getLabelForEdge(node.edgeType),
              source: String(node.index),
              target: String(node.retainsIndex),
            },
          });
        }

        return r;
      }),

      style: [
        // the stylesheet for the graph
        {
          selector: 'node',
          style: {
            'background-color': colors['editorWidget-background'],
            'border-color': colors['editorWidget-border'],
            'border-width': 1,
            color: colors['editor-foreground'],
            label: 'data(name)',
            'font-size': 11,
          },
        },

        {
          selector: 'edge',
          style: {
            width: 2,
            'line-color': colors['editorWidget-border'],
            'target-arrow-color': colors['editorWidget-border'],
            'target-arrow-shape': 'triangle',
            'curve-style': 'straight',
            'font-size': 11,
            color: colors['editor-foreground'],
          },
        },

        {
          selector: 'node.highlighted',
          style: {
            'background-color': colors['charts-blue'],
            'border-color': colors['editorWidget-border'],
          },
        },
        {
          selector: 'edge.highlighted',
          style: {
            'line-color': colors['charts-blue'],
            'target-arrow-color': colors['charts-blue'],
            label: 'data(type)',
          },
        },
      ],

      layout: {
        name: 'klay',
        animate: false,
        nodeDimensionsIncludeLabels: true,
        klay: {
          // preferred since this opens to the side by default
          direction: 'DOWN',
          // makes the graph more deterministic, without it the retained node
          // can end up in the middle vs. in nice layers
          nodeLayering: 'LONGEST_PATH',
          // determinism
          randomizationSeed: 42,
          // not sure this does anything with a prescribed direction and
          // layering, it's here for the vibes
          aspectRatio: window.innerWidth / window.innerHeight,
        },
      } as any,
    });

    const root = cy.$(`#${index}`);
    root.style('background-color', colors['charts-blue']);

    attachPathHoverHandle(root, cy);

    cy.viewport({
      zoom: 1,
      pan: {
        // center the node horizontally, and most of the way towards the bottom,
        // since we dictated the layout is "down"
        x: -root.position().x + window.innerWidth / 2,
        y: -root.position().y + window.innerHeight / 1.2,
      },
    });

    setLoading(false);

    return () => cy.destroy();
  }, [container, nodes]);

  return (
    <Fragment>
      {loading && (
        <Fragment>
          <PageLoader />
          {nodes ? 'Building graph layout...' : 'Parsing snapshot...'}
        </Fragment>
      )}
      <div className={styles.graph} ref={setContainer} />
    </Fragment>
  );
};

const container = document.createElement('div');
container.classList.add(styles.wrapper);
document.body.appendChild(container);
render(<Root />, container);

function attachPathHoverHandle(root: cytoscape.CollectionReturnValue, graph: cytoscape.Core) {
  let lastPath: cytoscape.CollectionReturnValue | null = null;
  graph.on('mouseover', 'node', ev => {
    lastPath = graph.elements().dijkstra({ root: ev.target, directed: true }).pathTo(root);
    lastPath.addClass('highlighted');
  });

  graph.on('mouseout', 'node', () => {
    if (lastPath) {
      lastPath.removeClass('highlighted');
    }
  });
}

function getLabelForEdge(edge: EdgeType) {
  switch (edge) {
    case EdgeType.Context:
      return 'Context';
    case EdgeType.Hidden:
      return 'Hidden';
    case EdgeType.Internal:
      return 'Internal';
    case EdgeType.Element:
      return 'Element';
    case EdgeType.Property:
      return 'Property';
    case EdgeType.Invisible:
      return 'Invisible';
    case EdgeType.Shortcut:
      return 'Shortcut';
    case EdgeType.Weak:
      return 'Weak';
    case EdgeType.Other:
      return 'Other';
  }
}
