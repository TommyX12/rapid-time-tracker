import produce, { Draft, immerable } from 'immer';
import {
  ActionID,
  ActionModel,
  DataModel,
  DEFAULT_SETTINGS,
  RecordModel,
  SettingsModel,
} from './data-model';
import Color from 'color';
import { clamp, firstGeq, firstLessThan, generateColor } from '../utils/utils';
import { Time } from '../utils/time';

export const ROOT_ACTION_ID: ActionID = 0;
export const MIN_ACTION_ID: ActionID = 1;
export const MIN_ACTION_ID_INCLUDING_ROOT: ActionID = 0;
export const OTHER_CHILD_NAME = 'other';

export const ILLEGAL_ACTION_NAME_CHARACTERS = /[:[,\]]/;

export interface RecordReferenceSignature {}

function newRecordReferenceSignature(): RecordReferenceSignature {
  return {};
}

export class Action {
  [immerable] = true;

  childIDs: ActionID[] = [];

  get isLeaf() {
    return this.childIDs.length === 0;
  }

  get isGroup() {
    return this.childIDs.length > 0;
  }

  get isRoot() {
    return this.model.id === ROOT_ACTION_ID;
  }

  constructor(public model: ActionModel) {}

  getCanonicalName(state: DataState, maxNumParts: number = -1) {
    if (this.isRoot) {
      return '';
    }

    const result: string[] = [this.model.name];
    let parentID = this.model.parentID;
    while (
      parentID !== undefined &&
      parentID !== ROOT_ACTION_ID &&
      (maxNumParts < 0 || result.length < maxNumParts)
    ) {
      const parent = state.actions.get(parentID);
      if (parent !== undefined) {
        result.push(parent.model.name);
        parentID = parent.model.parentID;
      } else {
        break;
      }
    }
    result.reverse();
    return result.join(': ');
  }
}

export class Record {
  [immerable] = true;

  constructor(public model: RecordModel) {}
}

export interface RecordWithIndex {
  index: number;
  record: Record;
}

export class DataState {
  [immerable] = true;

  readonly nextActionID: number;

  // This is an abstract object such that, if two data state has the same
  // recordReferenceSignature (referential equality), then it is valid to modify
  // a record at a certain index (e.g. using updateRecord) on both.
  // This is used by components to know when to throw away an index.
  readonly recordReferenceSignature = newRecordReferenceSignature();

  private constructor(
    public actions = new Map<ActionID, Action>(),
    // Records are guaranteed to be sorted.
    public records: Record[] = [],
    public settings: SettingsModel = DEFAULT_SETTINGS,
    public filePath?: string
  ) {
    let nextID = 0;
    actions.forEach((action) => {
      nextID = Math.max(action.model.id, nextID);
    });
    nextID += 1;
    this.nextActionID = nextID;
  }

  get rootAction() {
    const result = this.actions.get(ROOT_ACTION_ID);
    if (result === undefined) {
      throw new Error('Root action undefined');
    }
    return result;
  }

  getRecordsInRange(startTime: Time, endTime: Time): RecordWithIndex[] {
    if (this.records.length === 0) {
      return [];
    }
    const startIndex = clamp(
      firstLessThan(
        this.records,
        startTime,
        (a, b) => a.lessThan(b),
        (record) => record.model.time
      ),
      0,
      this.records.length - 1
    );
    const endIndex = clamp(
      firstGeq(
        this.records,
        endTime,
        (a, b) => a.lessThan(b),
        (record) => record.model.time
      ) + 1,
      startIndex,
      this.records.length
    );
    const result = [] as RecordWithIndex[];
    for (let i = startIndex; i < endIndex; ++i) {
      result.push({ record: this.records[i], index: i });
    }
    return result;
  }

  private sortRecord() {
    const sortedRecords = this.records.slice();
    sortedRecords.sort((a, b) => {
      return a.model.time.seconds - b.model.time.seconds;
    });
    // Sort records
    return produce(this, (draft) => {
      draft.records = sortedRecords;
    });
  }

  addRecord(model: RecordModel) {
    return produce(this, (draft) => {
      draft.records.push(new Record(model));
      draft.recordReferenceSignature = newRecordReferenceSignature();
    }).sortRecord();
  }

  updateRecord(index: number, model: RecordModel) {
    if (index < 0 || index >= this.records.length) {
      return this;
    }
    return produce(this, (draft) => {
      draft.records[index] = new Record(model);
    }).sortRecord();
  }

  removeRecord(index: number) {
    if (index < 0 || index >= this.records.length) {
      return this;
    }
    return produce(this, (draft) => {
      draft.records.splice(index, 1);
      draft.recordReferenceSignature = newRecordReferenceSignature();
    });
  }

  updateSettings(recipe: (draft: Draft<SettingsModel>) => void) {
    return produce(this, (draft) => {
      recipe(draft.settings);
    });
  }

  rescaleAllRecords(oldHoursPerUnit: number, newHoursPerUnit: number) {
    const factor = oldHoursPerUnit / newHoursPerUnit;
    if (!Number.isFinite(factor) || factor <= 0) {
      return this;
    }
    return produce(this, (draft) => {
      for (let i = 0; i < draft.records.length; ++i) {
        draft.records[i].model.duration *= factor;
      }
    });
  }

  // Note: This reads the current state, not draft.
  private makeDummyChild(
    actionID: number,
    parentID: number,
    model: Omit<ActionModel, 'id'>,
    draft: Draft<DataState>,
    parent: Draft<Action>
  ) {
    // We want to move records on the parent to a dummy child since actions
    // with children cannot have records.
    let parentHasRecord = false;
    const numRecords = this.records.length;
    for (let i = 0; i < numRecords; ++i) {
      if (this.records[i].model.actionID === parentID) {
        parentHasRecord = true;
        break;
      }
    }
    if (parentHasRecord) {
      let otherChildID: ActionID;
      if (
        model.name.trim().toLowerCase() ===
        OTHER_CHILD_NAME.trim().toLowerCase()
      ) {
        otherChildID = actionID;
      } else {
        otherChildID = draft.nextActionID;
        draft.nextActionID += 1;
        parent.childIDs.push(otherChildID);
        draft.actions.set(
          otherChildID,
          new Action({
            color: generateColor(),
            name: OTHER_CHILD_NAME,
            parentID,
            id: otherChildID,
          })
        );
      }

      for (let i = 0; i < numRecords; ++i) {
        if (this.records[i].model.actionID === parentID) {
          draft.records[i].model.actionID = otherChildID;
        }
      }
    }
  }

  static validateActionName(name: string) {
    return (
      name === name.trim() &&
      name.length > 0 &&
      name.search(ILLEGAL_ACTION_NAME_CHARACTERS) === -1
    );
  }

  addAction(model: Omit<ActionModel, 'id'>) {
    if (!DataState.validateActionName(model.name)) {
      throw new Error(`Invalid action name: ${model.name}`);
    }
    const newID = this.nextActionID;
    return produce(this, (draft) => {
      // TODO validation
      draft.nextActionID += 1;
      if (model.parentID === undefined) {
        throw new Error('model.parentID is undefined');
      }
      const parentID = model.parentID;
      const parent = draft.actions.get(parentID);
      if (parent === undefined) {
        throw new Error('parent is undefined');
      }
      const parentIsLeaf = parent.isLeaf;
      parent.childIDs.push(newID);
      draft.actions.set(newID, new Action({ ...model, id: newID }));
      if (parentIsLeaf) {
        this.makeDummyChild(newID, parentID, model, draft, parent);
      }
    });
  }

  updateAction(model: ActionModel): DataState {
    if (!DataState.validateActionName(model.name)) {
      throw new Error(`Invalid action name: ${model.name}`);
    }
    const actionID = model.id;
    return produce(this, (draft) => {
      // TODO validation
      const oldAction = draft.actions.get(actionID);
      if (oldAction === undefined) {
        throw new Error('Old action undefined');
      }
      const oldParentID = oldAction.model.parentID;
      if (oldParentID === undefined) {
        throw new Error('Old parent ID is undefined');
      }
      const newParentID = model.parentID;
      if (newParentID === undefined) {
        throw new Error('newParentID is undefined');
      }
      const oldParent = draft.actions.get(oldParentID);
      if (oldParent === undefined) {
        throw new Error('Old parent is undefined');
      }
      oldAction.model = { ...model };
      if (newParentID !== oldParentID) {
        const newParent = draft.actions.get(newParentID);
        if (newParent === undefined) {
          throw new Error('newParent is undefined');
        }
        const parentIsLeaf = newParent.isLeaf;
        oldParent.childIDs.splice(oldParent.childIDs.indexOf(actionID), 1);
        newParent.childIDs.push(actionID);
        if (parentIsLeaf) {
          this.makeDummyChild(actionID, newParentID, model, draft, newParent);
        }
      }
    });
  }

  removeAction(id: ActionID) {
    const action = this.actions.get(id);
    if (action === undefined || action.isRoot) return this;

    const childrenID = [] as ActionID[];
    const childrenIDSet = new Set<ActionID>();
    const dfs = (a: Action) => {
      childrenID.push(a.model.id);
      childrenIDSet.add(a.model.id);
      for (const childID of a.childIDs) {
        const child = this.actions.get(childID);
        if (child !== undefined) {
          dfs(child);
        }
      }
    };
    dfs(action);

    return produce(this, (draft) => {
      const parent =
        action.model.parentID === undefined
          ? undefined
          : draft.actions.get(action.model.parentID);
      if (parent !== undefined) {
        const idx = parent.childIDs.indexOf(id);
        if (idx >= 0) {
          parent.childIDs.splice(idx, 1);
        }
      }

      for (const childID of childrenID) {
        draft.actions.delete(childID);
      }

      draft.records = this.records.filter(
        (record) => !childrenIDSet.has(record.model.actionID)
      );
    });
  }

  toModel() {
    const model: DataModel = {
      settings: this.settings,
      actions: [],
      records: [],
    };

    this.actions.forEach((action) => {
      // Do not include the root action.
      if (action.isRoot) return;
      model.actions.push(action.model);
    });

    this.records.forEach((record) => {
      model.records.push(record.model);
    });

    return model;
  }

  static fromModel(model: DataModel, filePath?: string) {
    const actions = new Map<ActionID, Action>();
    const records: Record[] = [];

    actions.set(ROOT_ACTION_ID, this.createRootAction());

    for (const actionModel of model.actions) {
      if (actionModel.id < MIN_ACTION_ID) {
        throw new Error(
          `Action [${actionModel.name}] has invalid action ID ${actionModel.id}`
        );
      }
      if (actions.has(actionModel.id)) {
        throw new Error(
          `Action [${actionModel.name}] has action ID ${actionModel.id} which already exists`
        );
      }
      actions.set(actionModel.id, new Action(actionModel));
    }
    // Reconcile children information
    for (const actionModel of model.actions) {
      if (actionModel.parentID !== undefined) {
        const parent = actions.get(actionModel.parentID);
        if (parent === undefined) {
          throw new Error(
            `Action [${actionModel.name}] has invalid parent ID ${actionModel.parentID}`
          );
        }
        parent.childIDs.push(actionModel.id);
      }
    }

    if (!this.isTree(actions)) {
      throw new Error(`Actions is not a valid tree.`);
    }

    for (const recordModel of model.records) {
      if (recordModel.duration < 0) {
        throw new Error(
          `Record at ${recordModel.time} has invalid duration ${recordModel.duration}`
        );
      }
      if (!actions.has(recordModel.actionID)) {
        throw new Error(
          `Record at ${recordModel.time} has invalid action ID ${recordModel.actionID}`
        );
      }
      records.push(new Record(recordModel));
    }

    records.sort((a, b) => {
      return a.model.time.seconds - b.model.time.seconds;
    });

    return new DataState(actions, records, model.settings, filePath);
  }

  dfs(
    actionID: ActionID,
    fns: {
      preOrder?: (action: Action, level: number) => void;
      postOrder?: (action: Action, level: number) => void;
    },
    level = 0
  ) {
    const action = this.actions.get(actionID);
    if (action === undefined) return;
    fns.preOrder?.(action, level);
    for (const childID of action.childIDs) {
      this.dfs(childID, fns, level + 1);
    }
    fns.postOrder?.(action, level);
  }

  static createEmpty(filePath?: string) {
    return new DataState(
      new Map<ActionID, Action>([[ROOT_ACTION_ID, this.createRootAction()]]),
      [],
      DEFAULT_SETTINGS,
      filePath
    );
  }

  private static createRootAction() {
    return new Action({
      id: ROOT_ACTION_ID,
      name: `All`,
      parentID: undefined,
      color: Color('#888888'),
    });
  }

  private static isTree(actions: Map<ActionID, Action>) {
    const visited = new Set<ActionID>();
    const dfs = (action: Action) => {
      if (visited.has(action.model.id)) {
        return false;
      }
      visited.add(action.model.id);
      for (const childID of action.childIDs) {
        const child = actions.get(childID);
        if (child !== undefined) {
          if (!dfs(child)) return false;
        }
      }
      return true;
    };
    return dfs(actions.get(ROOT_ACTION_ID)!);
  }
}
