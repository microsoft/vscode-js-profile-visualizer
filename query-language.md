# Query Language

Goals in having a query language for profiles include:

- Quick querying by humans
- Increasing accessibility by having a textual mode to express what you're looking for
- Ability to create Semmle-esque queries that match patterns in graphs for analysis

## Prior Art

A query language that operates on the true form of the profile is difficult. Locations in the source have multiple call frames, which have parent and children and might be touched multiple times over the course of the profile. It is kind of a 3D graph, with the time, call frame, and location as its axes. This model is hard to hold in one's head, and hard to query in its raw form, thus we have projections that flatten it to a 2D plane by eliminating location (creating the flame graph) or time (creating the bottom up or top down table, depending on perspective).

So at this point we have a 2D graph, which is more digestable to query. In both cases, one of our axes is call frames, which are recursive. And in all cases, we don't really want to let users transform the results, only filter, sort, and unroll them. That said, there are a few graph query languages:

- GraphQL is the big one (that has graph in the name!). But it doesn't support recursive structures that well.
- `jq` is a JSON query language, which can recurse, but is optimized around projection which we explicitly don't want here.
- neo4j's supports recursion, but its language will be esoteric to most JavaScript users
- Gremlin does what we need as well, and it has the advantage of being a fairly simple, fluent-esque syntax.

It seems that Gremlin is the best existing match for us. While there are client libraries for Gremlin in JavaScript, there doesn't appear to be a pure-JS or otherwise embeddable Gremlin server. So it seems like a good place to draw inspiration from, even if we can't use it directly.

### Query Language

Our query language, let's call it 'FlameQL', is JavaScript with helper functions. This is easy to handle in the JavaScript-based extension host, and should let us reuse existing language features. We can restrict the syntax if we want to make it run other places or be more sandboxable.

Operators are made available as global functions, like what Gremlin has: `eq(field, x)`, `neq(field, x)`, `lt(field, number)`, `lte(field, number)`, `gt(field, number)`, `gte(field, number)`, `contains(field, str)`, `match(field, str)`, `startsWith(field, str)`, `endsWith(field, str)`, `and(expr...)`, `or(expr...)`, `xor(expr...)`, `not(expr...)`, `asc(field)`, `desc(field)`.

Three global functions are made available for the three data projections: `bottomUp()`, `topDown()`, and `timeline()`. These 'return' an object stream of the top-level nodes for the projection--either locations or call frames. We intentionally don't have lambdas in order to make this more portable. The magic `v` value can be used to reference columns, for example `v.selfTime`.

- `has(operator)` selects nodes where the nested expression matches.
- `hasDeep(operator)` selects nodes where them or their child matches.
- `hasDeepest(operator)` selects nodes where the deepest child matches.
- `orderBy(operatorOrDirection, ...)` orders the results by the column. Multiple expressions can be passed, for example `.orderBy(asc(v.functionName), desc(v.selfTime)`.
- `limit(number)` limits the output results
- `skip(number)` skips results in the output

### Examples

Get the top-10 frames with the largest self time:

```js
bottomUp().orderBy(v.selfTime, desc()).limit(10)
```


Filter for any stacks containing a frame that has 'react' in it:

```js
bottomUp().hasDeep(contains(v.path, 'react')).limit(10)
```


Filter for any stacks containing a frame that has 'react' or 'redux' in it:

```js
bottomUp().hasDeep(or(
  contains(v.path, 'react'),
  contains(v.path, 'redux'),
).limit(10)
```

Filter for stacks where 'redux' caused a 'react' call:

```js
bottomUp().hasDeep(and(
  contains(v.path, 'redux'),
  hasDeep(contains(v.path, 'react')),
).limit(10)
```
