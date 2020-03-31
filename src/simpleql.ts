
export const parse = (input: string) => {
  const parse = new Parser(input);
  return parse.getTokens();
};

const isEmpty = (str: string) => /\s/.test(str);

enum KeyWord {
  SEMICOLON = ':',
  BRACE_LEFT = '{',
  BRACE_RIGHT = '}',
  COMMA = ',',
  NEW_LINE = '\n',
  PIPE = '|',
  PARAM_START = '(',
  PARAM_END = ')',
  SQUARE_BRACKET_LEFT = '[',
  SQUARE_BRACKET_RIGHT = ']',
}

const opTable = new Set<string>();

for (const key of Object.keys(KeyWord)) {
  opTable.add((KeyWord as any)[key]);
}

interface Param {
  key: string;
  value?: string | string[];
}
interface Processor {
  name: string;
  params: Array<string | string[]>;
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
    processors?: Processor[];
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
        if (this.matchNextNotEmptyToken([ KeyWord.COMMA, KeyWord.NEW_LINE ])) {
          this.nextToken();
        }
        return { ended: false, node };
      case KeyWord.COMMA:
      case KeyWord.NEW_LINE:
        return { ended: this.matchNextNotEmptyToken(KeyWord.BRACE_RIGHT), node };
      default:
        return { ended: false, node };
    }
  }

  private parseProcessorList() {
    const processors: Processor[] = [];
    this.nextToken();

    let hasNext = true;
    do {
      const value = this.readValue();
      const processor: Processor = { name: value, params: [] };
      processors.push(processor);

      if (this.matchNextNotEmptyToken([KeyWord.PARAM_START])) {
        this.nextToken();
        processor.params = this.parseProcessorParams();
      }
      if (this.matchNextNotEmptyToken([KeyWord.PIPE])) {
        this.nextToken();
        hasNext = true;
      } else {
        hasNext = false;
      }
    } while (hasNext);

    return processors;
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

    switch (tok) {
      case KeyWord.PARAM_START:
        this.nextToken();
        type.param = this.parseParams();
        if (this.matchNextNotEmptyToken([ KeyWord.PIPE ])) {
          type.processors = this.parseProcessorList();
        }
        break;
      case KeyWord.PIPE:
        type.processors = this.parseProcessorList();
        return type;
      case KeyWord.BRACE_LEFT:
      case KeyWord.COMMA:
      case KeyWord.NEW_LINE:
      case undefined:
        return type;
      default:
        this.throwPraseError(tok);
    }

    return type;
  }

  private parseProcessorParams() {
    let hasNext = true;
    const params: Processor['params'] = [];
    const value = this.readParamValue();
    params.push(value);
    do {
      const tok = this.nextToken();
      switch (tok) {
        // 遇到括号结束，参数部分结束
        case KeyWord.PARAM_END:
          hasNext = false;
          break;
        // 遇到分号，value 部分开始
        case KeyWord.COMMA: {
          const value = this.readParamValue();
          params.push(value);
          break;
        }

        // 默认情况，解析错误，位置字符
        default:
          this.throwPraseError(tok);
      }
    } while (hasNext);
    return params;
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
          param.value = this.readParamValue();
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

  private readParamValue() {
    if (this.matchNextNotEmptyToken([ '"', '\'' ])) {
      return this.readString();
    }

    const value = this.readValue();
    if (!this.matchNextNotEmptyToken(KeyWord.SQUARE_BRACKET_LEFT)) {
      return value;
    }
    // $xx[$$xxx.id] 暂时只支持一层解析
    this.nextToken();
    const next = this.readValue();
    const tok = this.nextToken();
    if (tok !== KeyWord.SQUARE_BRACKET_RIGHT) {
      this.throwPraseError(tok);
    }
    return [ value, next ]
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

  private matchNextNotEmptyToken(token: string | string[]) {
    if (Array.isArray(token)) {
      return token.indexOf(this.nextToken(0, false)) > -1;
    }
    return this.nextToken(0, false) === token;
  }

  private readString() {
    let tok = '';
    const first = this.nextToken();
    let index = 0;
    do {
      tok = this.input[index + this.nextIndex];
      index += 1;
      if (tok === undefined) {
        this.throwPraseError(tok);
      }
    } while (tok !== first);

    return first + this.receiveToken(index);
  }

  private nextToken(index = 0, move = true) {
    let tok = '';
    do {
      tok = this.input[index + this.nextIndex];
      index += 1;
    } while (!opTable.has(tok) && tok && !tok.trim());

    if (move) {
      this.nextIndex += index;
      // 如果遇到逗号，后面的换行符直接过滤，防止冲突
      if (tok === KeyWord.COMMA) {
        this.skipEmpty();
      }
    }
    return tok;
  }

  /**
   * 一直读取属性的值，直到遇到下一个关键字
   * @param tok
   */
  private readValue() {
    // 去除前面的空白
    this.skipEmpty();

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
    const value = this.receiveToken(index - 1);
    return value;
  }

  private skipEmpty() {
    let tok;
    do {
      tok = this.pickNext();
      if (!isEmpty(tok)) {
        break;
      }
      this.nextIndex += 1;
    } while (true)
  }

  private throwPraseError(tok: string): never {
    const start = Math.max(0, this.nextIndex - 50);
    // 读取 50 个字符
    const errorLine = this.input.slice(start, this.nextIndex + 1).trim();
    const empty = new Array(errorLine.length - 1).fill(' ');
    const errorSubLine =  empty.join('') + '^';
    const error = new Error(`Unexpected token '${tok}' at \n ${errorLine} \n ${errorSubLine}`);
    error.name = 'TokenParseError';
    throw error;
  }
}
