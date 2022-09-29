import Color from 'color';
import { Time } from '../utils/time';
import {
  MIN_ACTION_ID,
  MIN_ACTION_ID_INCLUDING_ROOT,
  ROOT_ACTION_ID,
} from './data-state';

export type ActionID = number;

const ACTIONS_MARKER = '[ACTIONS]';

const RECORDS_MARKER = '[RECORDS]';

enum ParsingMode {
  ACTIONS,
  RECORDS,
}

export interface ActionModel {
  readonly id: ActionID;
  readonly name: string;
  readonly parentID?: ActionID;
  readonly color: Color;
}

export interface RecordModel {
  readonly time: Time;
  readonly actionID: ActionID;
  readonly duration: number;
}

export interface DataModel {
  readonly actions: ActionModel[];
  readonly records: RecordModel[];
}

export class DataModelReader {
  read(text: string): DataModel {
    const model: DataModel = {
      actions: [],
      records: [],
    };

    const lines = text.split('\n').filter((line) => line.length > 0);

    let parsingMode = ParsingMode.ACTIONS;

    const parentStack: [ActionID, number][] = [];

    for (const line of lines) {
      if (line.startsWith('[')) {
        if (line === ACTIONS_MARKER) {
          parsingMode = ParsingMode.ACTIONS;
        } else if (line === RECORDS_MARKER) {
          parsingMode = ParsingMode.RECORDS;
        }
      } else {
        if (parsingMode === ParsingMode.ACTIONS) {
          let indentCount = 0;
          while (indentCount < line.length && line[indentCount] === ' ') {
            indentCount += 1;
          }
          while (
            parentStack.length > 0 &&
            indentCount <= parentStack[parentStack.length - 1][1]
          ) {
            parentStack.pop();
          }
          const tokens = line
            .substring(indentCount)
            .trim()
            .split(',')
            .map((token) => token.trim());
          const id = this.parseActionID(tokens[0]);
          if (tokens.length === 4) {
            // Legacy parsing mode
            const name = tokens[1];
            const parentID =
              tokens[2].length === 0
                ? undefined
                : this.parseParentActionID(tokens[2]);
            const color = Color(tokens[3]);
            model.actions.push({ id, name, parentID, color });
          } else {
            const name = tokens[1];
            const parentID =
              parentStack.length > 0
                ? parentStack[parentStack.length - 1][0]
                : 0;
            const color = Color(tokens[2]);
            model.actions.push({ id, name, parentID, color });
          }
          parentStack.push([id, indentCount]);
        } else if (parsingMode === ParsingMode.RECORDS) {
          const tokens = line
            .trim()
            .split(',')
            .map((token) => token.trim());
          const time = this.parseTime(tokens[0]);
          const actionID = this.parseActionID(tokens[1]);
          const duration = this.parseDuration(tokens[2]);
          model.records.push({ actionID, time, duration });
        }
      }
    }

    return model;
  }

  parseActionID(token: string) {
    const id = parseInt(token, 10);
    if (Number.isNaN(id) || id < MIN_ACTION_ID) {
      throw new Error(`Invalid action ID: ${token}`);
    }
    return id;
  }

  parseParentActionID(token: string) {
    const id = parseInt(token, 10);
    if (Number.isNaN(id) || id < MIN_ACTION_ID_INCLUDING_ROOT) {
      throw new Error(`Invalid parent action ID: ${token}`);
    }
    return id;
  }

  parseTime(token: string) {
    const time = Time.fromString(token);
    if (time === undefined) {
      throw new Error(`Invalid time: ${token}`);
    }
    return time;
  }

  parseDuration(token: string) {
    const duration = parseInt(token, 10);
    if (Number.isNaN(duration) || duration < 0) {
      throw new Error(`Invalid duration: ${token}`);
    }
    return duration;
  }
}

export class DataModelWriter {
  write(model: DataModel): string {
    const lines: string[] = [];

    lines.push(ACTIONS_MARKER);

    const children = new Map<ActionID, ActionID[]>();
    const idToAction = new Map<ActionID, ActionModel>();
    for (const action of model.actions) {
      idToAction.set(action.id, action);
      if (action.parentID !== undefined) {
        if (children.has(action.parentID)) {
          children.get(action.parentID)?.push(action.id);
        } else {
          children.set(action.parentID, [action.id]);
        }
      }
    }
    const visited = new Set<ActionID>();
    const dfs = (id: ActionID, level: number) => {
      if (visited.has(id)) {
        throw new Error('Action list is not a tree');
      }
      visited.add(id);
      if (id !== ROOT_ACTION_ID) {
        const action = idToAction.get(id);
        if (action === undefined) {
          throw new Error('Undefined action');
        }
        lines.push(
          `${'  '.repeat(level - 1)}${action.id},${
            action.name
          },${action.color.hex()}`
        );
      }
      for (const childID of children.get(id) || []) {
        dfs(childID, level + 1);
      }
    };
    dfs(ROOT_ACTION_ID, 0);

    lines.push('');
    lines.push(RECORDS_MARKER);

    for (const record of model.records) {
      lines.push(
        `${record.time.toString()},${record.actionID},${record.duration}`
      );
    }

    return lines.join('\n');
  }
}
