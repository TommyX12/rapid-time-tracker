import {
  CSSProperties,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import {
  Button,
  ButtonGroup,
  Dialog,
  Icon,
  Menu,
  MenuDivider,
  MenuItem,
  Position,
} from '@blueprintjs/core';
import { Action, DataState, ROOT_ACTION_ID } from '../data/data-state';
import { MainContext } from './Main';
import styles from './ActionTree.module.css';
import { ActionID } from '../data/data-model';
import {
  VirtualScroller,
  VirtualScrollerContext,
} from '../utils/VirtualScroller';
import { Popover2, Tooltip2 } from '@blueprintjs/popover2';
import { ActionDialog, EditActionProps } from './ActionDialog';
import { Counter, Notifier, prettyNumber } from '../utils/utils';
import classNames from 'classnames';
import Color from 'color';

const ITEM_HEIGHT = 25;
const INDENT_PER_LEVEL = 20;

const DEFAULT_EXPANSION_STATE = true;

const DURATION_HEAT_COLOR = Color('rgba(0,165,255,0.43)');

interface ActionTreeItemData {
  action: Action;
  expanded: boolean;
  level: number;
  durationCount?: number;
  hasChildren: boolean;
}

interface ActionTreeItemSharedData {
  setActionExpansionState: (actionID: ActionID, expanded: boolean) => void;
  toggleActionExpansionState: (actionID: ActionID) => void;
  addAction: (parentID: ActionID) => void;
  editAction: (actionID: ActionID) => void;
  deleteAction: (actionID: ActionID) => void;
  collapseAllInAction: (actionID: ActionID) => void;
  expandAllInAction: (actionID: ActionID) => void;
  totalDurationCount: number;
  unitMultiplier: number;
  isPercentage: boolean;
}

// TODO: This is done so that we can mutate the data map directly and not having to shallow copy.
interface ExpansionState {
  data: Map<ActionID, boolean>;
}

const ActionTreeItem = ({
  index,
  data,
  style,
}: {
  index: number;
  data: VirtualScrollerContext<ActionTreeItemData, ActionTreeItemSharedData>;
  style?: CSSProperties;
}) => {
  const { itemDataList, sharedData } = data;
  const { action, expanded, level, durationCount, hasChildren } =
    itemDataList[index];

  const onAddChildClick = useCallback(() => {
    sharedData.addAction(action.model.id);
  }, [action.model.id, sharedData]);

  const onEditClick = useCallback(() => {
    sharedData.editAction(action.model.id);
  }, [action.model.id, sharedData]);

  const onDeleteClick = useCallback(() => {
    sharedData.deleteAction(action.model.id);
  }, [action.model.id, sharedData]);

  const onCollapseAllClick = useCallback(() => {
    sharedData.collapseAllInAction(action.model.id);
  }, [action.model.id, sharedData]);

  const onExpandAllClick = useCallback(() => {
    sharedData.expandAllInAction(action.model.id);
  }, [action.model.id, sharedData]);

  return (
    <div style={style} className={styles.itemContainer}>
      <div className={styles.item}>
        <div
          className={styles.itemIcon}
          style={{ paddingLeft: `${level * INDENT_PER_LEVEL}px` }}
          onClick={() => sharedData.toggleActionExpansionState(action.model.id)}
        >
          <Icon
            icon={
              // eslint-disable-next-line no-nested-ternary
              hasChildren ? (expanded ? 'caret-down' : 'caret-right') : 'dot'
            }
            className={classNames({ [styles.leafExpandIcon]: !hasChildren })}
          />
        </div>
        <Popover2
          content={
            <Menu>
              <MenuItem
                icon="plus"
                text="Add Child"
                onClick={onAddChildClick}
              />
              <MenuItem
                icon="collapse-all"
                text="Collapse All"
                onClick={onCollapseAllClick}
              />
              <MenuItem
                icon="expand-all"
                text="Expand All"
                onClick={onExpandAllClick}
              />
              {action.isRoot ? undefined : (
                <>
                  <MenuDivider></MenuDivider>
                  <MenuItem icon="edit" text="Edit" onClick={onEditClick} />
                  <MenuItem
                    icon="cross"
                    text="Delete"
                    intent="danger"
                    onClick={onDeleteClick}
                  />
                </>
              )}
            </Menu>
          }
          position={Position.LEFT}
          className="simple-flex"
        >
          <div className="row">
            {durationCount !== undefined && durationCount > 0 && (
              <div
                className={classNames(styles.durationChip, {
                  [styles.leafDurationChip]: action.isLeaf,
                })}
                style={{
                  backgroundColor: DURATION_HEAT_COLOR.fade(
                    1.0 - durationCount / sharedData.totalDurationCount
                  ).toString(),
                }}
              >
                {prettyNumber(
                  durationCount * sharedData.unitMultiplier,
                  sharedData.isPercentage
                )}
              </div>
            )}
            <div
              className={classNames(styles.itemText, 'row')}
              style={{
                backgroundColor: action.model.color.alpha(0.2).toString(),
                borderLeftColor: action.model.color.alpha(0.5).toString(),
              }}
            >
              {action.model.name}
            </div>
            <div className="hfill"></div>
          </div>
        </Popover2>
      </div>
    </div>
  );
};

function getExpansionState(map: Map<ActionID, boolean>, id: ActionID) {
  const result = map.get(id);
  if (result === undefined) return DEFAULT_EXPANSION_STATE;
  return result;
}

function getItemDataList(
  state: DataState,
  expansionState: ExpansionState,
  durationCounter?: Counter<ActionID>,
  showZeroDurationCount?: boolean
) {
  const result: ActionTreeItemData[] = [];

  const dfs = (action: Action, level: number) => {
    const expanded = getExpansionState(expansionState.data, action.model.id);
    if (
      showZeroDurationCount ||
      action.isRoot ||
      !durationCounter ||
      durationCounter.get(action.model.id) > 0
    ) {
      result.push({
        action,
        expanded,
        level,
        durationCount: durationCounter?.get(action.model.id),
        hasChildren: !action.isLeaf,
      });
    }

    if (expanded) {
      action.childIDs.forEach((childID) => {
        const child = state.actions.get(childID);
        if (child !== undefined) {
          dfs(child, level + 1);
        }
      });
    }
  };

  const rootAction = state.actions.get(ROOT_ACTION_ID);
  if (rootAction === undefined) {
    throw new Error('Root action undefined');
  }
  dfs(rootAction, 0);

  return result;
}

export function ActionTree({
  durationCounter,
  showZeroDurationCount,
  unitMultiplier = 1,
  isPercentage = false,
  updateHeightNotifier,
}: {
  durationCounter?: Counter<ActionID>;
  showZeroDurationCount?: boolean;
  unitMultiplier?: number;
  isPercentage?: boolean;
  updateHeightNotifier?: Notifier;
}) {
  const { state, updateState } = useContext(MainContext);

  const [expansionState, setExpansionState] = useState<ExpansionState>({
    data: new Map<ActionID, boolean>(),
  });

  const [actionEditProps, setActionEditProps] = useState<
    EditActionProps | undefined
  >(undefined);
  const [actionDialogParentID, setActionDialogParentID] = useState<
    ActionID | undefined
  >(undefined);

  const [actionDialogOpen, setActionDialogOpen] = useState(false);

  const setActionExpansionState = useCallback(
    (actionID: ActionID, expanded: boolean) => {
      expansionState.data.set(actionID, expanded);
      setExpansionState({ ...expansionState });
    },
    [expansionState]
  );

  const toggleActionExpansionState = useCallback(
    (actionID: ActionID) => {
      expansionState.data.set(
        actionID,
        !getExpansionState(expansionState.data, actionID)
      );
      setExpansionState({ ...expansionState });
    },
    [expansionState]
  );

  const itemDataList = useMemo(() => {
    return getItemDataList(
      state,
      expansionState,
      durationCounter,
      showZeroDurationCount
    );
  }, [durationCounter, expansionState, showZeroDurationCount, state]);

  const showUpToLevel = useCallback(
    (upToLevel: number) => {
      state.dfs(ROOT_ACTION_ID, {
        preOrder: (action, level) => {
          expansionState.data.set(action.model.id, level < upToLevel);
        },
      });
      setExpansionState({ ...expansionState });
    },
    [expansionState, state]
  );

  const showAll = useCallback(() => {
    state.dfs(ROOT_ACTION_ID, {
      preOrder: (action) => {
        expansionState.data.set(action.model.id, true);
      },
    });
    setExpansionState({ ...expansionState });
  }, [expansionState, state]);

  const showUpToLevel1 = useCallback(() => {
    showUpToLevel(1);
  }, [showUpToLevel]);

  const showUpToLevel2 = useCallback(() => {
    showUpToLevel(2);
  }, [showUpToLevel]);

  const showUpToLevel3 = useCallback(() => {
    showUpToLevel(3);
  }, [showUpToLevel]);

  const addAction = useCallback((parentID: ActionID) => {
    setActionDialogOpen(true);
    setActionEditProps(undefined);
    setActionDialogParentID(parentID);
  }, []);

  const editAction = useCallback((actionID: ActionID) => {
    setActionDialogOpen(true);
    setActionEditProps({ actionID });
    setActionDialogParentID(undefined);
  }, []);

  const deleteAction = useCallback(
    (actionID: ActionID) => {
      updateState(state.removeAction(actionID));
    },
    [state, updateState]
  );

  const collapseAllInAction = useCallback(
    (actionID: ActionID) => {
      state.dfs(actionID, {
        preOrder: (action) => {
          expansionState.data.set(action.model.id, false);
        },
      });
      setExpansionState({ ...expansionState });
    },
    [expansionState, state]
  );

  const expandAllInAction = useCallback(
    (actionID: ActionID) => {
      state.dfs(actionID, {
        preOrder: (action) => {
          expansionState.data.set(action.model.id, true);
        },
      });
      setExpansionState({ ...expansionState });
    },
    [expansionState, state]
  );

  const totalDurationCount = useMemo(() => {
    if (durationCounter === undefined) return 0;
    return durationCounter.get(ROOT_ACTION_ID);
  }, [durationCounter]);

  const sharedData: ActionTreeItemSharedData = useMemo(() => {
    return {
      setActionExpansionState,
      toggleActionExpansionState,
      addAction,
      editAction,
      deleteAction,
      collapseAllInAction,
      expandAllInAction,
      totalDurationCount,
      unitMultiplier,
      isPercentage,
    };
  }, [
    addAction,
    collapseAllInAction,
    deleteAction,
    editAction,
    expandAllInAction,
    setActionExpansionState,
    toggleActionExpansionState,
    totalDurationCount,
    unitMultiplier,
    isPercentage,
  ]);

  const itemKeyFn = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-shadow
    (
      index: number,
      data: VirtualScrollerContext<ActionTreeItemData, ActionTreeItemSharedData>
    ) => data.itemDataList[index].action.model.id,
    []
  );

  const onActionDialogClose = useCallback(() => {
    setActionDialogOpen(false);
  }, []);

  return (
    <div className={classNames('column', styles.container)}>
      <div className={classNames('row', 'fill-width', styles.toolbar)}>
        <ButtonGroup minimal>
          <Tooltip2 content="Show up to level 1" position="top">
            <Button icon="header-one" onClick={showUpToLevel1}></Button>
          </Tooltip2>
          <Tooltip2 content="Show up to level 2" position="top">
            <Button icon="header-two" onClick={showUpToLevel2}></Button>
          </Tooltip2>
          <Tooltip2 content="Show up to level 3" position="top">
            <Button icon="header-three" onClick={showUpToLevel3}></Button>
          </Tooltip2>
          <Tooltip2 content="Show all" position="top">
            <Button icon="expand-all" onClick={showAll}></Button>
          </Tooltip2>
        </ButtonGroup>
      </div>
      <div className="simple-flex fill-width">
        <VirtualScroller
          itemHeight={ITEM_HEIGHT}
          itemDataList={itemDataList}
          sharedData={sharedData}
          itemKeyFn={itemKeyFn}
          updateHeightNotifier={updateHeightNotifier}
        >
          {ActionTreeItem}
        </VirtualScroller>
      </div>
      <Dialog
        isOpen={actionDialogOpen}
        onClose={onActionDialogClose}
        title={actionEditProps === undefined ? 'Add action' : 'Edit action'}
        style={{ width: '600px' }}
      >
        <ActionDialog
          isOpen={actionDialogOpen}
          onDone={onActionDialogClose}
          editProps={actionEditProps}
          parentID={actionDialogParentID}
        ></ActionDialog>
      </Dialog>
    </div>
  );
}
