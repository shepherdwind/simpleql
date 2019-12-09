import { parse } from "../src/simpleql";
import 'should';
import { AssertionError } from "assert";

/**
 * Dummy test
 */
describe('simple query', () => {
  it('ok', function () {
    const astTree = parse(`
      $root: Member {
        honourMember: member,
        payerStatus,
      },
      foo: All,
      clause: Fengdie(path: insmutual_clause, base: $foo),
      latest: Fengdie(insxhbbff_old_upgrade),
    `);
    expect(astTree).toMatchSnapshot();
  });

  it('old patten', () => {
    const astTree = parse(`
      root: Member {
        honourMember,
        payerStatus
      }
      foo: All,
      clause: Fengdie {
        clause: insmutual_clause,
        latest: insxhbbff_old_upgrade,
      }
    `);
    expect(astTree).toMatchSnapshot();
  });

  it('no comma support', function () {
    const astTree = parse(`
      $root: Member {
        honourMember: member
        payerStatus
      }
      foo: All
      clause: Fengdie(path: insmutual_clause, base: $foo)
      latest: Fengdie(insxhbbff_old_upgrade)
    `);
    expect(astTree).toMatchSnapshot();
  });

  it('dependency logic', () => {
    const astTree = parse(`
      contract: Contract(foo)
      config: IopList(sceneCode: $sceneCodeMap[$$contract.planNo])
      data: IopData($if: "contract.name > 1 || contract.id === 12", bar: 'a > 1')
    `);
    expect(astTree).toMatchSnapshot();
  });

  it ('error', () => {
    expect(() => parse('root: Member { a: b ')).toThrow();
    expect(() => parse('root: Member{}')).toThrow();
    expect(() => parse('root: Member($if: "a > 1)')).toThrow();
    expect(() => parse('root: Member(code: $code[$$foo.bar)')).toThrow();
  });
});
