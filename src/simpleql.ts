
export const parse = (input: string) => {
  const parse = new Parser(input);
  return parse.getTokens();
};

enum KeyWord {
  SEMICOLON = ':',
  BRACE_LEFT = '{',
  BRACE_RIGHT = '}',
  COMMA = ',',
  PIPE = '|',
  PARAM_START = '(',
  PARAM_END = ')',
}
const opTable = new Set<string>();

for (const key of Object.keys(KeyWord)) {
  opTable.add((KeyWord as any)[key]);
}

interface Param {
  key: string;
  value?: string;
}
/**
 * 解析语法后得到的 ast 结构，比如
 * $root:Member {
 *   status: payerStatus,
 * }
 * =>
 * [ { name: '$root', type: 'Member', props: [ { name: 'payStatus', mapName: 'status' } ] } ]
 *
 * 语法表示从 Member 结构中读取 payerStatus，赋值给 status 属性
 */
export interface AstTree {
  name: string;
  // 直接一个属性映射
  field?: string;
  // 类型声明
  type?: {
    name: string;
    param?: Param[];
  };
  props?: AstTree[];
}

class Parser {
  private input = '';
  private nextIndex = 0;

  constructor(input: string) {
    this.input = input;
  }

  getTokens() {
    const astList: AstTree[] = [];
    let hasNext = true;
    do {
      const { ended, node } = this.parseStatement();
      hasNext = !ended;
      if (node) {
        astList.push(node);
      }
    } while (hasNext);
    return astList;
  }

  private parseStatement() {
    const name = this.readValue();
    if (!name) {
      return { ended: true, node: null };
    }

    const node: AstTree = {
      name,
    };

    let tok = this.nextToken();

    if (tok === KeyWord.SEMICOLON) {
      const type = this.readType();
      if (typeof type === 'string') {
        node.field = type;
      } else {
        node.type = type;
      }

      tok = this.nextToken();
    }

    switch (tok) {
      case KeyWord.BRACE_LEFT:
        node.props = this.getTokens();
        tok = this.nextToken();
        if (tok !== KeyWord.BRACE_RIGHT) {
          this.throwPraseError(tok);
        }
        // }, 模式，大括号结束部分支持逗号，直接忽略
        if (this.matchNextNotEmptyToken(KeyWord.COMMA)) {
          this.nextToken();
        }
        return { ended: false, node };
      case KeyWord.COMMA:
        return { ended: this.matchNextNotEmptyToken(KeyWord.BRACE_RIGHT), node };
      default:
        return { ended: false, node };
    }
  }

  private readType() {
    const value = this.readValue();
    if (!value) {
      this.throwPraseError('');
    }
    // 小写，直接返回
    if (value[0] > 'a') {
      return value;
    }
    const tok = this.pickNext();
    const type: AstTree['type'] = { name: value };

    if (tok === KeyWord.PARAM_START) {
      this.nextToken();
      type.param = this.parseParams();
    } else if (tok === KeyWord.BRACE_LEFT || tok === KeyWord.COMMA || tok === undefined) {
      return type;
    } else {
      this.throwPraseError(tok);
    }

    return type;
  }

  /**
   * 参数处理 Contract(id: foo)
   */
  private parseParams() {
    let hasNext = true;
    const params: Param[] = [];
    do {
      const key = this.readValue();
      const param: Param = { key };
      const tok = this.nextToken();
      switch (tok) {
        // 遇到括号结束，参数部分结束
        case KeyWord.PARAM_END:
          hasNext = false;
          params.push(param);
          break;
        // 遇到分号，value 部分开始
        case KeyWord.SEMICOLON: {
          param.value = this.readValue();
          params.push(param);

          const next = this.nextToken();
          // 遇到逗号，下一个参数开始，继续执行
          hasNext = next === KeyWord.COMMA;
          if (next !== KeyWord.COMMA && next !== KeyWord.PARAM_END) {
            this.throwPraseError(next);
          }
          break;
        }

        // 默认情况，解析错误，位置字符
        default:
          this.throwPraseError(tok);
      }
    } while (hasNext);
    return params;
  }

  private receiveToken(index = 1) {
    const tok = this.input.slice(this.nextIndex, this.nextIndex + index).trim();
    this.nextIndex += index;
    return tok;
  }

  /**
   * 查询下一个 token ，但是不移动索引
   * @param index
   */
  private pickNext(index = 0) {
    return this.input[index + this.nextIndex];
  }

  private matchNextNotEmptyToken(token: string) {
    return this.nextToken(0, false) === token;
  }

  private nextToken(index = 0, move = true) {
    let tok = '';
    do {
      tok = this.input[index + this.nextIndex];
      index += 1;
    } while (tok && !tok.trim());

    if (move) {
      this.nextIndex += index;
    }
    return tok;
  }

  /**
   * 一直读取属性的值，直到遇到下一个关键字
   * @param tok
   */
  private readValue() {
    let tok = this.pickNext();
    if (!tok) {
      return '';
    }

    if (opTable.has(tok)) {
      this.throwPraseError(tok);
    }

    let index = 0;
    while (!opTable.has(tok) && tok !== undefined) {
      tok = this.pickNext(index);
      index += 1;
    }
    return this.receiveToken(index - 1);
  }

  private throwPraseError(tok: string): never {
    // 读取 50 个字符
    const errorLine = this.input.slice(this.nextIndex - 50, this.nextIndex);
    const error = new Error(`token parse error, should not ${tok} at \n ${errorLine}`);
    error.name = 'TokenParseError';
    throw error;
  }
}
