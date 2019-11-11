import { parse } from "../src/simpleql";
import 'should';

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
});
