# Simple Evaluate

[![NPM version][npm-image]][npm-url]
[![build status][travis-image]][travis-url]
[![Test coverage][coveralls-image]][coveralls-url]
[![npm download][download-image]][download-url]

[npm-image]: http://img.shields.io/npm/v/simpleql.svg?style=flat-square
[npm-url]: http://npmjs.org/package/simpleql
[download-image]: https://img.shields.io/npm/dm/simpleql.svg?style=flat-square
[download-url]: https://npmjs.org/package/simpleql
[travis-image]: https://img.shields.io/travis/shepherdwind/simpleql.svg?style=flat-square
[travis-url]: https://travis-ci.org/shepherdwind/simpleql
[coveralls-image]: https://img.shields.io/coveralls/shepherdwind/simpleql.svg?style=flat-square
[coveralls-url]: https://coveralls.io/r/shepherdwind/simpleql?branch=master


A simple query language, just like grathql, but much simple.

### Usage

```js
import { parse } from 'simpleql';
const astTree = parse(`
  $root: Member {
    honourMember: member,
    payerStatus,
  },
  foo: All,
  clause: Fengdie(path: insmutual_clause, base: $foo),
  latest: Fengdie(insxhbbff_old_upgrade),
`);
```
